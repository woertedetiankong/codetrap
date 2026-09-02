import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { withAdvisoryLock } from "./advisory-lock";
import { writeFileAtomic } from "./fs-json";
import {
  EvalEmbedder,
  evaluateSearchFixtureCases,
  parseEvalFixture,
  type EvalCaseReport,
  type EvalFixture,
  type SearchEvalDetailedReport,
  type SearchEvalMetrics,
} from "./search-eval";
import { isRecord } from "./value-types";

export const CONTROLLED_EVAL_SCHEMA_VERSION = 1 as const;
export const CONTROLLED_EVAL_FIXTURE = "src/tests/fixtures/search-eval.json" as const;
export const CONTROLLED_EVAL_PROFILES = [
  "retrieval_policy_v1",
  "memory_contribution_v1",
] as const;

export type ControlledEvalProfile = (typeof CONTROLLED_EVAL_PROFILES)[number];
export type ControlledEvalClassification =
  | "regressed"
  | "improved"
  | "changed"
  | "unchanged_pass"
  | "unchanged_fail";

export type ControlledEvalProfileInfo = {
  id: ControlledEvalProfile;
  baseline_label: string;
  candidate_label: string;
  question: string;
  intentional_variable: string;
};

export type ControlledEvalSideIdentity = {
  id: string;
  label: string;
  retrieval_mode: "fts_only" | "fixture_directed";
  memory: "confirmed_fixture" | "expected_traps_masked";
  semantic: "disabled" | "deterministic_eval_embedding";
};

export type ControlledEvalCaseSide = Pick<
  EvalCaseReport,
  "passed" | "recallAt3" | "recallAt5" | "reciprocalRank" | "error"
> & {
  top_results: Array<{ id: number; title: string }>;
};

export type ControlledEvalCaseComparison = {
  id: string;
  query: string;
  fixture_mode: string;
  gold_trap_ids: number[];
  classification: ControlledEvalClassification;
  baseline: ControlledEvalCaseSide;
  candidate: ControlledEvalCaseSide;
  evidence: {
    fixture: typeof CONTROLLED_EVAL_FIXTURE;
    query_index: number;
    query_sha256: string;
  };
};

export type ControlledEvalExperiment = {
  schema_version: typeof CONTROLLED_EVAL_SCHEMA_VERSION;
  id: string;
  kind: "deterministic_retrieval";
  status: "completed";
  profile: ControlledEvalProfile;
  created_at: string;
  completed_at: string;
  duration_ms: number;
  suite: {
    path: typeof CONTROLLED_EVAL_FIXTURE;
    sha256: string;
    snapshot: string;
    case_count: number;
  };
  repository: {
    revision: string | null;
    dirty: boolean | null;
  };
  runtime: {
    bun_version: string;
    platform: NodeJS.Platform;
  };
  isolation: {
    kind: "in_memory_fixture_snapshot";
    source_writes: false;
    command_execution: false;
  };
  budget: {
    model_calls: 0;
    token_budget: 0;
    estimated_cost: 0;
  };
  configuration: {
    fingerprint: string;
    seed: string;
    trials: number;
    baseline: ControlledEvalSideIdentity;
    candidate: ControlledEvalSideIdentity;
    intentional_variable: string;
  };
  reproducible: boolean;
  trial_runs: Array<{
    index: number;
    order: "baseline_then_candidate" | "candidate_then_baseline";
    case_order: string[];
    baseline_duration_ms: number;
    candidate_duration_ms: number;
  }>;
  summary: {
    total_cases: number;
    regressions: number;
    improvements: number;
    changed: number;
    unchanged_pass: number;
    unchanged_fail: number;
    baseline_metrics: SearchEvalMetrics;
    candidate_metrics: SearchEvalMetrics;
    baseline_failed_cases: number;
    candidate_failed_cases: number;
    baseline_average_duration_ms: number;
    candidate_average_duration_ms: number;
    duration_delta_ms: number;
  };
  cases: ControlledEvalCaseComparison[];
};

export type ControlledEvalRunInput = {
  profile: ControlledEvalProfile;
  trials?: number;
  seed?: string;
};

export type ControlledEvalStoreIssue = {
  file: string;
  issue: "invalid_experiment";
};

export type ControlledEvalHistory = {
  experiments: ControlledEvalExperiment[];
  corrupt_results: ControlledEvalStoreIssue[];
};

type OrderedCase = {
  id: string;
  originalIndex: number;
  query: EvalFixture["queries"][number];
};

