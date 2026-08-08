import { createHash } from "node:crypto";
import type { CandidateTrap } from "../domain/session";
import {
  CANDIDATE_SCHEMA_VERSION,
  LEGACY_CANDIDATE_SCHEMA_VERSION,
  PHASE1_CANDIDATE_SCHEMA_VERSION,
  type CandidateKind,
  type DeliveryState,
  type ReviewDecision,
} from "../domain/candidate";
import { trapFingerprint } from "./session-capture";

export type MigrateCandidateOptions = {
  /**
   * Whether the trap a legacy `accepted` record points at still resolves.
   * Omitted means "assume it does" — the §8.3 mapping only downgrades a record
   * to `staged` when the link is provably broken, never on a missing lookup.
   */
  trapExists?: (trapId: number, scope: string) => boolean;
};

/**
 * The content hash an authorization binds to.
 *
 * Deliberately the same normalization as the Phase 1A suppression fingerprint:
 * title, context, mistake, fix and scope, whitespace-collapsed and lowercased.
 * Reformatting or retagging is therefore not a material edit, but changing what
 * the lesson actually says is.
 */
export function candidateContentHash(
  candidate: Pick<CandidateTrap, "trap"> & Partial<Pick<CandidateTrap, "candidate_kind" | "destination_payload">>
): string {
  if (!candidate.destination_payload && (!candidate.candidate_kind || candidate.candidate_kind === "pitfall_trap")) {
    return trapFingerprint(candidate.trap);
  }
  const normalized = stableValue({
    trap: trapFingerprint(candidate.trap),
    kind: candidate.candidate_kind ?? "pitfall_trap",
    payload: candidate.destination_payload ?? null,
  });
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 32);
}

export function isLegacyCandidate(candidate: CandidateTrap): boolean {
  return (candidate.schema_version ?? LEGACY_CANDIDATE_SCHEMA_VERSION) < CANDIDATE_SCHEMA_VERSION;
}

export function documentNeedsMigration(candidates: CandidateTrap[]): boolean {
  return candidates.some(isLegacyCandidate);
}

/**
 * v1 -> v2, applying the §8.3 mapping:
 *
 * ```text
 * old proposed                        -> pending  + draft
 * old rejected                        -> rejected + draft
 * old accepted with accepted_trap_id  -> approved + committed
 * old accepted with missing trap/link -> approved + staged + migration_warning
 * ```
 *
 * Pure and idempotent: a v2 record is returned unchanged, so normalize-on-read
 * can run on every read without rewriting anything.
 */
export function migrateCandidate(
  candidate: CandidateTrap,
  options: MigrateCandidateOptions = {}
): CandidateTrap {
  if (!isLegacyCandidate(candidate)) return candidate;

  const version = candidate.schema_version ?? LEGACY_CANDIDATE_SCHEMA_VERSION;
  if (version === PHASE1_CANDIDATE_SCHEMA_VERSION) {
    const hintedInsight = candidate.candidate_kind === "unclassified"
      && candidate.destination_hint?.trim().toLowerCase() === "insight";
    const migrated = {
      ...candidate,
      schema_version: CANDIDATE_SCHEMA_VERSION,
      candidate_kind: hintedInsight ? "insight" as const : candidate.candidate_kind ?? "pitfall_trap",
    };
    return { ...migrated, content_hash: candidateContentHash(migrated) };
  }

  const mapped = mapLegacyState(candidate, options);
  return {
    ...candidate,
    schema_version: CANDIDATE_SCHEMA_VERSION,
    revision: candidate.revision ?? 1,
    content_hash: candidate.content_hash ?? candidateContentHash(candidate),
    candidate_kind: candidate.candidate_kind ?? ("pitfall_trap" satisfies CandidateKind),
    review_decision: mapped.review_decision,
    delivery_state: mapped.delivery_state,
    source_agent: candidate.source_agent ?? "unknown",
    // A migrated record carries no authorization: nothing on disk recorded one
    // bound to a revision, and inventing one would assert a user decision that
    // was never made. Re-approval is required before a migrated `staged`
    // record can be committed.
    ...(mapped.migration_warning ? { migration_warning: mapped.migration_warning } : {}),
    // `status` is deliberately preserved, never recomputed. §8.3: "No record
    // changes meaning merely because it was loaded by the new version." A
    // legacy `accepted` record with a broken trap link maps to approved+staged,
    // but rewriting its status to `proposed` would move it out of the reviewed
    // tab and make it editable again — a change of meaning, and lossy.
  };
}

