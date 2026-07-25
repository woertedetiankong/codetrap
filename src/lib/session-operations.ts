import type { CandidateTrap } from "../domain/session";
import { parseSessionNoteKind } from "../domain/session";
import {
  DEFAULT_EXECUTOR,
  defaultAuthorizedScope,
  type AuthorizationInput,
  type Executor,
  type LearningReceipt,
  type SuppressionRecord,
} from "../domain/learning";
import {
  CANDIDATE_SCHEMA_VERSION,
  LEGACY_CANDIDATE_SCHEMA_VERSION,
  type CandidateAuthorization,
} from "../domain/candidate";
import {
  authorizationIsCurrent,
  candidateContentHash,
  downgradeCandidates,
  downgradeLosses,
  isLegacyCandidate,
  migrateCandidates,
  type MigrateCandidateOptions,
} from "./candidate-envelope";
import type { TrapOperations } from "./trap-operations";
import { LearningStore } from "./learning-store";
import {
  capturedCandidateDraft,
  capturedTrapInput,
  candidateWithTrapEdits,
  captureGoal,
  trapFingerprint,
} from "./session-capture";
import { candidateAcceptedScope } from "./session-candidate-scope";
import { findCandidateConflicts, type CandidateConflict } from "./session-conflicts";
import {
  projectCandidateReviewSummary,
  sessionCandidateReviewSummary,
  sessionIndexEntryWithReview,
  type ProjectCandidateReviewSummary,
} from "./session-review";
import type {
  AcceptCandidateResult,
  AddSessionNoteArgs,
  CloseSessionResult,
  DeleteSessionResult,
  PruneSessionsResult,
  RemoveSessionCandidatesResult,
  SessionStore,
  StartSessionArgs,
} from "./session-store";
import { uniqueStrings } from "./string-list";

export type { AuthorizationInput };

export type SessionAcceptRequest = AuthorizationInput & {
  candidateId: string;
  sessionId?: string;
  edit?: Record<string, unknown>;
  supersedesId?: number;
  acceptAnyway?: boolean;
};

export type SessionSaveCandidateRequest = {
  candidateId: string;
  sessionId?: string;
  edit: Record<string, unknown>;
};

export type SessionRejectRequest = AuthorizationInput & {
  candidateId: string;
  sessionId?: string;
  reason?: string | null;
};

export type SessionRollbackRequest = AuthorizationInput & {
  candidateId: string;
  sessionId?: string;
};

export type SessionApproveRequest = AuthorizationInput & {
  candidateId: string;
  sessionId?: string;
};

export type SessionApproveResult = {
  success: true;
  session: ReturnType<SessionStore["getSession"]>;
  candidate: CandidateTrap;
  authorization: CandidateAuthorization;
  receipt: LearningReceipt;
};

export type SessionUnsuppressRequest = AuthorizationInput & {
  fingerprint: string;
};

export type SessionMigrateRequest = {
  sessionId?: string;
  direction?: "up" | "down";
  apply?: boolean;
};

export type SessionMigrationEntry = {
  session_id: string;
  from_version: number;
  to_version: number;
  candidate_count: number;
  warnings: string[];
};

export type SessionMigrateResult = {
  success: true;
  direction: "up" | "down";
  applied: boolean;
  target_version: number;
  sessions: SessionMigrationEntry[];
  next_action?: { command: string };
};

export type SessionPruneRequest = {
  olderThanDays: number;
  apply: boolean;
  now?: Date;
};

export type SessionCaptureRequest = {
  trap: Record<string, unknown>;
  goal?: string;
  kind?: string;
  relatedFiles?: string[];
  sourceRef?: string;
  evidenceNote?: string;
};

export type SessionConflictResult = {
  success: false;
  session_id: string;
  candidate_id: string;
  possible_conflicts: CandidateConflict[];
};

export type SessionAcceptSuccess = AcceptCandidateResult & {
  success: true;
  receipt: LearningReceipt;
};

export type SessionAcceptResult = SessionAcceptSuccess | SessionConflictResult;

export type SessionCapturedResult = {
  success: true;
  suppressed: false;
  session: ReturnType<SessionStore["getSession"]>;
  candidate: CandidateTrap;
  candidate_count: number;
  candidates_path: string;
  created_session: boolean;
  closed_session: boolean;
  duplicate: boolean;
  recap_path: string | null;
  fingerprint: string;
};

