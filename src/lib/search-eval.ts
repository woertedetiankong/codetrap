import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import type { TrapInput, TrapSearchResult } from "../domain/trap";
import { SEARCH_MODES, type SearchMode } from "./constants";
import {
  type EmbeddingConfig,
  type EmbeddingProvider,
  type EmbeddingTask,
} from "./embedder";
import {
  EmbeddingRuntime,
  defaultEmbeddingRuntime,
  embeddingRuntimeFrom,
  type EmbeddingRuntimeInput,
} from "./embedding-runtime";

export type PhaseGate = "phase0" | "phase1" | "phase4" | "dogfood";
export const DOGFOOD_JUDGMENTS = ["useful_hit", "miss", "noisy_hit", "no_relevant_trap"] as const;
export type DogfoodJudgment = (typeof DOGFOOD_JUDGMENTS)[number];

export type EvalQuery = {
  query: string;
  mode: SearchMode;
  goldTrapIds: number[];
  phaseGate: PhaseGate;
  minRecallAt3?: number;
  minRecallAt5: number;
  source?: string;
  judgment?: DogfoodJudgment;
  observedTopTitles?: string[];
  note?: string;
};

export type EvalFixture = {
  traps: TrapInput[];
  queries: EvalQuery[];
};

export type EvalCaseReport = {
  query: string;
  mode: SearchMode;
  phaseGate: PhaseGate;
  judgment?: DogfoodJudgment;
  goldTrapIds: number[];
  expectedTitles: string[];
  topResults: { id: number; title: string; sources: string[]; diagnostics: string[] }[];
  recallAt3: number;
  recallAt5: number;
  reciprocalRank: number;
  passed: boolean;
  error?: string;
};

export type SearchEvalMetrics = {
  recall_at_3: number;
  recall_at_5: number;
  mrr: number;
  hybrid_fallback_count: number;
  semantic_error_count: number;
};

export type SearchEvalNextAction = {
  command: string;
  reason: string;
};

export type SearchEvalReport = {
  mode: "deterministic" | "live";
  fixture: string;
  provider: EmbeddingConfig | null;
  semantic_available: boolean;
  provider_error: string | null;
  total_cases: number;
  metrics: SearchEvalMetrics;
  dogfood: {
    total: number;
    judgment_counts: Record<DogfoodJudgment, number>;
  };
  failures: EvalCaseReport[];
  misses: EvalCaseReport[];
  noisy_hits: EvalCaseReport[];
  next_actions: SearchEvalNextAction[];
};

export type RecordDogfoodResult = {
  success: true;
  fixture: string;
  query: EvalQuery;
  query_count: number;
};

export class EvalEmbedder implements EmbeddingProvider {
  readonly provider = "eval";
  readonly model = "eval-embedding";
  readonly dimensions = 14;

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    return texts.map(vectorFor);
  }
}

export const DEFAULT_SEARCH_EVAL_FIXTURE = "src/tests/fixtures/search-eval.json";

export function recordDogfoodCase(fixturePath: string, jsonInput: string | undefined): RecordDogfoodResult {
  if (!jsonInput) throw new Error("record requires --json '<record>'.");

  const fixture = readEvalFixture(fixturePath);
  const query = normalizeRecord(JSON.parse(jsonInput) as unknown, fixture);
  fixture.queries.push(query);
  writeEvalFixture(fixturePath, fixture);
  return {
    success: true,
    fixture: fixturePath,
    query,
    query_count: fixture.queries.length,
  };
}

export async function reportDogfood(fixturePath: string, live: boolean): Promise<SearchEvalReport> {
  const fixture = readEvalFixture(fixturePath);
  const runtime = live ? defaultEmbeddingRuntime() : new EmbeddingRuntime(new EvalEmbedder());
  const evaluated = await evaluateSearchFixture(fixture, runtime);
  const mode: SearchEvalReport["mode"] = live ? "live" : "deterministic";
  const report: Omit<SearchEvalReport, "next_actions"> = {
    mode,
    fixture: fixturePath,
    ...evaluated,
  };
  return {
    ...report,
    next_actions: buildSearchEvalNextActions(report),
  };
}

