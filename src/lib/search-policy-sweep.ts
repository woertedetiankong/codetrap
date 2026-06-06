import { readFileSync } from "node:fs";
import type { TrapSearchResult } from "../domain/trap";
import { SCOPES, SEARCH_MODES, type Scope, type SearchMode } from "./constants";
import { isRecord } from "./value-types";
import {
  defaultEmbeddingRuntime,
  embeddingRuntimeFrom,
  type EmbeddingRuntimeInput,
} from "./embedding-runtime";
import {
  DEFAULT_SEARCH_EVAL_FIXTURE,
  EvalEmbedder,
  evaluateSearchFixtureCases,
  readEvalFixture,
  type EvalCaseReport,
  type SearchEvalMetrics,
} from "./search-eval";
import { ScopedRepositoryContext } from "./scope-context";
import {
  DEFAULT_RANKING_CONFIG,
  type RankingConfig,
} from "./search-policy";

export type RankingCandidate = {
  name: string;
  config: RankingConfig;
};

export type GoldTarget = {
  scope?: Scope;
  id?: number;
  title?: string;
};

export type LiveEvalCase = {
  query: string;
  mode?: SearchMode;
  scope?: Scope;
  limit?: number;
  gold?: GoldTarget[];
  minRecallAt3?: number;
  minRecallAt5?: number;
};

export type ComparableSearchCase = {
  key: string;
  query: string;
  mode: SearchMode;
  scope?: Scope;
  scored: boolean;
  recallAt3: number;
  recallAt5: number;
  reciprocalRank: number;
  passed: boolean;
  topResults: { id: number; scope?: Scope; title: string; sources: string[]; diagnostics: string[] }[];
  warnings: string[];
  error?: string;
};

export type CaseDelta = {
  query: string;
  mode: SearchMode;
  scope?: Scope;
  before: number;
  after: number;
  beforeTop: string[];
  afterTop: string[];
};

export type SweepCandidateReport = {
  name: string;
  config: RankingConfig;
  total_cases: number;
  scored_cases: number;
  metrics: SearchEvalMetrics;
  cases: ComparableSearchCase[];
  failures: ComparableSearchCase[];
  regressions: CaseDelta[];
  improvements: CaseDelta[];
};

export type PolicySweepReport = {
  mode: "fixture" | "live";
  source: string;
  cwd?: string;
  candidate_count: number;
  baseline: SweepCandidateReport;
  candidates: SweepCandidateReport[];
  best: SweepCandidateReport;
  recommendation: string;
};

type FixtureSweepOptions = {
  fixturePath?: string;
  candidates?: RankingCandidate[];
};

type LiveSweepOptions = {
  cwd: string;
  cases: LiveEvalCase[];
  candidates?: RankingCandidate[];
  embeddings?: EmbeddingRuntimeInput;
  defaultScope?: Scope;
  home?: string;
};

export const DEFAULT_POLICY_SWEEP_CANDIDATES: RankingCandidate[] = [
  candidate("default", {}),
  candidate("title-tag-heavy", {
    titleTokenBoost: 0.24,
    tagTokenBoost: 0.28,
    maxBoost: 0.55,
  }),
  candidate("identifier-heavy", {
    identifierBoost: 0.3,
    maxBoost: 0.55,
  }),
  candidate("scope-heavy", {
    pathMatchBoost: 0.2,
    moduleMatchBoost: 0.14,
    ownerMatchBoost: 0.08,
    maxBoost: 0.55,
  }),
  candidate("severity-light", {
    severityBoost: {
      warning: 0,
      error: 0.02,
      critical: 0.03,
    },
  }),
  candidate("semantic-loose", {
    semanticMinScore: 0.2,
  }),
  candidate("semantic-strict", {
    semanticMinScore: 0.4,
  }),
];

export async function runFixturePolicySweep(options: FixtureSweepOptions = {}): Promise<PolicySweepReport> {
  const fixturePath = options.fixturePath ?? DEFAULT_SEARCH_EVAL_FIXTURE;
  const fixture = readEvalFixture(fixturePath);
  const candidates = options.candidates ?? DEFAULT_POLICY_SWEEP_CANDIDATES;
  const reports: SweepCandidateReport[] = [];
  let baselineCases: ComparableSearchCase[] | undefined;

  for (const item of candidates) {
    const detailed = await evaluateSearchFixtureCases(fixture, new EvalEmbedder(), item.config);
    const cases = detailed.cases.map(fromEvalCaseReport);
    if (!baselineCases) baselineCases = cases;
    reports.push(candidateReport(item, cases, baselineCases));
  }

  return buildSweepReport("fixture", fixturePath, reports);
}

