import {
  buildTrapEvidenceInput,
  type TrapEvidence,
  type TrapEvidenceInput,
  type TrapExportEvidence,
  type TrapImportEvidence,
  type TrapImportRecord,
  type TrapInput,
} from "../domain/trap";
import {
  parseEvidenceRelatedFiles,
  parseOptionalEvidenceRelatedFiles,
  parseOptionalTrapTags,
} from "./trap-json-fields";

export interface TrapArchiveImportAdapter {
  add(input: TrapInput): { id: number; scope: string };
  addEvidence(
    id: number,
    input: TrapEvidenceInput,
    scope?: string
  ): { scope: string; evidence_id: number | null; success: boolean };
}

export function normalizeEvidenceForExport(evidence: TrapEvidence): TrapExportEvidence {
  return {
    ...evidence,
    related_files: parseEvidenceRelatedFiles(evidence.related_files),
  };
}

export function importTrapArchive(
  records: TrapImportRecord[],
  adapter: TrapArchiveImportAdapter
): number {
  let count = 0;
  for (const record of records) {
    try {
      const result = adapter.add(toTrapInput(record));
      importEvidenceRecords(record.evidence ?? [], result, adapter);
      count++;
    } catch {
      // Preserve legacy behavior: import valid traps even if another trap is malformed.
    }
  }
  return count;
}

function importEvidenceRecords(
  records: TrapImportEvidence[],
  trap: { id: number; scope: string },
  adapter: TrapArchiveImportAdapter
): void {
  for (const evidence of records) {
    try {
      adapter.addEvidence(
        trap.id,
        buildTrapEvidenceInput(toEvidenceInput(evidence)),
        trap.scope
      );
    } catch {
      // Preserve valid trap imports even if one evidence record is malformed.
    }
  }
}

function toTrapInput(record: TrapImportRecord): TrapInput {
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
  };
}

function toEvidenceInput(evidence: TrapImportEvidence): Record<string, unknown> {
  return {
    source_type: evidence.source_type,
    source_ref: evidence.source_ref ?? undefined,
    observed_at: evidence.observed_at ?? undefined,
    related_files: parseOptionalEvidenceRelatedFiles(evidence.related_files),
    note: evidence.note ?? undefined,
  };
}
