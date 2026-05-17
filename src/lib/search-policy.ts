import type { RankingSignal, Trap, TrapSearchResult } from "../domain/trap";
import { EmbeddingProviderUnavailableError } from "./embedder";
import { parseTrapPathGlobs, parseTrapTags } from "./trap-json-fields";
import {
  hasSpecificPathMatch,
  trapMatchesApplicability,
  type ApplicabilityFilter,
} from "./trap-scope-match";

export interface SearchPolicyOptions extends ApplicabilityFilter {
  limit?: number;
  rerank?: boolean;
  includeRankingSignals?: boolean;
}

export interface RankingConfig {
  rrfK: number;
  semanticMinScore: number;
  lengthNormAnchor: number;
  maxBoost: number;
  titleTokenBoost: number;
  tagTokenBoost: number;
  identifierBoost: number;
  severityBoost: Record<string, number>;
  pathMatchBoost: number;
  moduleMatchBoost: number;
  ownerMatchBoost: number;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  rrfK: 60,
  semanticMinScore: 0.3,
  lengthNormAnchor: 500,
  maxBoost: 0.45,
  titleTokenBoost: 0.16,
  tagTokenBoost: 0.2,
  identifierBoost: 0.18,
  severityBoost: {
    warning: 0,
    error: 0.04,
    critical: 0.07,
  },
  pathMatchBoost: 0.12,
  moduleMatchBoost: 0.08,
  ownerMatchBoost: 0.04,
};

export class TrapSearchPolicy {
  constructor(private readonly ranking: RankingConfig = DEFAULT_RANKING_CONFIG) {}

  candidateLimit(opts: SearchPolicyOptions, resultLimit: number): number {
    return shouldOverfetch(opts) ? Math.max(resultLimit * 5, 50) : resultLimit;
  }

  semanticMinScore(): number {
    return this.ranking.semanticMinScore;
  }

  filterResults(results: TrapSearchResult[], filter: ApplicabilityFilter): TrapSearchResult[] {
    return results.filter((result) => trapMatchesApplicability(result.trap, filter));
  }

  matchesTrap(trap: Trap, filter: ApplicabilityFilter): boolean {
    return trapMatchesApplicability(trap, filter);
  }

  filterTraps(traps: Trap[], filter: ApplicabilityFilter): Trap[] {
    return traps.filter((trap) => this.matchesTrap(trap, filter));
  }

  rankResults(
    results: TrapSearchResult[],
    query: string,
    opts: SearchPolicyOptions,
    limit: number
  ): TrapSearchResult[] {
    return applyReranking(results, query, opts, this.ranking).slice(0, limit);
  }

