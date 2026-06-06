import type { CandidateTrap } from "../domain/session";
import type { Scope } from "./constants";
import {
  candidateTrapKey,
  createCandidateTrap,
  nextCandidateId,
  type CandidateDraft,
} from "./session-capture";
import { scoreCandidateTrap } from "./trap-quality";

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
  return updateProposedCandidate(candidates, candidateId, args.sessionId, (candidate) => ({
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
    return {
      ...candidate,
      trap: args.trap,
      quality_score: scored.score,
      quality: scored.quality,
    };
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
    status: "accepted",
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
    rejected_at: now.toISOString(),
    rejection_reason: args.reason || undefined,
  }));
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