/**
 * A capture that never entered the inbox because the user already suppressed
 * this lesson. No session is created and nothing is written.
 */
export type SessionCaptureSuppressedResult = {
  success: true;
  suppressed: true;
  suppression: SuppressionRecord;
  fingerprint: string;
  title: string;
};

export type SessionCaptureResult = SessionCapturedResult | SessionCaptureSuppressedResult;

export type SessionRollbackResult = {
  success: true;
  session: ReturnType<SessionStore["getSession"]>;
  candidate: CandidateTrap;
  trap_id: number;
  scope: string;
  trap_deleted: boolean;
  receipt: LearningReceipt;
};

export type SessionUnsuppressResult = {
  success: true;
  suppression: SuppressionRecord;
  receipt: LearningReceipt;
};

export class SessionOperations {
  private readonly learning: LearningStore;

  constructor(
    private readonly sessions: SessionStore,
    private readonly traps: TrapOperations,
    learning?: LearningStore
  ) {
    this.learning = learning ?? new LearningStore(sessions.getProjectRoot());
    // Without this the §8.3 "accepted but the trap is gone" mapping never
    // fires, and the first mutation would durably persist `committed` for a
    // record whose trap no longer exists.
    this.sessions.useMigrateOptions(this.migrateOptions());
  }

  startSession(args: StartSessionArgs) {
    return this.sessions.startSession(args);
  }

  addNote(args: AddSessionNoteArgs) {
    return this.sessions.addNote(args);
  }

  status() {
    return {
      ...this.sessions.status(),
      candidate_review: this.candidateReviewSummary(),
    };
  }

  listSessions(args: { status?: string; limit?: number } = {}) {
    return this.sessions.listSessions(args).map((session) =>
      sessionIndexEntryWithReview(session, this.sessions.candidateDocument(session.id).candidates)
    );
  }

  candidateReviewSummary(): ProjectCandidateReviewSummary {
    const sessions = this.sessions.listSessions({ status: "all" }).map((session) =>
      sessionCandidateReviewSummary(session, this.sessions.candidateDocument(session.id).candidates)
    );
    return projectCandidateReviewSummary(sessions);
  }

  showSession(id: string) {
    return this.sessions.showSession(id);
  }

  summarizeNotes(id?: string) {
    return this.sessions.summarizeNotes(id);
  }

  closeSession(id: string | undefined, proposeTraps: boolean): CloseSessionResult {
    // The index is read once and closed over, rather than re-read for each of
    // the candidates the close proposes.
    let suppressed: Set<string> | null = null;
    return this.sessions.closeSession(id, proposeTraps, new Date(), {
      isSuppressed: (candidate) => {
        suppressed ??= new Set(this.learning.listSuppressions().map((entry) => entry.fingerprint));
        return suppressed.has(trapFingerprint(candidate.trap));
      },
    });
  }

  captureCandidate(request: SessionCaptureRequest): SessionCaptureResult {
    const trap = capturedTrapInput(request.trap);
    // Validate the note kind before creating any session so an invalid
    // --kind can't leak a permanently-active auto-session (M21).
    parseSessionNoteKind(request.kind);

    // The suppression check runs before any write, including the auto-session:
    // a suppressed lesson must leave no trace at all, or "does not reappear"
    // degrades into "reappears in an empty session" (§16 1A).
    const fingerprint = trapFingerprint(trap);
    const suppression = this.learning.isSuppressed(fingerprint);
    if (suppression) {
      return { success: true, suppressed: true, suppression, fingerprint, title: trap.title };
    }

    const active = this.sessions.status().session;
    const createdSession = active === null;
    const session = active ?? this.sessions.startSession({
      goal: captureGoal(request.goal, trap.title),
      module: trap.module,
      owner: trap.owner,
    });

    try {
      const captured = this.sessions.addCandidate({
        sessionId: session.id,
        draft: capturedCandidateDraft(session, {
          trap,
          kind: request.kind,
          relatedFiles: request.relatedFiles,
          sourceRef: request.sourceRef,
          evidenceNote: request.evidenceNote,
        }),
      });
      const closed = createdSession ? this.sessions.closeSession(session.id, false) : null;
      return {
        success: true,
        suppressed: false,
        session: closed?.session ?? captured.session,
        candidate: captured.candidate,
        candidate_count: this.sessions.candidateDocument(session.id).candidates.length,
        candidates_path: captured.candidates_path,
        created_session: createdSession,
        closed_session: closed !== null,
        duplicate: captured.duplicate,
        recap_path: closed?.recap_path ?? null,
        fingerprint,
      };
    } catch (error) {
      // If we created the auto-session solely for this capture and a later
      // step failed, remove it so it doesn't linger as the active session (M21).
      if (createdSession) {
        try {
          this.sessions.deleteSession(session.id);
        } catch {
          // Best-effort cleanup — surface the original capture error below.
        }
      }
      throw error;
    }
  }

