import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const RENAME_RETRY_CODES = new Set(["EACCES", "EBUSY", "EEXIST", "EPERM"]);

export type RenameRetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  rename?: (source: string, destination: string) => void;
  sleep?: (milliseconds: number) => void;
};

/**
 * Write via a temp file + rename so a reader never observes a partial file.
 * Shared by the session, learning, and project-identity stores so the atomicity
 * strategy has one definition to fix rather than three.
 */
export function writeFileAtomic(path: string, content: string): void {
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    writeAndSync(tmp, content);
    renameFileWithRetry(tmp, path);
    syncParentDirectory(path);
  } finally {
    // `force` makes this a no-op after a successful rename. On failure it
    // prevents abandoned temp files from accumulating beside durable state.
    try {
      rmSync(tmp, { force: true });
    } catch {
      // Preserve the original write/rename error if a scanner also keeps the
      // temporary file open. A later write uses a unique temp name.
    }
  }
}

export function renameFileWithRetry(
  source: string,
  destination: string,
  options: RenameRetryOptions = {}
): void {
  const maxRetries = options.maxRetries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 10;
  const rename = options.rename ?? renameSync;
  const sleep = options.sleep ?? Bun.sleepSync;

  for (let attempt = 0; ; attempt++) {
    try {
      rename(source, destination);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (!code || !RENAME_RETRY_CODES.has(code) || attempt >= maxRetries) throw error;
      sleep(baseDelayMs * (2 ** attempt));
    }
  }
}

function writeAndSync(path: string, content: string): void {
  const fd = openSync(path, "w");
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function syncParentDirectory(path: string): void {
  // Windows does not allow opening a directory with the flags Node exposes.
  // The temp file itself is still flushed before rename on every platform.
  if (process.platform === "win32") return;
  let fd: number | undefined;
  try {
    fd = openSync(dirname(path), "r");
    fsyncSync(fd);
  } catch {
    // Some filesystems do not support directory fsync. Atomic replacement has
    // already succeeded, so durability enhancement failure is non-fatal.
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Directory fsync is best-effort and must not turn a completed atomic
        // replacement into a reported failure.
      }
    }
  }
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
