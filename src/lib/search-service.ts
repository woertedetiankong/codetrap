import type { Database } from "bun:sqlite";
import * as queries from "../db/queries";
import type { TrapSearchResult } from "../domain/trap";
import type { SearchMode, TrapStatus } from "./constants";
import {
  cosineSimilarity,
  EmbeddingProviderUnavailableError,
  embeddingConfig,
  type EmbeddingProvider,
} from "./embedder";
import {
  DEFAULT_RANKING_CONFIG,
  TrapSearchPolicy,
  type RankingConfig,
} from "./search-policy";
import { DatabaseEmbeddingIndex } from "./embedding-index";

export interface SearchOptions {
  category?: string;
  scope?: string;
  limit?: number;
  mode?: SearchMode;
  status?: TrapStatus | "all";
  path?: string;
  module?: string;
  owner?: string;
  rerank?: boolean;
  includeRankingSignals?: boolean;
}

const DEFAULT_LIMIT = 20;

export class SearchService {
  private readonly policy: TrapSearchPolicy;
  private readonly embeddingIndex: DatabaseEmbeddingIndex;

  constructor(
    private readonly db: Database,
    private readonly embedder?: EmbeddingProvider,
    ranking: RankingConfig = DEFAULT_RANKING_CONFIG
  ) {
    this.policy = new TrapSearchPolicy(ranking);
    this.embeddingIndex = new DatabaseEmbeddingIndex(db);
  }

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
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const searchLimit = this.policy.candidateLimit(opts, limit);
    const candidates = queries
      .searchTraps(this.db, query, { ...opts, limit: searchLimit })
      .filter((result) => this.policy.matchesTrap(result.trap, opts))
      .map((result) => ({
        ...result,
        sources: ["fts"] as ("fts")[],
        score: ftsScore(result.rank),
      }));
    return this.policy.rankResults(candidates, query, opts, limit);
  }

  async semanticSearch(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    if (!this.embedder) {
      throw new EmbeddingProviderUnavailableError();
    }

    const [queryEmbedding] = await this.embedder.embed([query], "retrieval.query");
    if (!queryEmbedding) return [];

    const config = embeddingConfig(this.embedder);
    const candidates = this.embeddingIndex.freshEmbeddings(config, {
      category: opts.category,
      scope: opts.scope,
      status: opts.status,
    });

    const results = candidates
      .map(({ trap, embedding }) => {
        const score = cosineSimilarity(queryEmbedding, embedding);
        return {
          trap,
          rank: score,
          sources: ["semantic"] as ("semantic")[],
          score,
        };
      })
      .filter((result) => this.policy.matchesTrap(result.trap, opts))
      .filter((result) => (result.score ?? 0) >= this.policy.semanticMinScore())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((result) => result as TrapSearchResult);
    return this.policy.rankResults(results, query, opts, opts.limit ?? DEFAULT_LIMIT);
  }

  async hybridSearch(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const ftsResults = this.ftsSearch(query, { ...opts, limit });

    try {
      const semanticResults = await this.semanticSearch(query, { ...opts, limit });
      if (semanticResults.length === 0) {
        return this.policy.withDiagnostics(ftsResults, {
          code: "semantic_no_candidates",
          message: "Hybrid search used FTS results because no fresh semantic candidates passed the score threshold.",
        });
      }
      return this.policy.fuse(ftsResults, semanticResults, query, opts, limit);
    } catch (error) {
      return this.policy.withDiagnostics(ftsResults, this.policy.semanticDiagnostic(error));
    }
  }
}

function ftsScore(rank: number): number {
  return Number.isFinite(rank) ? -rank : 0;
}
