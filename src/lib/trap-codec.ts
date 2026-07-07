import type {
  Trap,
  TrapEvidence,
  TrapEvidenceInput,
  TrapExportEvidence,
  TrapExportRecord,
  TrapImportEvidence,
  TrapImportRecord,
  TrapInput,
  TrapUpdate,
} from "../domain/trap";
import { buildTrapEvidenceInput, parseTrapStatus } from "../domain/trap";
import { DEFAULT_SEVERITY, DEFAULT_TRAP_STATUS, type TrapStatus } from "./constants";
import {
  parseEvidenceRelatedFiles,
  parseOptionalEvidenceRelatedFiles,
  parseOptionalTrapPathGlobs,
  parseOptionalTrapTags,
  parseTrapPathGlobs,
  parseTrapTags,
  encodeTrapPathGlobs,
  encodeTrapTags,
} from "./trap-json-fields";
import { buildTrapSearchText } from "./trap-search-document";

export type JsonTrap = Omit<Trap, "tags" | "path_globs"> & {
  tags: string[];
  path_globs: string[];
};

export type JsonTrapEvidence = Omit<TrapEvidence, "related_files"> & {
  related_files: string[];
};

export function toTrapJson(trap: Trap): JsonTrap {
  return {
    ...trap,
    tags: parseTrapTags(trap.tags),
    path_globs: parseTrapPathGlobs(trap.path_globs),
  };
}

export function toTrapEvidenceJson(evidence: TrapEvidence): JsonTrapEvidence {
  return {
    ...evidence,
    related_files: parseEvidenceRelatedFiles(evidence.related_files),
  };
}

export function normalizeTrapForExport(trap: Trap): Omit<TrapExportRecord, "evidence"> {
  return {
    ...trap,
    path_globs: parseTrapPathGlobs(trap.path_globs),
  };
}

export function normalizeEvidenceForExport(evidence: TrapEvidence): TrapExportEvidence {
  return {
    ...evidence,
    related_files: parseEvidenceRelatedFiles(evidence.related_files),
  };
}

export function importRecordToTrapInput(record: TrapImportRecord): TrapInput {
  return {
    title: record.title,
    category: record.category,
    tags: parseOptionalTrapTags(record.tags),
    scope: record.scope,
    context: record.context,
    mistake: record.mistake,
    fix: record.fix,
    before_code: record.before_code ?? undefined,
    after_code: record.after_code ?? undefined,
    severity: record.severity ?? undefined,
    project_path: record.project_path ?? undefined,
    path_globs: parseOptionalTrapPathGlobs(record.path_globs),
    module: record.module ?? undefined,
    owner: record.owner ?? undefined,
  };
}

export function importRecordToTrapRecordInsert(
  record: TrapImportRecord,
  projectPath: string | null
): Omit<Trap, "id"> {
  const input = importRecordToTrapInput(record);
  const fields = encodeTrapInsertFields(input);
  const createdAt = record.created_at ?? sqliteNow();
  return {
    title: input.title,
    category: input.category,
    tags: fields.tags,
    scope: input.scope,
    context: input.context,
    mistake: input.mistake,
    fix: input.fix,
    search_text: fields.search_text,
    before_code: input.before_code ?? null,
    after_code: input.after_code ?? null,
    severity: input.severity ?? DEFAULT_SEVERITY,
    state_key: record.state_key ?? null,
    status: parseTrapImportStatus(record.status),
    // Remapped after the whole batch inserts, once destination ids are known.
    supersedes_id: null,
    valid_from: record.valid_from ?? createdAt,
    valid_until: record.valid_until ?? null,
    project_path: input.scope === "project" ? projectPath : null,
    path_globs: fields.path_globs,
    module: input.module ?? null,
    owner: input.owner ?? null,
    hit_count: record.hit_count ?? 0,
    created_at: createdAt,
    updated_at: record.updated_at ?? createdAt,
  };
}

function parseTrapImportStatus(status: string | null | undefined): TrapStatus {
  if (status === undefined || status === null) return DEFAULT_TRAP_STATUS;
  const parsed = parseTrapStatus(status);
  if (parsed === undefined || parsed === "all") return DEFAULT_TRAP_STATUS;
  return parsed;
}

function sqliteNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function importEvidenceToTrapInput(evidence: TrapImportEvidence): TrapEvidenceInput {
  return buildTrapEvidenceInput({
    source_type: evidence.source_type,
    source_ref: evidence.source_ref ?? undefined,
    observed_at: evidence.observed_at ?? undefined,
    related_files: parseOptionalEvidenceRelatedFiles(evidence.related_files),
    note: evidence.note ?? undefined,
  });
}

export function encodeTrapInsertFields(input: TrapInput): {
  tags: string;
  path_globs: string;
  search_text: string;
} {
  const tags = encodeTrapTags(input.tags);
  const pathGlobs = encodeTrapPathGlobs(input.path_globs);
  return {
    tags,
    path_globs: pathGlobs,
    search_text: buildTrapSearchText({ ...input, tags, path_globs: pathGlobs }),
  };
}

export function mergeTrapUpdateForSearchText(current: Trap, input: TrapUpdate): Trap {
  return {
    ...current,
    ...input,
    tags: input.tags !== undefined ? encodeTrapTags(input.tags) : current.tags,
    path_globs: input.path_globs !== undefined ? encodeTrapPathGlobs(input.path_globs) : current.path_globs,
  };
}
