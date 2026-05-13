import type { Database } from "bun:sqlite";
import { CATEGORIES, SEVERITIES, SCOPES, SCHEMA_VERSION } from "../lib/constants";

export function initSchema(db: Database): void {
  // Schema version table — add migrations here when breaking schema changes are needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
  `);

  const current = (db.query("SELECT version FROM schema_version").get() as { version: number } | null)?.version ?? 0;

  if (current < SCHEMA_VERSION) {
    applyMigrations(db, current);
  }

  if (current === 0) {
    db.exec(`
      INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION})
    `);
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

    db.prepare("UPDATE schema_version SET version = ?").run(1);
  }
  // Future migrations go here:
  // if (from < 2) { ... db.run("UPDATE schema_version SET version = ?", 2); }
}