export async function evaluateSearchFixture(
  fixture: EvalFixture,
  embeddings: EmbeddingRuntimeInput
): Promise<Omit<SearchEvalReport, "mode" | "fixture" | "next_actions">> {
  const runtime = embeddingRuntimeFrom(embeddings);
  const repo = fixtureRepository(fixture, runtime);

  let providerError: string | null = null;
  if (runtime.available()) {
    try {
      await repo.ensureEmbeddings();
    } catch (error) {
      providerError = errorMessage(error);
    }
  }
  const searchRepo = providerError ? fixtureRepository(fixture, undefined) : repo;

  const cases: EvalCaseReport[] = [];
  let hybridFallbackCount = 0;
  let semanticErrorCount = 0;

  for (const item of fixture.queries) {
    try {
      const results = await searchRepo.search(item.query, { mode: item.mode, limit: 5 });
      const report = caseReport(item, fixture, results);
      cases.push(report);
      if (item.mode === "hybrid" && (!runtime.available() || hasSemanticFallback(results))) {
        hybridFallbackCount++;
      }
    } catch (error) {
      semanticErrorCount++;
      cases.push(caseReport(item, fixture, [], errorMessage(error)));
    }
  }

  const dogfoodCases = cases.filter((item) => item.phaseGate === "dogfood" || item.judgment !== undefined);
  const failures = cases.filter((item) => !item.passed);
  const misses = cases.filter((item) => item.judgment === "miss" || item.recallAt5 < (fixtureQuery(item, fixture)?.minRecallAt5 ?? 1));
  const noisyHits = cases.filter((item) => item.judgment === "noisy_hit");
  const metrics = aggregateMetrics(cases);
  return {
    provider: runtime.config(),
    semantic_available: runtime.available() && providerError === null,
    provider_error: providerError,
    total_cases: cases.length,
    metrics: {
      ...metrics,
      hybrid_fallback_count: hybridFallbackCount,
      semantic_error_count: semanticErrorCount,
    },
    dogfood: {
      total: dogfoodCases.length,
      judgment_counts: {
        useful_hit: dogfoodCases.filter((item) => item.judgment === "useful_hit").length,
        miss: dogfoodCases.filter((item) => item.judgment === "miss").length,
        noisy_hit: dogfoodCases.filter((item) => item.judgment === "noisy_hit").length,
        no_relevant_trap: dogfoodCases.filter((item) => item.judgment === "no_relevant_trap").length,
      },
    },
    failures,
    misses,
    noisy_hits: noisyHits,
  };
}

export function readEvalFixture(path: string): EvalFixture {
  if (!existsSync(path)) throw new Error(`Fixture not found: ${path}`);
  return parseEvalFixture(readFileSync(path, "utf-8"), path);
}

export function parseEvalFixture(text: string, path: string): EvalFixture {
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.traps) || !Array.isArray(parsed.queries)) {
    throw new Error(`Invalid eval fixture: ${path}`);
  }
  return parsed as EvalFixture;
}

export function writeEvalFixture(path: string, fixture: EvalFixture): void {
  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
}

export function formatSearchEvalReport(report: SearchEvalReport): string {
  const lines = [
    `Dogfood eval (${report.mode})`,
    `Fixture: ${report.fixture}`,
    `Provider: ${providerLabel(report.provider)}`,
    `Semantic available: ${String(report.semantic_available)}`,
  ];
  if (report.provider_error) lines.push(`Provider error: ${report.provider_error}`);
  lines.push(
    `Cases: ${report.total_cases}`,
    `Recall@3: ${report.metrics.recall_at_3}`,
    `Recall@5: ${report.metrics.recall_at_5}`,
    `MRR: ${report.metrics.mrr}`,
    `Hybrid fallback count: ${report.metrics.hybrid_fallback_count}`,
    `Semantic error count: ${report.metrics.semantic_error_count}`,
    `Dogfood cases: ${report.dogfood.total}`,
    `Judgments: ${formatJudgmentCounts(report.dogfood.judgment_counts)}`
  );
  appendCaseSection(lines, "Failures", report.failures);
  appendCaseSection(lines, "Misses to inspect", report.misses);
  appendCaseSection(lines, "Noisy hits to inspect", report.noisy_hits);
  lines.push("Next actions:", ...formatNextActions(report.next_actions));
  return lines.join("\n");
}

