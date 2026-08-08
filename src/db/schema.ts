import type { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { CATEGORIES, SEVERITIES, SCOPES, SCHEMA_VERSION } from "../lib/constants";
import { buildTrapSearchText } from "../lib/trap-search-document";

const LEGACY_EMBEDDINGS_TABLE = "trap_embeddings_legacy_v5";

export function initSchema(db: Database): void {
  // Schema version table — add migrations here when breaking schema changes are needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
  `);

  const current = readSchemaVersion(db);
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${current} is newer than this codetrap build (supports up to ${SCHEMA_VERSION}). Upgrade codetrap.`
    );
  }
  if (current === SCHEMA_VERSION && !tableExists(db, LEGACY_EMBEDDINGS_TABLE)) return;

  backupBeforeMigration(db, current);

  // One immediate transaction serializes concurrent openers and makes the
  // whole migration all-or-nothing: a crash mid-way rolls back instead of
  // leaving half-renamed tables behind.
  db.transaction(() => {
    const version = readSchemaVersion(db);
    if (version < SCHEMA_VERSION) {
      setSchemaVersion(db, version);
      applyMigrations(db, version);
    }
    // A pre-fix binary crashed between renaming trap_embeddings and copying it,
    // then stamped v6 with an empty table on the next open. Finish the copy
    // instead of orphaning the legacy rows forever. This runs independent of the
    // version bump above so a DB already at the current version (or a DB carried
    // past v6 by a later migration) still gets its orphaned legacy rows copied.
    if (tableExists(db, LEGACY_EMBEDDINGS_TABLE)) {
      copyLegacyEmbeddings(db);
    }
  }).immediate();
}

function readSchemaVersion(db: Database): number {
  const row = db.query("SELECT MAX(version) AS version FROM schema_version").get() as { version: number | null };
  return row.version ?? 0;
}

function setSchemaVersion(db: Database, version: number): void {
  db.exec("DELETE FROM schema_version");
  db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
}

