import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Trap } from "../domain/trap";
import { DEFAULT_TRAP_STATUS, type TrapStatus } from "../lib/constants";
import {
  decodeEmbedding,
  encodeEmbedding,
  type EmbeddingConfig,
  type FreshEmbedding,
  type StoredEmbedding,
} from "../lib/embedder";
import type { EmbeddingStateCounts } from "../lib/embedding-health";
import { embeddingIsFresh, passageHashForTrap } from "../lib/trap-search-document";
import { countTraps, listTraps } from "./queries";

type TrapEmbeddingRow = {
  trap_id: number;
  provider: string;
  model: string;
  dimensions: number;
  passage_version: number;
  passage_hash: string;
  embedding: Uint8Array;
  updated_at: string;
};

export function getEmbedding(db: Database, trapId: number): StoredEmbedding | null {
  const row = db
    .query("SELECT * FROM trap_embeddings WHERE trap_id = ?")
    .get(trapId) as TrapEmbeddingRow | null;
  return row ? rowToStoredEmbedding(row) : null;
}

export function upsertEmbedding(db: Database, record: StoredEmbedding): void {
  db.prepare(`
    INSERT INTO trap_embeddings (
      trap_id, provider, model, dimensions, passage_version, passage_hash, embedding, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(trap_id) DO UPDATE SET
      provider = excluded.provider,
      model = excluded.model,
      dimensions = excluded.dimensions,
      passage_version = excluded.passage_version,
      passage_hash = excluded.passage_hash,
      embedding = excluded.embedding,
      updated_at = datetime('now')
  `).run(
    record.trap_id,
    record.provider,
    record.model,
    record.dimensions,
    record.passage_version,
    record.passage_hash,
    encodeEmbedding(record.embedding)
  );
}

export function deleteEmbedding(db: Database, trapId: number): void {
  db.prepare("DELETE FROM trap_embeddings WHERE trap_id = ?").run(trapId);
}

export function getAllFreshEmbeddings(
  db: Database,
  config: EmbeddingConfig,
  opts: { category?: string; scope?: string; status?: TrapStatus | "all" } = {}
): FreshEmbedding[] {
  const conditions = [
    "e.provider = ?",
    "e.model = ?",
    "e.dimensions = ?",
    "e.passage_version = ?",
  ];
  const params: SQLQueryBindings[] = [
    config.provider,
    config.model,
    config.dimensions,
    config.passageVersion,
  ];

  if (opts.category) {
    conditions.push("t.category = ?");
    params.push(opts.category);
  }
  if (opts.scope) {
    conditions.push("t.scope = ?");
    params.push(opts.scope);
  }
  if (opts.status !== "all") {
    conditions.push("t.status = ?");
    params.push(opts.status ?? DEFAULT_TRAP_STATUS);
  }

  const rows = db
    .query(
      `
      SELECT
        t.*,
        e.embedding AS embedding,
        e.passage_hash AS embedding_passage_hash
      FROM trap_embeddings e
      JOIN traps t ON t.id = e.trap_id
      WHERE ${conditions.join(" AND ")}
    `
    )
    .all(...params) as (Trap & { embedding: Uint8Array; embedding_passage_hash: string })[];

  return rows.flatMap((row) => {
    if (row.embedding_passage_hash !== passageHashForTrap(row)) return [];
    const { embedding, embedding_passage_hash: _passageHash, ...trap } = row;
    return [{ trap: trap as Trap, embedding: decodeEmbedding(embedding) }];
  });
}

export function getTrapsNeedingEmbeddings(
  db: Database,
  config: EmbeddingConfig,
  opts: { scope?: string; category?: string; status?: TrapStatus | "all"; force?: boolean; limit?: number } = {}
): Trap[] {
  const traps = listTraps(db, {
    scope: opts.scope,
    category: opts.category,
    status: opts.status,
    limit: 100000,
  });
  const needed: Trap[] = [];

  for (const trap of traps) {
    const embedding = getEmbedding(db, trap.id);
    if (opts.force || !embeddingIsFresh(trap, embedding, config)) {
      needed.push(trap);
    }
  }

  return needed.slice(0, opts.limit ?? needed.length);
}

export function countEmbeddableTraps(
  db: Database,
  opts: { scope?: string; category?: string; status?: TrapStatus | "all" } = {}
): number {
  return countTraps(db, opts);
}

export function getEmbeddingStateCounts(
  db: Database,
  config: EmbeddingConfig | null,
  opts: { scope?: string; category?: string; status?: TrapStatus | "all" } = {}
): EmbeddingStateCounts {
  const traps = listTraps(db, {
    scope: opts.scope,
    category: opts.category,
    status: opts.status,
    limit: 100000,
  });
  const counts: EmbeddingStateCounts = {
    total: traps.length,
    fresh: 0,
    stale: 0,
    missing: 0,
  };

  for (const trap of traps) {
    const embedding = getEmbedding(db, trap.id);
    if (!embedding) {
      counts.missing++;
    } else if (config && embeddingIsFresh(trap, embedding, config)) {
      counts.fresh++;
    } else {
      counts.stale++;
    }
  }

  return counts;
}

function rowToStoredEmbedding(row: TrapEmbeddingRow): StoredEmbedding {
  return {
    trap_id: row.trap_id,
    provider: row.provider,
    model: row.model,
    dimensions: row.dimensions,
    passage_version: row.passage_version,
    passage_hash: row.passage_hash,
    embedding: decodeEmbedding(row.embedding),
    updated_at: row.updated_at,
  };
}
