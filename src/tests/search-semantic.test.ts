import { describe, expect, test } from "bun:test";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { embeddingConfig, type EmbeddingProvider, type EmbeddingTask } from "../lib/embedder";
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

class AlternateMockEmbedder implements EmbeddingProvider {
  readonly provider = "alternate-mock";
  readonly model = "alternate-mock-embedding";
  readonly dimensions = 6;

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    return texts.map(vectorFor);
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

  test("diagnostics survive an empty result set", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    const outcome = await repo.searchWithDiagnostics("anything at all", { mode: "hybrid" });
    expect(outcome.results).toEqual([]);
    expect(outcome.diagnostics[0]?.code).toBe("semantic_unavailable");
  });

  test("hybrid search reports a partial embedding index out-of-band", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), new MockEmbedder());
    repo.add(trap({ title: "Use fetchWrapper for HTTP requests" }));
    await repo.ensureEmbeddings();
    repo.add(trap({
      title: "Newest fetch retry trap",
      category: "api",
      tags: ["fetch"],
      context: "When retrying fetch calls.",
      mistake: "New traps rank keyword-only until reindexed.",
      fix: "Surface the partial index instead of hiding the bias.",
    }));

    const outcome = await repo.searchWithDiagnostics("fetch", { mode: "hybrid" });
    expect(outcome.diagnostics.map((diagnostic) => diagnostic.code)).toContain("partial_index");
    expect(outcome.diagnostics.find((diagnostic) => diagnostic.code === "partial_index")?.message)
      .toContain("1 of 2");
  });

  test("semantic mode reports stale embeddings instead of silently dropping traps", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), new MockEmbedder());
    const id = repo.add(trap());
    await repo.ensureEmbeddings();
    repo.update(id, { fix: "Use the new fetchWrapper helper." });

    const outcome = await repo.searchWithDiagnostics("remote API calls", { mode: "semantic" });
    expect(outcome.results).toEqual([]);
    const partial = outcome.diagnostics.find((diagnostic) => diagnostic.code === "partial_index");
    expect(partial?.message).toContain("1 of 1");
    expect(partial?.message).toContain("embeddings reindex");
  });

  test("new and edited traps are embedded on write when a provider is available", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), new MockEmbedder());
    const id = repo.add(trap());

    expect(await repo.ensureEmbeddingForTrap(id)).toBe(true);
    expect(repo.getEmbedding(id)).not.toBeNull();
    // Fresh embedding: nothing to do on a second call.
    expect(await repo.ensureEmbeddingForTrap(id)).toBe(false);

    repo.update(id, { fix: "Use the new fetchWrapper helper." });
    expect(repo.getEmbedding(id)).toBeNull();
    expect(await repo.ensureEmbeddingForTrap(id)).toBe(true);
    expect(repo.getEmbedding(id)).not.toBeNull();

    // No provider: a quiet no-op, not an error.
    const bare = new TrapRepository(openDatabase(":memory:"));
    const bareId = bare.add(trap());
    expect(await bare.ensureEmbeddingForTrap(bareId)).toBe(false);
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

  test("changing embedding provider metadata stores a second profile", async () => {
    const db = openDatabase(":memory:");
    const mockEmbedder = new MockEmbedder();
    const alternateEmbedder = new AlternateMockEmbedder();
    const mockConfig = embeddingConfig(mockEmbedder);
    const alternateConfig = embeddingConfig(alternateEmbedder);
    const repo = new TrapRepository(db, mockEmbedder);
    const id = repo.add(trap());
    await repo.ensureEmbeddings();

    expect(repo.getEmbedding(id, mockConfig)?.provider).toBe("mock");

    const alternateRepo = new TrapRepository(db, alternateEmbedder);
    expect(await alternateRepo.search("remote API calls", { mode: "semantic" })).toEqual([]);

    const refresh = await alternateRepo.ensureEmbeddings();
    expect(refresh.generated).toBe(1);
    expect(alternateRepo.getEmbedding(id, alternateConfig)?.provider).toBe("alternate-mock");
    expect(alternateRepo.getEmbedding(id, mockConfig)?.provider).toBe("mock");
    expect(alternateRepo.embeddingProfiles({ scope: "global" }).map((profile) => profile.id).sort()).toEqual([
      "alternate-mock:alternate-mock-embedding:6:p1",
      "mock:mock-embedding:6:p1",
    ]);
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