/**
 * v2 -> v1, dropping exactly the fields v1 did not have.
 *
 * This is what makes the migration *reversible* in the sense the exit gate
 * asks for: restoring a backup proves only that a copy was kept, whereas
 * inverting the transform proves the new envelope added no information that
 * cannot be discarded cleanly.
 */
export function downgradeCandidate(candidate: CandidateTrap): CandidateTrap {
  const {
    schema_version,
    revision,
    content_hash,
    candidate_kind,
    destination_hint,
    destination_payload,
    destination_commit_id,
    review_decision,
    delivery_state,
    rationale,
    source_agent,
    source_manifest_refs,
    authorization,
    migration_warning,
    ...legacy
  } = candidate;
  return legacy;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function migrateCandidates(
  candidates: CandidateTrap[],
  options: MigrateCandidateOptions = {}
): CandidateTrap[] {
  return candidates.map((candidate) => migrateCandidate(candidate, options));
}

export function downgradeCandidates(candidates: CandidateTrap[]): CandidateTrap[] {
  return candidates.map(downgradeCandidate);
}

/**
 * What a downgrade cannot carry back.
 *
 * v1 -> v2 -> v1 is exact, because v2 only adds fields. The reverse is not:
 * v1 has no way to say "suppressed rather than rejected" or "committed then
 * rolled back", so those distinctions collapse. That is a property of the older
 * format, not a defect in the transform — but the user is told before it
 * happens rather than discovering it afterwards.
 */
export function downgradeLosses(candidates: CandidateTrap[]): string[] {
  const losses: string[] = [];
  for (const candidate of candidates) {
    if (candidate.review_decision === "suppressed") {
      losses.push(`${candidate.id}: "suppressed" becomes "rejected" — v1 cannot distinguish a skip from a judgement.`);
    }
    if (candidate.delivery_state === "rolled_back") {
      losses.push(`${candidate.id}: the record of a commit that was rolled back is not representable in v1.`);
    }
    if (candidate.authorization) {
      losses.push(`${candidate.id}: the recorded authorization is dropped; re-approval will be required.`);
    }
  }
  return losses;
}

/**
 * Applies a material edit: bump the revision, recompute the hash, and drop an
 * authorization that no longer describes what the user saw.
 */
export function withCandidateEdit(candidate: CandidateTrap, edited: CandidateTrap): CandidateTrap {
  const contentHash = candidateContentHash(edited);
  if (contentHash === (candidate.content_hash ?? candidateContentHash(candidate))) {
    // Not a material edit — tags, globs, severity and the like. The revision
    // and any authorization survive.
    return { ...edited, content_hash: contentHash };
  }

  const { authorization, ...rest } = edited;
  return {
    ...rest,
    revision: (candidate.revision ?? 1) + 1,
    content_hash: contentHash,
  };
}

/** Whether a recorded authorization still describes the candidate's content. */
export function authorizationIsCurrent(candidate: CandidateTrap): boolean {
  const authorization = candidate.authorization;
  if (!authorization) return false;
  return authorization.content_hash === (candidate.content_hash ?? candidateContentHash(candidate))
    && authorization.revision === (candidate.revision ?? 1);
}

export function axesOf(candidate: CandidateTrap): {
  review_decision: ReviewDecision;
  delivery_state: DeliveryState;
} {
  const migrated = migrateCandidate(candidate);
  return {
    review_decision: migrated.review_decision ?? "pending",
    delivery_state: migrated.delivery_state ?? "draft",
  };
}

function mapLegacyState(
  candidate: CandidateTrap,
  options: MigrateCandidateOptions
): { review_decision: ReviewDecision; delivery_state: DeliveryState; migration_warning?: string } {
  if (candidate.status === "rejected") {
    return { review_decision: "rejected", delivery_state: "draft" };
  }
  if (candidate.status !== "accepted") {
    return { review_decision: "pending", delivery_state: "draft" };
  }

  const trapId = candidate.accepted_trap_id;
  if (trapId === undefined) {
    return {
      review_decision: "approved",
      delivery_state: "staged",
      migration_warning: "Accepted before Phase 1B with no trap link recorded; re-approve before committing.",
    };
  }

  const scope = candidate.accepted_scope ?? (candidate.trap.scope === "global" ? "global" : "project");
  if (options.trapExists && !options.trapExists(trapId, scope)) {
    return {
      review_decision: "approved",
      delivery_state: "staged",
      migration_warning: `Accepted trap #${trapId} is missing from ${scope} scope; re-approve before committing.`,
    };
  }

  return { review_decision: "approved", delivery_state: "committed" };
}
