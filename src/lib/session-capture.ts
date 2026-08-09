import { CANDIDATE_SCHEMA_VERSION, type CandidateKind, type SourceAgent } from "../domain/candidate";
import type { CandidateTrap, SessionMetadata, SessionNote } from "../domain/session";
import { parseSessionNoteKind } from "../domain/session";
import { buildTrapInput } from "../domain/trap";
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  DEFAULT_SEVERITY,
  SCOPES,
  SEVERITIES,
} from "./constants";
import { uniqueStrings } from "./string-list";
import { trimOuterBlankLines } from "./text-lines";
import { scoreCandidateTrap } from "./trap-quality";
import { isRecord } from "./value-types";
import { candidateContentHash, trapContentKey, trapFingerprint } from "./candidate-identity";

export { trapContentKey, trapFingerprint } from "./candidate-identity";

export type CandidateDraft = Pick<CandidateTrap, "trap" | "evidence"> & {
  /** §8.2 provenance, populated by the Phase 1C adapters. */
  candidate_kind?: CandidateKind;
  source_agent?: SourceAgent;
  destination_hint?: string;
  rationale?: string;
  source_manifest_refs?: string[];
  destination_payload?: Record<string, unknown>;
};

export type CapturedCandidateDraftArgs = {
  trap: CandidateTrap["trap"];
  kind?: string;
  candidateKind?: CandidateKind;
  relatedFiles?: string[];
  sourceRef?: string | null;
  evidenceNote?: string | null;
  sourceAgent?: SourceAgent;
  destinationHint?: string;
  rationale?: string;
  sourceManifestRefs?: string[];
  destinationPayload?: Record<string, unknown>;
};

export type ParsedTrapMarkdownInput = {
  trap: CandidateTrap["trap"];
  evidenceNote?: string;
  relatedFiles?: string[];
};

const TRAP_MARKDOWN_FIELDS = new Set([
  "title",
  "trap_title",
  "context",
  "trigger",
  "mistake",
  "avoid",
  "fix",
  "do_instead",
  "category",
  "scope",
  "severity",
  "tags",
  "path_globs",
  "paths",
  "module",
  "owner",
  "before_code",
  "after_code",
  "evidence",
  "related_files",
]);

export function proposeCandidateTraps(session: SessionMetadata, notes: SessionNote[]): CandidateTrap[] {
  const candidates: CandidateTrap[] = [];
  for (const note of notes) {
    const draft = explicitTrapDraft(session, note);
    if (!draft) continue;

    candidates.push(createCandidateTrap(draft, `cand-${String(candidates.length + 1).padStart(3, "0")}`));
  }
  return candidates;
}

export function createCandidateTrap(draft: CandidateDraft, id: string): CandidateTrap {
  const scored = scoreCandidateTrap(draft);
  return {
    id,
    status: "proposed",
    quality_score: scored.score,
    quality: scored.quality,
    trap: draft.trap,
    evidence: draft.evidence,
    schema_version: CANDIDATE_SCHEMA_VERSION,
    revision: 1,
    content_hash: candidateContentHash(draft),
    candidate_kind: draft.candidate_kind ?? "pitfall_trap",
    review_decision: "pending",
    delivery_state: "draft",
    source_agent: draft.source_agent ?? "unknown",
    ...(draft.destination_hint ? { destination_hint: draft.destination_hint } : {}),
    ...(draft.rationale ? { rationale: draft.rationale } : {}),
    ...(draft.source_manifest_refs?.length ? { source_manifest_refs: draft.source_manifest_refs } : {}),
    ...(draft.destination_payload ? { destination_payload: draft.destination_payload } : {}),
  };
}

export function mergeCandidateTraps(existing: CandidateTrap[], proposed: CandidateTrap[]): CandidateTrap[] {
  const merged = [...existing];
  const seen = new Set(merged.map(candidateTrapKey));
  for (const candidate of proposed) {
    const key = candidateTrapKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...candidate, id: nextCandidateId(merged) });
  }
  return merged;
}

export function candidateTrapKey(candidate: CandidateTrap): string {
  return candidateContentHash(candidate);
}

/**
 * The identity of a lesson, independent of which session proposed it: the
 * material fields normalized for whitespace and case. Two mining runs over the
 * same evidence produce the same key, which is what lets a suppression survive
 * a re-run (§16 Phase 1A).
 */
