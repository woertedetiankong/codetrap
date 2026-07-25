import type { CandidateTrap, SessionIndexEntry, SessionMetadata } from "../domain/session";
import type { LearningReceipt, SuppressionRecord } from "../domain/learning";
import { authorizationIsCurrent } from "./candidate-envelope";
import type { Scope } from "./constants";
import { candidateAcceptedScope } from "./session-candidate-scope";
import {
  CANDIDATES_FILE,
  NOTES_FILE,
  RECAP_FILE,
  sessionRelativeDir,
  sessionRelativeFile,
} from "./session-codec";
import type { CandidateConflict } from "./session-conflicts";
import type { TrapOperations } from "./trap-operations";

export type SessionPayload = SessionMetadata & {
  session_dir: string;
  notes_path: string;
  recap_path: string;
  candidate_traps_path: string;
};

export type SessionConflictPayload = {
  success: false;
  error: string;
  session_id: string;
  candidate_id: string;
  possible_conflicts: CandidateConflict[];
};

export type SessionCliConflictPayload = SessionConflictPayload & {
  next_actions: string[];
};

export type SessionAcceptPayload = {
  success: true;
  session_id: string;
  candidate_id: string;
  status: CandidateTrap["status"];
  trap_id: number;
  scope: string;
  evidence_id: number | null;
  superseded_id: number | null;
  receipt: LearningReceipt;
};

export type SessionRejectPayload = {
  success: true;
  session_id: string;
  candidate_id: string;
  status: CandidateTrap["status"];
  reason: string | null;
  suppression: SuppressionRecord;
  receipt: LearningReceipt;
};

export type SessionRollbackPayload = {
  success: true;
  session_id: string;
  candidate_id: string;
  status: CandidateTrap["status"];
  trap_id: number;
  scope: string;
  trap_deleted: boolean;
  receipt: LearningReceipt;
};

export type SessionCaptureSuppressedPayload = {
  success: true;
  suppressed: true;
  fingerprint: string;
  title: string;
  suppression: SuppressionRecord;
  next_action: { command: string };
};

export type SessionCleanupPayload = {
  success: true;
  session_id: string;
  removed_count: number;
  removed_candidate_ids: string[];
};

export type SessionCandidateReview =
  | { status: "pending"; label: string }
  | {
      status: "approved";
      label: string;
      authorized_scope: string;
      authorized_at: string;
      revision: number;
    }
  | {
      status: "accepted";
      label: string;
      trap_id: number;
      scope: string;
      trap_present: true;
      trap_status: string;
      trap_title: string;
    }
  | {
      status: "accepted_missing";
      label: string;
      trap_id?: number;
      scope?: string;
      trap_present: false;
    }
  | {
      status: "rejected";
      label: string;
      rejected_at?: string;
      rejection_reason?: string;
    };

export type ReviewedSessionCandidate = CandidateTrap & { review: SessionCandidateReview };

export type CandidateReviewCounts = {
  candidate_count: number;
  pending_count: number;
  reviewed_count: number;
  accepted_count: number;
  rejected_count: number;
  high_quality_pending_count: number;
  needs_edit_count: number;
};

export type SessionCandidateReviewSummary = CandidateReviewCounts & {
  session_id: string;
  goal: string;
  status: SessionIndexEntry["status"];
};

export type ProjectCandidateReviewSummary = CandidateReviewCounts & {
  session_count: number;
  pending_session_count: number;
  next_session_id: string | null;
};

export type SessionIndexEntryWithReview = SessionIndexEntry & CandidateReviewCounts & {
  candidate_review: SessionCandidateReviewSummary;
};

export function sessionPayload(session: SessionMetadata): SessionPayload {
  return {
    ...session,
    session_dir: sessionRelativeDir(session.id),
    notes_path: sessionRelativeFile(session.id, NOTES_FILE),
    recap_path: sessionRelativeFile(session.id, RECAP_FILE),
    candidate_traps_path: sessionRelativeFile(session.id, CANDIDATES_FILE),
  };
}

export function sessionConflictPayload(result: {
  session_id: string;
  candidate_id: string;
  possible_conflicts: CandidateConflict[];
}): SessionConflictPayload {
  return {
    success: false,
    error: "Possible active trap conflict found.",
    session_id: result.session_id,
    candidate_id: result.candidate_id,
    possible_conflicts: result.possible_conflicts,
  };
}

