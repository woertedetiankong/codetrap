import type { TrapStats } from "../db/repository";
import {
  type Trap,
  type TrapDetails,
  type TrapEvidenceInput,
  type TrapExportRecord,
  type TrapImportRecord,
  type TrapInput,
  type TrapSearchResult,
  type TrapUpdate,
} from "../domain/trap";
import type { SearchMode, TrapStatus } from "./constants";
import type { EmbeddingConfig } from "./embedder";
import {
  defaultEmbeddingRuntime,
  embeddingRuntimeFrom,
  type EmbeddingRuntime,
  type EmbeddingRuntimeInput,
  type EmbeddingRuntimeStatus,
} from "./embedding-runtime";
import { summarizeEmbeddingState, type EmbeddingStateSummary, type EmbeddingStatsResult } from "./embedding-health";
import { normalizeScope, ScopedRepositoryContext, type ScopedRepository } from "./scope-context";
import { importTrapArchive } from "./trap-archive";
import {
  resolveScopedMutation,
  type AddTrapEvidenceResult,
  type TrapMutationResult,
} from "./trap-mutation-result";

export {
  type TrapInput,
  type TrapSearchResult,
  type Trap,
  type TrapDetails,
  type TrapExportRecord,
  type TrapImportRecord,
  type TrapUpdate,
  type TrapStats,
};

export type { EmbeddingStateSummary };
export type TrapEmbeddingStats = EmbeddingStatsResult;

export class TrapStore {
  private readonly scopes: ScopedRepositoryContext;
  private readonly embeddings: EmbeddingRuntime;

  constructor(
    cwd: string,
    embeddings: EmbeddingRuntimeInput = defaultEmbeddingRuntime(),
    private readonly home?: string
  ) {
    this.embeddings = embeddingRuntimeFrom(embeddings);
    this.scopes = new ScopedRepositoryContext(cwd, this.embeddings, home);
  }

  add(input: TrapInput): { id: number; scope: string } {
    const scope = normalizeScope(input.scope);
    if (scope === "project" && !this.scopes.hasProject()) {
      throw new Error("Not in a project. Run 'codetrap init' first, or use --scope global.");
    }

    const id = this.scopes.repositoryFor(scope).add({
      ...input,
      scope,
      project_path: scope === "project" ? this.scopes.projectRoot() : null,
    });
    return { id, scope };
  }

  async search(
    query: string,
    opts: { category?: string; scope?: string; limit?: number; mode?: SearchMode; status?: TrapStatus | "all"; path?: string; module?: string; owner?: string; rerank?: boolean; includeRankingSignals?: boolean } = {}
  ): Promise<{ results: TrapSearchResult[]; scope: string }[]> {
    const out: { results: TrapSearchResult[]; scope: string }[] = [];
    const limit = opts.limit ?? 20;

    for (const scoped of this.scopes.repositoriesForRead(opts.scope)) {
      const results = await scoped.repository.search(query, {
        category: opts.category,
        scope: scoped.scope,
        limit,
        mode: opts.mode ?? "hybrid",
        status: opts.status,
        path: opts.path,
        module: opts.module,
        owner: opts.owner,
        rerank: opts.rerank,
        includeRankingSignals: opts.includeRankingSignals,
      });
      if (results.length > 0) out.push({ results, scope: scoped.scope });
    }

    return out;
  }

  get(id: number, scope?: string): { trap: Trap; scope: string } | null {
    for (const scoped of this.scopes.repositoriesForRead(scope)) {
      const trap = scoped.repository.get(id);
      if (trap) return { trap, scope: scoped.scope };
    }
    return null;
  }

  getDetails(id: number, scope?: string): TrapDetails | null {
    for (const scoped of this.scopes.repositoriesForRead(scope)) {
      const details = scoped.repository.getDetails(id, scoped.scope);
      if (details) return details;
    }
    return null;
  }

  list(opts: { category?: string; scope?: string; limit?: number; offset?: number; status?: TrapStatus | "all"; path?: string; module?: string; owner?: string } = {}): { traps: Trap[]; scope: string }[] {
    const out: { traps: Trap[]; scope: string }[] = [];

    for (const scoped of this.scopes.repositoriesForRead(opts.scope)) {
      const traps = scoped.repository.list({ ...opts, scope: scoped.scope });
      if (traps.length > 0) out.push({ traps, scope: scoped.scope });
    }

    return out;
  }

  update(id: number, input: TrapUpdate, scope?: string): TrapMutationResult {
    return this.resolveMutation(scope, (scoped) => ({
      success: scoped.repository.update(id, input),
    }));
  }

  delete(id: number, scope?: string): TrapMutationResult {
    return this.resolveMutation(scope, (scoped) => ({
      success: scoped.repository.delete(id),
    }));
  }

  addEvidence(id: number, input: TrapEvidenceInput, scope?: string): AddTrapEvidenceResult {
    return this.resolveMutation(
      scope,
      (scoped) => {
      const evidenceId = scoped.repository.addEvidence(id, input);
        return {
          evidence_id: evidenceId,
          success: evidenceId !== null,
        };
      },
      () => ({ evidence_id: null, success: false })
    );
  }

