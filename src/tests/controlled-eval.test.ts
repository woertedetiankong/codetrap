import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ControlledEvalOperations,
  type ControlledEvalExperiment,
} from "../lib/controlled-eval";
import { tempProjectDir } from "./helpers";

describe("controlled eval runner", () => {
  test("runs a reproducible policy comparison without modifying the source fixture", async () => {
    const project = controlledEvalProject("codetrap-controlled-policy-");
    const fixturePath = join(project, "src", "tests", "fixtures", "search-eval.json");
    const before = readFileSync(fixturePath);
    const operations = new ControlledEvalOperations(project, () => new Date("2026-08-31T08:00:00.000Z"));

    const result = await operations.run({
      profile: "retrieval_policy_v1",
      trials: 2,
      seed: "policy-test",
    });

    expect(result).toMatchObject({
      schema_version: 1,
      kind: "deterministic_retrieval",
      status: "completed",
      profile: "retrieval_policy_v1",
      suite: {
        path: "src/tests/fixtures/search-eval.json",
        sha256: sha(before),
        case_count: 3,
      },
      isolation: {
        kind: "in_memory_fixture_snapshot",
        source_writes: false,
        command_execution: false,
      },
      budget: { model_calls: 0, token_budget: 0, estimated_cost: 0 },
      configuration: { seed: "policy-test", trials: 2 },
      reproducible: true,
      summary: { total_cases: 3 },
    });
    expect(result.trial_runs).toHaveLength(2);
    expect(result.cases).toHaveLength(3);
    expect(result.cases.every((item) => item.evidence.fixture === "src/tests/fixtures/search-eval.json")).toBe(true);
    expect(readFileSync(fixturePath)).toEqual(before);
    expect(readFileSync(join(project, result.suite.snapshot))).toEqual(before);
    expect(operations.list()).toEqual([result]);
  });

  test("shows the controlled contribution of confirmed memory", async () => {
    const project = controlledEvalProject("codetrap-controlled-memory-");
    const operations = new ControlledEvalOperations(project, () => new Date("2026-08-31T08:15:00.000Z"));

    const result = await operations.run({
      profile: "memory_contribution_v1",
      trials: 1,
    });

    expect(result.summary.improvements).toBe(2);
    expect(result.summary.regressions).toBe(0);
    expect(result.summary.candidate_failed_cases).toBe(0);
    expect(result.cases.slice(0, 2).every((item) => item.classification === "improved")).toBe(true);
    const noRelevant = result.cases.find((item) => item.gold_trap_ids.length === 0);
    expect(noRelevant).toMatchObject({
      classification: "changed",
      baseline: { passed: true },
      candidate: { passed: true },
    });
  });

  test("keeps healthy experiment history visible while reporting corrupt artifacts", async () => {
    const project = controlledEvalProject("codetrap-controlled-partial-history-");
    const operations = new ControlledEvalOperations(project, () => new Date("2026-09-02T05:00:00.000Z"));
    const result = await operations.run({ profile: "memory_contribution_v1", trials: 1 });
    const experiments = join(project, ".codetrap", "evals", "experiments");
    writeFileSync(join(experiments, "broken-result.json"), "{ truncated");

    expect(operations.history()).toEqual({
      experiments: [result],
      corrupt_results: [{ file: "broken-result.json", issue: "invalid_experiment" }],
    });
    expect(() => operations.list()).toThrow("contains 1 invalid experiment");
    expect(readFileSync(join(experiments, "broken-result.json"), "utf8")).toBe("{ truncated");
  });

  test("fails closed before creating result state for a missing or invalid suite", async () => {
    const missingProject = tempProjectDir("codetrap-controlled-missing-", { realpath: true });
    const missing = new ControlledEvalOperations(missingProject);
    expect(missing.run({ profile: "retrieval_policy_v1" })).rejects.toThrow("fixture not found");
    expect(existsSync(join(missingProject, ".codetrap", "evals"))).toBe(false);

    const invalidProject = tempProjectDir("codetrap-controlled-invalid-", { realpath: true });
    const fixturePath = join(invalidProject, "src", "tests", "fixtures", "search-eval.json");
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, "{ invalid");
    const invalid = new ControlledEvalOperations(invalidProject);
    expect(invalid.run({ profile: "retrieval_policy_v1" })).rejects.toThrow();
    expect(existsSync(join(invalidProject, ".codetrap", "evals"))).toBe(false);
  });

  test("rejects unbounded trials and unsupported profiles", async () => {
    const project = controlledEvalProject("codetrap-controlled-input-");
    const operations = new ControlledEvalOperations(project);
    expect(operations.run({ profile: "retrieval_policy_v1", trials: 6 })).rejects.toThrow("between 1 and 5");
    expect(operations.run({ profile: "other" as ControlledEvalExperiment["profile"] })).rejects.toThrow("profile must be one of");
  });
});

function controlledEvalProject(prefix: string): string {
  const project = tempProjectDir(prefix, { realpath: true });
  const fixturePath = join(project, "src", "tests", "fixtures", "search-eval.json");
  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, `${JSON.stringify({
    traps: [
      {
        title: "Run SQLite migrations with rollback coverage",
        category: "database",
        tags: ["sqlite", "migration", "rollback"],
        scope: "project",
        context: "When changing a SQLite database schema.",
        mistake: "Shipping without rollback coverage leaves a broken database.",
        fix: "Run migration and rollback tests together.",
        severity: "error",
      },
      {
        title: "Use the shared session helper",
        category: "auth",
        tags: ["auth", "session"],
        scope: "project",
        context: "When implementing login state.",
        mistake: "Reading cookies directly duplicates authentication behavior.",
        fix: "Use the shared session helper.",
        severity: "warning",
      },
    ],
    queries: [
      { query: "sqlite migration rollback", mode: "hybrid", goldTrapIds: [1], phaseGate: "dogfood", minRecallAt3: 1, minRecallAt5: 1, judgment: "useful_hit" },
      { query: "authentication session helper", mode: "semantic", goldTrapIds: [2], phaseGate: "phase4", minRecallAt3: 1, minRecallAt5: 1 },
      { query: "no matching experience exists", mode: "hybrid", goldTrapIds: [], phaseGate: "dogfood", minRecallAt3: 0, minRecallAt5: 0, judgment: "no_relevant_trap" },
    ],
  }, null, 2)}\n`);
  return project;
}

function sha(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
