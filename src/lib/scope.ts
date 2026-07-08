import { homedir } from "node:os";
import { CODETRAP_DIR, TRAPS_DB_FILE } from "./constants";
import { defaultScopePathResolver, resolveScopePath, ScopePathResolver } from "./scope-path";

// L5: path resolution must be side-effect free. Creating ~/.codetrap here made
// *any* command in *any* directory materialize the global dir just by resolving
// a path. The directory is created lazily when a database is actually opened
// (see openDatabase in db/connection.ts).
export function getGlobalDir(homeDir = homedir()): string {
  return defaultScopePathResolver.join(homeDir, CODETRAP_DIR);
}

export function getGlobalDB(homeDir = homedir()): string {
  return defaultScopePathResolver.join(getGlobalDir(homeDir), TRAPS_DB_FILE);
}

export function findProjectRoot(
  cwd: string,
  homeDir = homedir(),
  resolver: ScopePathResolver = defaultScopePathResolver
): string | null {
  let dir = resolver.resolve(cwd, homeDir);
  while (true) {
    if (resolver.same(dir, homeDir)) return null;
    if (resolver.exists(resolver.join(dir, CODETRAP_DIR))) return dir;
    const parent = resolver.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function getProjectDB(root: string): string {
  const dir = defaultScopePathResolver.join(root, CODETRAP_DIR);
  return defaultScopePathResolver.join(dir, TRAPS_DB_FILE);
}
