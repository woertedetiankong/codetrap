import type { Database } from "bun:sqlite";
import { CATEGORIES, SEVERITIES, SCOPES, SCHEMA_VERSION } from "../lib/constants";
import { buildTrapSearchText } from "../lib/trap-search-document";

export function initSchema(db: Database): void {
  // Schema version table — add migrations here when breaking schema changes are needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
  `);

  const versionRow = db.query("SELECT version FROM schema_version").get() as { version: number } | null;
  const current = versionRow?.version ?? 0;

  if (current < SCHEMA_VERSION) {
    applyMigrations(db, current);
  }

  if (!versionRow) {
    db.exec(`
      INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION})
    `);
  } else if (current === 0) {
    db.prepare("UPDATE schema_version SET version = ?").run(SCHEMA_VERSION);
  }
}

function applyMigrations(db: Database, from: number): void {
  // v0 → v1: initial schema
  if (from < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS traps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('${CATEGORIES.join("','")}')),
        tags TEXT NOT NULL DEFAULT '[]',
        scope TEXT NOT NULL CHECK(scope IN ('${SCOPES.join("','")}')),
        context TEXT NOT NULL,
        mistake TEXT NOT NULL,
        fix TEXT NOT NULL,
        before_code TEXT,
        after_code TEXT,
        severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('${SEVERITIES.join("','")}')),
        project_path TEXT,
        hit_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS traps_fts USING fts5(
        title, context, mistake, fix, tags,
        content='traps',
        content_rowid='id'
      );
    `);

    createFTSTriggersV1(db);
    db.prepare("UPDATE schema_version SET version = ?").run(1);
  }

  if (from < 2) {
    if (!columnExists(db, "traps", "search_text")) {
      db.exec("ALTER TABLE traps ADD COLUMN search_text TEXT NOT NULL DEFAULT ''");
    }

    const rows = db
      .query("SELECT id, title, context, mistake, fix, tags, before_code, after_code FROM traps")
      .all() as {
      id: number;
      title: string;
      context: string;
      mistake: string;
      fix: string;
      tags: string;
      before_code: string | null;
      after_code: string | null;
    }[];

    const update = db.prepare("UPDATE traps SET search_text = ? WHERE id = ?");
    for (const row of rows) {
      update.run(buildTrapSearchText(row), row.id);
    }

    dropFTS(db);
    createFTSWithSearchText(db);
    db.exec(`
      INSERT INTO traps_fts(rowid, title, context, mistake, fix, tags, search_text)
      SELECT id, title, context, mistake, fix, tags, search_text FROM traps;
    `);
    db.prepare("UPDATE schema_version SET version = ?").run(2);
  }

  if (from < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS trap_embeddings (
        trap_id INTEGER PRIMARY KEY REFERENCES traps(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        passage_version INTEGER NOT NULL,
        passage_hash TEXT NOT NULL,
        embedding BLOB NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.prepare("UPDATE schema_version SET version = ?").run(3);
  }
}

function columnExists(db: Database, table: string, column: string): boolean {
  const rows = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

function dropFTS(db: Database): void {
  db.exec(`
    DROP TRIGGER IF EXISTS traps_ai;
    DROP TRIGGER IF EXISTS traps_ad;
    DROP TRIGGER IF EXISTS traps_au;
    DROP TABLE IF EXISTS traps_fts;
  `);
}

function createFTSTriggersV1(db: Database): void {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS traps_ai AFTER INSERT ON traps BEGIN
      INSERT INTO traps_fts(rowid, title, context, mistake, fix, tags)
      VALUES (new.id, new.title, new.context, new.mistake, new.fix, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS traps_ad AFTER DELETE ON traps BEGIN
      INSERT INTO traps_fts(traps_fts, rowid, title, context, mistake, fix, tags)
      VALUES ('delete', old.id, old.title, old.context, old.mistake, old.fix, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS traps_au AFTER UPDATE ON traps BEGIN
      INSERT INTO traps_fts(traps_fts, rowid, title, context, mistake, fix, tags)
      VALUES ('delete', old.id, old.title, old.context, old.mistake, old.fix, old.tags);
      INSERT INTO traps_fts(rowid, title, context, mistake, fix, tags)
      VALUES (new.id, new.title, new.context, new.mistake, new.fix, new.tags);
    END;
  `);
}

function createFTSWithSearchText(db: Database): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS traps_fts USING fts5(
      title, context, mistake, fix, tags, search_text,
      content='traps',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS traps_ai AFTER INSERT ON traps BEGIN
      INSERT INTO traps_fts(rowid, title, context, mistake, fix, tags, search_text)
      VALUES (new.id, new.title, new.context, new.mistake, new.fix, new.tags, new.search_text);
    END;

    CREATE TRIGGER IF NOT EXISTS traps_ad AFTER DELETE ON traps BEGIN
      INSERT INTO traps_fts(traps_fts, rowid, title, context, mistake, fix, tags, search_text)
      VALUES ('delete', old.id, old.title, old.context, old.mistake, old.fix, old.tags, old.search_text);
    END;

    CREATE TRIGGER IF NOT EXISTS traps_au AFTER UPDATE ON traps BEGIN
      INSERT INTO traps_fts(traps_fts, rowid, title, context, mistake, fix, tags, search_text)
      VALUES ('delete', old.id, old.title, old.context, old.mistake, old.fix, old.tags, old.search_text);
      INSERT INTO traps_fts(rowid, title, context, mistake, fix, tags, search_text)
      VALUES (new.id, new.title, new.context, new.mistake, new.fix, new.tags, new.search_text);
    END;
  `);
}
