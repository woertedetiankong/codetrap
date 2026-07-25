import { existsSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_AGENT_BY_ID, type LearningSourceId } from "../domain/learning-source";
import { parseCandidateKind, type CandidateKind } from "../domain/candidate";
import { readJsonFile } from "./fs-json";
import {
  CANDIDATES_FILE,
  EVIDENCE_PACK_FILE,
  SOURCE_MANIFEST_FILE,
  type EvidencePack,
} from "./learning-review-dir";
import { isRecord } from "./value-types";

export type StagedCandidateDraft = {
  title: string;
  candidate_kind: CandidateKind;
  destination_hint?: string;
  trigger: string;
  lesson: string;
  recommended_action: string;
  rationale?: string;
  category?: string;
  scope?: string;
  severity?: string;
  tags?: string[];
  path_globs?: string[];
  module?: string;
  owner?: string;
  evidence: { ref: string; note?: string }[];
};

export type StageRejection = {
  index: number;
  title: string | null;
  errors: string[];
};

export type StageValidation = {
  accepted: StagedCandidateDraft[];
  rejected: StageRejection[];
  source: LearningSourceId;
  source_agent: string;
  review_id: string;
  known_refs: number;
};

/**
 * Deterministic verification, per §9.3: the agent proposes, the CLI checks that
 * every claimed reference actually resolves. Semantic judgment advises;
 * deterministic verification gates.
 *
 * A candidate that fails any check is reported with its reasons rather than
 * silently dropped — §8.4 forbids candidates disappearing without a trace.
 */
export function validateStagedCandidates(args: {
  reviewDir: string;
  raw: unknown;
  pack: EvidencePack;
}): StageValidation {
  const knownRefs = new Set(args.pack.items.map((item) => item.ref));
  const rows = Array.isArray(args.raw)
    ? args.raw
    : isRecord(args.raw) && Array.isArray(args.raw.candidates)
      ? args.raw.candidates
      : null;

  if (!rows) {
    throw new Error(
      `${CANDIDATES_FILE} must be a JSON array of candidates, or an object with a "candidates" array.`
    );
  }

  const accepted: StagedCandidateDraft[] = [];
  const rejected: StageRejection[] = [];

  rows.forEach((row, index) => {
    const errors: string[] = [];
    if (!isRecord(row)) {
      rejected.push({ index, title: null, errors: ["Candidate is not a JSON object."] });
      return;
    }

    const title = requiredText(row.title);
    const trigger = requiredText(row.trigger ?? row.context);
    const lesson = requiredText(row.lesson ?? row.mistake);
    const action = requiredText(row.recommended_action ?? row.fix);

    if (!title) errors.push("title is required.");
    // §8.4: no trigger means it cannot become a guardrail; no action means it
    // cannot enter runtime. Both are hard gates, not warnings.
    if (!trigger) errors.push("trigger is required — without it the lesson cannot become a guardrail (§8.4).");
    if (!action) errors.push("recommended_action is required — without it the lesson cannot enter runtime (§8.4).");
    if (!lesson) errors.push("lesson is required.");

    let kind: CandidateKind = "pitfall_trap";
    try {
      kind = parseCandidateKind(optionalText(row.candidate_kind));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const evidence = normalizeEvidence(row.evidence, knownRefs, errors);

    if (errors.length > 0) {
      rejected.push({ index, title, errors });
      return;
    }

    accepted.push({
      title: title as string,
      candidate_kind: kind,
      destination_hint: optionalText(row.destination_hint),
      trigger: trigger as string,
      lesson: lesson as string,
      recommended_action: action as string,
      rationale: optionalText(row.rationale),
      category: optionalText(row.category),
      scope: optionalText(row.scope),
      severity: optionalText(row.severity),
      tags: stringArray(row.tags),
      path_globs: stringArray(row.path_globs),
      module: optionalText(row.module),
      owner: optionalText(row.owner),
      evidence,
    });
  });

  return {
    accepted,
    rejected,
    source: args.pack.source,
    source_agent: SOURCE_AGENT_BY_ID[args.pack.source] ?? "unknown",
    review_id: args.pack.review_id,
    known_refs: knownRefs.size,
  };
}

export function readReviewArtifacts(reviewDir: string): { pack: EvidencePack; candidatesPath: string } {
  const packPath = join(reviewDir, EVIDENCE_PACK_FILE);
  const candidatesPath = join(reviewDir, CANDIDATES_FILE);
  if (!existsSync(packPath)) {
    throw new Error(`No ${EVIDENCE_PACK_FILE} in ${reviewDir}. Run 'codetrap learn evidence-pack' first.`);
  }
  if (!existsSync(join(reviewDir, SOURCE_MANIFEST_FILE))) {
    throw new Error(`No ${SOURCE_MANIFEST_FILE} in ${reviewDir}; the review directory is incomplete.`);
  }
  if (!existsSync(candidatesPath)) {
    throw new Error(
      `No ${CANDIDATES_FILE} in ${reviewDir}. An agent writes it from ${EVIDENCE_PACK_FILE}; see discovery-prompt.md.`
    );
  }
  return { pack: readJsonFile<EvidencePack>(packPath, "evidence pack"), candidatesPath };
}

/**
 * Maps a validated draft onto the trap shape `session capture` already accepts,
 * so staging reuses the Phase 1A/1B inbox rather than inventing a second one.
 */
export function draftToTrapInput(draft: StagedCandidateDraft): Record<string, unknown> {
  return {
    title: draft.title,
    category: draft.category ?? "convention",
    scope: draft.scope ?? "project",
    severity: draft.severity ?? "warning",
    tags: draft.tags,
    path_globs: draft.path_globs,
    module: draft.module,
    owner: draft.owner,
    context: draft.trigger,
    mistake: draft.lesson,
    fix: draft.recommended_action,
  };
}

function normalizeEvidence(
  value: unknown,
  knownRefs: Set<string>,
  errors: string[]
): { ref: string; note?: string }[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("evidence is required: at least one ref from the evidence pack.");
    return [];
  }

  const evidence: { ref: string; note?: string }[] = [];
  for (const item of value) {
    const record = isRecord(item) ? item : null;
    const ref = optionalText(record?.ref ?? item);
    if (!ref) {
      errors.push("evidence entry has no ref.");
      continue;
    }
    if (!knownRefs.has(ref)) {
      // The core §9.3 gate: a claimed pointer that does not resolve is not
      // evidence, and Phase 0 risk 5 was precisely evidence decaying into
      // paraphrase when nothing enforced it.
      errors.push(`evidence ref ${ref} does not appear in ${EVIDENCE_PACK_FILE}.`);
      continue;
    }
    evidence.push({ ref, note: optionalText(record?.note) });
  }
  return evidence;
}

function requiredText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : null;
}

function optionalText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}
