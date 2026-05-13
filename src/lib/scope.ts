import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
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

export function findProjectRoot(cwd: string): string | null {
  let dir = cwd;
  while (true) {
    if (existsSync(join(dir, CODETRAP_DIR))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

export function getProjectDB(root: string): string {
  const dir = join(root, CODETRAP_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, TRAPS_DB_FILE);
}
