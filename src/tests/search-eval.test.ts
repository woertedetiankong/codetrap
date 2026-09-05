import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import {
  EvalEmbedder,
  evaluateSearchFixture,
  evaluateSearchFixtureCases,
  readEvalFixture,
  retrievalMetricsForRanking,
} from "../lib/search-eval";

const fixture = readEvalFixture(fileURLToPath(new URL("./fixtures/search-eval.json", import.meta.url)));

describe("search evaluation fixture", () => {
  test("meets Recall@5 gates for the implemented retrieval phases", async () => {
    const report = await evaluateSearchFixture(fixture, new EvalEmbedder());
    expect(report.failures).toEqual([]);
    expect(report.metrics.recall_at_5).toBeGreaterThanOrEqual(1);
    expect(report.metrics.mrr).toBeGreaterThanOrEqual(0.8);
  });

  test("negative retrieval cases reject false positives even with zero recall thresholds", async () => {
    const report = await evaluateSearchFixtureCases({
      traps: [fixture.traps[0]!],
      queries: ["fetchWrapper", "zzqxvzzunknown"].map((query) => ({
        query, mode: "fts", goldTrapIds: [], phaseGate: "dogfood",
        judgment: "no_relevant_trap", minRecallAt3: 0, minRecallAt5: 0,
      })),
    }, new EvalEmbedder());
    expect(report.cases[0]!.topResults.length).toBeGreaterThan(0);
    expect(report.cases[0]!.passed).toBe(false);
    expect(report.cases[1]!.topResults).toEqual([]);
    expect(report.cases[1]!.passed).toBe(true);
    expect(report.failures.map((item) => item.query)).toEqual(["fetchWrapper"]);
    expect(report.noisy_hits.map((item) => item.query)).toEqual(["fetchWrapper"]);
  });

  test("excludes a gold result at rank 6 from Recall@5", () => {
    const metrics = retrievalMetricsForRanking([6], [1, 2, 3, 4, 5, 6]);

    expect(metrics.recallAt3).toBe(0);
    expect(metrics.recallAt5).toBe(0);
    expect(metrics.reciprocalRank).toBeCloseTo(1 / 6);
  });

  test("reranking exposes generic exact-match signals", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), undefined);
    repo.add({
      title: "Use generic helper for writes",
      category: "convention",
      tags: ["helper"],
      scope: "global",
      context: "When changing repository writes, use the helper.",
      mistake: "Writing directly duplicates behavior.",
      fix: "Use the shared helper.",
      severity: "warning",
    });
    const targetId = repo.add({
      title: "TrapStore writes must use transaction helper",
      category: "database",
      tags: ["TrapStore", "transaction"],
      scope: "global",
      context: "When changing TrapStore write behavior, preserve atomic updates.",
      mistake: "Updating related records outside a transaction can leave partial state.",
      fix: "Use the transaction helper for TrapStore writes.",
      severity: "error",
    });

    const results = await repo.search("TrapStore transaction helper", {
      mode: "fts",
      limit: 2,
      includeRankingSignals: true,
    });

    expect(results[0]?.trap.id).toBe(targetId);
    const signals = results[0]?.ranking_signals?.map((signal) => signal.code) ?? [];
    expect(signals).toContain("title_token_exact");
    expect(signals).toContain("tag_exact");
    expect(signals).toContain("code_identifier_exact");

    const withoutRerank = await repo.search("TrapStore transaction helper", {
      mode: "fts",
      limit: 2,
      rerank: false,
      includeRankingSignals: true,
    });
    expect(withoutRerank[0]?.ranking_signals).toEqual([]);
  });
});