  candidateDocument(id?: string) {
    return this.sessions.candidateDocument(id);
  }

  getCandidate(candidateId: string, sessionId?: string) {
    return this.sessions.getCandidate(candidateId, sessionId);
  }

  saveCandidate(request: SessionSaveCandidateRequest) {
    const { session, candidate } = this.sessions.getCandidate(request.candidateId, request.sessionId);
    const editedCandidate = candidateWithTrapEdits(candidate, request.edit);
    return this.sessions.saveCandidateTrap(editedCandidate.id, {
      sessionId: session.id,
      trap: editedCandidate.trap,
    });
  }

  listReceipts(limit = 0): LearningReceipt[] {
    return this.learning.listReceipts(limit);
  }

  listSuppressions(): SuppressionRecord[] {
    return this.learning.listSuppressions();
  }

  /**
   * Records the user's authorization against the candidate's current revision
   * and content hash. Commit later checks it, so an edit between approval and
   * commit is caught rather than silently carried.
   */
  approveCandidate(request: SessionApproveRequest): SessionApproveResult {
    const approved = this.sessions.approveCandidate(request.candidateId, {
      sessionId: request.sessionId,
      authorizedScope: authorizedScope(request, defaultAuthorizedScope(request.candidateId)),
      executor: request.executor ?? DEFAULT_EXECUTOR,
    });
    const authorization = approved.candidate.authorization;
    if (!authorization) throw new Error(`Candidate ${approved.candidate.id} was not authorized.`);
    const receipt = this.learning.appendReceipt({
      action: "approve",
      executor: authorization.executor,
      authorizedScope: authorization.authorized_scope,
      fingerprint: authorization.content_hash,
      title: approved.candidate.trap.title,
      sessionId: approved.session.id,
      candidateId: approved.candidate.id,
    });
    return { success: true, ...approved, authorization, receipt };
  }

