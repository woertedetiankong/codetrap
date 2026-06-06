import { describe, expect, test } from "bun:test";
import {
  reviewCandidateMutationPayload,
  reviewCandidateTrapDraft,
  reviewQueueModel,
  selectedReviewSessionId,
} from "../web/client-review";

describe("web review model", () => {
  test("selects the first pending session when the current session is missing", () => {
    const sessions = [
      { id: "already-reviewed", pending_count: 0 },
      { id: "needs-review", pending_count: 3 },
      { id: "later-review", pending_count: 1 },
    ];

    expect(selectedReviewSessionId(sessions, null)).toBe("needs-review");
    expect(selectedReviewSessionId(sessions, "missing")).toBe("needs-review");
    expect(selectedReviewSessionId(sessions, "already-reviewed")).toBe("already-reviewed");
  });

  test("models the visible candidate queue for the active review tab", () => {
    const candidates = [
      { id: "accepted", status: "accepted", quality_score: 1 },
      { id: "pending-low", status: "proposed", quality_score: 0.7 },
      { id: "pending-high", status: "proposed", quality_score: 0.95 },
    ];

    const inbox = reviewQueueModel({
      candidates,
      candidateView: "inbox",
      candidateId: "accepted",
      candidateReview: { pending_count: 2, pending_session_count: 1 },
    });
    expect(inbox.pendingCount).toBe(2);
    expect(inbox.reviewedCount).toBe(1);
    expect(inbox.visibleCandidates.map((candidate) => candidate.id)).toEqual(["pending-high", "pending-low"]);
    expect(inbox.selectedCandidateId).toBe("pending-high");
    expect(inbox.summary).toEqual({ pending_count: 2, pending_session_count: 1 });

    const reviewed = reviewQueueModel({
      candidates,
      candidateView: "reviewed",
      candidateId: "accepted",
      candidateReview: { pending_count: 0, pending_session_count: 0 },
    });
    expect(reviewed.visibleCandidates.map((candidate) => candidate.id)).toEqual(["accepted"]);
    expect(reviewed.selectedCandidateId).toBe("accepted");
    expect(reviewed.summary).toBeNull();
  });

  test("builds candidate mutation payloads from the visible review draft", () => {
    const draft = reviewCandidateTrapDraft({
      title: " Accept current draft ",
      category: "api",
      scope: "project",
      severity: "error",
      tags: "web, review, web",
      path_globs: "src/web/**, src/lib/session-operations.ts",
      module: " web ",
      owner: " ",
      context: "When accepting a polished candidate.",
      mistake: "Posting only the candidate id drops visible edits.",
      fix: "Send the current form as an accept-time edit.",
    });

    expect(draft).toEqual({
      title: " Accept current draft ",
      category: "api",
      scope: "project",
      severity: "error",
      tags: ["web", "review"],
      path_globs: ["src/web/**", "src/lib/session-operations.ts"],
      module: "web",
      owner: null,
      context: "When accepting a polished candidate.",
      mistake: "Posting only the candidate id drops visible edits.",
      fix: "Send the current form as an accept-time edit.",
    });

    expect(reviewCandidateMutationPayload({
      projectRoot: "/project",
      sessionId: "session-1",
      candidateId: "cand-001",
      trap: draft,
      extra: { acceptAnyway: true },
    })).toEqual({
      projectRoot: "/project",
      sessionId: "session-1",
      candidateId: "cand-001",
      trap: draft,
      acceptAnyway: true,
    });
  });
});
