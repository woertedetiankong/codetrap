import type { CandidateTrap } from "../domain/session";
import { candidateContentHash } from "./candidate-envelope";
import { uniqueStrings } from "./string-list";

export type CandidateLocation = {
  session_id: string;
  candidate: CandidateTrap;
};

export type ProvenanceInput = {
  source_agent?: string;
  source_manifest_refs?: string[];
  review_id?: string;
  evidence?: CandidateTrap["evidence"];
};

/**
 * §13.4: "Staging consolidates only identical revision hashes and preserves
 * combined evidence."
 *
 * Identical means the Phase 1B `content_hash` — the normalized material fields.
 * Anything less exact is a semantic judgment, and §9.3 reserves those for the
 * human. This is deliberately the only automatic merge in the system.
 */
export function findExactDuplicate(
  existing: CandidateLocation[],
  contentHash: string
): CandidateLocation | null {
  return existing.find((entry) =>
    isConsolidationTarget(entry.candidate)
    && (entry.candidate.content_hash ?? candidateContentHash(entry.candidate)) === contentHash
  ) ?? null;
}

/**
 * A rejected or suppressed candidate is a closed decision and must never absorb
 * new provenance: merging onto it would route a re-mined lesson around the
 * suppression index, quietly reviving something the user said no to.
 *
 * An *accepted* one is the opposite case — §13.4 wants committed-trap evidence
 * to record every client history that contributed, so consolidating there is
 * exactly the intent.
 */
function isConsolidationTarget(candidate: CandidateTrap): boolean {
  if (candidate.status === "rejected") return false;
  const decision = candidate.review_decision;
  if (decision === "rejected" || decision === "suppressed") return false;
  // An already-committed candidate is excluded too. Merging evidence onto it
  // would leave the candidate and its durable trap permanently disagreeing —
  // the trap row is unchanged — and updating the trap is an authorized write
  // (§3.2), not something staging may do on its own.
  return candidate.status !== "accepted" && candidate.delivery_state !== "committed";
}

/** An exact-hash match that is already committed: reported, never modified. */
export function findCommittedDuplicate(
  existing: CandidateLocation[],
  contentHash: string
): CandidateLocation | null {
  return existing.find((entry) =>
    (entry.candidate.status === "accepted" || entry.candidate.delivery_state === "committed")
    && (entry.candidate.content_hash ?? candidateContentHash(entry.candidate)) === contentHash
  ) ?? null;
}

/**
 * Merges provenance onto the surviving candidate. Nothing is dropped: both
 * clients' `source_agent`s, both sets of evidence, and both sets of manifest
 * refs survive, which is what makes cross-client dedup safe now that Phase 1C
 * produces candidates from two adapters.
 */
export function consolidateProvenance(
  existing: CandidateTrap,
  incoming: ProvenanceInput
): CandidateTrap {
  const contributing = uniqueStrings([
    ...(existing.contributing_sources ?? []),
    ...(existing.source_agent ? [existing.source_agent] : []),
    ...(incoming.source_agent ? [incoming.source_agent] : []),
  ]);

  return {
    ...existing,
    contributing_sources: contributing.length > 1 ? contributing : existing.contributing_sources,
    source_manifest_refs: uniqueStrings([
      ...(existing.source_manifest_refs ?? []),
      ...(incoming.source_manifest_refs ?? []),
    ]),
    // Deduped by source_ref + note: re-running `learn stage --apply` on the same
    // review must not inflate the apparent support for a lesson.
    evidence: mergeEvidence(existing.evidence, incoming.evidence ?? []),
  };
}

function mergeEvidence(
  existing: CandidateTrap["evidence"],
  incoming: CandidateTrap["evidence"]
): CandidateTrap["evidence"] {
  const seen = new Set(existing.map(evidenceKey));
  const merged = [...existing];
  for (const item of incoming) {
    const key = evidenceKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function evidenceKey(item: CandidateTrap["evidence"][number]): string {
  return `${item.source_ref ?? ""}\u0000${item.note ?? ""}`;
}

export type SimilarityMatch = {
  session_id: string;
  candidate_id: string;
  title: string;
  /** The matched candidate's content hash — the stable part of its identity. */
  content_hash: string;
  score: number;
  reason: string;
};

/**
 * §9.3: similar candidates "appear as one review cluster with each revision and
 * provenance visible" — the CLI never merges them. This returns advisory
 * matches; both candidates always survive.
 */
export function findSemanticMatches(
  existing: CandidateLocation[],
  trap: CandidateTrap["trap"],
  contentHash: string,
  threshold = 0.5
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = [];
  for (const entry of existing) {
    const entryHash = entry.candidate.content_hash ?? candidateContentHash(entry.candidate);
    // An exact duplicate is consolidated, not clustered.
    if (entryHash === contentHash) continue;

    const scored = similarity(trap, entry.candidate.trap);
    if (scored.score < threshold) continue;
    matches.push({
      session_id: entry.session_id,
      candidate_id: entry.candidate.id,
      title: entry.candidate.trap.title,
      content_hash: entryHash,
      score: Number(scored.score.toFixed(2)),
      reason: scored.reason,
    });
  }
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * A stable cluster id shared by every member of one similarity group.
 *
 * Derived from content hashes only — candidate ids are unique per *session*,
 * so mixing them in produced ids that collided across sessions and changed
 * depending on which member was staged first.
 */
export function clusterId(contentHash: string, matchHashes: string[]): string {
  const all = uniqueStrings([contentHash, ...matchHashes]).sort();
  return `cluster:${all[0].slice(0, 12)}`;
}

function similarity(
  left: CandidateTrap["trap"],
  right: CandidateTrap["trap"]
): { score: number; reason: string } {
  const titleScore = jaccard(tokens(left.title), tokens(right.title));
  const tagScore = jaccard(
    (left.tags ?? []).map((tag) => tag.toLowerCase()),
    (right.tags ?? []).map((tag) => tag.toLowerCase())
  );
  const bodyScore = jaccard(
    tokens(`${left.context} ${left.mistake} ${left.fix}`),
    tokens(`${right.context} ${right.mistake} ${right.fix}`)
  );

  // Title dominates: two lessons with the same name are the ones a reviewer
  // most needs shown side by side, even when the bodies were written
  // differently by two different clients.
  const score = titleScore * 0.5 + bodyScore * 0.3 + tagScore * 0.2;
  const reason = titleScore >= 0.5
    ? "near-identical title"
    : bodyScore >= 0.5
      ? "overlapping trigger and action"
      : "shared tags and wording";
  return { score, reason };
}

function jaccard(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let shared = 0;
  for (const value of leftSet) if (rightSet.has(value)) shared += 1;
  const union = leftSet.size + rightSet.size - shared;
  return union === 0 ? 0 : shared / union;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "when",
  "that", "this", "is", "are", "be", "it", "as", "at", "by", "from", "not",
]);

function tokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter(
    (token) => token.length > 2 && !STOPWORDS.has(token)
  );
}