function backupBeforeMigration(db: Database, fromVersion: number): void {
  const filename = db.filename;
  if (!filename || filename === ":memory:") return;
  if (!tableExists(db, "traps")) return;

  const backupDir = join(dirname(filename), "backups");
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `${basename(filename)}.pre-migration-v${fromVersion}.${timestamp}.backup`);
  writeFileSync(backupPath, db.serialize());
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

  if (from < 4) {
    if (!columnExists(db, "traps", "state_key")) {
      db.exec("ALTER TABLE traps ADD COLUMN state_key TEXT");
    }
    if (!columnExists(db, "traps", "status")) {
      db.exec("ALTER TABLE traps ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    }
    if (!columnExists(db, "traps", "supersedes_id")) {
      db.exec("ALTER TABLE traps ADD COLUMN supersedes_id INTEGER REFERENCES traps(id) ON DELETE SET NULL");
    }
    if (!columnExists(db, "traps", "valid_from")) {
      db.exec("ALTER TABLE traps ADD COLUMN valid_from TEXT");
      db.exec("UPDATE traps SET valid_from = COALESCE(created_at, datetime('now')) WHERE valid_from IS NULL");
    }
    if (!columnExists(db, "traps", "valid_until")) {
      db.exec("ALTER TABLE traps ADD COLUMN valid_until TEXT");
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS trap_evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trap_id INTEGER NOT NULL REFERENCES traps(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        source_ref TEXT,
        observed_at TEXT NOT NULL DEFAULT (datetime('now')),
        related_files TEXT NOT NULL DEFAULT '[]',
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.prepare("UPDATE schema_version SET version = ?").run(4);
  }

  if (from < 5) {
    if (!columnExists(db, "traps", "path_globs")) {
      db.exec("ALTER TABLE traps ADD COLUMN path_globs TEXT NOT NULL DEFAULT '[]'");
    }
    if (!columnExists(db, "traps", "module")) {
      db.exec("ALTER TABLE traps ADD COLUMN module TEXT");
    }
    if (!columnExists(db, "traps", "owner")) {
      db.exec("ALTER TABLE traps ADD COLUMN owner TEXT");
    }

    const rows = db
      .query("SELECT id, title, context, mistake, fix, tags, before_code, after_code, path_globs, module, owner FROM traps")
      .all() as {
      id: number;
      title: string;
      context: string;
      mistake: string;
      fix: string;
      tags: string;
      before_code: string | null;
      after_code: string | null;
      path_globs: string;
      module: string | null;
      owner: string | null;
    }[];

    const update = db.prepare("UPDATE traps SET search_text = ? WHERE id = ?");
    for (const row of rows) {
      update.run(buildTrapSearchText(row), row.id);
    }

    db.prepare("UPDATE schema_version SET version = ?").run(5);
  }

  if (from < 6) {
    migrateEmbeddingProfiles(db);
    db.prepare("UPDATE schema_version SET version = ?").run(6);
  }

  if (from < 7) {
    // A1: give each database a single-row record of its stable project identity
    // (minted in .codetrap/project.json). Additive — existing rows are untouched
    // and the row is populated lazily by the store, so this migration is a pure
    // table create with no data rewrite.
    createProjectMetaTable(db);
    db.prepare("UPDATE schema_version SET version = ?").run(7);
  }

  if (from < 8) {
    // §16 1E: usefulness is a distinct signal from recall. `hit_count` counts
    // views (it increments on `codetrap show` and MCP get_trap); it cannot
    // answer "did this lesson actually help", which is the §17 falsifier's
    // question and §14's product metric. Additive columns, no data rewrite.
    addColumnIfMissing(db, "traps", "useful_count", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "traps", "last_useful_at", "TEXT");
    db.prepare("UPDATE schema_version SET version = ?").run(8);
  }

  if (from < 9) {
    // Phase 2 currency is additive. Existing lessons begin with their creation
    // timestamp as the best honest validation proxy; explicit validation moves
    // it forward. Graduation archives the lesson while retaining its target.
    addColumnIfMissing(db, "traps", "last_validated", "TEXT");
    addColumnIfMissing(db, "traps", "graduated_at", "TEXT");
    addColumnIfMissing(db, "traps", "graduated_to", "TEXT");
    if (columnExists(db, "traps", "created_at")) {
      db.exec("UPDATE traps SET last_validated = COALESCE(last_validated, created_at)");
    } else {
      // Some migration tests intentionally model the minimal v5 embedding
      // schema. Currency must not make those valid historical shapes fail.
      db.exec("UPDATE traps SET last_validated = COALESCE(last_validated, datetime('now'))");
    }
    db.prepare("UPDATE schema_version SET version = ?").run(9);
  }
}

function addColumnIfMissing(db: Database, table: string, column: string, definition: string): void {
  if (columnExists(db, table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function createProjectMetaTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_meta (
      project_id TEXT NOT NULL,
      project_path TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migrateEmbeddingProfiles(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS embedding_profiles (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      passage_version INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (tableExists(db, LEGACY_EMBEDDINGS_TABLE)) {
    // Resume a migration that a pre-fix binary abandoned after the rename.
    createProfileAwareEmbeddingsTable(db);
    copyLegacyEmbeddings(db);
    return;
  }

  const hasTrapEmbeddings = tableExists(db, "trap_embeddings");
  if (!hasTrapEmbeddings || columnExists(db, "trap_embeddings", "profile_id")) {
    createProfileAwareEmbeddingsTable(db);
    return;
  }

  db.exec(`ALTER TABLE trap_embeddings RENAME TO ${LEGACY_EMBEDDINGS_TABLE}`);
  createProfileAwareEmbeddingsTable(db);
  copyLegacyEmbeddings(db);
}

function copyLegacyEmbeddings(db: Database): void {
  db.exec(`
    INSERT OR IGNORE INTO embedding_profiles (
      id, provider, model, dimensions, passage_version, created_at, updated_at
    )
    SELECT
      provider || ':' || model || ':' || dimensions || ':p' || passage_version,
      provider,
      model,
      dimensions,
      passage_version,
      MIN(updated_at),
      MAX(updated_at)
    FROM ${LEGACY_EMBEDDINGS_TABLE}
    GROUP BY provider, model, dimensions, passage_version;

    INSERT OR IGNORE INTO trap_embeddings (
      trap_id, profile_id, passage_hash, embedding, updated_at
    )
    SELECT
      trap_id,
      provider || ':' || model || ':' || dimensions || ':p' || passage_version,
      passage_hash,
      embedding,
      updated_at
    FROM ${LEGACY_EMBEDDINGS_TABLE}
    WHERE trap_id IN (SELECT id FROM traps);

    DROP TABLE ${LEGACY_EMBEDDINGS_TABLE};
  `);
}

function createProfileAwareEmbeddingsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trap_embeddings (
      trap_id INTEGER NOT NULL REFERENCES traps(id) ON DELETE CASCADE,
      profile_id TEXT NOT NULL REFERENCES embedding_profiles(id) ON DELETE CASCADE,
      passage_hash TEXT NOT NULL,
      embedding BLOB NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (trap_id, profile_id)
    );

    CREATE INDEX IF NOT EXISTS idx_trap_embeddings_profile
      ON trap_embeddings(profile_id);
  `);
}

function tableExists(db: Database, table: string): boolean {
  const row = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | null;
  return row !== null;
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
