import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { CODETRAP_DIR, TRAPS_DB_FILE } from "./constants";

export function getGlobalDir(): string {
  const dir = join(homedir(), CODETRAP_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function getGlobalDB(): string {
  return join(getGlobalDir(), TRAPS_DB_FILE);
}

export function findProjectRoot(cwd: string, homeDir = homedir()): string | null {
  let dir = resolve(cwd);
  const home = resolve(homeDir);
  while (true) {
    if (dir === home) return null;
    if (existsSync(join(dir, CODETRAP_DIR))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function getProjectDB(root: string): string {
  const dir = join(root, CODETRAP_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, TRAPS_DB_FILE);
}
