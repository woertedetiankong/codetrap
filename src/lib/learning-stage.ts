import { existsSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_AGENT_BY_ID, type LearningSourceId } from "../domain/learning-source";
import { parseCandidateKind, type CandidateKind } from "../domain/candidate";
import type { CandidateTrap } from "../domain/session";
import { buildTrapInput } from "../domain/trap";
import { readJsonFile } from "./fs-json";
import {
  CANDIDATES_FILE,
  EVIDENCE_PACK_FILE,
  SOURCE_MANIFEST_FILE,
  type EvidencePack,
} from "./learning-review-dir";
import { isRecord } from "./value-types";
import type { CoverageClaim } from "./coverage-verify";
import { INSIGHT_SOURCE_TYPES, type InsightSourceType } from "./phase2-store";
import {
  normalizeCollectionContextSections,
  normalizeSourceCoverage,
  normalizeSourceUnitRefs,
  type CollectionContextSection,
  type SourceCoverageManifest,
} from "../domain/source-coverage";
import { normalizeInsightCollectionBatches } from "./insight-collection-batch";

export type StagedInsightCollection = {
  id?: string;
  title: string;
  summary?: string;
  source_type?: InsightSourceType;
  source_refs?: string[];
  topics?: string[];
  source_coverage?: SourceCoverageManifest;
  context_sections?: CollectionContextSection[];
  position: number;
};

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
  source_type?: InsightSourceType;
  topics?: string[];
  source_unit_refs?: string[];
  collection?: StagedInsightCollection;
  evidence: { ref: string; note?: string }[];
  /** Agent coverage claims, verified deterministically at staging (§9.3). */
  coverage?: CoverageClaim;
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

  const acceptedRows: { index: number; draft: StagedCandidateDraft }[] = [];
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
    const sourceType = normalizeSourceType(row.source_type, errors);
    const collection = normalizeInsightCollection(row.collection, errors);
    const sourceUnitRefs = normalizeCandidateSourceUnitRefs(row.source_unit_refs, collection, errors);
    if (collection && !collection.source_coverage
      && (kind === "insight" || optionalText(row.destination_hint) === "insight")) {
      errors.push("collection.source_coverage is required for new learning collections.");
    }
    if (collection?.source_coverage) {
      if (collection.source_coverage.mode !== "sampled") {
        errors.push("AI-session learning review collections must use source_coverage.mode sampled.");
      }
      if (collection.source_coverage.source_fingerprint !== args.pack.source_fingerprint) {
        errors.push("collection.source_coverage.source_fingerprint does not match the evidence pack.");
      }
    }
    if ((sourceType || collection || Array.isArray(row.topics) || Array.isArray(row.source_unit_refs))
      && kind !== "insight" && optionalText(row.destination_hint) !== "insight") {
      errors.push("source_type, topics, source_unit_refs, and collection are only valid for learning insights.");
    }

    if (errors.length > 0) {
      rejected.push({ index, title, errors });
      return;
    }

    acceptedRows.push({ index, draft: {
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
      source_type: sourceType,
      topics: stringArray(row.topics),
      source_unit_refs: sourceUnitRefs,
      collection,
      evidence,
      coverage: isRecord(row.coverage) ? (row.coverage as CoverageClaim) : undefined,
    } });
  });

  const batchErrors = validateInsightCollectionBatches(acceptedRows.map((entry) => entry.draft));
  const accepted: StagedCandidateDraft[] = [];
  for (const entry of acceptedRows) {
    const errors = batchErrors.get(entry.draft);
    if (errors?.length) {
      rejected.push({ index: entry.index, title: entry.draft.title, errors });
    } else {
      accepted.push(entry.draft);
    }
  }

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
export function draftToTrapInput(draft: StagedCandidateDraft): CandidateTrap["trap"] {
  return buildTrapInput({
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
  });
}

