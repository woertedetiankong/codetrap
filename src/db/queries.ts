import type { Database, SQLQueryBindings } from "bun:sqlite";
import { DEFAULT_SEVERITY, DEFAULT_TRAP_STATUS, type TrapStatus } from "../lib/constants";
import {
  TRAP_UPDATE_FIELDS,
  type Trap,
  type TrapEvidence,
  type TrapExportRecord,
  type TrapEvidenceInput,
  type TrapInput,
  type TrapSearchResult,
  type TrapUpdate,
} from "../domain/trap";
import { prepareFTSQuery } from "../lib/fts-query";
import { normalizeQuery } from "../lib/search-normalizer";
import {
  encodeTrapInsertFields,
  mergeTrapUpdateForSearchText,
  normalizeEvidenceForExport,
  normalizeTrapForExport,
} from "../lib/trap-codec";
import { encodeEvidenceRelatedFiles, encodeTrapPathGlobs, encodeTrapTags } from "../lib/trap-json-fields";
import { buildTrapSearchText, passageFieldsChanged, searchTextFieldsChanged } from "../lib/trap-search-document";

export type TrapStatusFilter = TrapStatus | "all";
export type TrapRecordInsert = Omit<Trap, "id">;

export function insertTrap(db: Database, input: TrapInput): number {
  const fields = encodeTrapInsertFields(input);
  const stmt = db.prepare(`
    INSERT INTO traps (
      title, category, tags, scope, context, mistake, fix, search_text,
      before_code, after_code, severity, state_key, status, supersedes_id,
      valid_from, valid_until, project_path, path_globs, module, owner
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    input.title,
    input.category,
    fields.tags,
    input.scope,
    input.context,
    input.mistake,
    input.fix,
    fields.search_text,
    input.before_code ?? null,
    input.after_code ?? null,
    input.severity ?? DEFAULT_SEVERITY,
    null,
    DEFAULT_TRAP_STATUS,
    null,
    null,
    input.project_path ?? null,
    fields.path_globs,
    normalizeOptionalText(input.module),
    normalizeOptionalText(input.owner)
  );
  return Number(result.lastInsertRowid);
}

export function searchTraps(
  db: Database,
  query: string,
  opts: { category?: string; scope?: string; limit?: number; offset?: number; status?: TrapStatusFilter; module?: string; owner?: string } = {}
): TrapSearchResult[] {
  const prepared = prepareFTSQuery(normalizeQuery(query));
  if (!prepared) return [];

  const conditions = ["traps_fts MATCH ?"];
  const params: SQLQueryBindings[] = [prepared];

  addTrapFilters(conditions, params, opts, "t");

  params.push(opts.limit ?? 20);

  // Only append OFFSET when paging so the common no-offset query keeps a
  // stable SQL string (and thus a single cached prepared statement).
  let pagination = "LIMIT ?";
  if (opts.offset && opts.offset > 0) {
    pagination += " OFFSET ?";
    params.push(opts.offset);
  }

  const rows = db
    .query(
      `
    SELECT t.*, rank
    FROM traps_fts f
    JOIN traps t ON t.id = f.rowid
    WHERE ${conditions.join(" AND ")}
    ORDER BY rank
    ${pagination}
  `
    )
    .all(...params) as (Trap & { rank: number })[];
  return rows.map((r) => ({ trap: r, rank: r.rank }));
}

export function getTrap(db: Database, id: number): Trap | null {
  return db.query("SELECT * FROM traps WHERE id = ?").get(id) as Trap | null;
}

export function listTraps(
  db: Database,
  opts: { category?: string; scope?: string; limit?: number; offset?: number; status?: TrapStatusFilter; module?: string; owner?: string } = {}
): Trap[] {
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];

  addTrapFilters(conditions, params, opts);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  return db
    .query(`SELECT * FROM traps ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Trap[];
}

export function updateTrap(db: Database, id: number, input: TrapUpdate): boolean {
  const updates: string[] = [];
  const params: SQLQueryBindings[] = [];
  const current = searchTextFieldsChanged(input) || passageFieldsChanged(input) ? getTrap(db, id) : null;

  for (const key of TRAP_UPDATE_FIELDS) {
    if (key === "tags" || key === "path_globs") continue;
    const value = input[key];
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      params.push(key === "module" || key === "owner" ? normalizeOptionalText(value) : value ?? null);
    }
  }
  if (input.tags !== undefined) {
    updates.push("tags = ?");
    params.push(encodeTrapTags(input.tags));
  }
  if (input.path_globs !== undefined) {
    updates.push("path_globs = ?");
    params.push(encodeTrapPathGlobs(input.path_globs));
  }

  if (current && searchTextFieldsChanged(input)) {
    const merged = mergeTrapUpdateForSearchText(current, input);
    updates.push("search_text = ?");
    params.push(buildTrapSearchText(merged));
  }

  if (updates.length === 0) return false;

  updates.push("updated_at = datetime('now')");
  params.push(id);

  const result = db.prepare(`UPDATE traps SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  return result.changes > 0;
}

export function deleteTrap(db: Database, id: number): boolean {
  const result = db.prepare("DELETE FROM traps WHERE id = ?").run(id);
  return result.changes > 0;
}

export function addTrapEvidence(db: Database, trapId: number, input: TrapEvidenceInput): number {
  const result = db
    .prepare(
      `
      INSERT INTO trap_evidence (
        trap_id, source_type, source_ref, observed_at, related_files, note
      )
      -- L3: normalize observed_at to SQLite's canonical 'YYYY-MM-DD HH:MM:SS'
      -- via datetime() so a caller-supplied ISO string (with 'T'/'Z') doesn't
      -- interleave incorrectly with datetime('now') values under lexical sort.
      VALUES (?, ?, ?, COALESCE(datetime(?), datetime('now')), ?, ?)
    `
    )
    .run(
      trapId,
      input.source_type,
      input.source_ref ?? null,
      input.observed_at ?? null,
      encodeEvidenceRelatedFiles(input.related_files),
      input.note ?? null
    );
  return Number(result.lastInsertRowid);
}

export function listTrapEvidence(db: Database, trapId: number): TrapEvidence[] {
  return db
    .query("SELECT * FROM trap_evidence WHERE trap_id = ? ORDER BY datetime(observed_at) DESC, id DESC")
    .all(trapId) as TrapEvidence[];
}

export function markTrapArchived(db: Database, id: number): boolean {
  const result = db
    .prepare(
      `
      UPDATE traps
      SET status = 'archived',
          valid_until = COALESCE(valid_until, datetime('now')),
          updated_at = datetime('now')
      WHERE id = ?
    `
    )
    .run(id);
  return result.changes > 0;
}

export function markTrapSuperseded(db: Database, id: number, stateKey: string): boolean {
  const result = db.prepare(supersedeTrapSql).run(stateKey, id);
  return result.changes > 0;
}

export function markTrapSuperseding(db: Database, id: number, supersedesId: number, stateKey: string): boolean {
  const result = db.prepare(supersedingTrapSql).run(stateKey, supersedesId, id);
  return result.changes > 0;
}

const supersedeTrapSql = `
  UPDATE traps
  SET status = 'superseded',
      state_key = ?,
      valid_until = COALESCE(valid_until, datetime('now')),
      updated_at = datetime('now')
  WHERE id = ?
`;

const supersedingTrapSql = `
  UPDATE traps
  SET status = 'active',
      state_key = ?,
      supersedes_id = ?,
      valid_from = COALESCE(valid_from, datetime('now')),
      valid_until = NULL,
      updated_at = datetime('now')
  WHERE id = ?
`;

export function incrementHitCount(db: Database, id: number): void {
  // L2: viewing a trap must not bump updated_at — otherwise merely reading a
  // trap reorders `list` (which sorts by updated_at DESC). hit_count is its own
  // signal; the FTS AFTER UPDATE trigger only re-syncs the index, not timestamps.
  db.prepare("UPDATE traps SET hit_count = hit_count + 1 WHERE id = ?").run(id);
}

/**
 * Records that a lesson actually helped, which is a different claim from having
 * been retrieved. Like `incrementHitCount` this deliberately leaves
 * `updated_at` alone so feedback does not reorder `list`.
 */
export function markTrapUseful(db: Database, id: number, at: string): boolean {
  const result = db
    .prepare("UPDATE traps SET useful_count = useful_count + 1, last_useful_at = ? WHERE id = ?")
    .run(at, id);
  return result.changes > 0;
}

export function getTopTraps(db: Database, scope: string, limit = 20): Trap[] {
  return db
    .query("SELECT * FROM traps WHERE scope = ? AND status = 'active' ORDER BY hit_count DESC LIMIT ?")
    .all(scope, limit) as Trap[];
}

export function getStats(db: Database, opts: { scope?: string; status?: TrapStatusFilter } = {}): {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
} {
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];
  addTrapFilters(conditions, params, opts);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const total = (db.query(`SELECT COUNT(*) as c FROM traps ${where}`).get(...params) as { c: number }).c;
  const byCategory = db
    .query(`SELECT category, COUNT(*) as c FROM traps ${where} GROUP BY category`)
    .all(...params) as { category: string; c: number }[];
  const bySeverity = db
    .query(`SELECT severity, COUNT(*) as c FROM traps ${where} GROUP BY severity`)
    .all(...params) as { severity: string; c: number }[];

  return {
    total,
    byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.c])),
    bySeverity: Object.fromEntries(bySeverity.map((r) => [r.severity, r.c])),
  };
}

export function exportTraps(db: Database): TrapExportRecord[] {
  const traps = db.query("SELECT * FROM traps").all() as Trap[];
  return traps.map((trap) => ({
    ...normalizeTrapForExport(trap),
    evidence: listTrapEvidence(db, trap.id).map(normalizeEvidenceForExport),
  }));
}

export function exportProjectTrapsByPath(db: Database, projectPath: string): TrapExportRecord[] {
  const traps = db
    .query("SELECT * FROM traps WHERE scope = 'project' AND project_path = ? ORDER BY id")
    .all(projectPath) as Trap[];
  return traps.map((trap) => ({
    ...normalizeTrapForExport(trap),
    evidence: listTrapEvidence(db, trap.id).map(normalizeEvidenceForExport),
  }));
}

export function insertTrapRecord(db: Database, record: TrapRecordInsert): number {
  const stmt = db.prepare(`
    INSERT INTO traps (
      title, category, tags, scope, context, mistake, fix, search_text,
      before_code, after_code, severity, state_key, status, supersedes_id,
      valid_from, valid_until, project_path, path_globs, module, owner,
      hit_count, useful_count, last_useful_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    record.title,
    record.category,
    record.tags,
    record.scope,
    record.context,
    record.mistake,
    record.fix,
    record.search_text,
    record.before_code,
    record.after_code,
    record.severity,
    record.state_key,
    record.status,
    record.supersedes_id,
    record.valid_from,
    record.valid_until,
    record.project_path,
    record.path_globs,
    normalizeOptionalText(record.module),
    normalizeOptionalText(record.owner),
    record.hit_count,
    record.useful_count,
    record.last_useful_at,
    record.created_at,
    record.updated_at
  );
  return Number(result.lastInsertRowid);
}

export type ProjectMetaRow = { project_id: string; project_path: string | null };

export function readProjectMeta(db: Database): ProjectMetaRow | null {
  return db
    .query("SELECT project_id, project_path FROM project_meta LIMIT 1")
    .get() as ProjectMetaRow | null;
}

// Single-row table (mirrors schema_version): rewrite it so a project DB always
// reflects exactly one stable identity, even if a prior write left a stray row.
export function upsertProjectMeta(db: Database, projectId: string, projectPath: string | null): void {
  db.transaction(() => {
    db.exec("DELETE FROM project_meta");
    db.prepare(
      "INSERT INTO project_meta (project_id, project_path, updated_at) VALUES (?, ?, datetime('now'))"
    ).run(projectId, projectPath);
  })();
}

export function updateTrapSupersedesId(db: Database, id: number, supersedesId: number): boolean {
  const result = db.prepare("UPDATE traps SET supersedes_id = ? WHERE id = ?").run(supersedesId, id);
  return result.changes > 0;
}

export function deleteTrapsByIds(db: Database, ids: number[]): number {
  if (ids.length === 0) return 0;
  let deleted = 0;
  const stmt = db.prepare("DELETE FROM traps WHERE id = ?");
  const tx = db.transaction(() => {
    for (const id of ids) {
      if (!getTrap(db, id)) continue;
      stmt.run(id);
      deleted++;
    }
  });
  tx();
  return deleted;
}

export function countTraps(db: Database, opts: { scope?: string; category?: string; status?: TrapStatusFilter } = {}): number {
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];
  addTrapFilters(conditions, params, opts);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = db.query(`SELECT COUNT(*) as c FROM traps ${where}`).get(...params) as { c: number };
  return row.c;
}

