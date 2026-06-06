import { openGlobal, openProject } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { CODETRAP_DIR, TRAPS_DB_FILE } from "./constants";
import type { Scope } from "./constants";
import type { EmbeddingRuntime } from "./embedding-runtime";
import type { RankingConfig } from "./search-policy";
import { findProjectRoot, getGlobalDB } from "./scope";
import { resolveScopePath, ScopePathResolver } from "./scope-path";

const scopePath = new ScopePathResolver();

export type ScopeContext = {
  cwd: string;
  project_root: string | null;
  project_db: string | null;
  global_db: string;
};

export function createScopeContext(cwd = process.cwd(), home?: string): ScopeContext {
  const resolvedCwd = resolveScopePath(cwd, home ?? cwd);
  const projectRoot = findProjectRoot(resolvedCwd, home);
  return {
    cwd: resolvedCwd,
    project_root: projectRoot,
    project_db: projectRoot ? scopePath.join(projectRoot, CODETRAP_DIR, TRAPS_DB_FILE) : null,
    global_db: getGlobalDB(home),
  };
}

export type ScopedRepository = {
  scope: Scope;
  repository: TrapRepository;
};

export class ScopedRepositoryContext {
  private readonly context: ScopeContext;
  private globalRepository?: TrapRepository;
  private projectRepository?: TrapRepository;

  constructor(
    cwd = process.cwd(),
    private readonly embeddings?: EmbeddingRuntime,
    private readonly home?: string,
    private readonly ranking?: RankingConfig
  ) {
    this.context = createScopeContext(cwd, home);
  }

  hasProject(): boolean {
    return this.context.project_root !== null;
  }

  projectRoot(): string | null {
    return this.context.project_root;
  }

  repositoriesForRead(scope?: string): ScopedRepository[] {
    const resolvedScope = optionalScope(scope);
    if (resolvedScope) {
      const entry = this.repositoryEntry(resolvedScope);
      return entry ? [entry] : [];
    }

    const repositories: ScopedRepository[] = [];
    const project = this.repositoryEntry("project");
    if (project) repositories.push(project);
    repositories.push({ scope: "global", repository: this.globalRepo() });
    return repositories;
  }

  repositoriesForWrite(scope?: string): ScopedRepository[] {
    return this.repositoriesForRead(scope);
  }

  repositoryFor(scope: Scope): TrapRepository {
    const entry = this.repositoryEntry(scope);
    if (!entry) {
      throw new Error("Not in a project. Run 'codetrap init' first, or use --scope global.");
    }
    return entry.repository;
  }

  repositoryEntry(scope: Scope): ScopedRepository | null {
    if (scope === "project") {
      return this.context.project_root ? { scope, repository: this.projectRepo() } : null;
    }
    return { scope, repository: this.globalRepo() };
  }

  private projectRepo(): TrapRepository {
    const projectRoot = this.context.project_root;
    if (!projectRoot) {
      throw new Error("Not in a project. Run 'codetrap init' first, or use --scope global.");
    }
    if (!this.projectRepository) {
      this.projectRepository = new TrapRepository(openProject(projectRoot), this.embeddings, this.ranking);
    }
    return this.projectRepository;
  }

  private globalRepo(): TrapRepository {
    if (!this.globalRepository) {
      this.globalRepository = new TrapRepository(openGlobal(this.home), this.embeddings, this.ranking);
    }
    return this.globalRepository;
  }
}

export function normalizeScope(scope: string): Scope {
  if (scope === "project" || scope === "global") return scope;
  throw new Error(`Invalid scope: ${scope}`);
}

export function optionalScope(scope?: string): Scope | null {
  if (!scope) return null;
  return normalizeScope(scope);
}

export function storeForScopeContext<T extends { forCwd(cwd: string): T }>(store: T, cwd?: unknown): T {
  if (typeof cwd === "string" && cwd.trim() !== "") {
    return store.forCwd(cwd);
  }
  return store;
}
