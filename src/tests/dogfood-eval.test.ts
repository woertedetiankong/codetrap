import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureSource = join(process.cwd(), "src/tests/fixtures/search-eval.json");

describe("dogfood eval script", () => {
  test("record appends a curated dogfood case to a fixture copy", () => {
    const fixture = tempFixture();
    const record = {
      query: "agent should use fetchWrapper for a remote API",
      mode: "hybrid",
      goldTrapIds: [1],
      judgment: "useful_hit",
      observedTopTitles: ["Use fetchWrapper for HTTP requests"],
      note: "Dogfood query from a real pre-edit check.",
    };

    const result = runDogfood(["record", "--fixture", fixture, "--json", JSON.stringify(record)]);
    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({
      success: true,
      fixture,
      query: {
        query: record.query,
        mode: "hybrid",
        goldTrapIds: [1],
        phaseGate: "dogfood",
        source: "dogfood",
        judgment: "useful_hit",
        minRecallAt3: 1,
        minRecallAt5: 1,
      },
    });

    const fixtureJson = JSON.parse(readFileSync(fixture, "utf-8"));
    expect(fixtureJson.queries.at(-1)).toMatchObject(payload.query);
  });

  test("record rejects unknown gold trap ids without mutating the fixture", () => {
    const fixture = tempFixture();
    const before = readFileSync(fixture, "utf-8");
    const record = {
      query: "unknown expected trap",
      mode: "hybrid",
      goldTrapIds: [9999],
      judgment: "miss",
    };

    const result = runDogfood(["record", "--fixture", fixture, "--json", JSON.stringify(record)]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown trap id");
    expect(result.stderr).toContain("Add a compact copy of the expected trap to fixture.traps");
    expect(readFileSync(fixture, "utf-8")).toBe(before);
  });

  test("record accepts no_relevant_trap observations without gold trap ids", () => {
    const fixture = tempFixture();
    const record = {
      query: "new subsystem has no recorded trap yet",
      mode: "hybrid",
      judgment: "no_relevant_trap",
      observedTopTitles: [],
      note: "Real pre-edit check found no applicable prior lesson.",
    };

    const result = runDogfood(["record", "--fixture", fixture, "--json", JSON.stringify(record)]);
    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.stdout);
    expect(payload.query).toMatchObject({
      query: record.query,
      mode: "hybrid",
      goldTrapIds: [],
      phaseGate: "dogfood",
      judgment: "no_relevant_trap",
      minRecallAt3: 0,
      minRecallAt5: 0,
    });

    const report = runDogfood(["report", "--fixture", fixture, "--json"]);
    expect(report.exitCode).toBe(0);
    const reportPayload = JSON.parse(report.stdout);
    expect(reportPayload.metrics.recall_at_5).toBeGreaterThanOrEqual(1);
    expect(reportPayload.dogfood).toMatchObject({
      total: 2,
      judgment_counts: {
        useful_hit: 1,
        no_relevant_trap: 1,
      },
    });
  });

  test("report --json returns stable deterministic metrics and failure lists", () => {
    const fixture = tempFixture();
    const result = runDogfood(["report", "--fixture", fixture, "--json"]);
    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({
      mode: "deterministic",
      fixture,
      provider: {
        provider: "eval",
        model: "eval-embedding",
      },
      semantic_available: true,
      dogfood: {
        total: 1,
        judgment_counts: {
          useful_hit: 1,
          miss: 0,
          noisy_hit: 0,
          no_relevant_trap: 0,
        },
      },
    });
    expect(payload.total_cases).toBeGreaterThan(0);
    expect(payload.metrics.recall_at_5).toBeGreaterThanOrEqual(1);
    expect(payload.metrics.mrr).toBeGreaterThanOrEqual(0.8);
    expect(payload.failures).toEqual([]);
    expect(payload.next_actions[0].reason).toContain("Keep logging real pre-edit searches");
  });

  test("report text includes judgment counts and next actions", () => {
    const fixture = tempFixture();
    const result = runDogfood(["report", "--fixture", fixture]);
    expect(result.exitCode).toBe(0);

    expect(result.stdout).toContain("Judgments: useful_hit=1, miss=0, noisy_hit=0, no_relevant_trap=0");
    expect(result.stdout).toContain("Next actions:");
    expect(result.stdout).toContain('codetrap search "<task keywords>" --mode hybrid --json');
  });

  test("report --live reports semantic unavailable without an embedding provider", () => {
    const fixture = tempFixture();
    const result = runDogfood(["report", "--live", "--fixture", fixture, "--json"], { JINA_API_KEY: "" });
    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({
      mode: "live",
      provider: null,
      semantic_available: false,
      provider_error: null,
    });
    expect(payload.metrics.hybrid_fallback_count).toBeGreaterThan(0);
    expect(payload.metrics.semantic_error_count).toBeGreaterThan(0);
    expect(payload.failures.length).toBeGreaterThan(0);
    expect(payload.next_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "codetrap embeddings use huggingface --model default",
        }),
      ])
    );
  });
});

function tempFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "codetrap-dogfood-eval-"));
  const fixture = join(dir, "search-eval.json");
  copyFileSync(fixtureSource, fixture);
  return fixture;
}

function runDogfood(args: string[], env: Record<string, string> = {}) {
  const home = env.HOME ?? mkdtempSync(join(tmpdir(), "codetrap-dogfood-home-"));
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", "scripts/dogfood-eval.ts", ...args],
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      CODETRAP_EMBEDDING_PROVIDER: "",
      CODETRAP_OLLAMA_MODEL: "",
      CODETRAP_OLLAMA_ENDPOINT: "",
      CODETRAP_OLLAMA_DIMENSIONS: "",
      OLLAMA_HOST: "",
      JINA_API_KEY: "",
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
}
