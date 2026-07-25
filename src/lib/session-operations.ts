import type { CandidateTrap } from "../domain/session";
import { parseSessionNoteKind } from "../domain/session";
import {
  DEFAULT_EXECUTOR,
  defaultAuthorizedScope,
  type AuthorizationInput,
  type LearningReceipt,
  type SuppressionRecord,
} from "../domain/learning";
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

export type SessionUnsuppressRequest = AuthorizationInput & {
  fingerprint: string;
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

  async acceptCandidate(request: SessionAcceptRequest): Promise<SessionAcceptResult> {
    const { session, candidate } = this.sessions.getCandidate(request.candidateId, request.sessionId);
    const editedCandidate = candidateWithTrapEdits(candidate, request.edit);
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

function authorizedScope(request: AuthorizationInput, fallback: string): string {
  return request.authorizedScope?.trim() || fallback;
}

function candidateRelatedFiles(candidate: CandidateTrap): string[] {
  return uniqueStrings(candidate.evidence.flatMap((evidence) => evidence.related_files ?? []));
}
