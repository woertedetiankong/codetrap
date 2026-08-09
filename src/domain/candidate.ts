import type { Executor } from "./learning";

/**
 * The candidate document's own schema version, deliberately separate from
 * `SESSION_VERSION`: session.json and index.json did not change shape in Phase
 * 1B, and bumping them would force a migration they do not need.
 *
 * v1 — the Phase 0/1A record: `status` plus the accepted and rejected fields.
 * v2 — the §8.2 envelope: three orthogonal state axes, revision, content hash,
 *      and a revision-bound authorization.
 * v3 — Phase 2 low-risk destinations and destination-specific payloads.
 * v4 - Phase 3 skill candidates; agent and automation kinds remain absent.
 */
export const CANDIDATE_SCHEMA_VERSION = 4;
export const LEGACY_CANDIDATE_SCHEMA_VERSION = 1;
export const PHASE1_CANDIDATE_SCHEMA_VERSION = 2;
export const PHASE2_CANDIDATE_SCHEMA_VERSION = 3;

/**
 * Phase 1 stabilized the first two (§8.1); Phase 2 adds only destinations that
 * now have a complete apply/revert lifecycle. Phase 3 adds only the
 * evidence-approved skill destination.
 */
export const CANDIDATE_KINDS = [
  "pitfall_trap",
  "unclassified",
  "project_convention",
  "docs_guidance",
  "search_eval_case",
  "insight",
  "skill_candidate",
] as const;
export type CandidateKind = (typeof CANDIDATE_KINDS)[number];

/** §8.3 axis 2: what the user decided. */
export const REVIEW_DECISIONS = ["pending", "approved", "rejected", "suppressed"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** §8.3 axis 3: how far the lesson has travelled toward a durable carrier. */
export const DELIVERY_STATES = ["draft", "staged", "committed", "rolled_back", "superseded"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

/** Which client's history produced the candidate (§8.2 `source_agent`). */
export const SOURCE_AGENTS = ["codex", "claude-code", "unknown"] as const;
export type SourceAgent = (typeof SOURCE_AGENTS)[number] | (string & {});

/**
 * A user authorization bound to one revision of one candidate.
 *
 * `content_hash` is the load-bearing field: commit recomputes it and refuses
 * when it no longer matches, which is what makes "material edits invalidate
 * authorization" (§3.2, §16 1B) true rather than merely stated.
 */
export interface CandidateAuthorization {
  revision: number;
  content_hash: string;
  authorized_scope: string;
  destination: CandidateKind;
  executor: Executor;
  authorized_at: string;
}

export function parseCandidateKind(value: string | undefined | null): CandidateKind {
  if (value === undefined || value === null || String(value).trim() === "") return "pitfall_trap";
  const normalized = String(value).trim();
  if ((CANDIDATE_KINDS as readonly string[]).includes(normalized)) return normalized as CandidateKind;
  throw new Error(`Invalid candidate kind: ${normalized}. Expected one of: ${CANDIDATE_KINDS.join(", ")}`);
}

/**
 * The legacy `status` implied by a pair of axes. `status` is retained on the
 * record because the Web console consumes it from untyped browser JS; deriving
 * it here keeps the two representations from drifting.
 */
export function statusFromAxes(decision: ReviewDecision, delivery: DeliveryState): "proposed" | "accepted" | "rejected" {
  if (decision === "rejected" || decision === "suppressed") return "rejected";
  if (decision === "approved" && delivery === "committed") return "accepted";
  return "proposed";
}