type EvaluatedSide = {
  report: SearchEvalDetailedReport;
  durationMs: number;
};

type TrialEvaluation = {
  orderedCases: OrderedCase[];
  baseline: EvaluatedSide;
  candidate: EvaluatedSide;
};

const PROFILE_INFO: Record<ControlledEvalProfile, ControlledEvalProfileInfo> = {
  retrieval_policy_v1: {
    id: "retrieval_policy_v1",
    baseline_label: "FTS-only baseline",
    candidate_label: "Confirmed fixture policy",
    question: "Does the confirmed hybrid/semantic retrieval policy outperform a lexical-only baseline?",
    intentional_variable: "retrieval mode and deterministic semantic availability",
  },
  memory_contribution_v1: {
    id: "memory_contribution_v1",
    baseline_label: "Expected memory masked",
    candidate_label: "Confirmed memory available",
    question: "Does the confirmed trap library make the expected experience retrievable?",
    intentional_variable: "availability of fixture-confirmed expected traps",
  },
};

export class ControlledEvalOperations {
  readonly projectRoot: string;

  constructor(
    projectRoot: string,
    private readonly now: () => Date = () => new Date()
  ) {
    this.projectRoot = resolve(projectRoot);
  }

  profiles(): ControlledEvalProfileInfo[] {
    return CONTROLLED_EVAL_PROFILES.map((id) => ({ ...PROFILE_INFO[id] }));
  }

  list(limit = 12): ControlledEvalExperiment[] {
    const history = this.history(limit);
    if (history.corrupt_results.length > 0) {
      throw new Error(`Controlled Eval result store contains ${history.corrupt_results.length} invalid experiment(s).`);
    }
    return history.experiments;
  }

