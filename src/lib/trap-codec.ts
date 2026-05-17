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
import { buildTrapEvidenceInput } from "../domain/trap";
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
