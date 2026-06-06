import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrapStore } from "../lib/store";
import { DEFAULT_RANKING_CONFIG } from "../lib/search-policy";
import {
  DEFAULT_POLICY_SWEEP_CANDIDATES,
  readLiveEvalCases,
  runFixturePolicySweep,
  runLivePolicySweep,
  type RankingCandidate,
} from "../lib/search-policy-sweep";
import { EvalEmbedder } from "../lib/search-eval";

const singleDefaultCandidate: RankingCandidate[] = [
  {
    name: "default",
    config: DEFAULT_RANKING_CONFIG,
  },
];

describe("search policy sweep", () => {
  test("runs fixture mode against the existing deterministic eval fixture", async () => {
    const report = await runFixturePolicySweep();

    expect(report.mode).toBe("fixture");
    expect(report.candidate_count).toBe(DEFAULT_POLICY_SWEEP_CANDIDATES.length);
    expect(report.baseline.metrics.recall_at_5).toBeGreaterThanOrEqual(1);
    expect(report.baseline.failures).toEqual([]);
    expect(report.recommendation).toContain("default config");
  });

  test("runs live mode against a project .codetrap/traps.db", async () => {
    const project = seededProject();
    const report = await runLivePolicySweep({
      cwd: project.cwd,
      embeddings: new EvalEmbedder(),
      candidates: singleDefaultCandidate,
      cases: [
        {
          query: "live policy target helper",
          mode: "fts",
          scope: "project",
          gold: [{ scope: "project", id: project.targetId, title: project.targetTitle }],
        },
      ],
    });

    expect(report.mode).toBe("live");
    expect(report.cwd).toBe(project.cwd);
    expect(report.baseline.metrics).toMatchObject({
      recall_at_3: 1,
      recall_at_5: 1,
      mrr: 1,
    });
    expect(report.baseline.failures).toEqual([]);
  });

  test("live gold title fallback keeps id drift visible", async () => {
    const project = seededProject();
    const report = await runLivePolicySweep({
      cwd: project.cwd,
      embeddings: new EvalEmbedder(),
      candidates: singleDefaultCandidate,
      cases: [
        {
          query: "live policy target helper",
          mode: "fts",
          scope: "project",
          gold: [{ scope: "project", id: project.targetId + 1000, title: project.targetTitle }],
        },
      ],
    });

    expect(report.baseline.metrics.recall_at_5).toBe(1);
    expect(report.baseline.cases[0]?.warnings).toContain(`gold_id_drift:${project.targetId + 1000}->${project.targetId}`);
  });

  test("runs explicit global live cases from a non-project cwd", async () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-sweep-home-"));
    const cwd = join(home, "Documents", "Code", "outside-project");
    mkdirSync(cwd, { recursive: true });
    const store = new TrapStore(cwd, new EvalEmbedder(), home);
    const title = "Global live eval target";
    const { id } = store.add({
      title,
      category: "convention",
      tags: ["global", "live", "policy"],
      scope: "global",
      context: "When running live policy sweep against global codetrap memory.",
      mistake: "Requiring a project root for an explicitly global live eval prevents global-only checks.",
      fix: "Resolve the requested scope through Scope Context and use the global repository when scope is global.",
      severity: "warning",
    });

    const report = await runLivePolicySweep({
      cwd,
      home,
      embeddings: new EvalEmbedder(),
      candidates: singleDefaultCandidate,
      cases: [
        {
          query: "global live policy target",
          mode: "fts",
          scope: "global",
          gold: [{ scope: "global", id, title }],
        },
      ],
    });

    expect(report.baseline.metrics.recall_at_5).toBe(1);
    expect(report.baseline.failures).toEqual([]);
  });

  test("reads live query files with scope-aware gold targets", () => {
    const dir = mkdtempSync(join(tmpdir(), "codetrap-live-queries-"));
    const file = join(dir, "queries.json");
    writeFileSync(file, JSON.stringify({
      queries: [
        {
          query: "live policy target helper",
          mode: "hybrid",
          scope: "project",
          gold: [{ scope: "project", id: 1, title: "Live project eval target" }],
        },
      ],
    }));

    expect(readLiveEvalCases(file)).toEqual([
      {
        query: "live policy target helper",
        mode: "hybrid",
        scope: "project",
        gold: [{ scope: "project", id: 1, title: "Live project eval target" }],
      },
    ]);
  });
});

function seededProject(): { cwd: string; targetId: number; targetTitle: string } {
  const cwd = mkdtempSync(join(tmpdir(), "codetrap-live-project-"));
  mkdirSync(join(cwd, ".codetrap"));
  const store = new TrapStore(cwd, new EvalEmbedder());
  store.add({
    title: "Generic helper convention",
    category: "convention",
    tags: ["helper"],
    scope: "project",
    context: "When changing generic helper code.",
    mistake: "Using direct calls duplicates behavior.",
    fix: "Use the shared helper.",
    severity: "warning",
  });
  const targetTitle = "Live project eval target";
  const { id: targetId } = store.add({
    title: targetTitle,
    category: "convention",
    tags: ["live", "policy", "target"],
    scope: "project",
    context: "When running live policy sweep tests against a real project database.",
    mistake: "Only testing fixture eval misses cwd and project database resolution.",
    fix: "Run live sweep with cwd and scope-aware gold matching.",
    severity: "error",
  });
  return { cwd, targetId, targetTitle };
}
