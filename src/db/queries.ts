import type { Database, SQLQueryBindings } from "bun:sqlite";
import { DEFAULT_SEVERITY } from "../lib/constants";
import { TRAP_UPDATE_FIELDS, type Trap, type TrapInput, type TrapSearchResult, type TrapUpdate } from "../domain/trap";

export function insertTrap(db: Database, input: TrapInput): number {
  const tags = JSON.stringify(input.tags ?? []);
  const stmt = db.prepare(`
    INSERT INTO traps (title, category, tags, scope, context, mistake, fix, before_code, after_code, severity, project_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    input.title,
    input.category,
    tags,
    input.scope,
    input.context,
    input.mistake,
    input.fix,
    input.before_code ?? null,
    input.after_code ?? null,
    input.severity ?? DEFAULT_SEVERITY,
    input.project_path ?? null
  );
  return Number(result.lastInsertRowid);
}

export function searchTraps(
  db: Database,
  query: string,
  opts: { category?: string; scope?: string; limit?: number } = {}
): TrapSearchResult[] {
  const conditions = ["traps_fts MATCH ?"];
  const params: SQLQueryBindings[] = [query];

  if (opts.category) {
    conditions.push("t.category = ?");
    params.push(opts.category);
  }
  if (opts.scope) {
    conditions.push("t.scope = ?");
    params.push(opts.scope);
  }

  params.push(opts.limit ?? 20);

  const rows = db
    .query(
      `
    SELECT t.*, rank
    FROM traps_fts f
    JOIN traps t ON t.id = f.rowid
    WHERE ${conditions.join(" AND ")}
    ORDER BY rank
    LIMIT ?
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
  opts: { category?: string; scope?: string; limit?: number; offset?: number } = {}
): Trap[] {
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];

  if (opts.category) {
    conditions.push("category = ?");
    params.push(opts.category);
  }
  if (opts.scope) {
    conditions.push("scope = ?");
    params.push(opts.scope);
  }

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

  for (const key of TRAP_UPDATE_FIELDS) {
    if (key === "tags") continue;
    const value = input[key];
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      params.push(value ?? null);
    }
  }
  if (input.tags !== undefined) {
    updates.push("tags = ?");
    params.push(JSON.stringify(input.tags));
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

export function incrementHitCount(db: Database, id: number): void {
  db.prepare("UPDATE traps SET hit_count = hit_count + 1, updated_at = datetime('now') WHERE id = ?").run(id);
}

export function getTopTraps(db: Database, scope: string, limit = 20): Trap[] {
  return db
    .query("SELECT * FROM traps WHERE scope = ? ORDER BY hit_count DESC LIMIT ?")
    .all(scope, limit) as Trap[];
}

export function getStats(db: Database): {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
} {
  const total = (db.query("SELECT COUNT(*) as c FROM traps").get() as { c: number }).c;
  const byCategory = db
    .query("SELECT category, COUNT(*) as c FROM traps GROUP BY category")
    .all() as { category: string; c: number }[];
  const bySeverity = db
    .query("SELECT severity, COUNT(*) as c FROM traps GROUP BY severity")
    .all() as { severity: string; c: number }[];

  return {
    total,
    byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.c])),
    bySeverity: Object.fromEntries(bySeverity.map((r) => [r.severity, r.c])),
  };
}

export function exportTraps(db: Database): Trap[] {
  return db.query("SELECT * FROM traps").all() as Trap[];
}

export function countTraps(db: Database, opts: { scope?: string; category?: string } = {}): number {
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];
  if (opts.scope) {
    conditions.push("scope = ?");
    params.push(opts.scope);
  }
  if (opts.category) {
    conditions.push("category = ?");
    params.push(opts.category);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = db.query(`SELECT COUNT(*) as c FROM traps ${where}`).get(...params) as { c: number };
  return row.c;
}
