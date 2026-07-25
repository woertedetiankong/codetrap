import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import type { CandidateTrap, CandidateTrapDocument, SessionIndexDocument, SessionIndexEntry, SessionMetadata, SessionNote } from "../domain/session";
import { parseSessionNoteKind, SESSION_VERSION } from "../domain/session";
import { CODETRAP_DIR } from "./constants";
import { CANDIDATE_SCHEMA_VERSION } from "../domain/candidate";
import type { Executor } from "../domain/learning";
import { migrateCandidates, type MigrateCandidateOptions } from "./candidate-envelope";
import { readJsonFile as readJsonFileRaw, writeFileAtomic } from "./fs-json";
import {
  acceptCandidateInDocument,
  addCandidateToDocument,
  approveCandidateInDocument,
  recordCandidateConflictCheckInDocument,
  rejectCandidateInDocument,
  removeCandidatesFromDocument,
  rollbackCandidateInDocument,
  saveCandidateTrapInDocument,
  type CandidateDocumentUpdateResult,
} from "./session-candidate-document";
import {
  ACTIVE_SESSION_FILE,
  CANDIDATES_FILE,
  createSessionId,
  formatImplementationNotesHeader,
  formatRecap,
  formatSessionNote,
  NOTES_FILE,
  noteCounts,
  parseSessionNotes,
  recapSummary,
  RECAP_FILE,
  sessionIndexEntry,
  sessionRelativeDir,
  SESSION_FILE,
  SESSION_INDEX_FILE,
  sessionRelativeFile,
  SESSIONS_DIR,
} from "./session-codec";
import { uniqueStrings } from "./string-list";
import { mergeCandidateTraps, proposeCandidateTraps, type CandidateDraft } from "./session-capture";

export interface StartSessionArgs {
  goal: string;
  specRef?: string | null;
  module?: string | null;
  owner?: string | null;
}

export interface AddSessionNoteArgs {
  kind?: string;
  text: string;
  relatedFiles?: string[];
  sourceRef?: string | null;
}

export interface CloseSessionResult {
  session: SessionMetadata;
  recap_path: string;
  candidate_count: number;
}

export interface CloseSessionOptions {
  /** Drops note-derived candidates whose lesson the user already suppressed. */
  isSuppressed?: (candidate: CandidateTrap) => boolean;
}

export interface AcceptCandidateResult {
  session: SessionMetadata;
  candidate: CandidateTrap;
  trap_id: number;
  scope: string;
  evidence_id: number | null;
  superseded_id: number | null;
}

export interface DeleteSessionResult {
  session_id: string;
  deleted: boolean;
  active_cleared: boolean;
  session_dir: string;
}

export interface PruneSessionsResult {
  cutoff: string;
  dry_run: boolean;
  deleted_count: number;
  sessions: {
    id: string;
    goal: string;
    status: string;
    created_at: string;
    closed_at: string | null;
  }[];
}

export interface RemoveSessionCandidatesResult {
  session: SessionMetadata;
  removed_count: number;
  removed_candidate_ids: string[];
  candidates: CandidateTrap[];
}

export interface AddSessionCandidateArgs {
  sessionId: string;
  draft: CandidateDraft;
}

/**
 * Refuse a document written by a newer codetrap rather than silently dropping
 * the fields this build does not know about — the same guard src/db/schema.ts
 * applies to the trap database.
 */
export function assertReadableCandidateVersion(version: number | undefined, path: string): void {
  const found = typeof version === "number" ? version : CANDIDATE_SCHEMA_VERSION;
  if (found > CANDIDATE_SCHEMA_VERSION) {
    throw new Error(
      `Candidate file ${path} is schema version ${found}, newer than this codetrap build (supports up to ${CANDIDATE_SCHEMA_VERSION}). Upgrade codetrap.`
    );
  }
}

const SAFE_SESSION_ID = /^[A-Za-z0-9._-]+$/;

export function assertSafeSessionId(id: string): void {
  if (!SAFE_SESSION_ID.test(id) || id === "." || id === "..") {
    throw new Error(`Invalid session id: ${id}`);
  }
}

const LOCK_DIR = ".lock";
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_MS = 25;

export class SessionStore {
  private migrateOptions: MigrateCandidateOptions = {};

  constructor(private readonly projectRoot: string) {}

