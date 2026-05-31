import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { CandidateTrap, CandidateTrapDocument, SessionIndexDocument, SessionMetadata, SessionNote } from "../domain/session";
import { parseSessionNoteKind, SESSION_VERSION } from "../domain/session";
import { CODETRAP_DIR } from "./constants";
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
import { proposeCandidateTraps } from "./session-capture";
import { scoreCandidateTrap } from "./trap-quality";

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
  traps_written: number;
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

export class SessionStore {
  constructor(private readonly projectRoot: string) {}

  startSession(args: StartSessionArgs, now = new Date()): SessionMetadata {
    const active = this.activeSession();
    if (active) {
      throw new Error(`Session ${active.id} is already active. Close it before starting another session.`);
    }

    const goal = args.goal.trim();
    if (!goal) throw new Error("Session goal is required.");

    this.ensureSessionsDir();
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

    mkdirSync(this.sessionDir(id), { recursive: true });
    this.writeSession(session);
    writeFileSync(this.notesPath(id), formatImplementationNotesHeader(session));
    this.writeIndexEntry(session, [], [], null);
    this.writeActive(id);
    return session;
  }

  addNote(args: AddSessionNoteArgs, now = new Date()): { session: SessionMetadata; note: SessionNote; notes_path: string } {
    const session = this.requireActiveSession();
    const text = args.text.trim();
    if (!text) throw new Error("Session note text is required.");

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

  closeSession(id: string | undefined, proposeTraps: boolean, now = new Date()): CloseSessionResult {
    const session = this.requireSession(this.resolveSessionId(id, { requireActive: id === undefined }));
    if (session.status === "closed") throw new Error(`Session ${session.id} is already closed.`);

    const closedAt = now.toISOString();
    const notes = this.readNotes(session.id);
    const candidates = proposeTraps ? proposeCandidateTraps(session, notes) : this.readCandidateDocument(session.id).candidates;
    if (proposeTraps) this.writeCandidateDocument(session.id, candidates);

    const updated = {
      ...session,
      status: "closed" as const,
      closed_at: closedAt,
      updated_at: closedAt,
    };
    this.writeSession(updated);
    writeFileSync(this.recapPath(updated.id), formatRecap(updated, notes, candidates));
    this.writeIndexEntry(updated, notes, candidates, recapSummary(updated, notes, candidates));
    if (this.readActive()?.active_session_id === updated.id) this.clearActive();

    return {
      session: updated,
      recap_path: sessionRelativeFile(updated.id, RECAP_FILE),
      candidate_count: candidates.length,
      traps_written: 0,
    };
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

  recordCandidateConflictCheck(
    candidateId: string,
    args: {
      sessionId?: string;
      trap?: CandidateTrap["trap"];
      conflictStatus: CandidateTrap["quality"]["conflict_status"];
      suggestedAction: CandidateTrap["quality"]["suggested_action"];
    }
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    const sessionId = this.resolveSessionId(args.sessionId);
    const session = this.requireSession(sessionId);
    const document = this.readCandidateDocument(sessionId);
    const candidate = document.candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} not found in session ${sessionId}.`);
    if (candidate.status !== "proposed") throw new Error(`Candidate ${candidateId} is already ${candidate.status}.`);

    if (args.trap) candidate.trap = args.trap;
    candidate.quality.conflict_checked = true;
    candidate.quality.conflict_status = args.conflictStatus;
    candidate.quality.suggested_action = args.suggestedAction;
    this.writeCandidateDocument(session.id, document.candidates);
    this.refreshSessionSummaries(session.id);
    return { session, candidate };
  }

  saveCandidateTrap(
    candidateId: string,
    args: {
      sessionId?: string;
      trap: CandidateTrap["trap"];
    }
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    const sessionId = this.resolveSessionId(args.sessionId);
    const session = this.requireSession(sessionId);
    const document = this.readCandidateDocument(sessionId);
    const candidate = document.candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} not found in session ${sessionId}.`);
    if (candidate.status !== "proposed") throw new Error(`Candidate ${candidateId} is already ${candidate.status}.`);

    const scored = scoreCandidateTrap({ trap: args.trap, evidence: candidate.evidence });
    candidate.trap = args.trap;
    candidate.quality_score = scored.score;
    candidate.quality = scored.quality;
    this.writeCandidateDocument(session.id, document.candidates);
    this.refreshSessionSummaries(session.id);
    return { session, candidate };
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
    const sessionId = this.resolveSessionId(args.sessionId);
    const session = this.requireSession(sessionId);
    const document = this.readCandidateDocument(sessionId);
    const candidate = document.candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} not found in session ${sessionId}.`);
    if (candidate.status !== "proposed") throw new Error(`Candidate ${candidateId} is already ${candidate.status}.`);

    if (args.trap) candidate.trap = args.trap;
    candidate.status = "accepted";
    candidate.accepted_trap_id = args.trapId;
    candidate.accepted_scope = args.scope === "project" ? "project" : "global";
    candidate.accepted_at = now.toISOString();
    candidate.quality.conflict_checked = args.conflictChecked ?? candidate.quality.conflict_checked;
    candidate.quality.conflict_status = args.conflictStatus ?? candidate.quality.conflict_status;
    candidate.quality.suggested_action = args.suggestedAction ?? candidate.quality.suggested_action;
    this.writeCandidateDocument(session.id, document.candidates);
    this.refreshSessionSummaries(session.id);

    return {
      session,
      candidate,
      trap_id: args.trapId,
      scope: args.scope,
      evidence_id: args.evidenceId,
      superseded_id: args.supersededId ?? null,
    };
  }

  rejectCandidate(
    candidateId: string,
    args: { sessionId?: string; reason?: string | null },
    now = new Date()
  ): { session: SessionMetadata; candidate: CandidateTrap } {
    const sessionId = this.resolveSessionId(args.sessionId);
    const session = this.requireSession(sessionId);
    const document = this.readCandidateDocument(sessionId);
    const candidate = document.candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} not found in session ${sessionId}.`);
    if (candidate.status !== "proposed") throw new Error(`Candidate ${candidateId} is already ${candidate.status}.`);

    candidate.status = "rejected";
    candidate.rejected_at = now.toISOString();
    if (args.reason) candidate.rejection_reason = args.reason;
    this.writeCandidateDocument(session.id, document.candidates);
    this.refreshSessionSummaries(session.id);
    return { session, candidate };
  }

  removeCandidates(sessionId: string | undefined, candidateIds: string[]): RemoveSessionCandidatesResult {
    const resolvedSessionId = this.resolveSessionId(sessionId);
    const session = this.requireSession(resolvedSessionId);
    const removeIds = new Set(uniqueStrings(candidateIds));
    if (removeIds.size === 0) {
      return {
        session,
        removed_count: 0,
        removed_candidate_ids: [],
        candidates: this.readCandidateDocument(session.id).candidates,
      };
    }

    const document = this.readCandidateDocument(session.id);
    const removed = document.candidates.filter((candidate) => removeIds.has(candidate.id));
    const candidates = document.candidates.filter((candidate) => !removeIds.has(candidate.id));
    if (removed.length > 0) {
      this.writeCandidateDocument(session.id, candidates);
      this.refreshSessionSummaries(session.id);
    }

    return {
      session,
      removed_count: removed.length,
      removed_candidate_ids: removed.map((candidate) => candidate.id),
      candidates,
    };
  }

  deleteSession(id: string): DeleteSessionResult {
    this.requireSession(id);
    const active_cleared = this.readActive()?.active_session_id === id;
    rmSync(this.sessionDir(id), { recursive: true, force: true });
    this.removeIndexEntry(id);
    if (active_cleared) this.clearActive();
    return {
      session_id: id,
      deleted: true,
      active_cleared,
      session_dir: sessionRelativeDir(id),
    };
  }

  pruneSessions(args: { cutoff: Date; dryRun?: boolean }): PruneSessionsResult {
    const cutoffTime = args.cutoff.getTime();
    const candidates = this.readIndex().sessions
      .filter((entry) => entry.status === "closed")
      .filter((entry) => {
        const closedAt = entry.closed_at ? Date.parse(entry.closed_at) : Date.parse(entry.created_at);
        return Number.isFinite(closedAt) && closedAt < cutoffTime;
      });

    if (!args.dryRun) {
      for (const session of candidates) {
        this.deleteSession(session.id);
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
  }

  readNotes(id: string): SessionNote[] {
    return parseSessionNotes(this.readOptionalText(this.notesPath(id)) ?? "");
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
    return JSON.parse(readFileSync(path, "utf-8")) as SessionMetadata;
  }

  private findCandidate(sessionId: string, candidateId: string): CandidateTrap {
    const candidate = this.readCandidateDocument(sessionId).candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} not found in session ${sessionId}.`);
    return candidate;
  }

  private readCandidateDocument(id: string): CandidateTrapDocument {
    const path = this.candidatesPath(id);
    if (!existsSync(path)) {
      return { version: SESSION_VERSION, session_id: id, candidates: [] };
    }
    return JSON.parse(readFileSync(path, "utf-8")) as CandidateTrapDocument;
  }

  private writeCandidateDocument(id: string, candidates: CandidateTrap[]): void {
    writeFileSync(this.candidatesPath(id), `${JSON.stringify({
      version: SESSION_VERSION,
      session_id: id,
      candidates,
    } satisfies CandidateTrapDocument, null, 2)}\n`);
  }

  private refreshSessionSummaries(id: string): void {
    const session = this.requireSession(id);
    const notes = this.readNotes(id);
    const candidates = this.readCandidateDocument(id).candidates;
    writeFileSync(this.recapPath(id), formatRecap(session, notes, candidates));
    this.writeIndexEntry(session, notes, candidates, recapSummary(session, notes, candidates));
  }

  private writeSession(session: SessionMetadata): void {
    writeFileSync(this.sessionJsonPath(session.id), `${JSON.stringify(session, null, 2)}\n`);
  }

  private readIndex(): SessionIndexDocument {
    const path = this.indexPath();
    if (!existsSync(path)) return { version: SESSION_VERSION, sessions: [] };
    return JSON.parse(readFileSync(path, "utf-8")) as SessionIndexDocument;
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
    writeFileSync(this.indexPath(), `${JSON.stringify({ version: SESSION_VERSION, sessions } satisfies SessionIndexDocument, null, 2)}\n`);
  }

  private removeIndexEntry(id: string): void {
    this.ensureSessionsDir();
    const index = this.readIndex();
    const sessions = index.sessions.filter((entry) => entry.id !== id);
    writeFileSync(this.indexPath(), `${JSON.stringify({ version: SESSION_VERSION, sessions } satisfies SessionIndexDocument, null, 2)}\n`);
  }

  private readActive(): { active_session_id: string | null; updated_at: string } | null {
    const path = this.activePath();
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8")) as { active_session_id: string | null; updated_at: string };
  }

  private writeActive(id: string): void {
    writeFileSync(this.activePath(), `${JSON.stringify({
      active_session_id: id,
      updated_at: new Date().toISOString(),
    }, null, 2)}\n`);
  }

  private clearActive(): void {
    this.ensureSessionsDir();
    writeFileSync(this.activePath(), `${JSON.stringify({
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

  private recapPath(id: string): string {
    return join(this.sessionDir(id), RECAP_FILE);
  }

  private candidatesPath(id: string): string {
    return join(this.sessionDir(id), CANDIDATES_FILE);
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