  async acceptCandidate(request: SessionAcceptRequest): Promise<SessionAcceptResult> {
    const { session, candidate } = this.sessions.getCandidate(request.candidateId, request.sessionId);
    const editedCandidate = candidateWithTrapEdits(candidate, request.edit);
    assertAuthorizedToCommit(candidate, editedCandidate, request.executor ?? DEFAULT_EXECUTOR, request.supersedesId);
    const supersedesId = request.supersedesId;
    const conflicts = await findCandidateConflicts(editedCandidate, this.traps);
    if (conflicts.length > 0 && supersedesId === undefined && request.acceptAnyway !== true) {
      const checked = this.sessions.recordCandidateConflictCheck(candidate.id, {
        sessionId: session.id,
        trap: editedCandidate.trap,
        conflictStatus: "possible",
        suggestedAction: "supersede",
      });
      return {
        success: false,
        session_id: checked.session.id,
        candidate_id: checked.candidate.id,
        possible_conflicts: conflicts,
      };
    }

    const trap = editedCandidate.trap;
    if (supersedesId !== undefined && !this.traps.getTrapDetails(supersedesId, String(trap.scope))) {
      throw new Error(`Trap #${supersedesId} not found in ${String(trap.scope)} scope.`);
    }

    // One transaction covers trap+evidence+supersede and the candidate's
    // proposed→accepted transition: if any step throws (including the
    // status guard rejecting an already-accepted candidate), no trap is
    // committed, so a retry cannot insert a duplicate.
    const accepted = this.traps.transaction(String(trap.scope), () => {
      const added = this.traps.addTrap({ ...trap });
      const evidence = this.traps.addTrapEvidence(added.id, {
        source_type: "conversation",
        source_ref: `session:${session.id}`,
        related_files: candidateRelatedFiles(editedCandidate),
        note: `Accepted from session candidate ${editedCandidate.id}`,
      }, added.scope);
      if (!evidence.success) throw new Error(`Failed to attach evidence to trap #${added.id}.`);

      if (supersedesId !== undefined) {
        const supersede = this.traps.supersedeTrap(supersedesId, added.id, added.scope);
        if (!supersede.success) throw new Error(`Trap #${supersedesId} could not be superseded by trap #${added.id}.`);
      }

      return {
        success: true as const,
        ...this.sessions.acceptCandidate(editedCandidate.id, {
          sessionId: session.id,
          trap,
          trapId: added.id,
          scope: added.scope,
          evidenceId: evidence.evidence_id,
          supersededId: supersedesId ?? null,
          conflictChecked: true,
          conflictStatus: supersedesId !== undefined ? "confirmed" : conflicts.length > 0 ? "possible" : "none",
          suggestedAction: supersedesId !== undefined ? "supersede" : "accept",
        }),
      };
    });

    // The receipt is written after the trap is durably committed, so a receipt
    // never claims a write that did not happen. The reverse gap — a trap with
    // no receipt — is recoverable by rollback; a receipt with no trap is not.
    const receipt = this.learning.appendReceipt({
      action: "commit",
      executor: request.executor ?? DEFAULT_EXECUTOR,
      authorizedScope: authorizedScope(request, defaultAuthorizedScope(editedCandidate.id)),
      fingerprint: trapFingerprint(trap),
      title: trap.title,
      sessionId: session.id,
      candidateId: editedCandidate.id,
      trapId: accepted.trap_id,
      trapScope: accepted.scope,
      supersededId: accepted.superseded_id,
    });

    // Outside the transaction: embedding is an HTTP call and best-effort.
    await this.traps.embedTrapBestEffort(accepted.trap_id, accepted.scope);
    return { ...accepted, receipt };
  }

  /**
   * Reverses a commit: deletes the durable trap and returns the candidate to
   * the review queue, so the store matches its pre-accept state and the lesson
   * can be reviewed again. The receipt log keeps the audit trail.
   */
  rollbackCandidate(request: SessionRollbackRequest): SessionRollbackResult {
    const { session, candidate } = this.sessions.getCandidate(request.candidateId, request.sessionId);
    if (candidate.status !== "accepted") {
      throw new Error(`Candidate ${candidate.id} is ${candidate.status}, not accepted; nothing to roll back.`);
    }
    const trapId = candidate.accepted_trap_id;
    if (trapId === undefined) {
      throw new Error(`Candidate ${candidate.id} has no committed trap to roll back.`);
    }
    const scope = candidateAcceptedScope(candidate);

    // A commit that superseded another trap cannot be reversed here: accept
    // marked the predecessor `superseded`, and nothing in the store can put it
    // back (status and valid_until are not updatable fields). Deleting the
    // successor anyway would retire both lessons and silently lose the older
    // one, so refuse instead. Restoring superseded traps is Phase 1B's.
    const committed = this.traps.getTrapDetails(trapId, scope);
    const supersededId = committed?.trap.supersedes_id ?? null;
    if (supersededId !== null) {
      throw new Error(
        `Trap #${trapId} superseded trap #${supersededId}; rolling it back would leave #${supersededId} retired with no replacement. ` +
        `Roll back manually: re-add trap #${supersededId}'s lesson, then \`codetrap delete ${trapId} --scope ${scope}\`.`
      );
    }

    // Tolerate an already-deleted trap: the point of rollback is to reach the
    // pre-accept state, and a candidate stranded by a bare `codetrap delete`
    // is exactly the case that needs repairing.
    const deleted = this.traps.deleteTrap(trapId, scope);
    const rolledBack = this.sessions.rollbackCandidate(candidate.id, { sessionId: session.id });

    const receipt = this.learning.appendReceipt({
      action: "rollback",
      executor: request.executor ?? DEFAULT_EXECUTOR,
      authorizedScope: authorizedScope(request, defaultAuthorizedScope(candidate.id)),
      fingerprint: trapFingerprint(candidate.trap),
      title: candidate.trap.title,
      sessionId: session.id,
      candidateId: candidate.id,
      trapId,
      trapScope: scope,
      reason: deleted.success ? null : `Trap #${trapId} was already absent from ${scope} scope.`,
    });

    return {
      success: true,
      session: rolledBack.session,
      candidate: rolledBack.candidate,
      trap_id: trapId,
      scope,
      trap_deleted: deleted.success,
      receipt,
    };
  }

