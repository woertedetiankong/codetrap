import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { initSchema } from "../db/schema";
import { encodeEmbedding } from "../lib/embedder";

describe("embedding profile storage", () => {
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

      expect((db.query("SELECT version FROM schema_version").get() as { version: number }).version).toBe(6);
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
});
