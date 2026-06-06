import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { CODETRAP_DIR, TRAPS_DB_FILE } from "./constants";
import { defaultScopePathResolver, resolveScopePath, ScopePathResolver } from "./scope-path";

export function getGlobalDir(homeDir = homedir()): string {
  const dir = defaultScopePathResolver.join(homeDir, CODETRAP_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
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
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return defaultScopePathResolver.join(dir, TRAPS_DB_FILE);
}
