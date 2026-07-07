import {
  type TrapEvidenceInput,
  type TrapImportEvidence,
  type TrapImportRecord,
} from "../domain/trap";
import {
  importEvidenceToTrapInput,
  normalizeEvidenceForExport,
  normalizeTrapForExport,
} from "./trap-codec";

export { normalizeEvidenceForExport, normalizeTrapForExport };

export interface TrapArchiveImportAdapter {
  insertRecord(record: TrapImportRecord): { id: number; scope: string };
  addEvidence(
    id: number,
    input: TrapEvidenceInput,
    scope?: string
  ): { scope: string; evidence_id: number | null; success: boolean };
  linkSupersedes(id: number, supersedesId: number, scope: string): void;
}

export type TrapImportSkip = {
  index: number;
  title: string | null;
  error: string;
};

export type TrapArchiveImportResult = {
  imported: number;
  total: number;
  skipped: TrapImportSkip[];
};

export function importTrapArchive(
  records: TrapImportRecord[],
  adapter: TrapArchiveImportAdapter
): TrapArchiveImportResult {
  let count = 0;
  const skipped: TrapImportSkip[] = [];
  // Source ids are per-scope, so track one id map per destination scope.
  const idMaps = new Map<string, Map<number, number>>();
  const pendingSupersedes: { sourceSupersedesId: number; destinationId: number; scope: string }[] = [];

  for (const [index, record] of records.entries()) {
    try {
      const result = adapter.insertRecord(record);
      importEvidenceRecords(record.evidence ?? [], result, adapter);
      if (typeof record.id === "number") {
        let idMap = idMaps.get(result.scope);
        if (!idMap) idMaps.set(result.scope, idMap = new Map());
        idMap.set(record.id, result.id);
      }
      if (typeof record.supersedes_id === "number") {
        pendingSupersedes.push({
          sourceSupersedesId: record.supersedes_id,
          destinationId: result.id,
          scope: result.scope,
        });
      }
      count++;
    } catch (error) {
      // Import the valid traps, but report what was dropped instead of
      // silently pretending everything landed.
      skipped.push({
        index,
        title: typeof record?.title === "string" ? record.title : null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const pending of pendingSupersedes) {
    const destinationSupersedesId = idMaps.get(pending.scope)?.get(pending.sourceSupersedesId);
    if (destinationSupersedesId === undefined) continue;
    try {
      adapter.linkSupersedes(pending.destinationId, destinationSupersedesId, pending.scope);
    } catch {
      // A broken supersede link should not undo the imported trap.
    }
  }

  return { imported: count, total: records.length, skipped };
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