  fuse(
    ftsResults: TrapSearchResult[],
    semanticResults: TrapSearchResult[],
    query: string,
    opts: SearchPolicyOptions,
    limit: number
  ): TrapSearchResult[] {
    const byId = new Map<number, TrapSearchResult & { score: number; sources: ("fts" | "semantic")[] }>();

    addRankedResults(byId, ftsResults, "fts", this.ranking);
    addRankedResults(byId, semanticResults, "semantic", this.ranking);

    const fused = [...byId.values()]
      .map((result) => ({
        ...result,
        score: applyLengthNormalization(result.score, result.trap, this.ranking),
        rank: applyLengthNormalization(result.score, result.trap, this.ranking),
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);

    return this.rankResults(fused, query, opts, limit);
  }

  withDiagnostics(
    results: TrapSearchResult[],
    diagnostic: { code: string; message: string }
  ): TrapSearchResult[] {
    return results.map((result) => ({
      ...result,
      diagnostics: [...(result.diagnostics ?? []), diagnostic],
    }));
  }

  semanticDiagnostic(error: unknown): { code: string; message: string } {
    if (error instanceof EmbeddingProviderUnavailableError) {
      return {
        code: "semantic_unavailable",
        message: error.message,
      };
    }
    return {
      code: "semantic_failed",
      message: error instanceof Error ? error.message : "Semantic search failed; hybrid search returned FTS results.",
    };
  }
}

function addRankedResults(
  byId: Map<number, TrapSearchResult & { score: number; sources: ("fts" | "semantic")[] }>,
  results: TrapSearchResult[],
  source: "fts" | "semantic",
  ranking: RankingConfig
): void {
  results.forEach((result, index) => {
    const score = 1 / (ranking.rrfK + index + 1);
    const existing = byId.get(result.trap.id);
    if (existing) {
      existing.score += score;
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }
    byId.set(result.trap.id, {
      ...result,
      score,
      sources: [source],
    });
  });
}

function applyLengthNormalization(score: number, trap: Trap, ranking: RankingConfig): number {
  const length = `${trap.context}\n${trap.mistake}\n${trap.fix}`.length;
  if (length <= ranking.lengthNormAnchor) return score;
  return score * Math.sqrt(ranking.lengthNormAnchor / length);
}

function applyReranking(
  results: TrapSearchResult[],
  query: string,
  opts: SearchPolicyOptions,
  ranking: RankingConfig
): TrapSearchResult[] {
  if (opts.rerank === false) return stripRankingSignals(results, opts);

  const queryInfo = analyzeQuery(query);
  return results
    .map((result) => {
      const signals = rankingSignals(result.trap, queryInfo, opts, ranking);
      const boost = Math.min(
        ranking.maxBoost,
        signals.reduce((sum, signal) => sum + signal.weight, 0)
      );
      const score = (result.score ?? result.rank ?? 0) * (1 + boost);
      return {
        ...result,
        score,
        rank: score,
        ...(opts.includeRankingSignals && signals.length > 0 ? { ranking_signals: signals } : {}),
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function stripRankingSignals(results: TrapSearchResult[], opts: SearchPolicyOptions): TrapSearchResult[] {
  if (opts.includeRankingSignals) return results.map((result) => ({ ...result, ranking_signals: [] }));
  return results.map(({ ranking_signals: _rankingSignals, ...result }) => result);
}

function rankingSignals(
  trap: Trap,
  query: QueryInfo,
  filter: ApplicabilityFilter,
  ranking: RankingConfig
): RankingSignal[] {
  const signals: RankingSignal[] = [];
  const titleTokens = tokenize(trap.title);
  const tags = parseTrapTags(trap.tags).map((tag) => tag.toLowerCase());
  const allFieldTokens = tokenize([
    trap.title,
    trap.context,
    trap.mistake,
    trap.fix,
    trap.before_code ?? "",
    trap.after_code ?? "",
    parseTrapPathGlobs(trap.path_globs).join(" "),
    trap.module ?? "",
    trap.owner ?? "",
  ].join(" "));

  for (const token of query.tokens) {
    if (titleTokens.has(token)) {
      signals.push({ code: "title_token_exact", weight: ranking.titleTokenBoost, detail: token });
      break;
    }
  }

  for (const token of query.tokens) {
    if (tags.includes(token)) {
      signals.push({ code: "tag_exact", weight: ranking.tagTokenBoost, detail: token });
      break;
    }
  }

  for (const token of query.identifierTokens) {
    if (allFieldTokens.has(token)) {
      signals.push({ code: "code_identifier_exact", weight: ranking.identifierBoost, detail: token });
      break;
    }
  }

  const severityBoost = ranking.severityBoost[trap.severity] ?? 0;
  if (severityBoost > 0) {
    signals.push({ code: "severity", weight: severityBoost, detail: trap.severity });
  }

  if (hasSpecificPathMatch(trap, filter.path)) {
    signals.push({ code: "path_scope_match", weight: ranking.pathMatchBoost, detail: filter.path });
  }
  if (filter.module && trap.module === filter.module) {
    signals.push({ code: "module_scope_match", weight: ranking.moduleMatchBoost, detail: filter.module });
  }
  if (filter.owner && trap.owner === filter.owner) {
    signals.push({ code: "owner_scope_match", weight: ranking.ownerMatchBoost, detail: filter.owner });
  }

  return signals;
}

type QueryInfo = {
  tokens: Set<string>;
  identifierTokens: Set<string>;
};

function analyzeQuery(query: string): QueryInfo {
  const tokens = tokenize(query);
  return {
    tokens,
    identifierTokens: new Set([...tokens].filter(isIdentifierLike)),
  };
}

function tokenize(value: string): Set<string> {
  return new Set((value.match(/[A-Za-z0-9_.$/@:-]+/g) ?? []).map((token) => token.toLowerCase()));
}

function isIdentifierLike(token: string): boolean {
  return (
    /[_.$/@:-]/.test(token) ||
    /\d/.test(token) ||
    /[a-z][A-Z]/.test(token) ||
    token.length >= 8
  );
}

function shouldOverfetch(opts: SearchPolicyOptions): boolean {
  return Boolean(opts.path || opts.module || opts.owner || opts.rerank !== false);
}