  /**
   * Supplies the trap-existence probe the §8.3 mapping needs. Set by
   * SessionOperations, which owns the trap store; the SessionStore alone cannot
   * answer "does trap #N still exist".
   */
  useMigrateOptions(options: MigrateCandidateOptions): void {
    this.migrateOptions = options;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  startSession(args: StartSessionArgs, now = new Date()): SessionMetadata {
    const goal = args.goal.trim();
    if (!goal) throw new Error("Session goal is required.");

    return this.withLock(() => {
      const active = this.activeSession();
      if (active) {
        throw new Error(`Session ${active.id} is already active. Close it before starting another session.`);
      }

      const id = createSessionId(goal, now, (candidate) => existsSync(this.sessionDir(candidate)));
      const createdAt = now.toISOString();
      const session: SessionMetadata = {
        version: SESSION_VERSION,
        id,
        goal,
        status: "active",
        created_at: createdAt,
        updated_at: createdAt,
        closed_at: null,
        scope: "project",
        project_path: this.projectRoot,
        module: args.module ?? null,
        owner: args.owner ?? null,
        spec_ref: args.specRef ?? null,
        notes_path: NOTES_FILE,
        recap_path: RECAP_FILE,
        candidate_traps_path: CANDIDATES_FILE,
      };

      // Non-recursive: if the directory exists despite the id check above,
      // fail loudly instead of silently sharing it with another session.
      mkdirSync(this.sessionDir(id), { recursive: false });
      this.writeSession(session);
      writeFileAtomic(this.notesPath(id), formatImplementationNotesHeader(session));
      this.writeIndexEntry(session, [], [], null);
      this.writeActive(id);
      return session;
    });
  }

  addNote(args: AddSessionNoteArgs, now = new Date()): { session: SessionMetadata; note: SessionNote; notes_path: string } {
    const text = args.text.trim();
    if (!text) throw new Error("Session note text is required.");

    return this.withLock(() => {
      const session = this.requireActiveSession();
      const note: SessionNote = {
        created_at: now.toISOString(),
        kind: parseSessionNoteKind(args.kind),
        text,
        related_files: uniqueStrings(args.relatedFiles ?? []),
        source_ref: args.sourceRef ?? null,
      };

      appendFileSync(this.notesPath(session.id), formatSessionNote(note));
      const updated = { ...session, updated_at: note.created_at };
      this.writeSession(updated);
      this.writeIndexEntry(updated, this.readNotes(updated.id), this.readCandidateDocument(updated.id).candidates, null);
      return {
        session: updated,
        note,
        notes_path: sessionRelativeFile(updated.id, NOTES_FILE),
      };
    });
  }

  status(): { active_session_id: string | null; session: SessionMetadata | null } {
    const active = this.activeSession();
    return {
      active_session_id: active?.id ?? null,
      session: active,
    };
  }

  listSessions(args: { status?: string; limit?: number } = {}) {
    const status = args.status ?? "all";
    if (!["active", "closed", "all"].includes(status)) {
      throw new Error("Invalid session status. Expected active, closed, or all.");
    }
    const sessions = this.readIndex().sessions
      .filter((entry) => status === "all" || entry.status === status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return typeof args.limit === "number" ? sessions.slice(0, args.limit) : sessions;
  }

  getSession(id: string): SessionMetadata {
    return this.requireSession(id);
  }

  showSession(id: string): { session: SessionMetadata; recap: string | null; notes_path: string; session_dir: string } {
    const session = this.requireSession(id);
    return {
      session,
      recap: this.readOptionalText(this.recapPath(id)),
      notes_path: sessionRelativeFile(id, NOTES_FILE),
      session_dir: join(".codetrap", SESSIONS_DIR, id),
    };
  }

  summarizeNotes(id?: string): {
    session: SessionMetadata;
    notes_path: string;
    content: string;
    notes: SessionNote[];
    note_counts: ReturnType<typeof noteCounts>;
    latest_notes: { created_at: string; kind: string; text: string; related_files: string[] }[];
  } {
    const session = this.requireSession(this.resolveSessionId(id));
    const content = this.readOptionalText(this.notesPath(session.id)) ?? "";
    const notes = parseSessionNotes(content);
    return {
      session,
      notes_path: sessionRelativeFile(session.id, NOTES_FILE),
      content,
      notes,
      note_counts: noteCounts(notes),
      latest_notes: notes.slice(-3).reverse().map((note) => ({
        created_at: note.created_at,
        kind: note.kind,
        text: note.text,
        related_files: note.related_files,
      })),
    };
  }

  closeSession(
    id: string | undefined,
    proposeTraps: boolean,
    now = new Date(),
    options: CloseSessionOptions = {}
  ): CloseSessionResult {
    return this.withLock(() => {
      const session = this.requireSession(this.resolveSessionId(id, { requireActive: id === undefined }));
      if (session.status === "closed") throw new Error(`Session ${session.id} is already closed.`);

      const closedAt = now.toISOString();
      const notes = this.readNotes(session.id);
      const existingCandidates = this.readCandidateDocument(session.id).candidates;
      // A suppressed lesson must not come back through close --propose-traps
      // either; the note that produced it is still in the session (§16 1A).
      // Only computed under --propose-traps: a plain close must not read the
      // suppression index at all, let alone fail on it.
      const candidates = proposeTraps
        ? mergeCandidateTraps(existingCandidates, this.proposeUnsuppressed(session, notes, options))
        : existingCandidates;
      if (proposeTraps) this.writeCandidateDocument(session.id, candidates);

      const updated = {
        ...session,
        status: "closed" as const,
        closed_at: closedAt,
        updated_at: closedAt,
      };
      this.writeSession(updated);
      // L21: the notes header is written once at start with "Status: active";
      // refresh it on close so implementation-notes.md doesn't claim the session
      // is still active forever.
      this.rewriteNotesHeaderStatus(updated);
      writeFileAtomic(this.recapPath(updated.id), formatRecap(updated, notes, candidates));
      this.writeIndexEntry(updated, notes, candidates, recapSummary(updated, notes, candidates));
      if (this.readActive()?.active_session_id === updated.id) this.clearActive();

      return {
        session: updated,
        recap_path: sessionRelativeFile(updated.id, RECAP_FILE),
        candidate_count: candidates.length,
      };
    });
  }

  candidateDocument(id?: string): CandidateTrapDocument {
    const sessionId = this.resolveSessionId(id);
    return this.readCandidateDocument(sessionId);
  }

  getCandidate(candidateId: string, sessionId?: string): { session: SessionMetadata; candidate: CandidateTrap } {
    const resolvedSessionId = this.resolveSessionId(sessionId);
    const session = this.requireSession(resolvedSessionId);
    const candidate = this.findCandidate(resolvedSessionId, candidateId);
    return { session, candidate };
  }

  addCandidate(args: AddSessionCandidateArgs): { session: SessionMetadata; candidate: CandidateTrap; candidates_path: string; duplicate: boolean } {
    return this.withLock(() => {
      const session = this.requireSession(args.sessionId);
      const document = this.readCandidateDocument(session.id);
      const added = addCandidateToDocument(document.candidates, args.draft);
      if (!added.duplicate) {
        this.writeCandidateDocument(session.id, added.candidates);
        this.refreshSessionSummaries(session.id);
      }
      return {
        session: this.requireSession(session.id),
        candidate: added.candidate,
        candidates_path: sessionRelativeFile(session.id, CANDIDATES_FILE),
        duplicate: added.duplicate,
      };
    });
  }

  recordCandidateConflictCheck(
    candidateId: string,
    args: {
      sessionId?: string;
      trap?: CandidateTrap["trap"];
      conflictStatus: CandidateTrap["quality"]["conflict_status"];
      suggestedAction: CandidateTrap["quality"]["suggested_action"];
    }
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    return this.withLock(() => {
      const sessionId = this.resolveSessionId(args.sessionId);
      const session = this.requireSession(sessionId);
      const document = this.readCandidateDocument(sessionId);
      return this.saveCandidateDocumentMutation(session, recordCandidateConflictCheckInDocument(
        document.candidates,
        candidateId,
        {
          sessionId,
          trap: args.trap,
          conflictStatus: args.conflictStatus,
          suggestedAction: args.suggestedAction,
        }
      ));
    });
  }

  saveCandidateTrap(
    candidateId: string,
    args: {
      sessionId?: string;
      trap: CandidateTrap["trap"];
    }
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    return this.withLock(() => {
      const sessionId = this.resolveSessionId(args.sessionId);
      const session = this.requireSession(sessionId);
      const document = this.readCandidateDocument(sessionId);
      return this.saveCandidateDocumentMutation(session, saveCandidateTrapInDocument(
        document.candidates,
        candidateId,
        { sessionId, trap: args.trap }
      ));
    });
  }

  acceptCandidate(
    candidateId: string,
    args: {
      sessionId?: string;
      trap?: CandidateTrap["trap"];
      trapId: number;
      scope: string;
      evidenceId: number | null;
      supersededId?: number | null;
      conflictChecked?: boolean;
      conflictStatus?: CandidateTrap["quality"]["conflict_status"];
      suggestedAction?: CandidateTrap["quality"]["suggested_action"];
    },
    now = new Date()
  ): AcceptCandidateResult {
    return this.withLock(() => {
      const sessionId = this.resolveSessionId(args.sessionId);
      const session = this.requireSession(sessionId);
      const document = this.readCandidateDocument(sessionId);
      const accepted = this.saveCandidateDocumentMutation(session, acceptCandidateInDocument(
        document.candidates,
        candidateId,
        {
          sessionId,
          trap: args.trap,
          trapId: args.trapId,
          scope: args.scope,
          conflictChecked: args.conflictChecked,
          conflictStatus: args.conflictStatus,
          suggestedAction: args.suggestedAction,
        },
        now
      ));

      return {
        session,
        candidate: accepted.candidate,
        trap_id: args.trapId,
        scope: args.scope,
        evidence_id: args.evidenceId,
        superseded_id: args.supersededId ?? null,
      };
    });
  }

  approveCandidate(
    candidateId: string,
    args: { sessionId?: string; authorizedScope: string; executor: Executor },
    now = new Date()
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    return this.withLock(() => {
      const sessionId = this.resolveSessionId(args.sessionId);
      const session = this.requireSession(sessionId);
      const document = this.readCandidateDocument(sessionId);
      return this.saveCandidateDocumentMutation(session, approveCandidateInDocument(
        document.candidates,
        candidateId,
        { sessionId, authorizedScope: args.authorizedScope, executor: args.executor },
        now
      ));
    });
  }

  rejectCandidate(
    candidateId: string,
    args: { sessionId?: string; reason?: string | null },
    now = new Date()
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    return this.withLock(() => {
      const sessionId = this.resolveSessionId(args.sessionId);
      const session = this.requireSession(sessionId);
      const document = this.readCandidateDocument(sessionId);
      return this.saveCandidateDocumentMutation(session, rejectCandidateInDocument(
        document.candidates,
        candidateId,
        { sessionId, reason: args.reason },
        now
      ));
    });
  }

  rollbackCandidate(
    candidateId: string,
    args: { sessionId?: string }
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    return this.withLock(() => {
      const sessionId = this.resolveSessionId(args.sessionId);
      const session = this.requireSession(sessionId);
      const document = this.readCandidateDocument(sessionId);
      return this.saveCandidateDocumentMutation(session, rollbackCandidateInDocument(
        document.candidates,
        candidateId,
        { sessionId }
      ));
    });
  }

  removeCandidates(sessionId: string | undefined, candidateIds: string[]): RemoveSessionCandidatesResult {
    return this.withLock(() => {
      const resolvedSessionId = this.resolveSessionId(sessionId);
      const session = this.requireSession(resolvedSessionId);
      const document = this.readCandidateDocument(session.id);
      const removed = removeCandidatesFromDocument(document.candidates, candidateIds);
      if (removed.removed.length > 0) {
        this.writeCandidateDocument(session.id, removed.candidates);
        this.refreshSessionSummaries(session.id);
      }

      return {
        session,
        removed_count: removed.removed.length,
        removed_candidate_ids: removed.removed.map((candidate) => candidate.id),
        candidates: removed.candidates,
      };
    });
  }

  deleteSession(id: string): DeleteSessionResult {
    return this.withLock(() => this.deleteSessionLocked(id));
  }

  pruneSessions(args: { cutoff: Date; dryRun?: boolean }): PruneSessionsResult {
    return this.withLock(() => {
      const cutoffTime = args.cutoff.getTime();
      const candidates = this.readIndex().sessions
        .filter((entry) => entry.status === "closed")
        .filter((entry) => {
          const closedAt = entry.closed_at ? Date.parse(entry.closed_at) : Date.parse(entry.created_at);
          return Number.isFinite(closedAt) && closedAt < cutoffTime;
        });

      if (!args.dryRun) {
        for (const session of candidates) {
          this.deleteSessionLocked(session.id);
        }
      }

      return {
        cutoff: args.cutoff.toISOString(),
        dry_run: args.dryRun ?? false,
        deleted_count: args.dryRun ? 0 : candidates.length,
        sessions: candidates.map((session) => ({
          id: session.id,
          goal: session.goal,
          status: session.status,
          created_at: session.created_at,
          closed_at: session.closed_at,
        })),
      };
    });
  }

  readNotes(id: string): SessionNote[] {
    return parseSessionNotes(this.readOptionalText(this.notesPath(id)) ?? "");
  }

  // Delete must succeed even when session/index/active JSON is corrupt —
  // it is the recovery path out of a truncated write.
  private deleteSessionLocked(id: string): DeleteSessionResult {
    const dir = this.sessionDir(id);
    if (!existsSync(dir)) throw new Error(`Session ${id} not found.`);

    let active_cleared: boolean;
    try {
      active_cleared = this.readActive()?.active_session_id === id;
    } catch {
      active_cleared = true;
    }

    rmSync(dir, { recursive: true, force: true });
    this.removeIndexEntry(id);
    if (active_cleared) this.clearActive();
    return {
      session_id: id,
      deleted: true,
      active_cleared,
      session_dir: sessionRelativeDir(id),
    };
  }

  private proposeUnsuppressed(
    session: SessionMetadata,
    notes: SessionNote[],
    options: CloseSessionOptions
  ): CandidateTrap[] {
    const proposed = proposeCandidateTraps(session, notes);
    if (!options.isSuppressed || proposed.length === 0) return proposed;
    const isSuppressed = options.isSuppressed;
    return proposed.filter((candidate) => !isSuppressed(candidate));
  }

  private withLock<T>(fn: () => T): T {
    this.ensureSessionsDir();
    const lockDir = join(this.sessionsDir(), LOCK_DIR);
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    for (;;) {
      try {
        mkdirSync(lockDir);
        break;
      } catch {
        if (this.stealStaleLock(lockDir)) continue;
        if (Date.now() >= deadline) {
          throw new Error(
            `Timed out waiting for the session lock at ${lockDir}. If no other codetrap process is running, delete that directory and retry.`
          );
        }
        Bun.sleepSync(LOCK_RETRY_MS);
      }
    }
    try {
      return fn();
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  }

  private stealStaleLock(lockDir: string): boolean {
    try {
      if (Date.now() - statSync(lockDir).mtimeMs > LOCK_STALE_MS) {
        rmSync(lockDir, { recursive: true, force: true });
        return true;
      }
    } catch {
      // The lock vanished between attempts; retry immediately.
      return true;
    }
    return false;
  }

  private activeSession(): SessionMetadata | null {
    const active = this.readActive();
    if (active?.active_session_id) {
      const session = this.getSessionOrNull(active.active_session_id);
      if (session?.status === "active") return session;
      this.clearActive();
    }
    return this.readIndex().sessions
      .filter((entry) => entry.status === "active")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((entry) => this.getSessionOrNull(entry.id))
      .find((session): session is SessionMetadata => session !== null) ?? null;
  }

  private resolveSessionId(id?: string, opts: { requireActive?: boolean } = {}): string {
    if (id) return id;
    const active = this.activeSession();
    if (active) return active.id;
    if (opts.requireActive) throw new Error("No active session. Start one with `codetrap session start <goal>`.");
    const latest = this.listSessions({ status: "all", limit: 1 })[0];
    if (!latest) throw new Error("No sessions found.");
    return latest.id;
  }

  private requireActiveSession(): SessionMetadata {
    const active = this.activeSession();
    if (!active) throw new Error("No active session. Start one with `codetrap session start <goal>`.");
    return active;
  }

  private requireSession(id: string): SessionMetadata {
    const session = this.getSessionOrNull(id);
    if (!session) throw new Error(`Session ${id} not found.`);
    return session;
  }

  private getSessionOrNull(id: string): SessionMetadata | null {
    const path = this.sessionJsonPath(id);
    if (!existsSync(path)) return null;
    return this.readJson<SessionMetadata>(path);
  }

  private findCandidate(sessionId: string, candidateId: string): CandidateTrap {
    const candidate = this.readCandidateDocument(sessionId).candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} not found in session ${sessionId}.`);
    return candidate;
  }

  private saveCandidateDocumentMutation(
    session: SessionMetadata,
    mutation: CandidateDocumentUpdateResult
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    this.writeCandidateDocument(session.id, mutation.candidates);
    this.refreshSessionSummaries(session.id);
    return { session, candidate: mutation.candidate };
  }

  private readJson<T>(path: string): T {
    return readJsonFileRaw<T>(path, "session file");
  }

  /**
   * Reads and normalizes to the current envelope. Migration is in-memory only:
   * a read never rewrites the file, so inspecting a project with an older
   * codetrap-written session cannot corrupt it. The first mutation persists v2.
   */
  private readCandidateDocument(id: string): CandidateTrapDocument {
    const path = this.candidatesPath(id);
    if (!existsSync(path)) {
      return { version: CANDIDATE_SCHEMA_VERSION, session_id: id, candidates: [] };
    }
    const document = this.readJson<CandidateTrapDocument>(path);
    assertReadableCandidateVersion(document.version, path);
    return {
      ...document,
      version: CANDIDATE_SCHEMA_VERSION,
      candidates: migrateCandidates(document.candidates ?? [], this.migrateOptions),
    };
  }

  /**
   * Session ids discovered by scanning directories rather than reading
   * index.json. Migration is a data-integrity operation, so it must not be able
   * to miss a session merely because the index is stale or was hand-edited.
   */
  listSessionIdsOnDisk(): string[] {
    const dir = this.sessionsDir();
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && dirent.name !== LOCK_DIR)
      .map((dirent) => dirent.name)
      .filter((name) => existsSync(this.candidatesPath(name)))
      .sort();
  }

  /** The raw on-disk document, unmigrated — for the migration command itself. */
  rawCandidateDocument(id?: string): CandidateTrapDocument {
    const sessionId = this.resolveSessionId(id);
    const path = this.candidatesPath(sessionId);
    if (!existsSync(path)) {
      return { version: CANDIDATE_SCHEMA_VERSION, session_id: sessionId, candidates: [] };
    }
    const document = this.readJson<CandidateTrapDocument>(path);
    // The migration command reads through here and would otherwise happily
    // relabel a document written by a newer build as v2 while leaving its
    // unknown fields intact.
    assertReadableCandidateVersion(document.version, path);
    return document;
  }

  /**
   * Locked, because migration races every other candidate mutation: an
   * unlocked rewrite could drop a candidate captured concurrently, or replay a
   * pre-accept snapshot over a just-committed one.
   */
  writeMigratedCandidateDocument(id: string, candidates: CandidateTrap[], version: number): void {
    this.withLock(() => {
      this.writeCandidateDocumentAtVersion(id, candidates, version);
      this.refreshSessionSummaries(id);
    });
  }

  private writeCandidateDocumentAtVersion(id: string, candidates: CandidateTrap[], version: number): void {
    writeFileAtomic(this.candidatesPath(id), `${JSON.stringify({
      version,
      session_id: id,
      candidates,
    } satisfies CandidateTrapDocument, null, 2)}\n`);
  }

  private writeCandidateDocument(id: string, candidates: CandidateTrap[]): void {
    this.writeCandidateDocumentAtVersion(id, candidates, CANDIDATE_SCHEMA_VERSION);
  }

  private refreshSessionSummaries(id: string): void {
    const session = this.requireSession(id);
    const notes = this.readNotes(id);
    const candidates = this.readCandidateDocument(id).candidates;
    writeFileAtomic(this.recapPath(id), formatRecap(session, notes, candidates));
    this.writeIndexEntry(session, notes, candidates, recapSummary(session, notes, candidates));
  }

  private writeSession(session: SessionMetadata): void {
    writeFileAtomic(this.sessionJsonPath(session.id), `${JSON.stringify(session, null, 2)}\n`);
  }

  private readIndex(): SessionIndexDocument {
    const path = this.indexPath();
    if (!existsSync(path)) return { version: SESSION_VERSION, sessions: [] };
    return this.readJson<SessionIndexDocument>(path);
  }

  private writeIndexEntry(
    session: SessionMetadata,
    notes: SessionNote[],
    candidates: CandidateTrap[],
    summary: string | null
  ): void {
    this.ensureSessionsDir();
    const index = this.readIndex();
    const existing = index.sessions.find((entry) => entry.id === session.id);
    const entry = sessionIndexEntry(session, notes, candidates, summary ?? existing?.summary ?? null);
    const sessions = [entry, ...index.sessions.filter((item) => item.id !== session.id)]
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    this.writeIndex(sessions);
  }

  private removeIndexEntry(id: string): void {
    this.ensureSessionsDir();
    let sessions: SessionIndexEntry[];
    try {
      sessions = this.readIndex().sessions.filter((entry) => entry.id !== id);
    } catch {
      // The index is corrupt; rebuild it from the surviving session dirs so
      // delete still completes and repairs the index as a side effect.
      sessions = this.rebuildIndexEntries(id);
    }
    this.writeIndex(sessions);
  }

  private rebuildIndexEntries(excludeId: string): SessionIndexEntry[] {
    const entries: SessionIndexEntry[] = [];
    for (const dirent of readdirSync(this.sessionsDir(), { withFileTypes: true })) {
      if (!dirent.isDirectory() || dirent.name === LOCK_DIR || dirent.name === excludeId) continue;
      try {
        const session = this.getSessionOrNull(dirent.name);
        if (!session) continue;
        entries.push(sessionIndexEntry(
          session,
          this.readNotes(session.id),
          this.readCandidateDocument(session.id).candidates,
          null
        ));
      } catch {
        // Skip sessions whose own files are corrupt.
      }
    }
    return entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  private writeIndex(sessions: SessionIndexEntry[]): void {
    writeFileAtomic(this.indexPath(), `${JSON.stringify({ version: SESSION_VERSION, sessions } satisfies SessionIndexDocument, null, 2)}\n`);
  }

  private readActive(): { active_session_id: string | null; updated_at: string } | null {
    const path = this.activePath();
    if (!existsSync(path)) return null;
    return this.readJson<{ active_session_id: string | null; updated_at: string }>(path);
  }

  private writeActive(id: string): void {
    writeFileAtomic(this.activePath(), `${JSON.stringify({
      active_session_id: id,
      updated_at: new Date().toISOString(),
    }, null, 2)}\n`);
  }

  private clearActive(): void {
    this.ensureSessionsDir();
    writeFileAtomic(this.activePath(), `${JSON.stringify({
      active_session_id: null,
      updated_at: new Date().toISOString(),
    }, null, 2)}\n`);
  }

  private readOptionalText(path: string): string | null {
    return existsSync(path) ? readFileSync(path, "utf-8") : null;
  }

  private ensureSessionsDir(): void {
    mkdirSync(this.sessionsDir(), { recursive: true });
  }

  private sessionsDir(): string {
    return join(this.projectRoot, CODETRAP_DIR, SESSIONS_DIR);
  }

  private sessionDir(id: string): string {
    assertSafeSessionId(id);
    return join(this.sessionsDir(), id);
  }

  private activePath(): string {
    return join(this.sessionsDir(), ACTIVE_SESSION_FILE);
  }

  private indexPath(): string {
    return join(this.sessionsDir(), SESSION_INDEX_FILE);
  }

  private sessionJsonPath(id: string): string {
    return join(this.sessionDir(id), SESSION_FILE);
  }

  private notesPath(id: string): string {
    return join(this.sessionDir(id), NOTES_FILE);
  }

  // L21: rewrite only the header's Status line (the region before "## Timeline"),
  // leaving the appended note bodies untouched.
  private rewriteNotesHeaderStatus(session: SessionMetadata): void {
    const path = this.notesPath(session.id);
    const content = this.readOptionalText(path);
    if (content === null) return;
    const splitAt = content.indexOf("## Timeline");
    const headerEnd = splitAt === -1 ? content.length : splitAt;
    const header = content.slice(0, headerEnd).replace(/^Status: .*$/m, `Status: ${session.status}`);
    writeFileAtomic(path, header + content.slice(headerEnd));
  }

  private recapPath(id: string): string {
    return join(this.sessionDir(id), RECAP_FILE);
  }

  private candidatesPath(id: string): string {
    return join(this.sessionDir(id), CANDIDATES_FILE);
  }
}

