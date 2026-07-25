import type { CandidateTrap } from "../domain/session";
import type { Scope } from "./constants";
import { uniqueStrings } from "./string-list";
import {
  candidateTrapKey,
  createCandidateTrap,
  nextCandidateId,
  type CandidateDraft,
} from "./session-capture";
import { scoreCandidateTrap } from "./trap-quality";
import { candidateContentHash, withCandidateEdit } from "./candidate-envelope";
import type { Executor } from "../domain/learning";

export type CandidateDocumentAddResult = {
  candidates: CandidateTrap[];
  candidate: CandidateTrap;
  duplicate: boolean;
};

export type CandidateDocumentUpdateResult = {
  candidates: CandidateTrap[];
  candidate: CandidateTrap;
};

export type CandidateDocumentRemoveResult = {
  candidates: CandidateTrap[];
  removed: CandidateTrap[];
};

export function addCandidateToDocument(
  candidates: CandidateTrap[],
  draft: CandidateDraft
): CandidateDocumentAddResult {
  const candidate = createCandidateTrap(draft, nextCandidateId(candidates));
  const duplicate = findDuplicateCandidate(candidates, candidate);
  if (duplicate) {
    return {
      candidates,
      candidate: duplicate,
      duplicate: true,
    };
  }

  return {
    candidates: [...candidates, candidate],
    candidate,
    duplicate: false,
  };
}

export function recordCandidateConflictCheckInDocument(
  candidates: CandidateTrap[],
  candidateId: string,
  args: {
    sessionId: string;
    trap?: CandidateTrap["trap"];
    conflictStatus: CandidateTrap["quality"]["conflict_status"];
    suggestedAction: CandidateTrap["quality"]["suggested_action"];
  }
): CandidateDocumentUpdateResult {
  return updateProposedCandidate(candidates, candidateId, args.sessionId, (candidate) => withCandidateEdit(candidate, {
    ...candidate,
    trap: args.trap ?? candidate.trap,
    quality: {
      ...candidate.quality,
      conflict_checked: true,
      conflict_status: args.conflictStatus,
      suggested_action: args.suggestedAction,
    },
  }));
}

export function saveCandidateTrapInDocument(
  candidates: CandidateTrap[],
  candidateId: string,
  args: {
    sessionId: string;
    trap: CandidateTrap["trap"];
  }
): CandidateDocumentUpdateResult {
  return updateProposedCandidate(candidates, candidateId, args.sessionId, (candidate) => {
    const scored = scoreCandidateTrap({ trap: args.trap, evidence: candidate.evidence });
    return withCandidateEdit(candidate, {
      ...candidate,
      trap: args.trap,
      quality_score: scored.score,
      quality: scored.quality,
    });
  });
}

export function acceptCandidateInDocument(
  candidates: CandidateTrap[],
  candidateId: string,
  args: {
    sessionId: string;
    trap?: CandidateTrap["trap"];
    trapId: number;
    scope: string;
    conflictChecked?: boolean;
    conflictStatus?: CandidateTrap["quality"]["conflict_status"];
    suggestedAction?: CandidateTrap["quality"]["suggested_action"];
  },
  now: Date
): CandidateDocumentUpdateResult {
  return updateProposedCandidate(candidates, candidateId, args.sessionId, (candidate) => ({
    ...candidate,
    trap: args.trap ?? candidate.trap,
    content_hash: candidateContentHash({ trap: args.trap ?? candidate.trap }),
    status: "accepted",
    review_decision: "approved",
    delivery_state: "committed",
    accepted_trap_id: args.trapId,
    accepted_scope: acceptedScope(args.scope),
    accepted_at: now.toISOString(),
    quality: {
      ...candidate.quality,
      conflict_checked: args.conflictChecked ?? candidate.quality.conflict_checked,
      conflict_status: args.conflictStatus ?? candidate.quality.conflict_status,
      suggested_action: args.suggestedAction ?? candidate.quality.suggested_action,
    },
  }));
}

/**
 * Binds a user authorization to the candidate's current revision and content
 * hash. Commit later recomputes the hash and refuses if it moved, which is what
 * makes "material edits invalidate authorization" enforceable (§16 1B).
 */
