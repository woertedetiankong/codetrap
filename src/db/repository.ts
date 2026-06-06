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
import { SearchService, type SearchOptions } from "../lib/search-service";
import {
  type EmbeddingConfig,
  type StoredEmbedding,
} from "../lib/embedder";
import {
  embeddingRuntimeFrom,
  type EmbeddingRuntime,
  type EmbeddingRuntimeInput,
} from "../lib/embedding-runtime";
import { runEmbeddingJob } from "../lib/embedding-job";
import { passageFieldsChanged } from "../lib/trap-search-document";
import * as embeddingQueries from "./embedding-queries";
import * as queries from "./queries";
import type { TrapStatus } from "../lib/constants";
import { TrapSearchPolicy } from "../lib/search-policy";
import type { RankingConfig } from "../lib/search-policy";
import { archiveTrapLifecycle, supersedeTrapLifecycle } from "../lib/trap-lifecycle";
import type { EmbeddingProfileSummary } from "./embedding-queries";

export type TrapStats = ReturnType<typeof queries.getStats>;
export type EmbeddingStateCounts = ReturnType<typeof embeddingQueries.getEmbeddingStateCounts>;
export type TrapRecordInsert = queries.TrapRecordInsert;

export class TrapRepository {
  private readonly searchService: SearchService;
  private readonly searchPolicy = new TrapSearchPolicy();
  private readonly embeddings: EmbeddingRuntime;

  constructor(
    private readonly db: Database,
    embeddings?: EmbeddingRuntimeInput,
    ranking?: RankingConfig
  ) {
    this.embeddings = embeddingRuntimeFrom(embeddings);
    this.searchService = new SearchService(db, this.embeddings, ranking);
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

  listMisScoped(expectedScope: string): Trap[] {
    return queries
      .listTraps(this.db, { status: "all", limit: 100000 })
      .filter((trap) => trap.scope !== expectedScope);
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
    return archiveTrapLifecycle(this.lifecycleAdapter(), id);
  }

  supersede(id: number, supersededById: number, stateKey?: string): boolean {
    return supersedeTrapLifecycle(this.lifecycleAdapter(), id, supersededById, stateKey);
  }

  hit(id: number): void {
    queries.incrementHitCount(this.db, id);
  }

  top(scope: string, limit = 20): Trap[] {
    return queries.getTopTraps(this.db, scope, limit);
  }

  stats(opts: { scope?: string; status?: TrapStatus | "all" } = {}): TrapStats {
    return queries.getStats(this.db, opts);
  }

  embeddingStats(config: EmbeddingConfig | null, opts: { scope?: string; status?: TrapStatus | "all" } = {}): EmbeddingStateCounts {
    return embeddingQueries.getEmbeddingStateCounts(this.db, config, opts);
  }

  embeddingProfiles(opts: { scope?: string; status?: TrapStatus | "all" } = {}): EmbeddingProfileSummary[] {
    return embeddingQueries.listEmbeddingProfiles(this.db, opts);
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

  getEmbedding(trapId: number, config?: EmbeddingConfig): StoredEmbedding | null {
    return embeddingQueries.getEmbedding(this.db, trapId, config);
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
    const provider = this.embeddings.requireProvider(
      "Embedding provider is unavailable. Configure an embedding provider to generate embeddings."
    );

    return runEmbeddingJob(
      {
        countEmbeddable: (countOpts) => embeddingQueries.countEmbeddableTraps(this.db, countOpts),
        trapsNeedingEmbeddings: (config, jobOpts) =>
          embeddingQueries.getTrapsNeedingEmbeddings(this.db, config, jobOpts),
        saveEmbedding: (record) => embeddingQueries.upsertEmbedding(this.db, record),
      },
      provider,
      opts
    );
  }

  private lifecycleAdapter() {
    return {
      get: (id: number) => queries.getTrap(this.db, id),
      transaction: <T>(callback: () => T) => this.transaction(callback),
      markArchived: (id: number) => queries.markTrapArchived(this.db, id),
      markSuperseded: (id: number, stateKey: string) => queries.markTrapSuperseded(this.db, id, stateKey),
      markSuperseding: (id: number, supersedesId: number, stateKey: string) =>
        queries.markTrapSuperseding(this.db, id, supersedesId, stateKey),
    };
  }
}
