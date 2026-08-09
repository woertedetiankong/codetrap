import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SearchMode } from "./constants";
import {
  evaluateSearchFixtureCases,
  parseEvalFixture,
  type EvalCaseReport,
  type EvalFixture,
  type SearchEvalMetrics,
} from "./search-eval";
import { PublicRetrievalEmbedder } from "./public-retrieval-embedder";
import { isRecord } from "./value-types";

export const PUBLIC_RETRIEVAL_BENCHMARK_ID = "codetrap-retrieval-v1";
export const DEFAULT_PUBLIC_RETRIEVAL_DATASET = "benchmarks/retrieval-v1/dataset.json";
export const DEFAULT_PUBLIC_RETRIEVAL_EXPECTED = "benchmarks/retrieval-v1/expected-results.json";

export type PublicBenchmarkClaims = {
  retrieval_quality: "measured_on_released_synthetic_dataset";
  candidate_quality: "not_measured";
  behavior_change: "not_measured";
  real_embedding_quality: "not_measured_deterministic_proxy_only";
};

export type PublicBenchmarkConfiguration = {
  name: string;
  search_mode: SearchMode;
  semantic: "deterministic_proxy" | "disabled";
  total_cases: number;
  metrics: SearchEvalMetrics;
  failures: string[];
  cases?: EvalCaseReport[];
};

export type PublicRetrievalBenchmarkReport = {
  schema_version: 1;
  benchmark_id: typeof PUBLIC_RETRIEVAL_BENCHMARK_ID;
  dataset: string;
  dataset_sha256: string;
  dataset_license: "MIT";
  dataset_provenance: "synthetic_authored_for_codetrap";
  offline: true;
  claims: PublicBenchmarkClaims;
  configurations: PublicBenchmarkConfiguration[];
};

export type PublicRetrievalBenchmarkExpected = Pick<
  PublicRetrievalBenchmarkReport,
  "schema_version" | "benchmark_id" | "dataset_sha256" | "claims"
> & {
  configurations: Array<Pick<PublicBenchmarkConfiguration, "name" | "metrics" | "failures">>;
};

type PublicDatasetDocument = EvalFixture & {
  benchmark: {
    id: string;
    schema_version: number;
    license: string;
    provenance: string;
  };
};

type BenchmarkRun = {
  name: string;
  mode: SearchMode;
  semantic: PublicBenchmarkConfiguration["semantic"];
};

const RUNS: BenchmarkRun[] = [
  { name: "default-hybrid-proxy", mode: "hybrid", semantic: "deterministic_proxy" },
  { name: "fts-only", mode: "fts", semantic: "disabled" },
  { name: "semantic-proxy-only", mode: "semantic", semantic: "deterministic_proxy" },
  { name: "hybrid-fts-fallback", mode: "hybrid", semantic: "disabled" },
];

const CLAIMS: PublicBenchmarkClaims = {
  retrieval_quality: "measured_on_released_synthetic_dataset",
  candidate_quality: "not_measured",
  behavior_change: "not_measured",
  real_embedding_quality: "not_measured_deterministic_proxy_only",
};

export async function runPublicRetrievalBenchmark(options: {
  datasetPath?: string;
  includeCases?: boolean;
} = {}): Promise<PublicRetrievalBenchmarkReport> {
  const datasetPath = options.datasetPath ?? DEFAULT_PUBLIC_RETRIEVAL_DATASET;
  const bytes = readFileSync(datasetPath);
  const document = parsePublicDataset(bytes.toString("utf8"), datasetPath);
  const configurations: PublicBenchmarkConfiguration[] = [];

  for (const run of RUNS) {
    const fixture = withMode(document, run.mode);
    const result = await evaluateSearchFixtureCases(
      fixture,
      run.semantic === "deterministic_proxy" ? new PublicRetrievalEmbedder() : undefined
    );
    configurations.push({
      name: run.name,
      search_mode: run.mode,
      semantic: run.semantic,
      total_cases: result.cases.length,
      metrics: result.metrics,
      failures: result.failures.map((item) => item.query),
      ...(options.includeCases ? { cases: result.cases } : {}),
    });
  }

  return {
    schema_version: 1,
    benchmark_id: PUBLIC_RETRIEVAL_BENCHMARK_ID,
    dataset: datasetPath,
    dataset_sha256: createHash("sha256").update(bytes).digest("hex"),
    dataset_license: "MIT",
    dataset_provenance: "synthetic_authored_for_codetrap",
    offline: true,
    claims: CLAIMS,
    configurations,
  };
}

export function expectedPublicBenchmarkSummary(
  report: PublicRetrievalBenchmarkReport
): PublicRetrievalBenchmarkExpected {
  return {
    schema_version: report.schema_version,
    benchmark_id: report.benchmark_id,
    dataset_sha256: report.dataset_sha256,
    claims: { ...report.claims },
    configurations: report.configurations.map((item) => ({
      name: item.name,
      metrics: { ...item.metrics },
      failures: [...item.failures],
    })),
  };
}

export function verifyPublicBenchmark(
  report: PublicRetrievalBenchmarkReport,
  expectedPath = DEFAULT_PUBLIC_RETRIEVAL_EXPECTED
): void {
  const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as unknown;
  if (!isRecord(expected)) throw new Error(`Invalid expected benchmark summary: ${expectedPath}`);
  const actual = expectedPublicBenchmarkSummary(report);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Public retrieval benchmark drifted from ${expectedPath}. ` +
      "Inspect dataset hash, metrics, and weak-configuration failures before updating the expected result."
    );
  }
}

export function formatPublicRetrievalBenchmark(report: PublicRetrievalBenchmarkReport): string {
  const lines = [
    `Public retrieval benchmark: ${report.benchmark_id}`,
    `Dataset: ${report.dataset}`,
    `Dataset SHA-256: ${report.dataset_sha256}`,
    `Dataset provenance: ${report.dataset_provenance} (${report.dataset_license})`,
    "Scope: retrieval on a released synthetic dataset",
    "Not measured: candidate quality, behavior change, real embedding quality",
    "Configurations:",
  ];
  for (const item of report.configurations) {
    lines.push(
      `  - ${item.name}: R@3=${item.metrics.recall_at_3} R@5=${item.metrics.recall_at_5} ` +
      `MRR=${item.metrics.mrr} failures=${item.failures.length}`
    );
  }
  return lines.join("\n");
}

function parsePublicDataset(text: string, path: string): PublicDatasetDocument {
  const raw = JSON.parse(text) as unknown;
  if (!isRecord(raw) || !isRecord(raw.benchmark)) {
    throw new Error(`Public benchmark metadata is missing: ${path}`);
  }
  const metadata = raw.benchmark;
  if (
    metadata.id !== PUBLIC_RETRIEVAL_BENCHMARK_ID ||
    metadata.schema_version !== 1 ||
    metadata.license !== "MIT" ||
    metadata.provenance !== "synthetic_authored_for_codetrap"
  ) {
    throw new Error(`Public benchmark metadata is invalid: ${path}`);
  }
  return parseEvalFixture(text, path) as PublicDatasetDocument;
}

function withMode(document: PublicDatasetDocument, mode: SearchMode): EvalFixture {
  return {
    traps: document.traps,
    queries: document.queries.map((item) => ({ ...item, mode })),
  };
}
