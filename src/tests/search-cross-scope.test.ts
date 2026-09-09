import { expect, test } from "bun:test";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { toCliSearchJson, toMcpSearchJson } from "../lib/output-json";
import { openObservationLedger } from "../lib/observation-ledger";
import type { EmbeddingProvider, EmbeddingTask } from "../lib/embedder";
import { tempHome, tempProjectDir, trap } from "./helpers";

class ScopeEmbedder implements EmbeddingProvider {
  readonly provider = "mock";
  readonly model = "scope-ranking";
  readonly dimensions = 2;
  async embed(texts: string[], task: EmbeddingTask) {
    return texts.map(text => new Float32Array(task === "retrieval.query" || text.includes("Global")
      ? [1, 0] : [0.4, Math.sqrt(0.84)]));
  }
}

async function fixture(embedGlobal = true) {
  const home = tempHome("codetrap-rank-home-", { realpath: true, initCodetrap: true });
  const project = tempProjectDir("codetrap-rank-project-", { realpath: true });
  const store = new TrapStore(project, new ScopeEmbedder(), home);
  for (let i = 0; i < 3; i++) {
    const entry = store.add(trap({ scope: "project", title: `Project fetchWrapper ${i}` }));
    expect(await store.embedTrapBestEffort(entry.id, entry.scope)).toBe(true);
  }
  const entry = store.add(trap({ scope: "global", title: "Global fetchWrapper" }));
  if (embedGlobal) expect(await store.embedTrapBestEffort(entry.id, entry.scope)).toBe(true);
  return { store, project, ops: new TrapOperations(store) };
}

test("semantic relevance survives grouping below and above the limit, including observation ranks", async () => {
  const { ops, project } = await fixture();
  const { cards, diagnostics } = await ops.searchTrapCards({ query: "fetchWrapper", mode: "semantic", limit: 20, rerank: false,
    observation: { run_id: "scope-order", device_id: "test-device", source_ref: "test" } });
  expect(diagnostics).toEqual([]);
  expect(cards.map(card => card.scope)).toEqual(["global", "project", "project", "project"]);
  expect(cards[0].trap_id).toBe(cards[1].trap_id);
  expect(toCliSearchJson(cards).map(card => card.scope)).toEqual(cards.map(card => card.scope));
  expect(toMcpSearchJson(cards).map(card => card.scope)).toEqual(cards.map(card => card.scope));
  const ledger = openObservationLedger(project);
  try {
    const exposure = ledger.listRunEvents("scope-order").find(event => event.type === "trap/exposed");
    expect(exposure?.attributes.revision).toMatch(/^global:/);
    expect(exposure?.attributes.rank).toBe(1);
  } finally { ledger.close(); }
  const limited = await ops.searchTrapCards({ query: "fetchWrapper", mode: "semantic", limit: 1, rerank: false });
  expect(limited.cards.map(card => card.scope)).toEqual(["global"]);
});

test("independent FTS corpora and mixed hybrid fallback preserve each scope's ranked opportunities", async () => {
  const { ops } = await fixture(false);
  for (const mode of ["fts", "hybrid"] as const) {
    const result = await ops.searchTrapCards({ query: "fetchWrapper", mode, limit: 3, rerank: false });
    expect(result.cards.map(card => card.scope)).toEqual(["project", "global", "project"]);
    expect(result.diagnostics.some(d => d.code === "cross_scope_rank_merge")).toBe(true);
    if (mode === "hybrid") {
      expect(result.cards[0].sources).toEqual(["fts", "semantic"]);
      expect(result.cards[1].sources).toEqual(["fts"]);
    }
  }
});

test("successful hybrid scores and ties retain deterministic scope identity", async () => {
  const { ops } = await fixture();
  const { cards, diagnostics } = await ops.searchTrapCards({ query: "fetchWrapper", mode: "hybrid", limit: 4, rerank: false });
  expect(cards.map(card => card.scope)).toEqual(["project", "global", "project", "project"]);
  expect(diagnostics).toEqual([]);
});