export function countProjectTrapsByPath(db: Database, projectPath: string): number {
  const row = db
    .query("SELECT COUNT(*) as c FROM traps WHERE scope = 'project' AND project_path = ?")
    .get(projectPath) as { c: number };
  return row.c;
}

function addTrapFilters(
  conditions: string[],
  params: SQLQueryBindings[],
  opts: { category?: string; scope?: string; status?: TrapStatusFilter; module?: string; owner?: string },
  alias?: string
): void {
  const prefix = alias ? `${alias}.` : "";
  if (opts.category) {
    conditions.push(`${prefix}category = ?`);
    params.push(opts.category);
  }
  if (opts.scope) {
    conditions.push(`${prefix}scope = ?`);
    params.push(opts.scope);
  }
  if (opts.status !== "all") {
    conditions.push(`${prefix}status = ?`);
    params.push(opts.status ?? DEFAULT_TRAP_STATUS);
  }
  const module = normalizeOptionalText(opts.module);
  if (module) {
    conditions.push(`(${prefix}module IS NULL OR ${prefix}module = '' OR ${prefix}module = ?)`);
    params.push(module);
  }
  const owner = normalizeOptionalText(opts.owner);
  if (owner) {
    conditions.push(`(${prefix}owner IS NULL OR ${prefix}owner = '' OR ${prefix}owner = ?)`);
    params.push(owner);
  }
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return value == null ? null : String(value);
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
