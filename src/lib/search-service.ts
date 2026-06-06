import type { Database } from "bun:sqlite";
import * as queries from "../db/queries";
import type { TrapSearchResult } from "../domain/trap";
import type { SearchMode, TrapStatus } from "./constants";
import { cosineSimilarity } from "./embedder";
import {
  embeddingRuntimeFrom,
  type EmbeddingRuntime,
  type EmbeddingRuntimeInput,
} from "./embedding-runtime";
import {
  DEFAULT_RANKING_CONFIG,
  TrapSearchPolicy,
  type RankingConfig,
  type SearchRetrievalPlan,
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
  private readonly embeddings: EmbeddingRuntime;

  constructor(
    private readonly db: Database,
    embeddings?: EmbeddingRuntimeInput,
    ranking: RankingConfig = DEFAULT_RANKING_CONFIG
  ) {
    this.embeddings = embeddingRuntimeFrom(embeddings);
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
    const plan = this.policy.plan(opts, DEFAULT_LIMIT);
    return this.policy.finalizeResults(this.retrieveFtsCandidates(query, plan), query, opts, plan);
  }

  async semanticSearch(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    const plan = this.policy.plan(opts, DEFAULT_LIMIT);
    return this.policy.finalizeResults(await this.retrieveSemanticCandidates(query, plan), query, opts, plan);
  }

  async hybridSearch(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    const plan = this.policy.plan(opts, DEFAULT_LIMIT);
    const ftsCandidates = this.retrieveFtsCandidates(query, plan);

    try {
      const semanticCandidates = await this.retrieveSemanticCandidates(query, plan);
      if (semanticCandidates.length === 0) {
        return this.policy.withDiagnostics(this.policy.finalizeResults(ftsCandidates, query, opts, plan), {
          code: "semantic_no_candidates",
          message: "Hybrid search used FTS results because no fresh semantic candidates passed the score threshold.",
        });
      }
      return this.policy.fuseAndFinalize(ftsCandidates, semanticCandidates, query, opts, plan);
    } catch (error) {
      return this.policy.withDiagnostics(
        this.policy.finalizeResults(ftsCandidates, query, opts, plan),
        this.policy.semanticDiagnostic(error)
      );
    }
  }

  private retrieveFtsCandidates(query: string, plan: SearchRetrievalPlan): TrapSearchResult[] {
    const candidates = queries
      .searchTraps(this.db, query, plan.ftsStorageFilter)
      .map((result) => ({
        ...result,
        sources: ["fts"] as ("fts")[],
        score: ftsScore(result.rank),
      }));
    return this.policy.prepareRetrievedResults(candidates, "fts", plan);
  }

  private async retrieveSemanticCandidates(
    query: string,
    plan: SearchRetrievalPlan
  ): Promise<TrapSearchResult[]> {
    const provider = this.embeddings.requireProvider();

    const [queryEmbedding] = await provider.embed([query], "retrieval.query");
    if (!queryEmbedding) return [];

    const config = this.embeddings.config();
    if (!config) throw this.embeddings.unavailableError();
    const candidates = this.embeddingIndex.freshEmbeddings(config, plan.semanticStorageFilter);

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
      .map((result) => result as TrapSearchResult);
    return this.policy.prepareRetrievedResults(results, "semantic", plan);
  }
}

function ftsScore(rank: number): number {
  return Number.isFinite(rank) ? -rank : 0;
}