export function approveCandidateInDocument(
  candidates: CandidateTrap[],
  candidateId: string,
  args: {
    sessionId: string;
    authorizedScope: string;
    executor: Executor;
  },
  now: Date
): CandidateDocumentUpdateResult {
  return updateProposedCandidate(candidates, candidateId, args.sessionId, (candidate) => {
    const revision = candidate.revision ?? 1;
    // Recomputed, never read from the record: an approval must describe the
    // content that is actually there, or a stale hash would deadlock every
    // later commit and every re-approval alike.
    const contentHash = candidateContentHash(candidate);
    return {
      ...candidate,
      revision,
      content_hash: contentHash,
      review_decision: "approved",
      delivery_state: "staged",
      authorization: {
        revision,
        content_hash: contentHash,
        authorized_scope: args.authorizedScope,
        destination: candidate.candidate_kind ?? "pitfall_trap",
        executor: args.executor,
        authorized_at: now.toISOString(),
      },
    };
  });
}

export function rejectCandidateInDocument(
  candidates: CandidateTrap[],
  candidateId: string,
  args: {
    sessionId: string;
    reason?: string | null;
  },
  now: Date
): CandidateDocumentUpdateResult {
  return updateProposedCandidate(candidates, candidateId, args.sessionId, (candidate) => ({
    ...candidate,
    status: "rejected",
    // A user-facing skip is `suppressed`, not `rejected` (§8.1): the lesson is
    // not wrong, it should simply not be proposed again. Phase 1A already
    // records the fingerprint that enforces that.
    review_decision: "suppressed",
    delivery_state: "draft",
    rejected_at: now.toISOString(),
    rejection_reason: args.reason || undefined,
  }));
}

/**
 * The reverse of `acceptCandidateInDocument`: drop the durable-trap link and
 * return the candidate to the review queue. Guarded on `accepted` so a rollback
 * cannot silently resurrect a rejected or already-rolled-back candidate.
 */
export function rollbackCandidateInDocument(
  candidates: CandidateTrap[],
  candidateId: string,
  args: { sessionId: string }
): CandidateDocumentUpdateResult {
  const candidate = candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error(`Candidate ${candidateId} not found in session ${args.sessionId}.`);
  if (candidate.status !== "accepted") {
    throw new Error(`Candidate ${candidateId} is ${candidate.status}, not accepted; nothing to roll back.`);
  }

  const { accepted_trap_id, accepted_scope, accepted_at, authorization, ...rest } = candidate;
  const updated: CandidateTrap = {
    ...rest,
    status: "proposed",
    // Back to pending, not approved: the authorization covered a commit that
    // has since been undone, so committing again needs a fresh decision.
    review_decision: "pending",
    delivery_state: "rolled_back",
  };
  return {
    candidates: candidates.map((item) => item.id === candidateId ? updated : item),
    candidate: updated,
  };
}

export function removeCandidatesFromDocument(
  candidates: CandidateTrap[],
  candidateIds: string[]
): CandidateDocumentRemoveResult {
  const removeIds = new Set(uniqueStrings(candidateIds));
  if (removeIds.size === 0) return { candidates, removed: [] };

  const removed = candidates.filter((candidate) => removeIds.has(candidate.id));
  return {
    candidates: candidates.filter((candidate) => !removeIds.has(candidate.id)),
    removed,
  };
}

function updateProposedCandidate(
  candidates: CandidateTrap[],
  candidateId: string,
  sessionId: string,
  update: (candidate: CandidateTrap) => CandidateTrap
): CandidateDocumentUpdateResult {
  const candidate = candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error(`Candidate ${candidateId} not found in session ${sessionId}.`);
  if (candidate.status !== "proposed") throw new Error(`Candidate ${candidateId} is already ${candidate.status}.`);

  const updated = update(candidate);
  return {
    candidates: candidates.map((item) => item.id === candidateId ? updated : item),
    candidate: updated,
  };
}

function findDuplicateCandidate(candidates: CandidateTrap[], candidate: CandidateTrap): CandidateTrap | null {
  const key = candidateTrapKey(candidate);
  return candidates.find((item) => candidateTrapKey(item) === key) ?? null;
}

function acceptedScope(scope: string): Scope {
  return scope === "project" ? "project" : "global";
}
