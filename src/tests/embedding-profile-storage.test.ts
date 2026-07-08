import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { initSchema } from "../db/schema";
import {
  embeddingProfileId,
  encodeEmbedding,
  type EmbeddingConfig,
} from "../lib/embedder";
import { passageHashForTrap } from "../lib/trap-search-document";
import { trap } from "./helpers";

describe("embedding profile storage", () => {
  test("creates profile-aware embedding tables when no embedding table exists", () => {
    const db = new Database(":memory:");
    try {
      db.exec(`
        CREATE TABLE schema_version (version INTEGER NOT NULL);
        INSERT INTO schema_version (version) VALUES (5);

        CREATE TABLE traps (
          id INTEGER PRIMARY KEY
        );
      `);

      initSchema(db);

      expect((db.query("SELECT version FROM schema_version").get() as { version: number }).version).toBe(7);
      expect(columnNames(db, "trap_embeddings")).toContain("profile_id");
      expect(columnNames(db, "embedding_profiles")).toContain("passage_version");
    } finally {
      db.close();
    }
  });

  test("preserves existing profile-aware embedding rows during migration", () => {
    const db = new Database(":memory:");
    try {
      db.exec(`
        CREATE TABLE schema_version (version INTEGER NOT NULL);
        INSERT INTO schema_version (version) VALUES (5);

        CREATE TABLE traps (
          id INTEGER PRIMARY KEY
        );
        INSERT INTO traps (id) VALUES (1);

        CREATE TABLE embedding_profiles (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          dimensions INTEGER NOT NULL,
          passage_version INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO embedding_profiles (
          id, provider, model, dimensions, passage_version, created_at, updated_at
        )
        VALUES ('mock:profile:2:p1', 'mock', 'profile', 2, 1, '2026-06-06 00:00:00', '2026-06-06 00:00:00');

        CREATE TABLE trap_embeddings (
          trap_id INTEGER NOT NULL REFERENCES traps(id) ON DELETE CASCADE,
          profile_id TEXT NOT NULL REFERENCES embedding_profiles(id) ON DELETE CASCADE,
          passage_hash TEXT NOT NULL,
          embedding BLOB NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (trap_id, profile_id)
        );
      `);
      db.prepare(`
        INSERT INTO trap_embeddings (
          trap_id, profile_id, passage_hash, embedding, updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        1,
        "mock:profile:2:p1",
        "current-hash",
        encodeEmbedding(new Float32Array([1, 0])),
        "2026-06-06 00:01:00"
      );

      initSchema(db);

      expect((db.query("SELECT version FROM schema_version").get() as { version: number }).version).toBe(7);
      expect(db.query("SELECT trap_id, profile_id, passage_hash FROM trap_embeddings").get()).toEqual({
        trap_id: 1,
        profile_id: "mock:profile:2:p1",
        passage_hash: "current-hash",
      });
    } finally {
      db.close();
    }
  });

  test("migrates legacy single-profile embeddings into profile rows", () => {
    const db = new Database(":memory:");
    try {
      db.exec(`
        CREATE TABLE schema_version (version INTEGER NOT NULL);
        INSERT INTO schema_version (version) VALUES (5);

        CREATE TABLE traps (
          id INTEGER PRIMARY KEY
        );
        INSERT INTO traps (id) VALUES (1);

        CREATE TABLE trap_embeddings (
          trap_id INTEGER PRIMARY KEY,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          dimensions INTEGER NOT NULL,
          passage_version INTEGER NOT NULL,
          passage_hash TEXT NOT NULL,
          embedding BLOB NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      db.prepare(`
        INSERT INTO trap_embeddings (
          trap_id, provider, model, dimensions, passage_version, passage_hash, embedding, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        1,
        "jina",
        "jina-embeddings-v5-text-small",
        1024,
        1,
        "legacy-hash",
        encodeEmbedding(new Float32Array([1, 0])),
        "2026-06-06 00:00:00"
      );

      initSchema(db);

      expect((db.query("SELECT version FROM schema_version").get() as { version: number }).version).toBe(7);
      expect(db.query("SELECT * FROM embedding_profiles").get()).toMatchObject({
        id: "jina:jina-embeddings-v5-text-small:1024:p1",
        provider: "jina",
        model: "jina-embeddings-v5-text-small",
        dimensions: 1024,
        passage_version: 1,
      });
      expect(db.query("SELECT trap_id, profile_id, passage_hash FROM trap_embeddings").get()).toEqual({
        trap_id: 1,
        profile_id: "jina:jina-embeddings-v5-text-small:1024:p1",
        passage_hash: "legacy-hash",
      });
    } finally {
      db.close();
    }
  });

  test("recovers legacy embeddings orphaned by an interrupted v5→v6 migration", () => {
    const db = new Database(":memory:");
    try {
      // Simulate the crash state a pre-fix binary left behind: version already
      // stamped 6, new-shape table empty, legacy rows orphaned.
      db.exec(`
        CREATE TABLE schema_version (version INTEGER NOT NULL);
        INSERT INTO schema_version (version) VALUES (6);

        CREATE TABLE traps (
          id INTEGER PRIMARY KEY
        );
        INSERT INTO traps (id) VALUES (1);

        CREATE TABLE embedding_profiles (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          dimensions INTEGER NOT NULL,
          passage_version INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE trap_embeddings (
          trap_id INTEGER NOT NULL REFERENCES traps(id) ON DELETE CASCADE,
          profile_id TEXT NOT NULL REFERENCES embedding_profiles(id) ON DELETE CASCADE,
          passage_hash TEXT NOT NULL,
          embedding BLOB NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (trap_id, profile_id)
        );

        CREATE TABLE trap_embeddings_legacy_v5 (
          trap_id INTEGER PRIMARY KEY,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          dimensions INTEGER NOT NULL,
          passage_version INTEGER NOT NULL,
          passage_hash TEXT NOT NULL,
          embedding BLOB NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      db.prepare(`
        INSERT INTO trap_embeddings_legacy_v5 (
          trap_id, provider, model, dimensions, passage_version, passage_hash, embedding, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        1,
        "jina",
        "jina-embeddings-v5-text-small",
        1024,
        1,
        "legacy-hash",
        encodeEmbedding(new Float32Array([1, 0])),
        "2026-06-06 00:00:00"
      );

      initSchema(db);

      expect(db.query("SELECT trap_id, profile_id, passage_hash FROM trap_embeddings").get()).toEqual({
        trap_id: 1,
        profile_id: "jina:jina-embeddings-v5-text-small:1024:p1",
        passage_hash: "legacy-hash",
      });
      expect(
        db.query("SELECT name FROM sqlite_master WHERE name = 'trap_embeddings_legacy_v5'").get()
      ).toBeNull();
    } finally {
      db.close();
    }
  });

  test("refuses to open a database from a newer codetrap", () => {
    const db = new Database(":memory:");
    try {
      db.exec(`
        CREATE TABLE schema_version (version INTEGER NOT NULL);
        INSERT INTO schema_version (version) VALUES (99);
      `);
      expect(() => initSchema(db)).toThrow(/newer than this codetrap/);
    } finally {
      db.close();
    }
  });

  test("snapshots a file-backed database before applying migrations", () => {
    const dir = mkdtempSync(join(tmpdir(), "codetrap-migration-backup-"));
    const dbPath = join(dir, "traps.db");
    const first = openDatabase(dbPath);
    first.close();

    // Force a re-migration on the next open.
    const downgrade = new Database(dbPath);
    downgrade.exec("UPDATE schema_version SET version = 5");
    downgrade.close();

    const reopened = openDatabase(dbPath);
    try {
      expect((reopened.query("SELECT version FROM schema_version").get() as { version: number }).version).toBe(7);
      const backups = readdirSync(join(dir, "backups"));
      expect(backups).toHaveLength(1);
      expect(backups[0]).toContain("traps.db.pre-migration-v5.");
    } finally {
      reopened.close();
    }
  });

  test("summarizes and refreshes embeddings by profile without per-trap lookups", () => {
    const db = openDatabase(":memory:");
    try {
      const repo = new TrapRepository(db);
      const activeConfig: EmbeddingConfig = {
        provider: "mock",
        model: "mock-embedding",
        dimensions: 2,
        passageVersion: 1,
      };
      const alternateConfig: EmbeddingConfig = {
        provider: "alternate-mock",
        model: "alternate-mock-embedding",
        dimensions: 2,
        passageVersion: 1,
      };

      const fresh = repo.add(trap({ title: "Fresh global trap", scope: "global", category: "api" }));
      const stale = repo.add(trap({ title: "Stale global trap", scope: "global", category: "api" }));
      const otherProfile = repo.add(trap({ title: "Other profile global trap", scope: "global", category: "api" }));
      const archived = repo.add(trap({ title: "Archived global trap", scope: "global", category: "api" }));
      const project = repo.add(trap({ title: "Fresh project trap", scope: "project", category: "api" }));

      storeEmbedding(repo, fresh, activeConfig);
      storeEmbedding(repo, stale, activeConfig, "old-passage-hash");
      storeEmbedding(repo, otherProfile, alternateConfig);
      storeEmbedding(repo, project, activeConfig);
      repo.archive(archived);

      expect(idSet(repo.getTrapsNeedingEmbeddings(activeConfig, { scope: "global" }))).toEqual(
        new Set([stale, otherProfile])
      );
      expect(idSet(repo.getTrapsNeedingEmbeddings(activeConfig, { scope: "global", force: true }))).toEqual(
        new Set([fresh, stale, otherProfile])
      );
      expect(repo.getTrapsNeedingEmbeddings(activeConfig, { scope: "global", limit: 1 })).toHaveLength(1);

      expect(repo.embeddingStats(activeConfig, { scope: "global" })).toEqual({
        total: 3,
        fresh: 1,
        stale: 1,
        missing: 1,
      });
      expect(repo.embeddingStats(activeConfig, { scope: "project" })).toEqual({
        total: 1,
        fresh: 1,
        stale: 0,
        missing: 0,
      });
      expect(repo.embeddingStats(activeConfig, { scope: "global", status: "all" })).toEqual({
        total: 4,
        fresh: 1,
        stale: 1,
        missing: 2,
      });
      expect(repo.embeddingStats(alternateConfig, { scope: "global" })).toEqual({
        total: 3,
        fresh: 1,
        stale: 0,
        missing: 2,
      });
      expect(repo.embeddingStats(null, { scope: "global" })).toEqual({
        total: 3,
        fresh: 0,
        stale: 3,
        missing: 0,
      });
    } finally {
      db.close();
    }
  });
});

function storeEmbedding(
  repo: TrapRepository,
  trapId: number,
  config: EmbeddingConfig,
  passageHash?: string
): void {
  const storedTrap = repo.get(trapId);
  if (!storedTrap) throw new Error(`Trap ${trapId} not found.`);
  repo.upsertEmbedding({
    trap_id: trapId,
    profile_id: embeddingProfileId(config),
    provider: config.provider,
    model: config.model,
    dimensions: config.dimensions,
    passage_version: config.passageVersion,
    passage_hash: passageHash ?? passageHashForTrap(storedTrap),
    embedding: new Float32Array([1, 0]),
  });
}

function idSet(traps: { id: number }[]): Set<number> {
  return new Set(traps.map((item) => item.id));
}

function columnNames(db: Database, table: string): string[] {
  return (db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name);
}