function buildSearchEvalNextActions(
  report: Omit<SearchEvalReport, "next_actions">
): SearchEvalNextAction[] {
  const actions: SearchEvalNextAction[] = [];
  if (report.mode === "live" && !report.semantic_available) {
    const action = defaultEmbeddingRuntime().setupAction();
    if (action) actions.push({
      command: action.command,
      reason: "Enable live semantic checks, then rerun bun run eval:dogfood -- report --live.",
    });
  }
  if (report.failures.length > 0) {
    actions.push({
      command: "bun run eval:dogfood -- report --json",
      reason: "Inspect expected ids, top results, and errors before changing search behavior or fixture expectations.",
    });
  }
  if (report.misses.length > 0) {
    actions.push({
      command: 'codetrap search "<miss query>" --mode hybrid --ranking-signals --json',
      reason: "Replay a miss with ranking signals before deciding whether to tune search or promote a fixture case.",
    });
  }
  if (report.noisy_hits.length > 0) {
    actions.push({
      command: 'codetrap search "<noisy query>" --mode hybrid --ranking-signals --json',
      reason: "Inspect why noisy results ranked before deciding whether the case belongs in dogfood eval.",
    });
  }
  if (actions.length === 0) {
    actions.push({
      command: 'codetrap search "<task keywords>" --mode hybrid --json',
      reason: "Keep logging real pre-edit searches in dogfood-log.md before automating promotion.",
    });
  }
  return actions;
}

function formatJudgmentCounts(counts: Record<DogfoodJudgment, number>): string {
  return DOGFOOD_JUDGMENTS.map((judgment) => `${judgment}=${counts[judgment]}`).join(", ");
}

function appendCaseSection(lines: string[], title: string, cases: EvalCaseReport[]): void {
  if (cases.length === 0) return;
  lines.push(`${title}:`);
  for (const item of cases.slice(0, 5)) {
    lines.push(`  - [${item.mode}] ${item.query}`);
    if (item.goldTrapIds.length > 0) {
      lines.push(`    expected: ${formatExpected(item)}`);
    }
    lines.push(`    top: ${formatTopResults(item)}`);
    if (item.error) lines.push(`    error: ${item.error}`);
  }
  if (cases.length > 5) lines.push(`  ... ${cases.length - 5} more`);
}

function formatExpected(item: EvalCaseReport): string {
  return item.goldTrapIds
    .map((id, index) => `#${id} ${item.expectedTitles[index] ?? ""}`.trim())
    .join(", ");
}

function formatTopResults(item: EvalCaseReport): string {
  if (item.topResults.length === 0) return "(none)";
  return item.topResults
    .slice(0, 3)
    .map((result) => `#${result.id} ${result.title}`)
    .join("; ");
}

function formatNextActions(actions: SearchEvalNextAction[]): string[] {
  if (actions.length === 0) return ["  (none)"];
  return actions.map((action) => `  - ${action.command} # ${action.reason}`);
}

function fixtureRepository(fixture: EvalFixture, embeddings: EmbeddingRuntimeInput): TrapRepository {
  const repo = new TrapRepository(openDatabase(":memory:"), embeddings);
  for (const trap of fixture.traps) repo.add(trap);
  return repo;
}

