import type { Database } from "bun:sqlite";
import type {
  Trap,
  TrapDetails,
  TrapEvidenceInput,
  TrapExportRecord,
  TrapInput,
  TrapSearchResult,
  TrapUpdate,
} from "../domain/trap";
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
import type { TrapStatus } from "../lib/constants";
import { TrapSearchPolicy } from "../lib/search-policy";

export type TrapStats = ReturnType<typeof queries.getStats>;
export type EmbeddingStateCounts = ReturnType<typeof embeddingQueries.getEmbeddingStateCounts>;
export type TrapRecordInsert = queries.TrapRecordInsert;

export class TrapRepository {
  private readonly searchService: SearchService;
  private readonly searchPolicy = new TrapSearchPolicy();

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

  getDetails(id: number, scope: "project" | "global"): TrapDetails | null {
    const trap = queries.getTrap(this.db, id);
    if (!trap) return null;
    return {
      trap,
      evidence: queries.listTrapEvidence(this.db, id),
      scope,
    };
  }

  list(opts: { category?: string; scope?: string; limit?: number; offset?: number; status?: TrapStatus | "all"; path?: string; module?: string; owner?: string } = {}): Trap[] {
    const limit = opts.limit ?? 50;
    const queryLimit = opts.path ? Math.max(limit * 5, 250) : limit;
    return queries
      .listTraps(this.db, { ...opts, limit: queryLimit })
      .filter((trap) => this.searchPolicy.matchesTrap(trap, opts))
      .slice(0, limit);
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

  addEvidence(trapId: number, input: TrapEvidenceInput): number | null {
    if (!queries.getTrap(this.db, trapId)) return null;
    return queries.addTrapEvidence(this.db, trapId, input);
  }

  archive(id: number): boolean {
    return queries.archiveTrap(this.db, id);
  }

  supersede(id: number, supersededById: number, stateKey?: string): boolean {
    return queries.supersedeTrap(this.db, id, supersededById, stateKey);
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

  embeddingStats(config: EmbeddingConfig | null): EmbeddingStateCounts {
    return embeddingQueries.getEmbeddingStateCounts(this.db, config);
  }

  exportAll(): TrapExportRecord[] {
    return queries.exportTraps(this.db);
  }

  exportProjectTrapsByPath(projectPath: string): TrapExportRecord[] {
    return queries.exportProjectTrapsByPath(this.db, projectPath);
  }

  insertTrapRecord(record: TrapRecordInsert): number {
    return queries.insertTrapRecord(this.db, record);
  }

  updateTrapSupersedesId(id: number, supersedesId: number): boolean {
    return queries.updateTrapSupersedesId(this.db, id, supersedesId);
  }

  deleteTrapsByIds(ids: number[]): number {
    return queries.deleteTrapsByIds(this.db, ids);
  }

  countProjectTrapsByPath(projectPath: string): number {
    return queries.countProjectTrapsByPath(this.db, projectPath);
  }

  transaction<T>(callback: () => T): T {
    return this.db.transaction(callback)();
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
    opts: { scope?: string; category?: string; status?: TrapStatus | "all"; force?: boolean; limit?: number } = {}
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
