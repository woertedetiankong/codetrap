import { readRevisionCommit, acceptRevision, rollbackRevision } from "./experience-revisions";
import type { RevisionDraft } from "../domain/experience-revision";
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
import { SearchService, type SearchOptions, type SearchOutcome } from "../lib/search-service";
import {
  embeddingConfig,
  embeddingProfileId,
  type EmbeddingConfig,
  type StoredEmbedding,
} from "../lib/embedder";
import {
  embeddingRuntimeFrom,
  type EmbeddingRuntime,
  type EmbeddingRuntimeInput,
} from "../lib/embedding-runtime";
import { runEmbeddingJob } from "../lib/embedding-job";
import { buildTrapPassage, embeddingIsFresh, hashTrapPassage, passageFieldsChanged } from "../lib/trap-search-document";
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

  async search(query: string, opts: SearchOptions = {}): Promise<TrapSearchResult[]> {
    return (await this.searchService.search(query, opts)).results;
  }

  searchWithDiagnostics(query: string, opts: SearchOptions = {}): Promise<SearchOutcome> {
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

  revisionCommit(id: string, owner: string) { return readRevisionCommit(this.db, id, owner); }
  acceptRevision(draft: RevisionDraft) { return acceptRevision(this.db, draft, (id, fields) => this.update(id, fields)); }
  rollbackRevision(id: string, owner: string) { return rollbackRevision(this.db, id, owner, (id, fields) => this.update(id, fields)); }

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

  markUseful(id: number, at: string): boolean {
    return queries.markTrapUseful(this.db, id, at);
  }

  validate(id: number, at: string): boolean {
    return queries.validateTrap(this.db, id, at);
  }

  graduate(id: number, target: string, at: string): boolean {
    return queries.graduateTrap(this.db, id, target, at);
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

  readProjectMeta(): queries.ProjectMetaRow | null {
    return queries.readProjectMeta(this.db);
  }

  upsertProjectMeta(projectId: string, projectPath: string | null): void {
    queries.upsertProjectMeta(this.db, projectId, projectPath);
  }

  transaction<T>(callback: () => T): T {
    return this.db.transaction(callback)();
  }

  getEmbedding(trapId: number, config?: EmbeddingConfig): StoredEmbedding | null {
    return embeddingQueries.getEmbedding(this.db, trapId, config);
  }

  // Embed one trap right after it is written, so new/edited traps do not
  // rank below older embedded ones until the next manual reindex.
  async ensureEmbeddingForTrap(id: number): Promise<boolean> {
    // A selected Hugging Face model is intentionally inert until an explicit
    // reindex downloads and validates it. Opportunistic writes must preserve
    // that boundary instead of making add/edit trigger a large download.
    const provider = this.embeddings.providerIfReady();
    if (!provider) return false;
    const trap = this.get(id);
    if (!trap) return false;

    const config = embeddingConfig(provider);
    const stored = embeddingQueries.getEmbedding(this.db, id, config);
    if (embeddingIsFresh(trap, stored, config)) return false;

    const passage = buildTrapPassage(trap);
    const [embedding] = await provider.embed([passage], "retrieval.passage");
    if (!embedding) return false;
    embeddingQueries.upsertEmbedding(this.db, {
      trap_id: id,
      profile_id: embeddingProfileId(config),
      provider: config.provider,
      model: config.model,
      dimensions: config.dimensions,
      passage_version: config.passageVersion,
      passage_hash: hashTrapPassage(passage),
      embedding,
    });
    return true;
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
