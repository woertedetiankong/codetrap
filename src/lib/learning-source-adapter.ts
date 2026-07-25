import { createHash } from "node:crypto";
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import type {
  LearningSourceId,
  NormalizedSession,
  NormalizedTurn,
  SourceManifestEntry,
  TurnRole,
} from "../domain/learning-source";
import { isHarnessNoise, redact } from "./learning-redaction";

export type SourceSessionRef = {
  source: LearningSourceId;
  session_id: string;
  path: string;
  modified_at: string;
};

/**
 * What a read includes beyond plain message text.
 *
 * Off by default, and deliberately so: tool calls and results are roughly 5x
 * the volume of message text and are where shell commands, file contents and
 * environment values live — so the §3.2 privacy surface widens sharply. The
 * flags exist because Phase 0 risk 4 asks whether codebase lessons live in the
 * 85% the extractor never read, and that question cannot be answered without
 * being able to read it.
 */
export type TurnLens = {
  /** Assistant reasoning blocks. */
  reasoning?: boolean;
  /** Tool calls and their results — where edits and command output live. */
  tools?: boolean;
};

export const TEXT_ONLY_LENS: TurnLens = {};

export type DiscoverOptions = {
  /**
   * Inclusive lower bound on the session file's modification time — not on the
   * conversation's own timestamps. Cheap and index-free, but it means a resumed
   * old session is admitted by a narrow window.
   */
  since?: Date;
  /** Restrict to sessions whose recorded cwd is inside this directory. */
  projectRoot?: string;
  limit?: number;
};

/**
 * One contract, one per client (§3.1: "One CLI contract; two thin client
 * adapters. Adding a third client later must not require touching the compiler
 * layer.")
 */
export interface SessionSourceAdapter {
  readonly id: LearningSourceId;
  /** Explicit allowed roots. Reads never escape these, and never follow symlinks out (§3.2). */
  roots(home: string): string[];
  discover(home: string, options?: DiscoverOptions): SourceSessionRef[];
  /**
   * `roots` is required, not optional: an optional guard is a guard that some
   * call path will skip. Every read goes through `assertInsideRoot` before a
   * byte is opened.
   */
  read(ref: SourceSessionRef, roots: string[], lens?: TurnLens): ReadSessionResult;
}

export type ReadSessionResult = {
  session: NormalizedSession;
  manifest: SourceManifestEntry;
  redactions: number;
};

// --- shared helpers used by every adapter -------------------------------

/**
 * §3.2: "Source readers default to explicit allowed roots, do not follow
 * symlinks out of those roots". Checked with lstat so a symlink is refused
 * rather than silently resolved.
 */
export function assertInsideRoot(path: string, roots: string[]): void {
  const target = resolve(path);

  // The final component must not itself be a link.
  const stats = lstatSync(target, { throwIfNoEntry: false });
  if (stats?.isSymbolicLink()) {
    throw new Error(`Refusing to read ${path}: it is a symlink, and source readers do not follow links.`);
  }

  // Compare *resolved* containers, not the lexical path: `resolve()` alone is
  // purely textual, so a symlinked intermediate directory
  // (~/.codex/sessions/archive -> /elsewhere) would pass a prefix test while
  // actually reading outside the root.
  const container = realpathish(dirname(target));
  const allowed = roots.some((root) => {
    const base = realpathish(resolve(root));
    return container === base || container.startsWith(base.endsWith(sep) ? base : base + sep);
  });
  if (!allowed) {
    throw new Error(`Refusing to read ${path}: outside the allowed source roots (${roots.join(", ")}).`);
  }
}

function realpathish(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

export function listJsonlFiles(dir: string, recursive: boolean): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    // Skip symlinked entries outright rather than stat-ing through them.
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (recursive) found.push(...listJsonlFiles(path, recursive));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".jsonl")) found.push(path);
  }
  return found.sort();
}

export function fileRef(
  source: LearningSourceId,
  path: string,
  sessionId: string
): SourceSessionRef {
  return {
    source,
    session_id: sessionId,
    path,
    modified_at: statSync(path).mtime.toISOString(),
  };
}

export function applyDiscoverFilters(
  refs: SourceSessionRef[],
  options: DiscoverOptions | undefined,
  cwdOf: (ref: SourceSessionRef) => string | null
): SourceSessionRef[] {
  let filtered = refs;
  if (options?.since) {
    const since = options.since.getTime();
    filtered = filtered.filter((ref) => Date.parse(ref.modified_at) >= since);
  }
  if (options?.projectRoot) {
    const root = resolve(options.projectRoot);
    filtered = filtered.filter((ref) => {
      const cwd = cwdOf(ref);
      if (!cwd) return false;
      const target = resolve(cwd);
      return target === root || target.startsWith(root.endsWith(sep) ? root : root + sep);
    });
  }
  // Newest first, so a --limit keeps the most recent work rather than the oldest.
  filtered = [...filtered].sort((a, b) => b.modified_at.localeCompare(a.modified_at));
  if (options?.limit !== undefined && options.limit > 0) filtered = filtered.slice(0, options.limit);
  return filtered;
}

