import { describe, expect, test } from "bun:test";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import type { EmbeddingProvider, EmbeddingTask } from "../lib/embedder";
import { trap } from "./helpers";

class MockEmbedder implements EmbeddingProvider {
  readonly provider = "mock";
  readonly model = "mock-embedding";
  readonly dimensions = 6;

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    return texts.map(vectorFor);
  }
}

class HybridFusionEmbedder implements EmbeddingProvider {
  readonly provider = "hybrid-fusion";
  readonly model = "hybrid-fusion-embedding";
  readonly dimensions = 2;

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    return texts.map(vectorForHybridFusion);
  }
}

describe("semantic and hybrid search", () => {
  test("semantic search ranks traps with mock embeddings", async () => {
    const embedder = new MockEmbedder();
    const repo = new TrapRepository(openDatabase(":memory:"), embedder);
    repo.add(trap());
    repo.add(
      trap({
        title: "Run SQLite migrations through schema.ts",
        category: "database",
        tags: ["sqlite", "migration"],
        context: "When changing tables, update schema migrations.",
        mistake: "Editing only queries leaves existing databases stale.",
        fix: "Increment SCHEMA_VERSION and add an idempotent migration.",
      })
    );

    await repo.ensureEmbeddings();

    const results = await repo.search("How should remote API calls be made?", { mode: "semantic" });
    expect(results[0]?.trap.title).toContain("fetchWrapper");
    expect(results[0]?.sources).toEqual(["semantic"]);
  });

  test("hybrid search falls back to FTS without an embedding provider", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    repo.add(trap());

    const results = await repo.search("fetchWrapper", { mode: "hybrid" });
    expect(results[0]?.trap.title).toContain("fetchWrapper");
    expect(results[0]?.sources).toEqual(["fts"]);
    expect(results[0]?.diagnostics?.[0]?.code).toBe("semantic_unavailable");
  });

  test("hybrid fusion considers overfetched candidates before final ranking", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), new HybridFusionEmbedder());
    repo.add(trap({
      title: "FTS-only alpha alpha alpha rule",
      tags: [],
      context: "Alpha appears often in this rule.",
      mistake: "Alpha-only text can dominate the lexical path.",
      fix: "Keep it as a single-source lexical candidate.",
    }));
    const combinedId = repo.add(trap({
      title: "Combined alpha rule",
      tags: [],
      context: "Alpha appears here too.",
      mistake: "Slicing each retrieval path before fusion can drop this candidate.",
      fix: "Fuse retrieval candidates first, then run final ranking.",
    }));
    repo.add(trap({
      title: "Semantic-only rule",
      tags: [],
      context: "This rule is close to the query only in embedding space.",
      mistake: "A semantic-only candidate can win one path.",
      fix: "Keep semantic candidates available for fusion.",
    }));

    await repo.ensureEmbeddings();

    const results = await repo.search("alpha", { mode: "hybrid", limit: 1 });

    expect(results[0]?.trap.id).toBe(combinedId);
    expect(results[0]?.sources).toEqual(["fts", "semantic"]);
  });

  test("embedding generation runs in batches and reports batch count", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), new MockEmbedder());
    repo.add(trap({ title: "Use fetchWrapper for HTTP requests" }));
    repo.add(
      trap({
        title: "Use session helpers for authentication",
        category: "auth",
        tags: ["auth", "login"],
        context: "Use the session helper for login flows.",
        mistake: "Reading cookies directly duplicates auth behavior.",
        fix: "Call the session helper.",
      })
    );

    const result = await repo.ensureEmbeddings({ batchSize: 1 });
    expect(result).toMatchObject({ generated: 2, skipped: 0, batches: 2 });
  });

  test("updating passage fields invalidates stale embeddings", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), new MockEmbedder());
    const id = repo.add(trap());
    await repo.ensureEmbeddings();

    expect(repo.getEmbedding(id)).not.toBeNull();

    repo.update(id, { fix: "Use the new fetchWrapper helper." });
    expect(repo.getEmbedding(id)).toBeNull();
  });
});

function vectorFor(text: string): Float32Array {
  const lower = text.toLowerCase();
  const vector = new Float32Array(6);
  if (/(http|https|fetch|axios|request|api|remote|network|网络|请求)/.test(lower)) vector[0] = 1;
  if (/(auth|authentication|login|session|认证)/.test(lower)) vector[1] = 1;
  if (/(db|database|sqlite|sql|migration|schema|数据库)/.test(lower)) vector[2] = 1;
  if (/(config|env|environment|配置)/.test(lower)) vector[3] = 1;
  if (/(cache|redis|缓存)/.test(lower)) vector[4] = 1;
  if (vector.every((value) => value === 0)) vector[5] = 1;
  return vector;
}

function vectorForHybridFusion(text: string): Float32Array {
  const lower = text.toLowerCase();
  if (lower.trim() === "alpha") return new Float32Array([1, 0]);
  if (lower.includes("semantic-only rule")) return new Float32Array([1, 0]);
  if (lower.includes("combined alpha rule")) return new Float32Array([0.9, 0.43589]);
  if (lower.includes("fts-only alpha")) return new Float32Array([0.2, 0.9798]);
  return new Float32Array([0, 1]);
}
