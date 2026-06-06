export type ReviewSessionLike = {
  id: string;
  pending_count?: number | null;
};

export type ReviewCandidateView = "inbox" | "reviewed";

export type ReviewCandidateLike = {
  id: string;
  status: string;
  quality_score: number;
};

export type ReviewSummaryLike = {
  pending_count?: number | null;
  pending_session_count?: number | null;
  high_quality_pending_count?: number | null;
  needs_edit_count?: number | null;
};

export type ReviewCandidateDraftFields = Record<string, unknown>;

export type ReviewCandidateTrapDraft = {
  title: string;
  category: string;
  scope: string;
  severity: string;
  tags: string[];
  path_globs: string[];
  module: string | null;
  owner: string | null;
  context: string;
  mistake: string;
  fix: string;
};

export type ReviewCandidateMutationPayloadArgs = {
  projectRoot: string | null;
  sessionId: string | null;
  candidateId: string | null;
  trap: ReviewCandidateTrapDraft;
  extra?: Record<string, unknown>;
};

export type ReviewCandidateMutationPayload = {
  projectRoot: string | null;
  sessionId: string | null;
  candidateId: string | null;
  trap: ReviewCandidateTrapDraft;
} & Record<string, unknown>;

export type ReviewQueueModelArgs<TCandidate extends ReviewCandidateLike> = {
  candidates: TCandidate[];
  candidateView: ReviewCandidateView;
  candidateId?: string | null;
  candidateReview?: ReviewSummaryLike | null;
};

export function selectedReviewSessionId(
  sessions: ReviewSessionLike[],
  currentSessionId: string | null | undefined
): string | null {
  if (currentSessionId && sessions.some((session) => session.id === currentSessionId)) {
    return currentSessionId;
  }
  return sessions.find((session) => (session.pending_count || 0) > 0)?.id || sessions[0]?.id || null;
}

export function reviewQueueModel<TCandidate extends ReviewCandidateLike>(
  args: ReviewQueueModelArgs<TCandidate>
) {
  const pendingCount = args.candidates.filter((candidate) => candidate.status === "proposed").length;
  const reviewedCount = args.candidates.length - pendingCount;
  const visibleCandidates = sortedReviewCandidates(args.candidates, args.candidateView);
  return {
    pendingCount,
    reviewedCount,
    visibleCandidates,
    selectedCandidateId: selectedReviewCandidateId(visibleCandidates, args.candidateId),
    summary: visibleReviewSummary(args.candidateReview),
  };
}

export function sortedReviewCandidates<TCandidate extends ReviewCandidateLike>(
  candidates: TCandidate[],
  candidateView: ReviewCandidateView
): TCandidate[] {
  return [...candidates]
    .filter((candidate) => candidateVisibleInReviewView(candidate, candidateView))
    .sort((a, b) => reviewStatusRank(a.status) - reviewStatusRank(b.status) || b.quality_score - a.quality_score);
}

export function selectedReviewCandidateId(
  candidates: ReviewCandidateLike[],
  currentCandidateId: string | null | undefined
): string | null {
  if (currentCandidateId && candidates.some((candidate) => candidate.id === currentCandidateId)) {
    return currentCandidateId;
  }
  return candidates[0]?.id || null;
}

export function visibleReviewSummary(summary: ReviewSummaryLike | null | undefined): ReviewSummaryLike | null {
  if (!summary || (summary.pending_count || 0) === 0) return null;
  return summary;
}

export function candidateVisibleInReviewView(
  candidate: ReviewCandidateLike,
  candidateView: ReviewCandidateView
): boolean {
  return candidateView === "inbox" ? candidate.status === "proposed" : candidate.status !== "proposed";
}

export function reviewStatusRank(status: string): number {
  return status === "proposed" ? 0 : status === "accepted" ? 1 : 2;
}

export function reviewCandidateTrapDraft(fields: ReviewCandidateDraftFields): ReviewCandidateTrapDraft {
  return {
    title: String(fields.title || ""),
    category: String(fields.category || ""),
    scope: String(fields.scope || ""),
    severity: String(fields.severity || ""),
    tags: reviewSplitList(fields.tags),
    path_globs: reviewSplitList(fields.path_globs),
    module: reviewBlankToNull(fields.module),
    owner: reviewBlankToNull(fields.owner),
    context: String(fields.context || ""),
    mistake: String(fields.mistake || ""),
    fix: String(fields.fix || ""),
  };
}

export function reviewCandidateMutationPayload(args: ReviewCandidateMutationPayloadArgs): ReviewCandidateMutationPayload {
  return {
    projectRoot: args.projectRoot,
    sessionId: args.sessionId,
    candidateId: args.candidateId,
    trap: args.trap,
    ...(args.extra || {}),
  };
}

function reviewSplitList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function reviewBlankToNull(value: unknown): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

const CLIENT_REVIEW_FUNCTIONS = [
  selectedReviewSessionId,
  reviewQueueModel,
  sortedReviewCandidates,
  selectedReviewCandidateId,
  visibleReviewSummary,
  candidateVisibleInReviewView,
  reviewStatusRank,
  reviewCandidateTrapDraft,
  reviewCandidateMutationPayload,
  reviewSplitList,
  reviewBlankToNull,
];

export const WEB_REVIEW_CLIENT_SCRIPT = CLIENT_REVIEW_FUNCTIONS
  .map((fn) => `    ${fn.toString().replace(/\n/g, "\n    ")}`)
  .join("\n\n");