export async function runLivePolicySweep(options: LiveSweepOptions): Promise<PolicySweepReport> {
  if (options.cases.length === 0) throw new Error("Live sweep requires at least one query case.");

  const candidates = options.candidates ?? DEFAULT_POLICY_SWEEP_CANDIDATES;
  const embeddings = options.embeddings ?? defaultEmbeddingRuntime();
  const reports: SweepCandidateReport[] = [];
  let baselineCases: ComparableSearchCase[] | undefined;

  for (const item of candidates) {
    const cases = await evaluateLiveCases({
      ...options,
      embeddings,
      defaultScope: options.defaultScope ?? "project",
      ranking: item.config,
    });
    if (!baselineCases) baselineCases = cases;
    reports.push(candidateReport(item, cases, baselineCases));
  }

  return buildSweepReport("live", "live project", reports, options.cwd);
}

export function readLiveEvalCases(path: string): LiveEvalCase[] {
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  const records = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.queries)
      ? parsed.queries
      : null;
  if (!records) throw new Error("Live queries file must be an array or an object with a queries array.");
  return records.map(normalizeLiveEvalCase);
}

export function formatPolicySweepReport(report: PolicySweepReport): string {
  const lines = [
    `Search policy sweep (${report.mode})`,
    `Source: ${report.source}`,
  ];
  if (report.cwd) lines.push(`cwd: ${report.cwd}`);
  lines.push(
    `Candidates: ${report.candidate_count}`,
    `Baseline: ${summaryLine(report.baseline)}`,
    `Best: ${summaryLine(report.best)}`,
    `Recommendation: ${report.recommendation}`,
    "Results:"
  );

  for (const candidate of report.candidates) {
    lines.push(`  - ${summaryLine(candidate)}`);
    if (candidate.regressions.length > 0) {
      lines.push(`    regressions: ${formatDeltas(candidate.regressions)}`);
    }
    if (candidate.improvements.length > 0) {
      lines.push(`    improvements: ${formatDeltas(candidate.improvements)}`);
    }
    if (candidate.failures.length > 0) {
      lines.push(`    failures: ${candidate.failures.slice(0, 3).map((item) => item.query).join("; ")}`);
    }
  }

  return lines.join("\n");
}

function candidate(name: string, patch: Partial<RankingConfig>): RankingCandidate {
  return {
    name,
    config: {
      ...DEFAULT_RANKING_CONFIG,
      ...patch,
      severityBoost: {
        ...DEFAULT_RANKING_CONFIG.severityBoost,
        ...(patch.severityBoost ?? {}),
      },
    },
  };
}

