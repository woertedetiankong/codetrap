import type { Database } from "bun:sqlite";
import * as embeddingQueries from "../db/embedding-queries";
import * as queries from "../db/queries";
import type { Trap, TrapSearchResult } from "../domain/trap";
import type { SearchMode } from "./constants";
import {
  cosineSimilarity,
  EmbeddingProviderUnavailableError,
  embeddingConfig,
  type EmbeddingProvider,
} from "./embedder";

export interface SearchOptions {
  category?: string;
  scope?: string;
  limit?: number;
  mode?: SearchMode;
}

export interface RankingConfig {
  rrfK: number;
  semanticMinScore: number;
  lengthNormAnchor: number;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  rrfK: 60,
  semanticMinScore: 0.3,
  lengthNormAnchor: 500,
};

const DEFAULT_LIMIT = 20;

export class SearchService {
  constructor(
    private readonly db: Database,
    private readonly embedder?: EmbeddingProvider,
    private readonly ranking: RankingConfig = DEFAULT_RANKING_CONFIG
  ) {}

  async search(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    if (!query.trim()) return [];

    const mode = opts.mode ?? "fts";
    switch (mode) {
      case "fts":
        return this.ftsSearch(query, opts);
      case "semantic":
        return this.semanticSearch(query, opts);
      case "hybrid":
        return this.hybridSearch(query, opts);
      default:
        throw new Error(`Invalid search mode: ${mode satisfies never}`);
    }
  }

  ftsSearch(query: string, opts: SearchOptions = {}): TrapSearchResult[] {
    return queries.searchTraps(this.db, query, opts).map((result) => ({
      ...result,
      sources: ["fts"],
      score: ftsScore(result.rank),
    }));
  }

  async semanticSearch(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    if (!this.embedder) {
      throw new EmbeddingProviderUnavailableError();
    }

    const [queryEmbedding] = await this.embedder.embed([query], "retrieval.query");
    if (!queryEmbedding) return [];

    const config = embeddingConfig(this.embedder);
    const candidates = embeddingQueries.getAllFreshEmbeddings(this.db, config, {
      category: opts.category,
      scope: opts.scope,
    });

    return candidates
      .map(({ trap, embedding }) => {
        const score = cosineSimilarity(queryEmbedding, embedding);
        return {
          trap,
          rank: score,
          sources: ["semantic"] as ("semantic")[],
          score,
        };
      })
      .filter((result) => (result.score ?? 0) >= this.ranking.semanticMinScore)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, opts.limit ?? DEFAULT_LIMIT);
  }

  async hybridSearch(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const ftsResults = this.ftsSearch(query, { ...opts, limit });

    try {
      const semanticResults = await this.semanticSearch(query, { ...opts, limit });
      if (semanticResults.length === 0) {
        return withDiagnostics(ftsResults, {
          code: "semantic_no_candidates",
          message: "Hybrid search used FTS results because no fresh semantic candidates passed the score threshold.",
        });
      }
      return rrfFuse(ftsResults, semanticResults, limit, this.ranking);
    } catch (error) {
      return withDiagnostics(ftsResults, semanticDiagnostic(error));
    }
  }
}

export function rrfFuse(
  ftsResults: TrapSearchResult[],
  semanticResults: TrapSearchResult[],
  limit = DEFAULT_LIMIT,
  ranking: RankingConfig = DEFAULT_RANKING_CONFIG
): TrapSearchResult[] {
  const byId = new Map<number, TrapSearchResult & { score: number; sources: ("fts" | "semantic")[] }>();

  addRankedResults(byId, ftsResults, "fts", ranking);
  addRankedResults(byId, semanticResults, "semantic", ranking);

  return [...byId.values()]
    .map((result) => ({
      ...result,
      score: applyLengthNormalization(result.score, result.trap, ranking),
      rank: applyLengthNormalization(result.score, result.trap, ranking),
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
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

function ftsScore(rank: number): number {
  return Number.isFinite(rank) ? -rank : 0;
}

function withDiagnostics(
  results: TrapSearchResult[],
  diagnostic: { code: string; message: string }
): TrapSearchResult[] {
  return results.map((result) => ({
    ...result,
    diagnostics: [...(result.diagnostics ?? []), diagnostic],
  }));
}

function semanticDiagnostic(error: unknown): { code: string; message: string } {
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