  archive(id: number, scope?: string): TrapMutationResult {
    return this.resolveMutation(scope, (scoped) => ({
      success: scoped.repository.archive(id),
    }));
  }

  supersede(
    id: number,
    supersededById: number,
    scope?: string,
    stateKey?: string
  ): TrapMutationResult {
    return this.resolveMutation(scope, (scoped) => ({
      success: scoped.repository.supersede(id, supersededById, stateKey),
    }));
  }

  hit(id: number, scope?: string): void {
    for (const scoped of this.scopes.repositoriesForRead(scope)) {
      if (scope || scoped.repository.get(id)) {
        scoped.repository.hit(id);
        return;
      }
    }
  }

  topTraps(scope: string, limit = 20): Trap[] {
    const resolvedScope = normalizeScope(scope);
    return this.scopes.repositoryFor(resolvedScope).top(resolvedScope, limit);
  }

  stats(opts: { scope?: string } = {}): { project: TrapStats | null; global: TrapStats | null } {
    const scope = opts.scope ? normalizeScope(opts.scope) : null;
    const project = scope === "global"
      ? null
      : this.scopes.repositoryEntry("project")?.repository.stats({ scope: "project" }) ?? null;
    const global = scope === "project"
      ? null
      : this.scopes.repositoryFor("global").stats({ scope: "global" });
    return { project, global };
  }

  embeddingStats(opts: { scope?: string } = {}): TrapEmbeddingStats {
    const scope = opts.scope ? normalizeScope(opts.scope) : null;
    const config = this.embeddingConfig();
    const project = scope === "global"
      ? null
      : this.scopes.repositoryEntry("project")
      ? summarizeEmbeddingState(this.scopes.repositoryFor("project").embeddingStats(config, { scope: "project" }), config)
      : null;
    const global = scope === "project"
      ? null
      : summarizeEmbeddingState(this.scopes.repositoryFor("global").embeddingStats(config, { scope: "global" }), config);
    return {
      project,
      global,
    };
  }

  diagnostics(): {
    mis_scoped_traps: {
      global_db_project_traps: Pick<Trap, "id" | "title" | "scope" | "project_path" | "status">[];
    };
  } {
    return {
      mis_scoped_traps: {
        global_db_project_traps: this.scopes.repositoryFor("global")
          .listMisScoped("global")
          .map((trap) => ({
            id: trap.id,
            title: trap.title,
            scope: trap.scope,
            project_path: trap.project_path,
            status: trap.status,
          })),
      },
    };
  }

  exportAll(opts: { scope?: string } = {}): TrapExportRecord[] {
    const traps: TrapExportRecord[] = [];
    for (const scoped of this.scopes.repositoriesForRead(opts.scope)) {
      traps.push(...scoped.repository.exportAll());
    }
    return traps;
  }

  importAll(traps: TrapImportRecord[]): number {
    return importTrapArchive(traps, {
      add: (input) => this.add(input),
      addEvidence: (id, input, scope) => this.addEvidence(id, input, scope),
    });
  }

  hasProject(): boolean {
    return this.scopes.hasProject();
  }

  getProjectRoot(): string | null {
    return this.scopes.projectRoot();
  }

  embeddingConfig(): EmbeddingConfig | null {
    return this.embeddings.config();
  }

  embeddingRuntimeStatus(): EmbeddingRuntimeStatus {
    return this.embeddings.status();
  }

  forCwd(cwd: string): TrapStore {
    return new TrapStore(cwd, this.embeddings, this.home);
  }

  async ensureEmbeddings(opts: { scope?: string; category?: string; limit?: number; force?: boolean; batchSize?: number } = {}): Promise<{
    generated: number;
    skipped: number;
    batches: number;
    scopes: { scope: string; generated: number; skipped: number; batches: number }[];
  }> {
    const scopes: { scope: string; generated: number; skipped: number; batches: number }[] = [];
    let generated = 0;
    let skipped = 0;
    let batches = 0;

    for (const scoped of this.scopes.repositoriesForRead(opts.scope)) {
      const result = await scoped.repository.ensureEmbeddings({
        scope: scoped.scope,
        category: opts.category,
        limit: opts.limit,
        force: opts.force,
        batchSize: opts.batchSize,
      });
      scopes.push({ scope: scoped.scope, ...result });
      generated += result.generated;
      skipped += result.skipped;
      batches += result.batches;
    }

    return { generated, skipped, batches, scopes };
  }

  private resolveMutation<TExtra extends object = {}>(
    scope: string | undefined,
    mutate: (scoped: ScopedRepository) => { success: boolean } & TExtra,
    fallback: () => { success: false } & TExtra = () => ({ success: false } as { success: false } & TExtra)
  ): { scope: "project" | "global"; success: boolean } & TExtra {
    return resolveScopedMutation(
      this.scopes.repositoriesForWrite(scope),
      { explicitScope: scope !== undefined },
      mutate,
      fallback
    );
  }
}