export function sessionCliConflictPayload(payload: SessionConflictPayload): SessionCliConflictPayload {
  return {
    ...payload,
    next_actions: [
      `codetrap session accept ${payload.candidate_id} --session ${payload.session_id} --accept-anyway`,
      `codetrap session accept ${payload.candidate_id} --session ${payload.session_id} --supersedes <trap-id>`,
      `codetrap session reject ${payload.candidate_id} --session ${payload.session_id} --reason <reason>`,
    ],
  };
}

export function sessionConflictText(payload: SessionConflictPayload): string {
  return [
    "Possible active trap conflict found:",
    ...payload.possible_conflicts.map((conflict) => [
      `#${conflict.trap_id} ${conflict.title}`,
      `  reason: ${conflict.reason}`,
      `  fix: ${conflict.fix}`,
    ].join("\n")),
    "",
    "Use --accept-anyway to save as a new trap, or --supersedes <trap-id> to preserve lifecycle history.",
  ].join("\n");
}

export function sessionAcceptPayload(accepted: {
  session: SessionMetadata;
  candidate: CandidateTrap;
  trap_id: number;
  scope: string;
  evidence_id: number | null;
  superseded_id: number | null;
  receipt: LearningReceipt;
}): SessionAcceptPayload {
  return {
    success: true,
    session_id: accepted.session.id,
    candidate_id: accepted.candidate.id,
    status: accepted.candidate.status,
    trap_id: accepted.trap_id,
    scope: accepted.scope,
    evidence_id: accepted.evidence_id,
    superseded_id: accepted.superseded_id,
    receipt: accepted.receipt,
  };
}

export function sessionRejectPayload(rejected: {
  session: SessionMetadata;
  candidate: CandidateTrap;
  suppression: SuppressionRecord;
  receipt: LearningReceipt;
}): SessionRejectPayload {
  return {
    success: true,
    session_id: rejected.session.id,
    candidate_id: rejected.candidate.id,
    status: rejected.candidate.status,
    reason: rejected.candidate.rejection_reason ?? null,
    suppression: rejected.suppression,
    receipt: rejected.receipt,
  };
}

export function sessionRollbackPayload(rolledBack: {
  session: SessionMetadata;
  candidate: CandidateTrap;
  trap_id: number;
  scope: string;
  trap_deleted: boolean;
  receipt: LearningReceipt;
}): SessionRollbackPayload {
  return {
    success: true,
    session_id: rolledBack.session.id,
    candidate_id: rolledBack.candidate.id,
    status: rolledBack.candidate.status,
    trap_id: rolledBack.trap_id,
    scope: rolledBack.scope,
    trap_deleted: rolledBack.trap_deleted,
    receipt: rolledBack.receipt,
  };
}

export function sessionCaptureSuppressedPayload(result: {
  fingerprint: string;
  title: string;
  suppression: SuppressionRecord;
}): SessionCaptureSuppressedPayload {
  return {
    success: true,
    suppressed: true,
    fingerprint: result.fingerprint,
    title: result.title,
    suppression: result.suppression,
    next_action: { command: `codetrap session unsuppress ${result.fingerprint}` },
  };
}

export function sessionCaptureSuppressedText(payload: SessionCaptureSuppressedPayload): string {
  const when = payload.suppression.suppressed_at.slice(0, 10);
  return [
    `Suppressed: "${payload.title}" was rejected on ${when} and was not added to the inbox.`,
    payload.suppression.reason ? `Reason: ${payload.suppression.reason}` : null,
    `Fingerprint: ${payload.fingerprint}`,
    `Allow it again: ${payload.next_action.command}`,
  ].filter((line): line is string => line !== null).join("\n");
}

export function sessionCleanupPayload(result: {
  session: SessionMetadata;
  removed_count: number;
  removed_candidate_ids: string[];
}): SessionCleanupPayload {
  return {
    success: true,
    session_id: result.session.id,
    removed_count: result.removed_count,
    removed_candidate_ids: result.removed_candidate_ids,
  };
}