  /**
   * Rejecting a candidate also suppresses its lesson project-wide, so the same
   * lesson mined again from the same evidence does not return to the inbox.
   */
  rejectCandidate(request: SessionRejectRequest) {
    const rejected = this.sessions.rejectCandidate(request.candidateId, {
      sessionId: request.sessionId,
      reason: request.reason,
    });
    const fingerprint = trapFingerprint(rejected.candidate.trap);
    const suppression = this.learning.recordSuppression({
      fingerprint,
      title: rejected.candidate.trap.title,
      reason: request.reason,
      sessionId: rejected.session.id,
      candidateId: rejected.candidate.id,
    });
    const receipt = this.learning.appendReceipt({
      action: "suppress",
      executor: request.executor ?? DEFAULT_EXECUTOR,
      authorizedScope: authorizedScope(request, defaultAuthorizedScope(rejected.candidate.id)),
      fingerprint,
      title: rejected.candidate.trap.title,
      sessionId: rejected.session.id,
      candidateId: rejected.candidate.id,
      reason: request.reason,
    });
    return { ...rejected, suppression, receipt };
  }

  /** Undoes a suppression so the lesson can be captured again. */
  unsuppress(request: SessionUnsuppressRequest): SessionUnsuppressResult {
    const removed = this.learning.removeSuppression(request.fingerprint);
    if (!removed) throw new Error(`No suppression found for fingerprint ${request.fingerprint}.`);
    const receipt = this.learning.appendReceipt({
      action: "unsuppress",
      executor: request.executor ?? DEFAULT_EXECUTOR,
      authorizedScope: authorizedScope(request, `suppression ${request.fingerprint} only`),
      fingerprint: removed.fingerprint,
      title: removed.title,
      sessionId: removed.session_id,
      candidateId: removed.candidate_id,
    });
    return { success: true, suppression: removed, receipt };
  }

  /**
   * Migrates candidate documents between schema versions.
   *
   * Dry-run by default (the `scope-migration` precedent): the report names
   * every session and record that would change before anything is written.
   * `--down` inverts the transform rather than restoring a copy, which is what
   * the §16 1B "reversible" gate actually asks for.
   */
  migrateCandidateDocuments(request: SessionMigrateRequest): SessionMigrateResult {
    const direction = request.direction ?? "up";
    const target = direction === "up" ? CANDIDATE_SCHEMA_VERSION : LEGACY_CANDIDATE_SCHEMA_VERSION;
    const sessions = request.sessionId
      ? [request.sessionId]
      : this.sessions.listSessionIdsOnDisk();

    const changed: SessionMigrationEntry[] = [];
    for (const sessionId of sessions) {
      const document = this.sessions.rawCandidateDocument(sessionId);
      if (document.candidates.length === 0 && document.version === target) continue;

      const candidates = direction === "up"
        ? migrateCandidates(document.candidates, this.migrateOptions())
        : downgradeCandidates(document.candidates);
      const from = document.version;
      if (from === target && JSON.stringify(candidates) === JSON.stringify(document.candidates)) continue;

      changed.push({
        session_id: sessionId,
        from_version: from,
        to_version: target,
        candidate_count: candidates.length,
        warnings: direction === "up"
          ? candidates
            .map((candidate) => candidate.migration_warning)
            .filter((warning): warning is string => Boolean(warning))
          : downgradeLosses(document.candidates),
      });
      if (request.apply) {
        this.sessions.writeMigratedCandidateDocument(sessionId, candidates, target);
      }
    }

    return {
      success: true,
      direction,
      applied: request.apply === true,
      target_version: target,
      sessions: changed,
      ...(request.apply ? {} : { next_action: { command: migrateApplyCommand(request) } }),
    };
  }

  /** Reports which sessions hold records older than the current envelope. */
  candidateMigrationStatus(): { pending_sessions: string[]; pending_records: number } {
    const pendingSessions: string[] = [];
    let pendingRecords = 0;
    for (const sessionId of this.sessions.listSessionIdsOnDisk()) {
      const document = this.sessions.rawCandidateDocument(sessionId);
      const legacy = document.candidates.filter(isLegacyCandidate).length;
      if (legacy > 0) {
        pendingSessions.push(sessionId);
        pendingRecords += legacy;
      }
    }
    return { pending_sessions: pendingSessions, pending_records: pendingRecords };
  }

