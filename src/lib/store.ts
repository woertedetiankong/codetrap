import type { EmbeddingProfileSummary } from "../db/embedding-queries";
import type { TrapStats } from "../db/repository";
import {
  type Trap,
  type TrapDetails,
  type TrapEvidenceInput,
  type TrapExportRecord,
  type TrapImportRecord,
  type TrapInput,
  type TrapSearchDiagnostic,
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
import {
  type ConfigWriteResult,
  type EmbeddingSettings,
  loadCodetrapConfig,
  setCodetrapEmbeddingSettings,
} from "./config";
import { summarizeEmbeddingState, type EmbeddingStateSummary, type EmbeddingStatsResult } from "./embedding-health";
import { ensureProjectIdentity, type ProjectIdentity } from "./project-identity";
import { normalizeScope, ScopedRepositoryContext, type ScopedRepository } from "./scope-context";
import { importTrapArchive, type TrapArchiveImportResult } from "./trap-archive";
import { importRecordToTrapRecordInsert } from "./trap-codec";
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
export type ScopedSearchDiagnostic = TrapSearchDiagnostic & { scope: string };
export type TrapEmbeddingStats = EmbeddingStatsResult;
export type TrapEmbeddingProfiles = {
  project: EmbeddingProfileSummary[] | null;
  global: EmbeddingProfileSummary[] | null;
};
export type EmbeddingScopeStatus = EmbeddingStateSummary & {
  profiles: EmbeddingProfileSummary[];
};
export type TrapEmbeddingStatus = {
  runtime: EmbeddingRuntimeStatus;
  project: EmbeddingScopeStatus | null;
  global: EmbeddingScopeStatus | null;
};

export class TrapStore {
  private readonly scopes: ScopedRepositoryContext;
  private readonly embeddings: EmbeddingRuntime;
  private identitySynced = false;

  constructor(
    cwd: string,
    embeddings?: EmbeddingRuntimeInput,
    private readonly home?: string
  ) {
    this.embeddings = embeddings === undefined
      ? defaultEmbeddingRuntime(process.env, loadCodetrapConfig(home))
      : embeddingRuntimeFrom(embeddings);
    this.scopes = new ScopedRepositoryContext(cwd, this.embeddings, home);
  }

  add(input: TrapInput): { id: number; scope: string } {
    const scope = normalizeScope(input.scope);
    if (scope === "project" && !this.scopes.hasProject()) {
      throw new Error("Not in a project. Run 'codetrap init' first, or use --scope global.");
    }

    if (scope === "project") this.syncProjectIdentityBestEffort();
    const id = this.scopes.repositoryFor(scope).add({
      ...input,
      scope,
      project_path: scope === "project" ? this.scopes.projectRoot() : null,
    });
    return { id, scope };
  }

  // A1: the project's stable identity (id in .codetrap/project.json, mirrored
  // into the DB's project_meta row). Returns null outside a project. Ensures the
  // identity exists (lazy mint) so projects created before A1 gain an id on first
  // read. `doctor` uses this to show a path-independent id and detect a move.
  projectIdentity(): ProjectIdentity | null {
    const root = this.scopes.projectRoot();
    if (!root) return null;
    const identity = ensureProjectIdentity(root);
    const entry = this.scopes.repositoryEntry("project");
    if (entry) entry.repository.upsertProjectMeta(identity.id, root);
    this.identitySynced = true;
    return identity;
  }

  // Identity is display metadata; never let a corrupt or unwritable
  // project.json block a trap write. Memoized so it runs at most once per store.
  private syncProjectIdentityBestEffort(): void {
    if (this.identitySynced) return;
    try {
      this.projectIdentity();
    } catch {
      this.identitySynced = true;
    }
  }

  async search(
    query: string,
    opts: { category?: string; scope?: string; limit?: number; mode?: SearchMode; status?: TrapStatus | "all"; path?: string; module?: string; owner?: string; rerank?: boolean; includeRankingSignals?: boolean } = {}
  ): Promise<{ groups: { results: TrapSearchResult[]; scope: string }[]; diagnostics: ScopedSearchDiagnostic[] }> {
    const groups: { results: TrapSearchResult[]; scope: string }[] = [];
    const diagnostics: ScopedSearchDiagnostic[] = [];
    const limit = opts.limit ?? 20;

    for (const scoped of this.scopes.repositoriesForRead(opts.scope)) {
      const outcome = await scoped.repository.searchWithDiagnostics(query, {
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
      if (outcome.results.length > 0) groups.push({ results: outcome.results, scope: scoped.scope });
      diagnostics.push(...outcome.diagnostics.map((diagnostic) => ({ ...diagnostic, scope: scoped.scope })));
    }

    return { groups: limitAcrossScopes(groups, limit), diagnostics };
  }

  async embedTrapBestEffort(id: number, scope: string): Promise<boolean> {
    try {
      const entry = this.scopes.repositoryEntry(normalizeScope(scope));
      if (!entry) return false;
      return await entry.repository.ensureEmbeddingForTrap(id);
    } catch {
      // Embedding on write is opportunistic; the trap itself is already
      // saved and `codetrap embeddings reindex` can catch up later.
      return false;
    }
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
    return this.resolveMutation(id, scope, (scoped) => ({
      success: scoped.repository.update(id, input),
    }));
  }

  delete(id: number, scope?: string): TrapMutationResult {
    return this.resolveMutation(id, scope, (scoped) => ({
      success: scoped.repository.delete(id),
    }));
  }

  addEvidence(id: number, input: TrapEvidenceInput, scope?: string): AddTrapEvidenceResult {
    return this.resolveMutation(
      id,
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
    return this.resolveMutation(id, scope, (scoped) => ({
      success: scoped.repository.archive(id),
    }));
  }

  supersede(
    id: number,
    supersededById: number,
    scope?: string,
    stateKey?: string
  ): TrapMutationResult {
    return this.resolveMutation(id, scope, (scoped) => ({
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
    const providerAvailable = this.embeddings.available();
    const project = scope === "global"
      ? null
      : this.scopes.repositoryEntry("project")
      ? summarizeEmbeddingState(this.scopes.repositoryFor("project").embeddingStats(config, { scope: "project" }), config, providerAvailable)
      : null;
    const global = scope === "project"
      ? null
      : summarizeEmbeddingState(this.scopes.repositoryFor("global").embeddingStats(config, { scope: "global" }), config, providerAvailable);
    return {
      project,
      global,
    };
  }

  embeddingProfiles(opts: { scope?: string } = {}): TrapEmbeddingProfiles {
    const scope = opts.scope ? normalizeScope(opts.scope) : null;
    const project = scope === "global"
      ? null
      : this.scopes.repositoryEntry("project")
      ? this.scopes.repositoryFor("project").embeddingProfiles({ scope: "project" })
      : null;
    const global = scope === "project"
      ? null
      : this.scopes.repositoryFor("global").embeddingProfiles({ scope: "global" });
    return { project, global };
  }

  async embeddingStatus(opts: { scope?: string } = {}): Promise<TrapEmbeddingStatus> {
    const runtime = await this.embeddingRuntimeHealth();
    const stats = this.embeddingStats(opts);
    const profiles = this.embeddingProfiles(opts);
    return {
      runtime,
      project: stats.project
        ? { ...stats.project, profiles: profiles.project ?? [] }
        : null,
      global: stats.global
        ? { ...stats.global, profiles: profiles.global ?? [] }
        : null,
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

  transaction<T>(scope: string, callback: () => T): T {
    return this.scopes.repositoryFor(normalizeScope(scope)).transaction(callback);
  }

  importAll(traps: TrapImportRecord[]): TrapArchiveImportResult {
    return importTrapArchive(traps, {
      insertRecord: (record) => this.insertImportRecord(record),
      addEvidence: (id, input, scope) => this.addEvidence(id, input, scope),
      linkSupersedes: (id, supersedesId, scope) => {
        this.scopes.repositoryFor(normalizeScope(scope)).updateTrapSupersedesId(id, supersedesId);
      },
    });
  }

  private insertImportRecord(record: TrapImportRecord): { id: number; scope: string } {
    const scope = normalizeScope(record.scope);
    if (scope === "project" && !this.scopes.hasProject()) {
      throw new Error("Not in a project. Run 'codetrap init' first, or use --scope global.");
    }
    const id = this.scopes.repositoryFor(scope).insertTrapRecord(
      importRecordToTrapRecordInsert(record, scope === "project" ? this.scopes.projectRoot() : null)
    );
    return { id, scope };
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

  embeddingRuntimeHealth(): Promise<EmbeddingRuntimeStatus> {
    return this.embeddings.health();
  }

  configureEmbeddings(settings: EmbeddingSettings): ConfigWriteResult {
    return setCodetrapEmbeddingSettings(settings, this.home);
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
    id: number,
    scope: string | undefined,
    mutate: (scoped: ScopedRepository) => { success: boolean } & TExtra,
    fallback: () => { success: false } & TExtra = () => ({ success: false } as { success: false } & TExtra)
  ): { scope: "project" | "global"; success: boolean; error?: string } & TExtra {
    let targets = this.scopes.repositoriesForWrite(scope);

    // Trap ids are per-database, so an unqualified id is ambiguous whenever
    // more than one scope is reachable. Refuse instead of guessing: mutating
    // whichever scope happens to have the id silently hits the wrong trap.
    if (scope === undefined && targets.length > 1) {
      const matches = targets.filter((target) => target.repository.get(id) !== null);
      if (matches.length > 1) {
        return {
          scope: targets[0].scope,
          ...fallback(),
          error: `Trap #${id} exists in both project and global scope. Pass --scope to pick one.`,
        };
      }
      if (matches.length === 1 && matches[0].scope !== targets[0].scope) {
        return {
          scope: matches[0].scope,
          ...fallback(),
          error: `Trap #${id} not found in ${targets[0].scope} scope; a different trap #${id} exists in ${matches[0].scope} scope. Pass --scope ${matches[0].scope} to target it.`,
        };
      }
      targets = [targets[0]];
    }

    return resolveScopedMutation(
      targets,
      { explicitScope: scope !== undefined, fallbackScope: targets[0]?.scope },
      mutate,
      fallback
    );
  }
}

// L14: each scope is searched with the full `limit`, so an unconstrained merge
// returned up to 2×limit cards and always listed global behind project. Treat
// `limit` as a total budget and keep the globally top-scored results, then
// regroup preserving the per-scope display order.
function limitAcrossScopes(
  groups: { results: TrapSearchResult[]; scope: string }[],
  limit: number
): { results: TrapSearchResult[]; scope: string }[] {
  const total = groups.reduce((sum, group) => sum + group.results.length, 0);
  if (total <= limit) return groups;

  const flat = groups.flatMap((group) => group.results);
  const scoreOf = (result: TrapSearchResult): number => result.score ?? result.rank ?? 0;
  const keep = new Set(
    flat
      .map((_, index) => index)
      .sort((a, b) => scoreOf(flat[b]) - scoreOf(flat[a]) || a - b)
      .slice(0, limit)
  );

  let index = 0;
  const trimmed: { results: TrapSearchResult[]; scope: string }[] = [];
  for (const group of groups) {
    const results = group.results.filter(() => keep.has(index++));
    if (results.length > 0) trimmed.push({ results, scope: group.scope });
  }
  return trimmed;
}
