import type { CandidateTrap, SessionIndexEntry } from "./session";
import type { CandidateKind } from "./candidate";

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
      status: "destination_committed";
      label: string;
      destination: CandidateKind;
      commit_id: string;
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