async function evaluateLiveCases(options: LiveSweepOptions & { ranking: RankingConfig }): Promise<ComparableSearchCase[]> {
  const defaultScope = options.defaultScope ?? "project";
  const scopes = new ScopedRepositoryContext(
    options.cwd,
    embeddingRuntimeFrom(options.embeddings),
    options.home,
    options.ranking
  );

  const out: ComparableSearchCase[] = [];
  for (const input of options.cases) {
    const scope = input.scope ?? defaultScope;
    const mode = input.mode ?? "hybrid";
    try {
      const results = await scopes.repositoryFor(scope).search(input.query, {
        mode,
        scope,
        limit: input.limit ?? 5,
      });
      out.push(liveCaseReport(input, mode, scope, results));
    } catch (error) {
      out.push({
        key: caseKey(input.query, mode, scope),
        query: input.query,
        mode,
        scope,
        scored: (input.gold ?? []).length > 0,
        recallAt3: 0,
        recallAt5: 0,
        reciprocalRank: 0,
        passed: false,
        topResults: [],
        warnings: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return out;
}

function liveCaseReport(
  input: LiveEvalCase,
  mode: SearchMode,
  scope: Scope,
  results: TrapSearchResult[]
): ComparableSearchCase {
  const gold = input.gold ?? [];
  const warnings = new Set<string>();
  const recallAt3 = gold.length > 0 ? recall(gold, results.slice(0, 3), warnings, scope) : 1;
  const recallAt5 = gold.length > 0 ? recall(gold, results.slice(0, 5), warnings, scope) : 1;
  const firstRank = gold.length > 0 ? firstMatchRank(gold, results, warnings, scope) : -1;
  const reciprocalRank = firstRank >= 0 ? 1 / (firstRank + 1) : 0;
  const minRecallAt3 = input.minRecallAt3 ?? (gold.length > 0 ? 1 : 0);
  const minRecallAt5 = input.minRecallAt5 ?? (gold.length > 0 ? 1 : 0);

  return {
    key: caseKey(input.query, mode, scope),
    query: input.query,
    mode,
    scope,
    scored: gold.length > 0,
    recallAt3,
    recallAt5,
    reciprocalRank,
    passed: recallAt3 >= minRecallAt3 && recallAt5 >= minRecallAt5,
    topResults: results.map((result) => ({
      id: result.trap.id,
      scope: result.trap.scope === "project" || result.trap.scope === "global" ? result.trap.scope : scope,
      title: result.trap.title,
      sources: result.sources ?? [],
      diagnostics: (result.diagnostics ?? []).map((diagnostic) => diagnostic.code),
    })),
    warnings: [...warnings],
  };
}

function recall(gold: GoldTarget[], results: TrapSearchResult[], warnings: Set<string>, defaultScope: Scope): number {
  return gold.filter((target) => targetMatches(target, results, warnings, defaultScope)).length / gold.length;
}

function firstMatchRank(
  gold: GoldTarget[],
  results: TrapSearchResult[],
  warnings: Set<string>,
  defaultScope: Scope
): number {
  return results.findIndex((result) =>
    gold.some((target) => targetMatches(target, [result], warnings, defaultScope))
  );
}

function targetMatches(
  target: GoldTarget,
  results: TrapSearchResult[],
  warnings: Set<string>,
  defaultScope: Scope
): boolean {
  const scope = target.scope ?? defaultScope;
  const scoped = results.filter((result) => result.trap.scope === scope);
  if (target.id !== undefined) {
    const idMatch = scoped.find((result) => result.trap.id === target.id);
    if (idMatch) {
      if (target.title && idMatch.trap.title !== target.title) {
        warnings.add(`gold_title_mismatch:${target.id}`);
      }
      return true;
    }
  }
  if (!target.title) return false;

  const titleMatches = scoped.filter((result) => result.trap.title === target.title);
  if (titleMatches.length > 1) warnings.add(`gold_title_ambiguous:${target.title}`);
  if (titleMatches.length > 0) {
    if (target.id !== undefined && titleMatches.every((result) => result.trap.id !== target.id)) {
      warnings.add(`gold_id_drift:${target.id}->${titleMatches.map((result) => result.trap.id).join(",")}`);
    }
    return true;
  }
  return false;
}

function fromEvalCaseReport(item: EvalCaseReport): ComparableSearchCase {
  return {
    key: caseKey(item.query, item.mode),
    query: item.query,
    mode: item.mode,
    scored: item.goldTrapIds.length > 0,
    recallAt3: item.recallAt3,
    recallAt5: item.recallAt5,
    reciprocalRank: item.reciprocalRank,
    passed: item.passed,
    topResults: item.topResults.map((result) => ({
      id: result.id,
      title: result.title,
      sources: result.sources,
      diagnostics: result.diagnostics,
    })),
    warnings: [],
    error: item.error,
  };
}

function candidateReport(
  candidate: RankingCandidate,
  cases: ComparableSearchCase[],
  baselineCases: ComparableSearchCase[]
): SweepCandidateReport {
  return {
    name: candidate.name,
    config: candidate.config,
    total_cases: cases.length,
    scored_cases: cases.filter((item) => item.scored).length,
    metrics: aggregateMetrics(cases),
    cases,
    failures: cases.filter((item) => !item.passed),
    regressions: deltas(cases, baselineCases, "regression"),
    improvements: deltas(cases, baselineCases, "improvement"),
  };
}

function aggregateMetrics(cases: ComparableSearchCase[]): SearchEvalMetrics {
  const scored = cases.filter((item) => item.scored);
  const total = scored.length || 1;
  return {
    recall_at_3: round(scored.reduce((sum, item) => sum + item.recallAt3, 0) / total),
    recall_at_5: round(scored.reduce((sum, item) => sum + item.recallAt5, 0) / total),
    mrr: round(scored.reduce((sum, item) => sum + item.reciprocalRank, 0) / total),
    hybrid_fallback_count: cases.filter((item) =>
      item.topResults.some((result) =>
        result.diagnostics.some((code) =>
          ["semantic_unavailable", "semantic_no_candidates", "semantic_failed"].includes(code)
        )
      )
    ).length,
    semantic_error_count: cases.filter((item) => item.error).length,
  };
}

function deltas(
  cases: ComparableSearchCase[],
  baselineCases: ComparableSearchCase[],
  direction: "regression" | "improvement"
): CaseDelta[] {
  const baselineByKey = new Map(baselineCases.map((item) => [item.key, item]));
  const out: CaseDelta[] = [];
  for (const item of cases) {
    const baseline = baselineByKey.get(item.key);
    if (!baseline || !item.scored) continue;
    const diff = item.reciprocalRank - baseline.reciprocalRank;
    const changed = direction === "regression" ? diff < -0.0001 : diff > 0.0001;
    if (!changed) continue;
    out.push({
      query: item.query,
      mode: item.mode,
      scope: item.scope,
      before: baseline.reciprocalRank,
      after: item.reciprocalRank,
      beforeTop: topTitles(baseline),
      afterTop: topTitles(item),
    });
  }
  return out;
}

function buildSweepReport(
  mode: PolicySweepReport["mode"],
  source: string,
  candidates: SweepCandidateReport[],
  cwd?: string
): PolicySweepReport {
  if (candidates.length === 0) throw new Error("At least one ranking candidate is required.");
  const baseline = candidates[0]!;
  const best = [...candidates].sort(compareCandidates)[0]!;
  return {
    mode,
    source,
    cwd,
    candidate_count: candidates.length,
    baseline,
    candidates,
    best,
    recommendation: recommendation(baseline, best, candidates),
  };
}

function compareCandidates(a: SweepCandidateReport, b: SweepCandidateReport): number {
  return (
    b.metrics.recall_at_3 - a.metrics.recall_at_3 ||
    b.metrics.mrr - a.metrics.mrr ||
    a.failures.length - b.failures.length ||
    a.regressions.length - b.regressions.length
  );
}

function recommendation(baseline: SweepCandidateReport, best: SweepCandidateReport, candidates: SweepCandidateReport[]): string {
  if (baseline.scored_cases === 0) return "No scored live cases yet; add gold targets before using this as an optimization signal.";
  const allTie = candidates.every((item) =>
    item.metrics.recall_at_3 === baseline.metrics.recall_at_3 &&
    item.metrics.recall_at_5 === baseline.metrics.recall_at_5 &&
    item.metrics.mrr === baseline.metrics.mrr
  );
  if (allTie) return "All candidates tie; add harder miss/noisy_hit eval cases before changing ranking config.";
  if (best.name === baseline.name) return "The default config is still best on this fixture.";
  if (best.regressions.length > 0) return `${best.name} improves aggregate metrics but has regressions; inspect before adopting.`;
  return `${best.name} is the strongest candidate on these cases; inspect changed rankings before editing defaults.`;
}

function normalizeLiveEvalCase(value: unknown): LiveEvalCase {
  if (!isRecord(value)) throw new Error("Each live query case must be an object.");
  const query = stringField(value, "query");
  const mode = optionalEnum(value, "mode", SEARCH_MODES);
  const scope = optionalEnum(value, "scope", SCOPES);
  return {
    query,
    mode,
    scope,
    limit: optionalPositiveInt(value, "limit"),
    gold: normalizeGoldTargets(value.gold),
    minRecallAt3: optionalScore(value, "minRecallAt3"),
    minRecallAt5: optionalScore(value, "minRecallAt5"),
  };
}

function normalizeGoldTargets(value: unknown): GoldTarget[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("gold must be an array.");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("gold entries must be objects.");
    const id = item.id === undefined ? undefined : Number(item.id);
    if (id !== undefined && (!Number.isInteger(id) || id <= 0)) throw new Error("gold.id must be a positive integer.");
    const scope = optionalEnum(item, "scope", SCOPES);
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : undefined;
    if (id === undefined && !title) throw new Error("gold entries require id or title.");
    return { id, title, scope };
  });
}

function caseKey(query: string, mode: SearchMode, scope?: Scope): string {
  return `${scope ?? "fixture"}\0${mode}\0${query}`;
}

function topTitles(item: ComparableSearchCase): string[] {
  return item.topResults.slice(0, 3).map((result) => `#${result.id} ${result.title}`);
}

function summaryLine(item: SweepCandidateReport): string {
  return `${item.name} R@3=${item.metrics.recall_at_3} R@5=${item.metrics.recall_at_5} MRR=${item.metrics.mrr} failures=${item.failures.length} regressions=${item.regressions.length}`;
}

function formatDeltas(items: CaseDelta[]): string {
  return items
    .slice(0, 3)
    .map((item) => `${item.query} ${round(item.before)}->${round(item.after)}`)
    .join("; ");
}

function optionalEnum<T extends readonly string[]>(value: Record<string, unknown>, key: string, choices: T): T[number] | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field !== "string" || !(choices as readonly string[]).includes(field)) {
    throw new Error(`${key} must be one of: ${choices.join(", ")}`);
  }
  return field as T[number];
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.trim() === "") throw new Error(`${key} is required.`);
  return field.trim();
}

function optionalPositiveInt(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  const number = Number(field);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${key} must be a positive integer.`);
  return number;
}

function optionalScore(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  const number = Number(field);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error(`${key} must be between 0 and 1.`);
  return number;
}


function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
