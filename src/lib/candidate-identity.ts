import { createHash } from "node:crypto";
import type { CandidateTrap } from "../domain/session";

/**
 * Material candidate identity shared by capture, dedup, edits, and approvals.
 * Keeping one implementation prevents a candidate from changing identity only
 * because it moved from the draft path to the authorization path.
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
  return shortHash(JSON.stringify(normalized));
}

/** The identity of a lesson independent of session and formatting noise. */
export function trapContentKey(trap: CandidateTrap["trap"]): string {
  return [
    trap.title,
    trap.context,
    trap.mistake,
    trap.fix,
    trap.scope,
  ].map(normalizeKeyPart).join("\u0000");
}

/** Stable short hash of `trapContentKey`, used as the suppression fingerprint. */
export function trapFingerprint(trap: CandidateTrap["trap"]): string {
  return shortHash(trapContentKey(trap));
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

function normalizeKeyPart(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