export function insightDestinationPayload(
  draft: StagedCandidateDraft,
  sourceRefs: string[],
  fallbackSourceType: InsightSourceType = "conversation"
): Record<string, unknown> | undefined {
  const isInsight = draft.candidate_kind === "insight" || draft.destination_hint?.trim().toLocaleLowerCase() === "insight";
  if (!isInsight) return undefined;
  return {
    title: draft.title,
    summary: draft.rationale ?? draft.lesson,
    body: draft.recommended_action,
    tags: draft.tags ?? [],
    source_refs: sourceRefs,
    source_type: draft.source_type ?? fallbackSourceType,
    topics: draft.topics ?? [],
    source_unit_refs: draft.source_unit_refs ?? [],
    ...(draft.collection ? {
      // Collection-level metadata is stamped once for the whole batch during
      // validation. Never derive it again from this individual chapter.
      collection: { ...draft.collection },
    } : {}),
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

function normalizeSourceType(value: unknown, errors: string[]): InsightSourceType | undefined {
  const sourceType = optionalText(value)?.toLocaleLowerCase();
  if (!sourceType) return undefined;
  if (!(INSIGHT_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    errors.push(`source_type must be one of: ${INSIGHT_SOURCE_TYPES.join(", ")}.`);
    return undefined;
  }
  return sourceType as InsightSourceType;
}

function normalizeInsightCollection(value: unknown, errors: string[]): StagedInsightCollection | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    errors.push("collection must be an object.");
    return undefined;
  }
  const title = requiredText(value.title);
  const position = value.position;
  if (!title) errors.push("collection.title is required.");
  if (typeof position !== "number" || !Number.isInteger(position) || position < 1) {
    errors.push("collection.position must be a positive integer.");
  }
  const sourceType = normalizeSourceType(value.source_type, errors);
  let sourceCoverage: SourceCoverageManifest | undefined;
  try {
    sourceCoverage = normalizeSourceCoverage(value.source_coverage, "collection.source_coverage");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  let contextSections: CollectionContextSection[] = [];
  try {
    contextSections = normalizeCollectionContextSections(
      value.context_sections,
      sourceCoverage,
      "collection.context_sections"
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (!title || typeof position !== "number" || !Number.isInteger(position) || position < 1) return undefined;
  return {
    id: optionalText(value.id),
    title,
    summary: optionalText(value.summary),
    source_type: sourceType,
    source_refs: stringArray(value.source_refs),
    topics: stringArray(value.topics),
    source_coverage: sourceCoverage,
    context_sections: contextSections.length > 0 ? contextSections : undefined,
    position,
  };
}

function normalizeCandidateSourceUnitRefs(
  value: unknown,
  collection: StagedInsightCollection | undefined,
  errors: string[]
): string[] | undefined {
  try {
    const refs = normalizeSourceUnitRefs(value, collection?.source_coverage, "source_unit_refs");
    if (collection?.source_coverage && refs.length === 0) {
      errors.push("source_unit_refs must identify at least one learned source unit when collection.source_coverage is present.");
    }
    return refs.length > 0 ? refs : undefined;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function validateInsightCollectionBatches(
  drafts: StagedCandidateDraft[]
): Map<StagedCandidateDraft, string[]> {
  const errors = new Map<StagedCandidateDraft, string[]>();
  const members: Array<{
    draft: StagedCandidateDraft;
    payload: Record<string, unknown>;
  }> = [];
  for (const draft of drafts) {
    const payload = insightDestinationPayload(
      draft,
      draft.evidence.map((item) => item.ref)
    );
    if (payload?.collection) members.push({ draft, payload });
  }

  const issues = normalizeInsightCollectionBatches(
    members.map((member) => ({ payload: member.payload }))
  );
  for (const issue of issues) {
    for (const index of issue.member_indexes) {
      const draft = members[index]?.draft;
      if (!draft) continue;
      const current = errors.get(draft) ?? [];
      if (!current.includes(issue.message)) current.push(issue.message);
      errors.set(draft, current);
    }
  }

  // Persist the shared contract on accepted drafts. `learn stage --apply`
  // later rebuilds each destination payload from these drafts, so CLI apply and
  // Web edit see the same stamped collection metadata as Phase 2 proposals.
  members.forEach(({ draft, payload }) => {
    if (errors.has(draft)) return;
    draft.collection = payload.collection as StagedInsightCollection;
  });
  return errors;
}
