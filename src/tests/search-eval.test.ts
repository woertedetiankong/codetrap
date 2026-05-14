import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import type { TrapInput } from "../domain/trap";
import type { SearchMode } from "../lib/constants";
import type { EmbeddingProvider, EmbeddingTask } from "../lib/embedder";

type EvalFixture = {
  traps: TrapInput[];
  queries: {
    query: string;
    mode: SearchMode;
    goldTrapIds: number[];
    phaseGate: "phase0" | "phase1" | "phase4";
    minRecallAt5: number;
  }[];
};

class EvalEmbedder implements EmbeddingProvider {
  readonly provider = "eval";
  readonly model = "eval-embedding";
  readonly dimensions = 6;

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    return texts.map(vectorFor);
  }
}

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/search-eval.json", import.meta.url), "utf-8")
) as EvalFixture;

describe("search evaluation fixture", () => {
  test("meets Recall@5 gates for the implemented retrieval phases", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), new EvalEmbedder());
    for (const trap of fixture.traps) {
      repo.add(trap);
    }
    await repo.ensureEmbeddings();

    for (const item of fixture.queries) {
      const results = await repo.search(item.query, { mode: item.mode, limit: 5 });
      const resultIds = new Set(results.map((result) => result.trap.id));
      const hits = item.goldTrapIds.filter((id) => resultIds.has(id)).length;
      const recallAt5 = hits / item.goldTrapIds.length;
      expect(recallAt5, `${item.phaseGate}: ${item.query}`).toBeGreaterThanOrEqual(item.minRecallAt5);
    }
  });
});

function vectorFor(text: string): Float32Array {
  const lower = text.toLowerCase();
  const vector = new Float32Array(6);
  if (/(http|https|fetch|axios|request|api|remote|network|网络|请求)/.test(lower)) vector[0] = 1;
  if (/(auth|authentication|login|session|认证)/.test(lower)) vector[1] = 1;
  if (/(db|database|sqlite|sql|migration|schema|table|数据库)/.test(lower)) vector[2] = 1;
  if (/(config|env|environment|process\.env|配置)/.test(lower)) vector[3] = 1;
  if (/(cache|redis|stale|缓存)/.test(lower)) vector[4] = 1;
  if (/(cli|flag|parseargs|query text|positionals)/.test(lower)) vector[5] = 1;
  if (vector.every((value) => value === 0)) vector[5] = 1;
  return vector;
}
