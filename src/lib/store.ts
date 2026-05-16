import { openGlobal, openProject } from "../db/connection";
import { TrapRepository, type TrapStats } from "../db/repository";
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
import { createDefaultEmbeddingProvider, type EmbeddingProvider } from "./embedder";
import { findProjectRoot } from "./scope";
import { importTrapArchive } from "./trap-archive";

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

type Scope = "project" | "global";

export class TrapStore {
  private projectRoot: string | null;
  private globalRepository?: TrapRepository;
  private projectRepository?: TrapRepository;
  private readonly embedder?: EmbeddingProvider;

  constructor(cwd: string, embedder: EmbeddingProvider | undefined = createDefaultEmbeddingProvider()) {
    this.projectRoot = findProjectRoot(cwd);
    this.embedder = embedder;
  }

  add(input: TrapInput): { id: number; scope: string } {
    const scope = normalizeScope(input.scope);
    if (scope === "project" && !this.projectRoot) {
      throw new Error("Not in a project. Run 'codetrap init' first, or use --scope global.");
    }

    const id = this.repositoryFor(scope).add({
      ...input,
      scope,
      project_path: scope === "project" ? this.projectRoot : null,
    });
    return { id, scope };
  }

  async search(
    query: string,
    opts: { category?: string; scope?: string; limit?: number; mode?: SearchMode; status?: TrapStatus | "all" } = {}
  ): Promise<{ results: TrapSearchResult[]; scope: string }[]> {
    const out: { results: TrapSearchResult[]; scope: string }[] = [];
    const limit = opts.limit ?? 20;

    for (const scoped of this.repositoriesForRead(opts.scope)) {
      const results = await scoped.repository.search(query, {
        category: opts.category,
        scope: scoped.scope,
        limit,
        mode: opts.mode ?? "hybrid",
        status: opts.status,
      });
      if (results.length > 0) out.push({ results, scope: scoped.scope });
    }

    return out;
  }

  get(id: number, scope?: string): { trap: Trap; scope: string } | null {
    for (const scoped of this.repositoriesForRead(scope)) {
      const trap = scoped.repository.get(id);
      if (trap) return { trap, scope: scoped.scope };
    }
    return null;
  }

  getDetails(id: number, scope?: string): TrapDetails | null {
    for (const scoped of this.repositoriesForRead(scope)) {
      const details = scoped.repository.getDetails(id, scoped.scope);
      if (details) return details;
    }
    return null;
  }

  list(opts: { category?: string; scope?: string; limit?: number; offset?: number; status?: TrapStatus | "all" } = {}): { traps: Trap[]; scope: string }[] {
    const out: { traps: Trap[]; scope: string }[] = [];

    for (const scoped of this.repositoriesForRead(opts.scope)) {
      const traps = scoped.repository.list({ ...opts, scope: scoped.scope });
      if (traps.length > 0) out.push({ traps, scope: scoped.scope });
    }

    return out;
  }

  update(id: number, input: TrapUpdate, scope?: string): { scope: string; success: boolean } {
    for (const scoped of this.repositoriesForWrite(scope)) {
      const success = scoped.repository.update(id, input);
      if (success || scope) return { scope: scoped.scope, success };
    }
    return { scope: "global", success: false };
  }

  delete(id: number, scope?: string): { scope: string; success: boolean } {
    for (const scoped of this.repositoriesForWrite(scope)) {
      const success = scoped.repository.delete(id);
      if (success || scope) return { scope: scoped.scope, success };
    }
    return { scope: "global", success: false };
  }

  addEvidence(id: number, input: TrapEvidenceInput, scope?: string): { scope: string; evidence_id: number | null; success: boolean } {
    for (const scoped of this.repositoriesForWrite(scope)) {
      const evidenceId = scoped.repository.addEvidence(id, input);
      if (evidenceId || scope) return { scope: scoped.scope, evidence_id: evidenceId, success: evidenceId !== null };
    }
    return { scope: "global", evidence_id: null, success: false };
  }

  archive(id: number, scope?: string): { scope: string; success: boolean } {
    for (const scoped of this.repositoriesForWrite(scope)) {
      const success = scoped.repository.archive(id);
      if (success || scope) return { scope: scoped.scope, success };
    }
    return { scope: "global", success: false };
  }

  supersede(
    id: number,
    supersededById: number,
    scope?: string,
    stateKey?: string
  ): { scope: string; success: boolean } {
    for (const scoped of this.repositoriesForWrite(scope)) {
      const success = scoped.repository.supersede(id, supersededById, stateKey);
      if (success || scope) return { scope: scoped.scope, success };
    }
    return { scope: "global", success: false };
  }

  hit(id: number, scope?: string): void {
    for (const scoped of this.repositoriesForRead(scope)) {
      if (scope || scoped.repository.get(id)) {
        scoped.repository.hit(id);
        return;
      }
    }
  }

  topTraps(scope: string, limit = 20): Trap[] {
    const resolvedScope = normalizeScope(scope);
    return this.repositoryFor(resolvedScope).top(resolvedScope, limit);
  }

  stats(): { project: TrapStats | null; global: TrapStats } {
    const project = this.projectRoot ? this.projectRepo().stats() : null;
    return { project, global: this.globalRepo().stats() };
  }

  exportAll(opts: { scope?: string } = {}): TrapExportRecord[] {
    const traps: TrapExportRecord[] = [];
    for (const scoped of this.repositoriesForRead(opts.scope)) {
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
    return this.projectRoot !== null;
  }

  getProjectRoot(): string | null {
    return this.projectRoot;
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

    for (const scoped of this.repositoriesForRead(opts.scope)) {
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

  private repositoriesForRead(scope?: string): { scope: Scope; repository: TrapRepository }[] {
    const resolvedScope = optionalScope(scope);
    if (resolvedScope) return this.repositoryEntry(resolvedScope) ? [this.repositoryEntry(resolvedScope)!] : [];

    const repositories: { scope: Scope; repository: TrapRepository }[] = [];
    const project = this.repositoryEntry("project");
    if (project) repositories.push(project);
    repositories.push({ scope: "global", repository: this.globalRepo() });
    return repositories;
  }

  private repositoriesForWrite(scope?: string): { scope: Scope; repository: TrapRepository }[] {
    return this.repositoriesForRead(scope);
  }

  private repositoryEntry(scope: Scope): { scope: Scope; repository: TrapRepository } | null {
    if (scope === "project") {
      return this.projectRoot ? { scope, repository: this.projectRepo() } : null;
    }
    return { scope, repository: this.globalRepo() };
  }

  private repositoryFor(scope: Scope): TrapRepository {
    if (scope === "project") return this.projectRepo();
    return this.globalRepo();
  }

  private projectRepo(): TrapRepository {
    if (!this.projectRoot) {
      throw new Error("Not in a project. Run 'codetrap init' first, or use --scope global.");
    }
    if (!this.projectRepository) {
      this.projectRepository = new TrapRepository(openProject(this.projectRoot), this.embedder);
    }
    return this.projectRepository;
  }

  private globalRepo(): TrapRepository {
    if (!this.globalRepository) {
      this.globalRepository = new TrapRepository(openGlobal(), this.embedder);
    }
    return this.globalRepository;
  }
}

function normalizeScope(scope: string): Scope {
  if (scope === "project" || scope === "global") return scope;
  throw new Error(`Invalid scope: ${scope}`);
}

function optionalScope(scope?: string): Scope | null {
  if (!scope) return null;
  return normalizeScope(scope);
}
