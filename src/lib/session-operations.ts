import type { CandidateTrap } from "../domain/session";
import type { Scope } from "./constants";
import type { TrapOperations } from "./trap-operations";
import {
  capturedCandidateDraft,
  capturedTrapInput,
  candidateWithTrapEdits,
  captureGoal,
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

export type SessionAcceptRequest = {
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

export type SessionRejectRequest = {
  candidateId: string;
  sessionId?: string;
  reason?: string | null;
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
};

export type SessionAcceptResult = SessionAcceptSuccess | SessionConflictResult;

export type SessionCaptureResult = {
  success: true;
  session: ReturnType<SessionStore["getSession"]>;
  candidate: CandidateTrap;
  candidate_count: number;
  candidates_path: string;
  created_session: boolean;
  closed_session: boolean;
  duplicate: boolean;
  recap_path: string | null;
};

export class SessionOperations {
  constructor(
    private readonly sessions: SessionStore,
    private readonly traps: TrapOperations
  ) {}

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
    return this.sessions.closeSession(id, proposeTraps);
  }

  captureCandidate(request: SessionCaptureRequest): SessionCaptureResult {
    const trap = capturedTrapInput(request.trap);
    const active = this.sessions.status().session;
    const createdSession = active === null;
    const session = active ?? this.sessions.startSession({
      goal: captureGoal(request.goal, trap.title),
      module: trap.module,
      owner: trap.owner,
    });
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
      session: closed?.session ?? captured.session,
      candidate: captured.candidate,
      candidate_count: this.sessions.candidateDocument(session.id).candidates.length,
      candidates_path: captured.candidates_path,
      created_session: createdSession,
      closed_session: closed !== null,
      duplicate: captured.duplicate,
      recap_path: closed?.recap_path ?? null,
    };
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
      success: true,
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
  }

  rejectCandidate(request: SessionRejectRequest) {
    return this.sessions.rejectCandidate(request.candidateId, {
      sessionId: request.sessionId,
      reason: request.reason,
    });
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

function candidateRelatedFiles(candidate: CandidateTrap): string[] {
  return uniqueStrings(candidate.evidence.flatMap((evidence) => evidence.related_files ?? []));
}
