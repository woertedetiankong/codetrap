import type { Database } from "bun:sqlite";
import type { Trap, TrapInput, TrapSearchResult, TrapUpdate } from "../domain/trap";
import * as embeddingQueries from "./embedding-queries";
import { SearchService, type SearchOptions } from "../lib/search-service";
import {
  type EmbeddingConfig,
  type EmbeddingProvider,
  type StoredEmbedding,
} from "../lib/embedder";
import { runEmbeddingJob } from "../lib/embedding-job";
import { passageFieldsChanged } from "../lib/trap-search-document";
import * as queries from "./queries";

export type TrapStats = ReturnType<typeof queries.getStats>;

export class TrapRepository {
  private readonly searchService: SearchService;

  constructor(
    private readonly db: Database,
    private readonly embedder?: EmbeddingProvider
  ) {
    this.searchService = new SearchService(db, embedder);
  }

  add(input: TrapInput): number {
    return queries.insertTrap(this.db, input);
  }

  search(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    return this.searchService.search(query, opts);
  }

  get(id: number): Trap | null {
    return queries.getTrap(this.db, id);
  }

  list(opts: { category?: string; scope?: string; limit?: number; offset?: number } = {}): Trap[] {
    return queries.listTraps(this.db, opts);
  }

  update(id: number, input: TrapUpdate): boolean {
    const success = queries.updateTrap(this.db, id, input);
    if (success && passageFieldsChanged(input)) {
      embeddingQueries.deleteEmbedding(this.db, id);
    }
    return success;
  }

  delete(id: number): boolean {
    return queries.deleteTrap(this.db, id);
  }

  hit(id: number): void {
    queries.incrementHitCount(this.db, id);
  }

  top(scope: string, limit = 20): Trap[] {
    return queries.getTopTraps(this.db, scope, limit);
  }

  stats(): TrapStats {
    return queries.getStats(this.db);
  }

  exportAll(): Trap[] {
    return queries.exportTraps(this.db);
  }

  getEmbedding(trapId: number): StoredEmbedding | null {
    return embeddingQueries.getEmbedding(this.db, trapId);
  }

  upsertEmbedding(record: StoredEmbedding): void {
    embeddingQueries.upsertEmbedding(this.db, record);
  }

  deleteEmbedding(trapId: number): void {
    embeddingQueries.deleteEmbedding(this.db, trapId);
  }

  getTrapsNeedingEmbeddings(
    config: EmbeddingConfig,
    opts: { scope?: string; category?: string; force?: boolean; limit?: number } = {}
  ): Trap[] {
    return embeddingQueries.getTrapsNeedingEmbeddings(this.db, config, opts);
  }

  async ensureEmbeddings(opts: { scope?: string; category?: string; limit?: number; force?: boolean; batchSize?: number } = {}): Promise<{
    generated: number;
    skipped: number;
    batches: number;
  }> {
    if (!this.embedder) {
      throw new Error("Embedding provider is unavailable. Set JINA_API_KEY to generate embeddings.");
    }

    return runEmbeddingJob(
      {
        countEmbeddable: (countOpts) => embeddingQueries.countEmbeddableTraps(this.db, countOpts),
        trapsNeedingEmbeddings: (config, jobOpts) =>
          embeddingQueries.getTrapsNeedingEmbeddings(this.db, config, jobOpts),
        saveEmbedding: (record) => embeddingQueries.upsertEmbedding(this.db, record),
      },
      this.embedder,
      opts
    );
  }
}
