import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const LOCK_TIMEOUT_MS = 10_000;
/**
 * Deliberately shorter than the acquire timeout. With stale > timeout a waiter
 * dies before it can ever reclaim an abandoned lock, so every command in the
 * window after a crash fails and tells the user to hand-delete a directory.
 */
export const LOCK_STALE_MS = 5_000;
export const LOCK_RETRY_BASE_MS = 25;
export const LOCK_RETRY_JITTER_MS = 25;

export type LockOutcome<T> = {
  value: T;
  /** How long the caller waited to acquire. Surfaced in JSON for observability (§13.1). */
  lock_wait_ms: number;
  /** True when a lock left behind by a dead process had to be reclaimed. */
  stole_stale_lock: boolean;
};

export type AdvisoryLockOptions = {
  timeoutMs?: number;
  staleMs?: number;
  now?: () => number;
  /** Injectable only so owner-liveness edge cases remain deterministic in tests. */
  isProcessAlive?: (pid: number) => boolean;
};

/**
 * A per-resource advisory lock around a read-modify-write critical section.
 *
 * §13.1: with Codex and Claude Code both active, concurrent writes are a normal
 * scenario. `.codetrap/sessions/` and `.codetrap/learning/` are plain files, so
 * two agents capturing simultaneously can interleave and lose candidates.
 *
 * `mkdir` is the primitive because it is atomic on every filesystem codetrap
 * targets, including the Windows and WSL paths where `O_EXCL` on a network
 * share is not dependable.
 *
 * Retry uses jitter: without it, two processes released at the same moment
 * retry in lockstep and keep colliding.
 */
export function withAdvisoryLock<T>(
  lockDir: string,
  fn: () => T,
  options: AdvisoryLockOptions = {}
): LockOutcome<T> {
  const timeoutMs = options.timeoutMs ?? LOCK_TIMEOUT_MS;
  const staleMs = options.staleMs ?? LOCK_STALE_MS;
  const now = options.now ?? (() => Date.now());
  const isProcessAlive = options.isProcessAlive ?? processIsAlive;

  const started = now();
  const deadline = started + timeoutMs;
  const token = `${process.pid}.${Math.random().toString(36).slice(2)}`;
  let stoleStale = false;

  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      // Only a existing directory means "someone else holds it". EACCES on a
      // read-only mount, ENOENT on a vanished parent and friends are real
      // failures: retrying them spins at 100% CPU and never reports the cause.
      if (!isLockHeldError(error)) throw error;

      if (stealStaleLock(lockDir, staleMs, now, isProcessAlive)) {
        stoleStale = true;
        continue;
      }
      if (now() >= deadline) {
        throw new Error(
          `Timed out after ${timeoutMs}ms waiting for the lock at ${lockDir}. ` +
          `If no other codetrap process is running, delete that directory and retry.`
        );
      }
      Bun.sleepSync(LOCK_RETRY_BASE_MS + Math.random() * LOCK_RETRY_JITTER_MS);
    }
  }

  // Claim ownership immediately. Release verifies this token so a process can
  // never remove a directory it no longer owns.
  writeFileSync(join(lockDir, OWNER_FILE), token);

  const waited = now() - started;
  try {
    return { value: fn(), lock_wait_ms: waited, stole_stale_lock: stoleStale };
  } finally {
    releaseIfOwned(lockDir, token);
  }
}

const OWNER_FILE = "owner";

function isLockHeldError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "EEXIST";
}

/**
 * Only remove a lock this process still owns. If it was stolen mid-section the
 * owner file no longer matches, and blindly removing would release a lock
 * another process is legitimately holding.
 */
function releaseIfOwned(lockDir: string, token: string): void {
  try {
    if (readFileSync(join(lockDir, OWNER_FILE), "utf-8") !== token) return;
  } catch {
    // No owner file: either already reclaimed, or never written. Fall through
    // and clean up rather than leaking a lock forever.
  }
  rmSync(lockDir, { recursive: true, force: true });
}

function stealStaleLock(
  lockDir: string,
  staleMs: number,
  now: () => number,
  isProcessAlive: (pid: number) => boolean
): boolean {
  let age: number;
  try {
    age = now() - statSync(lockDir).mtimeMs;
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "ENOENT") return false;
    throw error;
  }
  if (age <= staleMs) return false;

  const ownerPid = readOwnerPid(lockDir);
  // A synchronous holder may legitimately exceed the lease duration while
  // JSON serialization or filesystem writes block timers. Age alone therefore
  // never authorizes stealing a lock from a process that is still alive.
  if (ownerPid !== null && isProcessAlive(ownerPid)) return false;

  // Renaming the abandoned directory is the atomic winner election. If two
  // waiters race to reclaim it, only one can move the original path; the other
  // observes ENOENT and retries normal acquisition instead of deleting the
  // winner's newly-created live lock.
  const quarantine = `${lockDir}.reclaim-${process.pid}-${Math.random().toString(36).slice(2)}`;
  try {
    renameSync(lockDir, quarantine);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT" || code === "EEXIST") return false;
    throw error;
  }
  rmSync(quarantine, { recursive: true, force: true });
  return true;
}

function readOwnerPid(lockDir: string): number | null {
  try {
    const match = readFileSync(join(lockDir, OWNER_FILE), "utf-8").match(/^(\d+)\./);
    if (!match) return null;
    const pid = Number(match[1]);
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  } catch {
    // A process that crashed between mkdir and owner write leaves no pid. The
    // age threshold still protects a live claimant during that short window.
    return null;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but this user cannot signal it. Only ESRCH
    // proves absence; every other result is treated conservatively as alive.
    return (error as { code?: string } | null)?.code !== "ESRCH";
  }
}