export type ParsedLine = Record<string, unknown>;

/**
 * Parses only the first `maxLines` lines. Discovery needs one header field, and
 * reading whole multi-megabyte transcripts to find it made `learn sources
 * --project-only` pull the entire corpus through memory for a command that
 * advertises itself as metadata-only.
 */
export function readJsonlHead(path: string, maxLines: number): ParsedLine[] {
  const handle = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const read = readSync(handle, buffer, 0, buffer.length, 0);
    const rows = buffer.subarray(0, read).toString("utf-8").split(/\r?\n/);
    const lines: ParsedLine[] = [];
    for (const row of rows.slice(0, maxLines)) {
      if (row.trim() === "") continue;
      try {
        const parsed = JSON.parse(row) as unknown;
        if (parsed && typeof parsed === "object") lines.push(parsed as ParsedLine);
      } catch {
        // A line straddling the buffer boundary is simply not available here.
      }
    }
    return lines;
  } finally {
    closeSync(handle);
  }
}

export function readJsonlLines(path: string): { lines: ParsedLine[]; lineCount: number; raw: string } {
  const raw = readFileSync(path, "utf-8");
  const rows = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  const lines: ParsedLine[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row) as unknown;
      if (parsed && typeof parsed === "object") lines.push(parsed as ParsedLine);
    } catch {
      // A torn or truncated line is skipped, not fatal: a transcript being
      // appended to while we read it is normal, and one bad line must not cost
      // the whole session.
    }
  }
  return { lines, lineCount: rows.length, raw };
}

/**
 * Turns raw text into a normalized turn, redacting and dropping harness noise.
 * Returns null when the line carries nothing a human said or a tool reported.
 */
export function normalizeTurn(
  index: number,
  role: TurnRole,
  timestamp: string | null,
  text: string
): { turn: NormalizedTurn; redactions: number } | null {
  if (isHarnessNoise(text)) return null;
  const redacted = redact(text);
  const trimmed = redacted.text.trim();
  if (!trimmed) return null;
  return {
    turn: { index, role, timestamp, text: trimmed },
    redactions: redacted.total,
  };
}

export function manifestEntry(
  session: NormalizedSession,
  path: string,
  raw: string,
  lineCount: number
): SourceManifestEntry {
  return {
    source: session.source,
    transcript_id: session.transcript_id,
    session_id: session.session_id,
    path,
    bytes: Buffer.byteLength(raw, "utf-8"),
    sha256: createHash("sha256").update(raw).digest("hex"),
    line_count: lineCount,
    cwd: session.cwd,
    branch: session.branch,
    first_timestamp: session.started_at,
    last_timestamp: session.ended_at,
  };
}

export function textFromContent(value: unknown, lens: TurnLens = TEXT_ONLY_LENS): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => blockText(part, lens))
    .filter(Boolean)
    .join("\n");
}

function blockText(part: unknown, lens: TurnLens): string {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  const record = part as Record<string, unknown>;

  switch (record.type) {
    case "thinking":
      return lens.reasoning ? String(record.thinking ?? "") : "";
    case "tool_use":
      return lens.tools ? formatToolUse(record) : "";
    case "tool_result":
      return lens.tools ? `[tool_result] ${textFromContent(record.content, lens)}` : "";
    default:
      return typeof record.text === "string" ? record.text : "";
  }
}

/**
 * Renders a tool call compactly. Edits carry the before/after strings, which is
 * the closest thing a transcript has to a diff — and the specific content Phase
 * 0 risk 4 suspects codebase lessons are hiding in.
 */
function formatToolUse(record: Record<string, unknown>): string {
  const name = String(record.name ?? "tool");
  const input = asRecord(record.input);
  if (!input) return `[${name}]`;

  const parts: string[] = [`[${name}]`];
  for (const key of ["file_path", "command", "description", "pattern", "path"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) parts.push(`${key}: ${value}`);
  }
  for (const key of ["old_string", "new_string", "content"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) parts.push(`${key}:\n${value}`);
  }
  return parts.join("\n");
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function toTurnRole(value: unknown): TurnRole | null {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "user" || role === "human") return "user";
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  if (role === "tool" || role === "tool_result" || role === "function") return "tool";
  return null;
}