  private migrateOptions(): MigrateCandidateOptions {
    return {
      trapExists: (trapId, scope) => this.traps.getTrapDetails(trapId, scope) !== null,
    };
  }

  deleteSession(sessionId: string): DeleteSessionResult {
    return this.sessions.deleteSession(sessionId);
  }

  pruneSessions(request: SessionPruneRequest): PruneSessionsResult {
    const now = request.now ?? new Date();
    const cutoff = new Date(now.getTime() - request.olderThanDays * 24 * 60 * 60 * 1000);
    return this.sessions.pruneSessions({ cutoff, dryRun: !request.apply });
  }

  cleanupDeletedTrapCandidates(sessionId?: string): RemoveSessionCandidatesResult {
    const document = this.sessions.candidateDocument(sessionId);
    const missingCandidateIds = document.candidates
      .filter((candidate) => candidate.status === "accepted")
      .filter((candidate) => {
        const trapId = candidate.accepted_trap_id;
        if (trapId === undefined) return true;
        return !this.traps.getTrapDetails(trapId, candidateAcceptedScope(candidate));
      })
      .map((candidate) => candidate.id);
    return this.sessions.removeCandidates(sessionId, missingCandidateIds);
  }
}

/**
 * §3.2: a durable write is allowed only after explicit user authorization, and
 * the executor may be an agent acting on that instruction.
 *
 * A human running `session accept` at the CLI *is* the authorization, so
 * `--executor user` needs no prior approve. An agent cannot authorize itself,
 * so `--executor agent` requires an authorization the user recorded against
 * this exact revision — and an edit since then invalidates it.
 */
function assertAuthorizedToCommit(
  stored: CandidateTrap,
  edited: CandidateTrap,
  executor: Executor,
  supersedesId: number | undefined
): void {
  // A human running the command is themselves the authorization, including for
  // an edit made in the same breath. Only an agent is bound by a prior one.
  if (executor !== "agent") return;

  const authorization = stored.authorization;
  if (!authorization) {
    throw new Error(
      `Candidate ${stored.id} has no recorded authorization, so an agent may not commit it. ` +
      `Have the user run: codetrap session approve ${stored.id}`
    );
  }
  if (!authorizationIsCurrent(stored)) {
    throw new Error(
      `Authorization for ${stored.id} is stale (approved revision ${authorization.revision}, current revision ${stored.revision ?? 1}). ` +
      `Re-approve it: codetrap session approve ${stored.id}`
    );
  }

  // An edit supplied at commit time changes the content being committed, so it
  // is checked separately — otherwise an agent could carry a valid approval and
  // commit something else.
  const committedHash = candidateContentHash(edited);
  if (committedHash !== authorization.content_hash) {
    throw new Error(
      `Authorization for ${stored.id} covered content hash ${authorization.content_hash}, but the candidate now hashes to ${committedHash}. ` +
      `The lesson changed materially since it was approved. Re-approve it: codetrap session approve ${stored.id}`
    );
  }

  // Superseding retires a different, possibly unrelated trap, and Phase 1B's
  // authorization does not describe that trap. Rollback also refuses to undo a
  // supersede, so an agent doing this on a bare candidate approval would be an
  // unauthorized and unrecoverable write.
  if (supersedesId !== undefined) {
    throw new Error(
      `Approval for ${stored.id} authorizes committing that lesson, not retiring trap #${supersedesId}. ` +
      `A supersede must be run by the user: codetrap session accept ${stored.id} --supersedes ${supersedesId} --executor user`
    );
  }
}

function migrateApplyCommand(request: SessionMigrateRequest): string {
  const parts = ["codetrap", "session", "migrate", "--apply"];
  if (request.direction === "down") parts.push("--down");
  if (request.sessionId) parts.push("--session", request.sessionId);
  return parts.join(" ");
}

function authorizedScope(request: AuthorizationInput, fallback: string): string {
  return request.authorizedScope?.trim() || fallback;
}

function candidateRelatedFiles(candidate: CandidateTrap): string[] {
  return uniqueStrings(candidate.evidence.flatMap((evidence) => evidence.related_files ?? []));
}