  history(limit = 12): ControlledEvalHistory {
    const directory = this.experimentsDirectory();
    if (!existsSync(directory)) return { experiments: [], corrupt_results: [] };
    const experiments: ControlledEvalExperiment[] = [];
    const corruptResults: ControlledEvalStoreIssue[] = [];
    for (const name of readdirSync(directory).filter((entry) => entry.endsWith(".json"))) {
      try {
        experiments.push(parseStoredExperiment(readFileSync(join(directory, name), "utf8"), name));
      } catch {
        // Keep the artifact in place for audit/recovery. Web callers receive a
        // bounded filename-only diagnostic while healthy history remains usable.
        if (corruptResults.length < 100) corruptResults.push({ file: name, issue: "invalid_experiment" });
      }
    }
    return {
      experiments: experiments
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, Math.max(1, Math.min(limit, 100))),
      corrupt_results: corruptResults.sort((left, right) => left.file.localeCompare(right.file)),
    };
  }

  async run(input: ControlledEvalRunInput): Promise<ControlledEvalExperiment> {
    const profile = controlledEvalProfile(input.profile);
    const trials = controlledEvalTrials(input.trials);
    const seed = controlledEvalSeed(input.seed);
    const fixturePath = join(this.projectRoot, CONTROLLED_EVAL_FIXTURE);
    if (!existsSync(fixturePath)) throw new Error(`Controlled Eval fixture not found: ${CONTROLLED_EVAL_FIXTURE}`);

    const fixtureBytes = readFileSync(fixturePath);
    const fixture = parseEvalFixture(fixtureBytes.toString("utf8"), fixturePath);
    if (fixture.queries.length === 0) throw new Error("Controlled Eval fixture has no confirmed cases.");
    const suiteSha = sha256(fixtureBytes);
    const profileInfo = PROFILE_INFO[profile];
    const identities = profileIdentities(profile, profileInfo);
    const fingerprint = sha256(stableJson({
      schema_version: CONTROLLED_EVAL_SCHEMA_VERSION,
      suite_sha256: suiteSha,
      profile,
      seed,
      trials,
      baseline: identities.baseline,
      candidate: identities.candidate,
    }));
    const createdAt = this.now().toISOString();
    const started = performance.now();
    const evaluations: TrialEvaluation[] = [];
    const trialRuns: ControlledEvalExperiment["trial_runs"] = [];

    for (let index = 0; index < trials; index++) {
      const orderedCases = orderedFixtureCases(fixture, `${seed}:${index}`);
      const orderedFixture: EvalFixture = { traps: fixture.traps, queries: orderedCases.map((item) => item.query) };
      const baselineFixture = baselineFixtureFor(profile, orderedFixture);
      const candidateFixture = candidateFixtureFor(profile, orderedFixture);
      const candidateFirst = Number.parseInt(sha256(`${seed}:side:${index}`).slice(0, 2), 16) % 2 === 1;
      let baseline: EvaluatedSide;
      let candidate: EvaluatedSide;
      if (candidateFirst) {
        candidate = await evaluateSide(candidateFixture, candidateEmbeddings(profile));
        baseline = await evaluateSide(baselineFixture, baselineEmbeddings(profile));
      } else {
        baseline = await evaluateSide(baselineFixture, baselineEmbeddings(profile));
        candidate = await evaluateSide(candidateFixture, candidateEmbeddings(profile));
      }
      evaluations.push({ orderedCases, baseline, candidate });
      trialRuns.push({
        index: index + 1,
        order: candidateFirst ? "candidate_then_baseline" : "baseline_then_candidate",
        case_order: orderedCases.map((item) => item.id),
        baseline_duration_ms: roundMilliseconds(baseline.durationMs),
        candidate_duration_ms: roundMilliseconds(candidate.durationMs),
      });
    }

    const first = evaluations[0];
    const cases = compareCases(first.orderedCases, first.baseline.report.cases, first.candidate.report.cases);
    const completedAt = this.now().toISOString();
    const baselineAverage = average(evaluations.map((trial) => trial.baseline.durationMs));
    const candidateAverage = average(evaluations.map((trial) => trial.candidate.durationMs));
    const id = `eval-${createdAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
    const snapshot = `.codetrap/evals/suites/${suiteSha}.json`;
    const experiment: ControlledEvalExperiment = {
      schema_version: CONTROLLED_EVAL_SCHEMA_VERSION,
      id,
      kind: "deterministic_retrieval",
      status: "completed",
      profile,
      created_at: createdAt,
      completed_at: completedAt,
      duration_ms: roundMilliseconds(performance.now() - started),
      suite: {
        path: CONTROLLED_EVAL_FIXTURE,
        sha256: suiteSha,
        snapshot,
        case_count: fixture.queries.length,
      },
      repository: repositoryIdentity(this.projectRoot),
      runtime: {
        bun_version: Bun.version,
        platform: process.platform,
      },
      isolation: {
        kind: "in_memory_fixture_snapshot",
        source_writes: false,
        command_execution: false,
      },
      budget: {
        model_calls: 0,
        token_budget: 0,
        estimated_cost: 0,
      },
      configuration: {
        fingerprint,
        seed,
        trials,
        baseline: identities.baseline,
        candidate: identities.candidate,
        intentional_variable: profileInfo.intentional_variable,
      },
      reproducible: evaluations.every((trial) =>
        sideSignature(trial.orderedCases, trial.baseline.report.cases) === sideSignature(first.orderedCases, first.baseline.report.cases) &&
        sideSignature(trial.orderedCases, trial.candidate.report.cases) === sideSignature(first.orderedCases, first.candidate.report.cases)
      ),
      trial_runs: trialRuns,
      summary: {
        total_cases: cases.length,
        regressions: cases.filter((item) => item.classification === "regressed").length,
        improvements: cases.filter((item) => item.classification === "improved").length,
        changed: cases.filter((item) => item.classification === "changed").length,
        unchanged_pass: cases.filter((item) => item.classification === "unchanged_pass").length,
        unchanged_fail: cases.filter((item) => item.classification === "unchanged_fail").length,
        baseline_metrics: first.baseline.report.metrics,
        candidate_metrics: first.candidate.report.metrics,
        baseline_failed_cases: first.baseline.report.failures.length,
        candidate_failed_cases: first.candidate.report.failures.length,
        baseline_average_duration_ms: roundMilliseconds(baselineAverage),
        candidate_average_duration_ms: roundMilliseconds(candidateAverage),
        duration_delta_ms: roundMilliseconds(candidateAverage - baselineAverage),
      },
      cases,
    };
    this.persist(experiment, fixtureBytes);
    return experiment;
  }

  private persist(experiment: ControlledEvalExperiment, fixtureBytes: Buffer): void {
    const root = this.rootDirectory();
    const suites = join(root, "suites");
    const experiments = this.experimentsDirectory();
    mkdirSync(suites, { recursive: true });
    mkdirSync(experiments, { recursive: true });
    withAdvisoryLock(join(root, ".write.lock"), () => {
      const snapshotPath = join(suites, `${experiment.suite.sha256}.json`);
      if (existsSync(snapshotPath)) {
        if (sha256(readFileSync(snapshotPath)) !== experiment.suite.sha256) {
          throw new Error(`Controlled Eval suite snapshot is corrupt: ${snapshotPath}`);
        }
      } else {
        writeFileAtomic(snapshotPath, fixtureBytes.toString("utf8"));
      }
      writeFileAtomic(
        join(experiments, `${experiment.id}.json`),
        `${JSON.stringify(experiment, null, 2)}\n`
      );
    });
  }

  private rootDirectory(): string {
    return join(this.projectRoot, ".codetrap", "evals");
  }

  private experimentsDirectory(): string {
    return join(this.rootDirectory(), "experiments");
  }
}

function controlledEvalProfile(value: unknown): ControlledEvalProfile {
  if (typeof value !== "string" || !(CONTROLLED_EVAL_PROFILES as readonly string[]).includes(value)) {
    throw new Error(`profile must be one of: ${CONTROLLED_EVAL_PROFILES.join(", ")}`);
  }
  return value as ControlledEvalProfile;
}

function controlledEvalTrials(value: unknown): number {
  const trials = value === undefined ? 2 : Number(value);
  if (!Number.isInteger(trials) || trials < 1 || trials > 5) {
    throw new Error("trials must be an integer between 1 and 5.");
  }
  return trials;
}

function controlledEvalSeed(value: unknown): string {
  if (value === undefined) return "codetrap-controlled-v1";
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80) {
    throw new Error("seed must be a non-empty string of at most 80 characters.");
  }
  return value.trim();
}

function profileIdentities(
  profile: ControlledEvalProfile,
  info: ControlledEvalProfileInfo
): { baseline: ControlledEvalSideIdentity; candidate: ControlledEvalSideIdentity } {
  if (profile === "retrieval_policy_v1") {
    return {
      baseline: {
        id: "fts_only_v1",
        label: info.baseline_label,
        retrieval_mode: "fts_only",
        memory: "confirmed_fixture",
        semantic: "disabled",
      },
      candidate: {
        id: "fixture_policy_v1",
        label: info.candidate_label,
        retrieval_mode: "fixture_directed",
        memory: "confirmed_fixture",
        semantic: "deterministic_eval_embedding",
      },
    };
  }
  return {
    baseline: {
      id: "expected_memory_masked_v1",
      label: info.baseline_label,
      retrieval_mode: "fixture_directed",
      memory: "expected_traps_masked",
      semantic: "deterministic_eval_embedding",
    },
    candidate: {
      id: "confirmed_memory_v1",
      label: info.candidate_label,
      retrieval_mode: "fixture_directed",
      memory: "confirmed_fixture",
      semantic: "deterministic_eval_embedding",
    },
  };
}

function baselineFixtureFor(profile: ControlledEvalProfile, fixture: EvalFixture): EvalFixture {
  if (profile === "retrieval_policy_v1") {
    return { traps: fixture.traps, queries: fixture.queries.map((query) => ({ ...query, mode: "fts" })) };
  }
  const expectedIds = new Set(fixture.queries.flatMap((query) => query.goldTrapIds));
  return {
    traps: fixture.traps.map((trap, index) => expectedIds.has(index + 1) ? maskedTrap(index + 1) : trap),
    queries: fixture.queries,
  };
}

function candidateFixtureFor(_profile: ControlledEvalProfile, fixture: EvalFixture): EvalFixture {
  return fixture;
}

function maskedTrap(id: number): EvalFixture["traps"][number] {
  return {
    title: `Controlled baseline placeholder ${id}`,
    category: "other",
    tags: ["controlled-baseline-placeholder"],
    scope: "project",
    context: "Neutral placeholder preserving fixture row identity.",
    mistake: "No confirmed experience is available in this baseline slot.",
    fix: "No guidance is supplied by the controlled baseline.",
    severity: "warning",
  };
}

function baselineEmbeddings(profile: ControlledEvalProfile): EvalEmbedder | undefined {
  return profile === "retrieval_policy_v1" ? undefined : new EvalEmbedder();
}

function candidateEmbeddings(_profile: ControlledEvalProfile): EvalEmbedder {
  return new EvalEmbedder();
}

async function evaluateSide(fixture: EvalFixture, embeddings: EvalEmbedder | undefined): Promise<EvaluatedSide> {
  const started = performance.now();
  const report = await evaluateSearchFixtureCases(fixture, embeddings);
  return { report, durationMs: performance.now() - started };
}

function orderedFixtureCases(fixture: EvalFixture, seed: string): OrderedCase[] {
  return fixture.queries
    .map((query, originalIndex) => ({
      id: controlledCaseId(query, originalIndex),
      originalIndex,
      query,
    }))
    .sort((left, right) =>
      sha256(`${seed}:${left.id}`).localeCompare(sha256(`${seed}:${right.id}`)) || left.id.localeCompare(right.id)
    );
}

function controlledCaseId(query: EvalFixture["queries"][number], index: number): string {
  return `case-${index + 1}-${sha256(stableJson({
    query: query.query,
    mode: query.mode,
    goldTrapIds: query.goldTrapIds,
  })).slice(0, 10)}`;
}

function compareCases(
  orderedCases: OrderedCase[],
  baseline: EvalCaseReport[],
  candidate: EvalCaseReport[]
): ControlledEvalCaseComparison[] {
  return orderedCases.map((item, index) => {
    const baselineCase = baseline[index];
    const candidateCase = candidate[index];
    return {
      id: item.id,
      query: item.query.query,
      fixture_mode: item.query.mode,
      gold_trap_ids: [...item.query.goldTrapIds],
      classification: caseClassification(baselineCase, candidateCase),
      baseline: compactCaseSide(baselineCase),
      candidate: compactCaseSide(candidateCase),
      evidence: {
        fixture: CONTROLLED_EVAL_FIXTURE,
        query_index: item.originalIndex + 1,
        query_sha256: sha256(stableJson(item.query)),
      },
    };
  }).sort((left, right) =>
    classificationOrder(left.classification) - classificationOrder(right.classification) ||
    left.evidence.query_index - right.evidence.query_index
  );
}

function caseClassification(baseline: EvalCaseReport, candidate: EvalCaseReport): ControlledEvalClassification {
  if (baseline.passed && !candidate.passed) return "regressed";
  if (!baseline.passed && candidate.passed) return "improved";
  if (caseSignature(baseline) !== caseSignature(candidate)) return "changed";
  return candidate.passed ? "unchanged_pass" : "unchanged_fail";
}

function compactCaseSide(item: EvalCaseReport): ControlledEvalCaseSide {
  return {
    passed: item.passed,
    recallAt3: item.recallAt3,
    recallAt5: item.recallAt5,
    reciprocalRank: item.reciprocalRank,
    top_results: item.topResults.slice(0, 5).map((result) => ({ id: result.id, title: result.title })),
    ...(item.error ? { error: item.error } : {}),
  };
}

function caseSignature(item: EvalCaseReport): string {
  return stableJson({
    passed: item.passed,
    recallAt3: item.recallAt3,
    recallAt5: item.recallAt5,
    reciprocalRank: item.reciprocalRank,
    top: item.topResults.map((result) => result.id),
    error: item.error ?? null,
  });
}

function sideSignature(orderedCases: OrderedCase[], cases: EvalCaseReport[]): string {
  return stableJson(orderedCases
    .map((item, index) => ({ id: item.id, result: caseSignature(cases[index]) }))
    .sort((left, right) => left.id.localeCompare(right.id)));
}

function classificationOrder(value: ControlledEvalClassification): number {
  return ["regressed", "improved", "changed", "unchanged_fail", "unchanged_pass"].indexOf(value);
}

function repositoryIdentity(projectRoot: string): ControlledEvalExperiment["repository"] {
  const revision = gitOutput(projectRoot, ["rev-parse", "HEAD"]);
  const status = gitOutput(projectRoot, ["status", "--porcelain=v1", "--untracked-files=normal"], true);
  return {
    revision: revision || null,
    dirty: status === null ? null : status.length > 0,
  };
}

function gitOutput(projectRoot: string, args: string[], allowEmpty = false): string | null {
  try {
    const result = Bun.spawnSync(["git", "-C", projectRoot, ...args], { stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) return null;
    const output = result.stdout.toString().trim();
    return output || (allowEmpty ? "" : null);
  } catch {
    return null;
  }
}

function parseStoredExperiment(text: string, source: string): ControlledEvalExperiment {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Corrupt Controlled Eval result ${source}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(value) || value.schema_version !== CONTROLLED_EVAL_SCHEMA_VERSION || value.kind !== "deterministic_retrieval") {
    throw new Error(`Unsupported Controlled Eval result: ${source}`);
  }
  return value as ControlledEvalExperiment;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function roundMilliseconds(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}
