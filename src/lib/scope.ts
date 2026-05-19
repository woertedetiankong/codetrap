import { existsSync, mkdirSync, realpathSync } from "node:fs";
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
  const home = canonicalPath(homeDir);
  while (true) {
    if (samePath(dir, home)) return null;
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

function samePath(left: string, right: string): boolean {
  return canonicalPath(left) === canonicalPath(right);
}

function canonicalPath(path: string): string {
  const resolved = resolve(msysToWindowsPath(path));
  const real = existsSync(resolved) ? realpathSync(resolved) : resolved;
  return process.platform === "win32" ? real.toLowerCase() : real;
}

function msysToWindowsPath(path: string): string {
  if (process.platform !== "win32") return path;
  const match = path.match(/^\/([a-zA-Z])(?:\/(.*))?$/);
  if (!match) return path;
  const [, drive, rest = ""] = match;
  return `${drive.toUpperCase()}:\\${rest.replaceAll("/", "\\")}`;
}