function caseReport(item: EvalQuery, fixture: EvalFixture, results: TrapSearchResult[], error?: string): EvalCaseReport {
  const caseError =
    error ??
    (item.goldTrapIds.length === 0 && item.judgment !== "no_relevant_trap"
      ? "goldTrapIds is required unless judgment is no_relevant_trap."
      : undefined);
  const resultIdsAt3 = new Set(results.slice(0, 3).map((result) => result.trap.id));
  const resultIdsAt5 = new Set(results.map((result) => result.trap.id));
  const hasGoldTraps = item.goldTrapIds.length > 0;
  const recallAt3 = hasGoldTraps
    ? item.goldTrapIds.filter((id) => resultIdsAt3.has(id)).length / item.goldTrapIds.length
    : 1;
  const recallAt5 = hasGoldTraps
    ? item.goldTrapIds.filter((id) => resultIdsAt5.has(id)).length / item.goldTrapIds.length
    : 1;
  const rank = hasGoldTraps ? results.findIndex((result) => item.goldTrapIds.includes(result.trap.id)) : -1;
  const reciprocalRank = rank >= 0 ? 1 / (rank + 1) : 0;
  const minRecallAt3 = item.minRecallAt3 ?? 0;
  const minRecallAt5 = item.minRecallAt5 ?? 0;
  const passed = !caseError && recallAt3 >= minRecallAt3 && recallAt5 >= minRecallAt5;

  return {
    query: item.query,
    mode: item.mode,
    phaseGate: item.phaseGate,
    judgment: item.judgment,
    goldTrapIds: item.goldTrapIds,
    expectedTitles: item.goldTrapIds.map((id) => fixture.traps[id - 1]?.title ?? `#${id}`),
    topResults: results.map((result) => ({
      id: result.trap.id,
      title: result.trap.title,
      sources: result.sources ?? [],
      diagnostics: (result.diagnostics ?? []).map((diagnostic) => diagnostic.code),
    })),
    recallAt3,
    recallAt5,
    reciprocalRank,
    passed,
    ...(caseError ? { error: caseError } : {}),
  };
}

function aggregateMetrics(cases: EvalCaseReport[]): Pick<SearchEvalMetrics, "recall_at_3" | "recall_at_5" | "mrr"> {
  const recallCases = cases.filter((item) => item.goldTrapIds.length > 0);
  const total = recallCases.length || 1;
  return {
    recall_at_3: round(recallCases.reduce((sum, item) => sum + item.recallAt3, 0) / total),
    recall_at_5: round(recallCases.reduce((sum, item) => sum + item.recallAt5, 0) / total),
    mrr: round(recallCases.reduce((sum, item) => sum + item.reciprocalRank, 0) / total),
  };
}

function normalizeRecord(value: unknown, fixture: EvalFixture): EvalQuery {
  if (!isRecord(value)) throw new Error("record JSON must be an object.");
  const query = stringField(value, "query");
  const mode = searchModeField(value, "mode");
  const judgment = judgmentField(value, "judgment");
  const goldTrapIds = goldTrapIdsField(value, "goldTrapIds", judgment);
  for (const id of goldTrapIds) {
    if (!fixture.traps[id - 1]) {
      throw new Error(
        `goldTrapIds contains unknown trap id: ${id}. Add a compact copy of the expected trap to fixture.traps before recording this dogfood case.`
      );
    }
  }

  return {
    query,
    mode,
    goldTrapIds,
    phaseGate: "dogfood",
    minRecallAt3: numberField(value, "minRecallAt3") ?? (judgment === "no_relevant_trap" ? 0 : 1),
    minRecallAt5: numberField(value, "minRecallAt5") ?? (judgment === "no_relevant_trap" ? 0 : 1),
    source: typeof value.source === "string" && value.source.trim() ? value.source.trim() : "dogfood",
    judgment,
    observedTopTitles: optionalStringArray(value, "observedTopTitles"),
    note: typeof value.note === "string" && value.note.trim() ? value.note.trim() : undefined,
  };
}

function fixtureQuery(report: EvalCaseReport, fixture: EvalFixture): EvalQuery | undefined {
  return fixture.queries.find((item) => item.query === report.query && item.mode === report.mode);
}

function hasSemanticFallback(results: TrapSearchResult[]): boolean {
  return results.some((result) =>
    (result.diagnostics ?? []).some((diagnostic) =>
      ["semantic_unavailable", "semantic_no_candidates", "semantic_failed"].includes(diagnostic.code)
    )
  );
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.trim() === "") throw new Error(`${key} is required.`);
  return field.trim();
}

