import { join, resolve } from "node:path";
import { CODETRAP_DIR, TRAPS_DB_FILE } from "./constants";
import { findProjectRoot, getGlobalDB } from "./scope";
import type { TrapStore } from "./store";

export type ScopeContext = {
  cwd: string;
  project_root: string | null;
  project_db: string | null;
  global_db: string;
};

export function createScopeContext(cwd = process.cwd()): ScopeContext {
  const resolvedCwd = resolve(cwd);
  const projectRoot = findProjectRoot(resolvedCwd);
  return {
    cwd: resolvedCwd,
    project_root: projectRoot,
    project_db: projectRoot ? join(projectRoot, CODETRAP_DIR, TRAPS_DB_FILE) : null,
    global_db: getGlobalDB(),
  };
}

export function storeForScopeContext(store: TrapStore, cwd?: unknown): TrapStore {
  if (typeof cwd === "string" && cwd.trim() !== "") {
    return store.forCwd(cwd);
  }
  return store;
}