export function nextCandidateId(candidates: CandidateTrap[]): string {
  const max = candidates
    .map((candidate) => candidate.id.match(/^cand-(\d+)$/)?.[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)
    .reduce((highest, value) => Math.max(highest, value), 0);
  return `cand-${String(max + 1).padStart(3, "0")}`;
}

export function capturedTrapInput(args: Record<string, unknown>): CandidateTrap["trap"] {
  return normalizeCandidateTrap({
    ...args,
    category: args.category ?? DEFAULT_CATEGORY,
    scope: args.scope ?? "project",
    severity: args.severity ?? DEFAULT_SEVERITY,
  }) as CandidateTrap["trap"];
}

export function capturedTrapMarkdownInput(markdown: string): ParsedTrapMarkdownInput {
  const fields = parseTrapMarkdownFields(markdown);
  const trap = trapFromParsedFields(fields);
  const evidenceNote = optionalText(fields.evidence);
  return {
    trap,
    evidenceNote: evidenceNote ?? undefined,
    relatedFiles: stringArray(fields.related_files),
  };
}

export function capturedCandidateDraft(
  session: SessionMetadata,
  args: CapturedCandidateDraftArgs
): CandidateDraft {
  const kind = parseSessionNoteKind(args.kind);
  return {
    trap: args.trap,
    evidence: [{
      source_type: kind === "test_failure" ? "test_failure" : "conversation",
      source_ref: args.sourceRef ?? `session:${session.id}`,
      related_files: uniqueStrings(args.relatedFiles ?? []),
      note: optionalText(args.evidenceNote) ?? `Captured through session capture (${kind}).`,
    }],
    ...(args.candidateKind ? { candidate_kind: args.candidateKind } : {}),
    ...(args.sourceAgent ? { source_agent: args.sourceAgent } : {}),
    ...(args.destinationHint ? { destination_hint: args.destinationHint } : {}),
    ...(args.rationale ? { rationale: args.rationale } : {}),
    ...(args.sourceManifestRefs?.length ? { source_manifest_refs: args.sourceManifestRefs } : {}),
    ...(args.destinationPayload ? { destination_payload: args.destinationPayload } : {}),
  };
}

export function captureGoal(goal: string | undefined, title: string): string {
  const trimmed = goal?.trim();
  return trimmed ? trimmed : `capture: ${title}`;
}

export function candidateWithTrapEdits(
  candidate: CandidateTrap,
  edit: Record<string, unknown> | undefined
): CandidateTrap {
  return {
    ...candidate,
    trap: normalizeCandidateTrap({
      ...candidate.trap,
      ...trapEdits(edit),
    }) as CandidateTrap["trap"],
  };
}

function explicitTrapDraft(session: SessionMetadata, note: SessionNote): CandidateDraft | null {
  const fields = parseTrapMarkdownFields(note.text);
  const title = fields.title ?? fields.trap_title;
  const context = fields.context ?? fields.trigger;
  const mistake = fields.mistake ?? fields.avoid;
  const fix = fields.fix ?? fields.do_instead;
  if (!title || !context || !mistake || !fix) return null;

  return {
    trap: normalizeCandidateTrap({
      title,
      category: fields.category,
      scope: fields.scope,
      context,
      mistake,
      fix,
      severity: fields.severity,
      tags: fields.tags,
      path_globs: fields.path_globs ?? fields.paths ?? fields.related_files ?? note.related_files,
      module: fields.module ?? session.module,
      owner: fields.owner ?? session.owner,
      before_code: fields.before_code,
      after_code: fields.after_code,
    }, { strictEnums: false }) as CandidateTrap["trap"],
    evidence: [evidenceFromNote(session, note, "Captured from explicit session candidate fields.")],
  };
}

function trapFromParsedFields(
  fields: Record<string, unknown>,
  options: { strictEnums?: boolean } = {}
): CandidateTrap["trap"] {
  return normalizeCandidateTrap({
    title: fields.title ?? fields.trap_title,
    category: fields.category,
    scope: fields.scope,
    context: fields.context ?? fields.trigger,
    mistake: fields.mistake ?? fields.avoid,
    fix: fields.fix ?? fields.do_instead,
    severity: fields.severity,
    tags: fields.tags,
    path_globs: fields.path_globs ?? fields.paths,
    module: fields.module,
    owner: fields.owner,
    before_code: stripOuterFence(optionalText(fields.before_code)),
    after_code: stripOuterFence(optionalText(fields.after_code)),
  }, options) as CandidateTrap["trap"];
}

function normalizeKeyPart(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function evidenceFromNote(session: SessionMetadata, note: SessionNote, noteText: string) {
  return {
    source_type: note.kind === "test_failure" ? "test_failure" : "conversation",
    source_ref: note.source_ref ?? `session:${session.id}`,
    related_files: note.related_files,
    note: noteText,
  };
}

function parseTrapMarkdownFields(text: string): Record<string, string> {
  const fields: Record<string, string[]> = {};
  let currentField: string | null = null;
  let fenceMarker: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const fence = line.match(/^\s*(```|~~~)/)?.[1] ?? null;
    if (fence !== null) {
      if (currentField) fields[currentField].push(line);
      fenceMarker = fenceMarker === null ? fence : fenceMarker === fence ? null : fenceMarker;
      continue;
    }

    if (fenceMarker === null) {
      const match = line.match(/^([A-Za-z][A-Za-z0-9 _-]{0,40}):\s*(.*)$/);
      if (match && isTrapMarkdownField(match[1])) {
        currentField = normalizeFieldName(match[1]);
        fields[currentField] = fields[currentField] ?? [];
        if (match[2].trim() !== "") fields[currentField].push(match[2].trimEnd());
        continue;
      }
    }

    if (currentField) fields[currentField].push(line);
  }

  return Object.fromEntries(
    Object.entries(fields)
      .map(([field, lines]) => [field, trimFieldLines(lines)])
  );
}

function normalizeFieldName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isTrapMarkdownField(value: string): boolean {
  return TRAP_MARKDOWN_FIELDS.has(normalizeFieldName(value));
}

function trimFieldLines(lines: string[]): string {
  return trimOuterBlankLines(lines).join("\n").trim();
}

function normalizeCandidateTrap(
  args: Record<string, unknown>,
  options: { strictEnums?: boolean } = {}
) {
  const strictEnums = options.strictEnums ?? true;
  return buildTrapInput({
    ...args,
    title: requiredText(args.title, "title"),
    category: enumText(args.category, CATEGORIES, DEFAULT_CATEGORY, "category", strictEnums),
    scope: enumText(args.scope, SCOPES, "project", "scope", strictEnums),
    context: requiredText(args.context, "context"),
    mistake: requiredText(args.mistake, "mistake"),
    fix: requiredText(args.fix, "fix"),
    tags: stringArray(args.tags),
    path_globs: stringArray(args.path_globs),
    module: optionalText(args.module),
    owner: optionalText(args.owner),
    before_code: optionalText(args.before_code),
    after_code: optionalText(args.after_code),
    severity: enumText(args.severity, SEVERITIES, DEFAULT_SEVERITY, "severity", strictEnums),
  });
}

function requiredText(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`trap ${field} is required.`);
  return text;
}

function enumText<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
  field: string,
  strict: boolean
): T[number] {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const text = String(value).trim();
  if ((allowed as readonly string[]).includes(text)) return text as T[number];
  if (!strict) return fallback;
  throw new Error(`Invalid trap ${field}: ${text}. Expected one of: ${allowed.join(", ")}`);
}

function stringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    const values = value
      .split(/\r?\n/)
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
        return (bullet?.[1] ?? trimmed).split(",");
      })
      .map((item) => item.trim())
      .filter(Boolean);
    return values.length > 0 ? values : undefined;
  }
  return undefined;
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function stripOuterFence(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const lines = value.split(/\r?\n/);
  const first = lines[0]?.trim();
  const last = lines[lines.length - 1]?.trim();
  if (lines.length >= 2 && first?.startsWith("```") && last === "```") {
    return lines.slice(1, -1).join("\n").trim();
  }
  if (lines.length >= 2 && first?.startsWith("~~~") && last === "~~~") {
    return lines.slice(1, -1).join("\n").trim();
  }
  return value;
}

function trapEdits(edit: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!edit) return {};
  const nested = edit.trap;
  return isRecord(nested) ? nested : edit;
}