function searchModeField(value: Record<string, unknown>, key: string): SearchMode {
  const mode = stringField(value, key);
  if (!(SEARCH_MODES as readonly string[]).includes(mode)) {
    throw new Error(`${key} must be one of: ${SEARCH_MODES.join(", ")}`);
  }
  return mode as SearchMode;
}

function judgmentField(value: Record<string, unknown>, key: string): DogfoodJudgment {
  const judgment = stringField(value, key);
  if (!(DOGFOOD_JUDGMENTS as readonly string[]).includes(judgment)) {
    throw new Error(`${key} must be one of: ${DOGFOOD_JUDGMENTS.join(", ")}`);
  }
  return judgment as DogfoodJudgment;
}

function goldTrapIdsField(value: Record<string, unknown>, key: string, judgment: DogfoodJudgment): number[] {
  const field = value[key];
  if (judgment === "no_relevant_trap") {
    if (field === undefined) return [];
    if (!Array.isArray(field)) throw new Error(`${key} must be an array of positive integer trap ids.`);
    if (field.length > 0) throw new Error(`${key} must be empty when judgment is no_relevant_trap.`);
    return [];
  }
  return intArrayField(value, key);
}

function intArrayField(value: Record<string, unknown>, key: string): number[] {
  const field = value[key];
  if (!Array.isArray(field) || field.length === 0) throw new Error(`${key} must be a non-empty array.`);
  const ids = field.map((item) => Number(item));
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
    throw new Error(`${key} must contain positive integer trap ids.`);
  }
  return ids;
}

function optionalStringArray(value: Record<string, unknown>, key: string): string[] | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (!Array.isArray(field)) throw new Error(`${key} must be an array of strings.`);
  const values = field.map(String).map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function numberField(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  const number = Number(field);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error(`${key} must be a number between 0 and 1.`);
  return number;
}

function providerLabel(provider: EmbeddingConfig | null): string {
  if (!provider) return "(none)";
  return `${provider.provider}/${provider.model}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function vectorFor(text: string): Float32Array {
  const lower = text.toLowerCase();
  const vector = new Float32Array(14);
  if (/(http|https|fetch|axios|request|api|remote|network|网络|请求)/.test(lower)) vector[0] = 1;
  if (/(auth|authentication|login|session|认证)/.test(lower)) vector[1] = 1;
  if (/(db|database|sqlite|sql|migration|schema|table|数据库)/.test(lower)) vector[2] = 1;
  if (/(config|env|environment|process\.env|配置)/.test(lower)) vector[3] = 1;
  if (/(cache|redis|stale|缓存)/.test(lower)) vector[4] = 1;
  if (/(cli|flag|parseargs|query text|positionals)/.test(lower)) vector[5] = 1;
  if (/(sticks3|esp-idf|esp32p4|hello_world|flash|target|8mb|idf)/.test(lower)) vector[6] = 1;
  if (/(m5unified|button|buttons|按键|按钮|screen|display|lcd|屏幕|兼容)/.test(lower)) vector[7] = 1;
  if (/(pmic|i2c|st7789|power|电源|屏幕不亮|backlight)/.test(lower)) vector[8] = 1;
  if (/(asr|豆包|voice|语音|firmware|固件|mac代理|agent-side)/.test(lower)) vector[9] = 1;
  if (/(voice_server_uri|localhost|127\.0\.0\.1|websocket|局域网|lan)/.test(lower)) vector[10] = 1;
  if (/(es8311|0x18|7-bit|8-bit|codec|probe|地址)/.test(lower)) vector[11] = 1;
  if (/(gpio14|gpio16|i2s|din|wav|全 0|zeros|speaker dout)/.test(lower)) vector[12] = 1;
  if (/(peak|32768|gain|quality|asr_timing|增益|重刷)/.test(lower)) vector[13] = 1;
  if (vector.every((value) => value === 0)) vector[5] = 1;
  return vector;
}
