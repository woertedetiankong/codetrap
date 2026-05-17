import {
  type TrapEvidenceInput,
  type TrapImportEvidence,
  type TrapImportRecord,
  type TrapInput,
} from "../domain/trap";
import {
  importEvidenceToTrapInput,
  importRecordToTrapInput,
  normalizeEvidenceForExport,
  normalizeTrapForExport,
} from "./trap-codec";

export { normalizeEvidenceForExport, normalizeTrapForExport };

export interface TrapArchiveImportAdapter {
  add(input: TrapInput): { id: number; scope: string };
  addEvidence(
    id: number,
    input: TrapEvidenceInput,
    scope?: string
  ): { scope: string; evidence_id: number | null; success: boolean };
}

export function importTrapArchive(
  records: TrapImportRecord[],
  adapter: TrapArchiveImportAdapter
): number {
  let count = 0;
  for (const record of records) {
    try {
      const result = adapter.add(importRecordToTrapInput(record));
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
        importEvidenceToTrapInput(evidence),
        trap.scope
      );
    } catch {
      // Preserve valid trap imports even if one evidence record is malformed.
    }
  }
}
