import { test, expect } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LearningSearch } from "../lib/learning-search";
import { EmbeddingRuntime } from "../lib/embedding-runtime";
import type { EmbeddingProvider } from "../lib/embedder";
import { learningFixture } from "./web-learning-fixture";
import { runCli } from "./helpers";
function fixture() {
  const f = learningFixture(),
    path = join(f.a.root, ".codetrap/phase2/insights.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  data.insights[0].body =
    "语义锚点：通过把原始材料交给阅读助手，只把精简结果传给主模型，降低上下文开销。";
  data.insights[1].body = "无关：如何烤面包。";
  writeFileSync(path, JSON.stringify(data));
  return { ...f, path, data };
}
function provider(
  model = "test",
  embed?: EmbeddingProvider["embed"],
): EmbeddingProvider {
  return {
    provider: "test",
    model,
    dimensions: 2,
    embed:
      embed ??
      (async (texts, task) =>
        texts.map(
          (text) =>
            new Float32Array(
              task === "retrieval.query" || text.includes("语义锚点")
                ? [1, 0]
                : [0, 1],
            ),
        )),
  };
}
test("body keywords work without a model; semantic paraphrases use fresh matching-profile vectors", async () => {
  const f = fixture(),
    s = new LearningSearch(f.a.root, new EmbeddingRuntime(provider()));
  expect((await s.search("降低上下文开销", "fts")).results[0].insight_id).toBe(
    "one",
  );
  expect(
    (await s.search("帮 AI 节省阅读预算", "semantic")).results,
  ).toHaveLength(0);
  expect((await s.reindex()).generated).toBe(s.status().passages);
  const found = await s.search("帮 AI 节省阅读预算", "semantic");
  expect(found.results.map((x) => x.insight_id)).toEqual(["one"]);
  expect(found.results[0].sources).toEqual(["semantic"]);
  expect(found.results[0].snippet).toContain("阅读助手");
  expect(found.results[0].kind).toBe("learning");
  expect((await s.reindex()).generated).toBe(0);
  const changed = new LearningSearch(
    f.a.root,
    new EmbeddingRuntime(provider("different-model")),
  );
  expect(changed.status().fresh).toBe(0);
  expect((await changed.search("省钱", "semantic")).results).toHaveLength(0);
});
test("edits and deletions invalidate stale chunks; failed reindex preserves prior data", async () => {
  const f = fixture(),
    s = new LearningSearch(f.a.root, new EmbeddingRuntime(provider()));
  await s.reindex();
  const index = join(f.a.root, ".codetrap/learning/search-index.json"),
    before = readFileSync(index, "utf8");
  f.data.insights[0].body = "changed";
  writeFileSync(f.path, JSON.stringify(f.data));
  expect(s.status().fresh).toBe(s.status().passages - 1);
  expect((await s.search("budget", "semantic")).results).toHaveLength(0);
  const failing = new LearningSearch(
    f.a.root,
    new EmbeddingRuntime(
      provider("test", async () => {
        throw new Error("offline");
      }),
    ),
  );
  await expect(failing.reindex()).rejects.toThrow("offline");
  expect(readFileSync(index, "utf8")).toBe(before);
  f.data.insights = [];
  f.data.collection_items = [];
  writeFileSync(f.path, JSON.stringify(f.data));
  expect((await s.search("budget", "hybrid")).results).toHaveLength(0);
});
test("corrupt vectors degrade hybrid search to text and explain recovery", async () => {
  const f = fixture(),
    s = new LearningSearch(f.a.root, new EmbeddingRuntime(provider()));
  await s.reindex();
  const index = join(f.a.root, ".codetrap/learning/search-index.json"),
    data = JSON.parse(readFileSync(index, "utf8"));
  data.entries[0].vector = [0, 0];
  writeFileSync(index, JSON.stringify(data));
  const found = await s.search("阅读助手", "hybrid");
  expect(found.results[0].sources).toEqual(["fts"]);
  expect(found.diagnostics[0].code).toBe("semantic_unavailable");
  await s.reindex();
  expect(s.status().error).toBeNull();
});
test("an edit while query embedding is pending cannot return the old snippet", async () => {
  const f = fixture();
  let release!: () => void, started!: () => void;
  const waiting = new Promise<void>((r) => (release = r)),
    arrived = new Promise<void>((r) => (started = r));
  const p = provider("test", async (texts, task) => {
    if (task === "retrieval.query") {
      started();
      await waiting;
    }
    return texts.map(() => new Float32Array([1, 0]));
  });
  const s = new LearningSearch(f.a.root, new EmbeddingRuntime(p));
  await s.reindex();
  const request = s.search("budget", "semantic");
  await arrived;
  f.data.insights = [];
  f.data.collection_items = [];
  writeFileSync(f.path, JSON.stringify(f.data));
  release();
  expect((await request).results).toHaveLength(0);
});
test("CLI offers search and readable Learning detail without conflating experience rules", () => {
  const f = fixture(),
    result = runCli(
      ["learn", "search", "阅读助手", "--mode", "fts", "--json"],
      f.a.root,
      f.home,
    );
  expect(result.exitCode).toBe(0);
  const body = JSON.parse(result.stdout);
  expect(body.results[0].next_action.command).toBe(
    "codetrap learn show one --json",
  );
  const show = runCli(["learn", "show", "one", "--json"], f.a.root, f.home);
  expect(JSON.parse(show.stdout).insight.body).toContain("语义锚点");
});
test("authenticated API searches registered projects and refuses unregistered roots", async () => {
  const f = fixture(),
    headers = { "X-Codetrap-Token": "learning-token" };
  expect(
    (
      await f.handler(
        new Request(
          "http://localhost/api/learning/search?project=" +
            encodeURIComponent(f.a.root) +
            "&q=阅读助手&mode=fts",
        ),
      )
    ).status,
  ).toBe(401);
  const r = await f.handler(
    new Request(
      "http://localhost/api/learning/search?project=" +
        encodeURIComponent(f.a.root) +
        "&q=阅读助手&mode=fts&scope=project",
      { headers },
    ),
  );
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body.results[0].library_key).toBe(f.a.root + "::one");
  const other = await f.handler(
    new Request(
      "http://localhost/api/learning/search?project=" +
        encodeURIComponent(f.b.root) +
        "&q=阅读助手&mode=fts&scope=project",
      { headers },
    ),
  );
  expect((await other.json()).results).toHaveLength(0);
  expect(
    (
      await f.handler(
        new Request(
          "http://localhost/api/learning/search?project=/tmp/unregistered&q=x",
          { headers },
        ),
      )
    ).status,
  ).toBeGreaterThanOrEqual(400);
});
