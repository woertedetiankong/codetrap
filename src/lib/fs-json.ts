import { readFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Write via a temp file + rename so a reader never observes a partial file.
 * Shared by the session, learning, and project-identity stores so the atomicity
 * strategy has one definition to fix rather than three.
 */
export function writeFileAtomic(path: string, content: string): void {
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

/**
 * Parse a JSON file, turning a syntax error into an actionable message that
 * names the file and the remedy.
 */
export function readJsonFile<T>(path: string, label = "file"): T {
  const text = readFileSync(path, "utf-8");
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Corrupt ${label} ${path}: ${message}. Fix or delete the file, then retry.`);
  }
}
