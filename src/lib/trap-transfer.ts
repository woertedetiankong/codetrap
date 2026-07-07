import type { TrapRecordInsert, TrapRepository } from "../db/repository";
import type { TrapExportEvidence, TrapExportRecord } from "../domain/trap";
import { DEFAULT_SEVERITY, DEFAULT_TRAP_STATUS } from "./constants";
import { buildTrapSearchText } from "./trap-search-document";
import { encodeTrapPathGlobs } from "./trap-json-fields";

export type TrapTransferMapping = {
  source_id: number;
  destination_id: number;
  title: string;
};

export function importProjectTrapTransfer(
  destination: TrapRepository,
  records: TrapExportRecord[],
  projectPath: string
): TrapTransferMapping[] {
  return destination.transaction(() => insertProjectTrapTransfer(destination, records, projectPath));
}

// The non-transactional core of the transfer, so a caller that already owns a
// transaction (the cross-DB migration, which copies here and deletes from the
// attached source in one atomic unit) can reuse it without nesting a second
// transaction. Callers with no ambient transaction should use
// importProjectTrapTransfer, which wraps this in one.
export function insertProjectTrapTransfer(
  destination: TrapRepository,
  records: TrapExportRecord[],
  projectPath: string
): TrapTransferMapping[] {
  const mappings: TrapTransferMapping[] = [];
  const idMap = new Map<number, number>();

  for (const record of records) {
    const destinationId = destination.insertTrapRecord(toProjectTransferRecord(record, projectPath));
    idMap.set(record.id, destinationId);
    mappings.push({ source_id: record.id, destination_id: destinationId, title: record.title });

    for (const evidence of record.evidence ?? []) {
      destination.addEvidence(destinationId, toEvidenceInput(evidence));
    }
  }

  for (const record of records) {
    if (record.supersedes_id === null) continue;
    const destinationId = idMap.get(record.id);
    const destinationSupersedesId = idMap.get(record.supersedes_id);
    if (destinationId !== undefined && destinationSupersedesId !== undefined) {
      destination.updateTrapSupersedesId(destinationId, destinationSupersedesId);
    }
  }

  return mappings;
}

export function deleteTransferredSourceTraps(
  source: TrapRepository,
  records: TrapExportRecord[]
): number {
  return source.deleteTrapsByIds(records.map((record) => record.id));
}

function toProjectTransferRecord(record: TrapExportRecord, projectPath: string): TrapRecordInsert {
  return {
    title: record.title,
    category: record.category,
    tags: record.tags,
    scope: "project",
    context: record.context,
    mistake: record.mistake,
    fix: record.fix,
    search_text: record.search_text || buildTrapSearchText(record),
    before_code: record.before_code,
    after_code: record.after_code,
    severity: record.severity ?? DEFAULT_SEVERITY,
    state_key: record.state_key,
    status: record.status ?? DEFAULT_TRAP_STATUS,
    supersedes_id: null,
    valid_from: record.valid_from,
    valid_until: record.valid_until,
    project_path: projectPath,
    path_globs: encodeTrapPathGlobs(record.path_globs),
    module: record.module,
    owner: record.owner,
    hit_count: record.hit_count ?? 0,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function toEvidenceInput(evidence: TrapExportEvidence) {
  return {
    source_type: evidence.source_type,
    source_ref: evidence.source_ref,
    observed_at: evidence.observed_at,
    related_files: evidence.related_files,
    note: evidence.note,
  };
}
