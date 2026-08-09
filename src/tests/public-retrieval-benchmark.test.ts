import { describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  DEFAULT_PUBLIC_RETRIEVAL_DATASET,
  DEFAULT_PUBLIC_RETRIEVAL_EXPECTED,
  expectedPublicBenchmarkSummary,
  runPublicRetrievalBenchmark,
  verifyPublicBenchmark,
} from "../lib/public-retrieval-benchmark";

describe("Phase 4A public retrieval benchmark", () => {
  test("ships the public dataset and runner in the npm package", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    expect(manifest.files).toContain("benchmarks");
    expect(manifest.files).toContain("scripts");
    expect(manifest.scripts["benchmark:retrieval"]).toBe("bun run scripts/public-retrieval-benchmark.ts");
  });

  test("reproduces the checked-in result and publishes weak configurations", async () => {
    const report = await runPublicRetrievalBenchmark();

    expect(() => verifyPublicBenchmark(report)).not.toThrow();
    expect(report).toMatchObject({
      benchmark_id: "codetrap-retrieval-v1",
      dataset_license: "MIT",
      dataset_provenance: "synthetic_authored_for_codetrap",
      offline: true,
      claims: {
        retrieval_quality: "measured_on_released_synthetic_dataset",
        candidate_quality: "not_measured",
        behavior_change: "not_measured",
        real_embedding_quality: "not_measured_deterministic_proxy_only",
      },
    });
    const defaultRun = report.configurations.find((item) => item.name === "default-hybrid-proxy");
    const ftsOnly = report.configurations.find((item) => item.name === "fts-only");
    const semanticOnly = report.configurations.find((item) => item.name === "semantic-proxy-only");
    const fallback = report.configurations.find((item) => item.name === "hybrid-fts-fallback");
    expect(defaultRun?.failures).toEqual([]);
    expect(defaultRun?.metrics.recall_at_3).toBe(1);
    expect(ftsOnly?.failures.length).toBeGreaterThan(0);
    expect(semanticOnly?.metrics.mrr).toBeLessThan(defaultRun?.metrics.mrr ?? 0);
    expect(fallback?.metrics.hybrid_fallback_count).toBe(12);
  });

  test("dataset bytes and expected metrics are both part of the drift gate", async () => {
    const dir = mkdtempSync(join(tmpdir(), "codetrap-public-benchmark-drift-"));
    const dataset = join(dir, "dataset.json");
    copyFileSync(DEFAULT_PUBLIC_RETRIEVAL_DATASET, dataset);
    writeFileSync(dataset, `${readFileSync(dataset, "utf8")}\n`);

    const report = await runPublicRetrievalBenchmark({ datasetPath: dataset });
    expect(() => verifyPublicBenchmark(report, DEFAULT_PUBLIC_RETRIEVAL_EXPECTED)).toThrow(
      "Public retrieval benchmark drifted"
    );

    const expected = expectedPublicBenchmarkSummary(report);
    expected.configurations[0]!.metrics.mrr = 0;
    const expectedPath = join(dir, "expected.json");
    writeFileSync(expectedPath, JSON.stringify(expected, null, 2));
    expect(() => verifyPublicBenchmark(report, expectedPath)).toThrow("Public retrieval benchmark drifted");
  });

  test("CLI verification runs with an isolated empty home", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-public-benchmark-home-"));
    const output = join(home, "artifacts", "retrieval-benchmark.json");
    const proc = Bun.spawnSync({
      cmd: ["bun", "run", "scripts/public-retrieval-benchmark.ts", "--verify", "--output", output],
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
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = new TextDecoder().decode(proc.stdout);
    const stderr = new TextDecoder().decode(proc.stderr);

    expect(proc.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Verification: passed");
    expect(stdout).toContain(`Report: ${resolve(output)}`);
    expect(stdout).toContain("Not measured: candidate quality, behavior change, real embedding quality");
    expect(existsSync(join(home, ".codetrap"))).toBe(false);
    const report = JSON.parse(readFileSync(output, "utf8"));
    expect(report.benchmark_id).toBe("codetrap-retrieval-v1");
    expect(report.dataset_sha256).toBe(
      "2f180e092a4e7dcf77818955f36e5d42e984d271fdd539a5c66cf7530fcefc8e"
    );
  });

  test("clean-runner workflow verifies Windows and Linux and preserves reports", () => {
    const workflow = readFileSync(".github/workflows/retrieval-benchmark.yml", "utf8");

    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("bun-version: 1.3.14");
    expect(workflow).toContain("bun install --frozen-lockfile");
    expect(workflow).toContain("--verify --output artifacts/retrieval-benchmark.json");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("if-no-files-found: error");
  });

  test("CLI preserves the actual report when verification detects drift", () => {
    const dir = mkdtempSync(join(tmpdir(), "codetrap-public-benchmark-failure-"));
    const expected = JSON.parse(readFileSync(DEFAULT_PUBLIC_RETRIEVAL_EXPECTED, "utf8"));
    expected.configurations[0].metrics.mrr = 0;
    const expectedPath = join(dir, "expected.json");
    const output = join(dir, "actual.json");
    writeFileSync(expectedPath, JSON.stringify(expected, null, 2));

    const proc = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "scripts/public-retrieval-benchmark.ts",
        "--verify",
        "--expected",
        expectedPath,
        "--output",
        output,
      ],
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(proc.exitCode).toBe(1);
    expect(new TextDecoder().decode(proc.stderr)).toContain("Public retrieval benchmark drifted");
    expect(JSON.parse(readFileSync(output, "utf8")).benchmark_id).toBe("codetrap-retrieval-v1");
  });
});