export function reviewedSessionCandidates(
  candidates: CandidateTrap[],
  traps: TrapOperations
): ReviewedSessionCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    review: sessionCandidateReview(candidate, traps),
  }));
}

export function candidateReviewCounts(candidates: CandidateTrap[]): CandidateReviewCounts {
  const pending = candidates.filter((candidate) => candidate.status === "proposed");
  const accepted = candidates.filter((candidate) => candidate.status === "accepted");
  const rejected = candidates.filter((candidate) => candidate.status === "rejected");
  return {
    candidate_count: candidates.length,
    pending_count: pending.length,
    reviewed_count: accepted.length + rejected.length,
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    high_quality_pending_count: pending.filter((candidate) =>
      candidate.quality_score >= 0.8 && candidate.quality.suggested_action === "accept"
    ).length,
    needs_edit_count: pending.filter((candidate) => candidate.quality.suggested_action === "edit").length,
  };
}

export function sessionCandidateReviewSummary(
  session: Pick<SessionIndexEntry, "id" | "goal" | "status">,
  candidates: CandidateTrap[]
): SessionCandidateReviewSummary {
  return {
    session_id: session.id,
    goal: session.goal,
    status: session.status,
    ...candidateReviewCounts(candidates),
  };
}

export function sessionIndexEntryWithReview(
  session: SessionIndexEntry,
  candidates: CandidateTrap[]
): SessionIndexEntryWithReview {
  const review = sessionCandidateReviewSummary(session, candidates);
  return {
    ...session,
    ...review,
    candidate_review: review,
  };
}

export function projectCandidateReviewSummary(
  sessions: SessionCandidateReviewSummary[]
): ProjectCandidateReviewSummary {
  const empty = candidateReviewCounts([]);
  const totals = sessions.reduce<CandidateReviewCounts>((acc, session) => ({
    candidate_count: acc.candidate_count + session.candidate_count,
    pending_count: acc.pending_count + session.pending_count,
    reviewed_count: acc.reviewed_count + session.reviewed_count,
    accepted_count: acc.accepted_count + session.accepted_count,
    rejected_count: acc.rejected_count + session.rejected_count,
    high_quality_pending_count: acc.high_quality_pending_count + session.high_quality_pending_count,
    needs_edit_count: acc.needs_edit_count + session.needs_edit_count,
  }), empty);
  const nextPending = sessions.find((session) => session.pending_count > 0);
  return {
    ...totals,
    session_count: sessions.length,
    pending_session_count: sessions.filter((session) => session.pending_count > 0).length,
    next_session_id: nextPending?.session_id ?? null,
  };
}

export function sessionCandidateReview(
  candidate: CandidateTrap,
  traps: TrapOperations
): SessionCandidateReview {
  if (candidate.status === "proposed") {
    // An approved-but-uncommitted candidate is still `proposed`, so without
    // this the console would show a lesson the user has already authorized as
    // if it were untouched — and a Save would silently discard that approval.
    const authorization = candidate.authorization;
    if (authorization && authorizationIsCurrent(candidate)) {
      return {
        status: "approved",
        label: `approved (revision ${authorization.revision}) — editing invalidates this`,
        authorized_scope: authorization.authorized_scope,
        authorized_at: authorization.authorized_at,
        revision: authorization.revision,
      };
    }
    return { status: "pending", label: "pending review" };
  }

  if (candidate.status === "rejected") {
    return {
      status: "rejected",
      label: "rejected",
      rejected_at: candidate.rejected_at,
      rejection_reason: candidate.rejection_reason,
    };
  }

  const trapId = candidate.accepted_trap_id;
  const scope = candidateAcceptedScope(candidate);
  if (trapId === undefined) {
    return {
      status: "accepted_missing",
      label: "accepted -> trap link missing",
      scope,
      trap_present: false,
    };
  }

  const details = traps.getTrapDetails(trapId, scope);
  if (!details) {
    return {
      status: "accepted_missing",
      label: `accepted -> trap #${trapId} deleted`,
      trap_id: trapId,
      scope,
      trap_present: false,
    };
  }

  return {
    status: "accepted",
    label: `accepted -> trap #${trapId}`,
    trap_id: trapId,
    scope: details.scope,
    trap_present: true,
    trap_status: details.trap.status,
    trap_title: details.trap.title,
  };
}
