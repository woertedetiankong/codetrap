import type { Database } from "bun:sqlite";
import * as embeddingQueries from "../db/embedding-queries";
import * as queries from "../db/queries";
import type { TrapSearchDiagnostic, TrapSearchResult } from "../domain/trap";
import type { SearchMode, TrapStatus } from "./constants";
import { cosineSimilarity, EmbeddingDimensionMismatchError } from "./embedder";
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

// Diagnostics ride out-of-band next to the results: stapling them onto
// result rows loses the signal exactly when it matters most — when the
// result list is empty.
export type SearchOutcome = {
  results: TrapSearchResult[];
  diagnostics: TrapSearchDiagnostic[];
};

export class SearchService {
  private readonly policy: TrapSearchPolicy;
  private readonly embeddings: EmbeddingRuntime;

  constructor(
    private readonly db: Database,
    embeddings?: EmbeddingRuntimeInput,
    ranking: RankingConfig = DEFAULT_RANKING_CONFIG
  ) {
    this.embeddings = embeddingRuntimeFrom(embeddings);
    this.policy = new TrapSearchPolicy(ranking);
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchOutcome> {
    if (!query.trim()) return { results: [], diagnostics: [] };

    const mode = opts.mode ?? "fts";
    switch (mode) {
      case "fts":
        return { results: this.ftsSearch(query, opts), diagnostics: [] };
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

  async semanticSearch(query: string, opts: SearchOptions = {}): Promise<SearchOutcome> {
    const plan = this.policy.plan(opts, DEFAULT_LIMIT);
    const results = this.policy.finalizeResults(await this.retrieveSemanticCandidates(query, plan), query, opts, plan);
    return { results, diagnostics: this.partialIndexDiagnostics(opts) };
  }

  async hybridSearch(query: string, opts: SearchOptions = {}): Promise<SearchOutcome> {
    const plan = this.policy.plan(opts, DEFAULT_LIMIT);
    const ftsCandidates = this.retrieveFtsCandidates(query, plan);

    try {
      const semanticCandidates = await this.retrieveSemanticCandidates(query, plan);
      if (semanticCandidates.length === 0) {
        const fallback = {
          code: "semantic_no_candidates",
          message: "Hybrid search used FTS results because no fresh semantic candidates passed the score threshold.",
        };
        return {
          results: this.policy.withDiagnostics(this.policy.finalizeResults(ftsCandidates, query, opts, plan), fallback),
          diagnostics: [fallback, ...this.partialIndexDiagnostics(opts)],
        };
      }
      return {
        results: this.policy.fuseAndFinalize(ftsCandidates, semanticCandidates, query, opts, plan),
        diagnostics: this.partialIndexDiagnostics(opts),
      };
    } catch (error) {
      const diagnostic = this.policy.semanticDiagnostic(error);
      return {
        results: this.policy.withDiagnostics(
          this.policy.finalizeResults(ftsCandidates, query, opts, plan),
          diagnostic
        ),
        diagnostics: [diagnostic],
      };
    }
  }

  // Traps without a fresh embedding get only one RRF contribution in hybrid
  // fusion (and none in semantic mode), so a partially built index quietly
  // biases ranking against the newest traps. Say so.
  private partialIndexDiagnostics(opts: SearchOptions): TrapSearchDiagnostic[] {
    const config = this.embeddings.config();
    if (!config) return [];
    const counts = embeddingQueries.getEmbeddingStateCounts(this.db, config, {
      scope: opts.scope,
      category: opts.category,
      status: opts.status,
    });
    const unindexed = counts.missing + counts.stale;
    if (unindexed === 0) return [];
    return [{
      code: "partial_index",
      message: `${unindexed} of ${counts.total} trap(s) lack fresh embeddings (${counts.missing} missing, ${counts.stale} stale) and rank keyword-only. Run \`codetrap embeddings reindex\`.`,
    }];
  }

  private retrieveFtsCandidates(query: string, plan: SearchRetrievalPlan): TrapSearchResult[] {
    // A3: `module`/`owner` are enforced in SQL, so the first `candidateLimit`
    // ranked rows are already a complete candidate set for them — but a `--path`
    // glob can only be evaluated in JS, *after* the SQL LIMIT. A selective path
    // can discard the whole first page while matching traps sit deeper in the
    // ranking, so without paging those traps are silently lost. Page through the
    // ranked matches until we have enough applicable candidates.
    if (!plan.applicabilityFilter.path) {
      const candidates = this.mapFtsRows(queries.searchTraps(this.db, query, plan.ftsStorageFilter));
      return this.policy.prepareRetrievedResults(candidates, "fts", plan);
    }
    return this.retrieveFtsCandidatesByPath(query, plan);
  }

  private retrieveFtsCandidatesByPath(query: string, plan: SearchRetrievalPlan): TrapSearchResult[] {
    const target = plan.candidateLimit;
    const pageSize = Math.max(target, 50);
    // Bound the scan so a broad query against a large index can't turn one
    // search into an unbounded table walk. FTS MATCH already restricts the pool
    // to query-matching rows, so this ceiling is only a pathological-case backstop.
    const scanLimit = Math.max(target * 20, 1000);
    const applicable: TrapSearchResult[] = [];
    let offset = 0;
    while (applicable.length < target && offset < scanLimit) {
      const rows = queries.searchTraps(this.db, query, { ...plan.ftsStorageFilter, limit: pageSize, offset });
      if (rows.length === 0) break;
      applicable.push(...this.policy.filterResults(this.mapFtsRows(rows), plan.applicabilityFilter));
      offset += rows.length;
      if (rows.length < pageSize) break; // ranked matches exhausted
    }
    return applicable.slice(0, target);
  }

  private mapFtsRows(rows: TrapSearchResult[]): TrapSearchResult[] {
    return rows.map((result) => ({
      ...result,
      sources: ["fts"] as ("fts")[],
      score: ftsScore(result.rank),
    }));
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
    if (queryEmbedding.length !== config.dimensions) {
      // The provider returned a query vector of an unexpected size — comparing
      // it against the stored embeddings would be meaningless. Fail loudly so
      // hybrid falls back to FTS with a diagnostic instead of ranking on noise.
      throw new EmbeddingDimensionMismatchError(config.dimensions, queryEmbedding.length);
    }
    const candidates = embeddingQueries.getAllFreshEmbeddings(this.db, config, plan.semanticStorageFilter);

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
