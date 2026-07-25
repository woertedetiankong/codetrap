import { join } from "node:path";
import type { NormalizedSession, NormalizedTurn } from "../../domain/learning-source";
import {
  applyDiscoverFilters,
  asRecord,
  asString,
  assertInsideRoot,
  fileRef,
  listJsonlFiles,
  manifestEntry,
  normalizeTurn,
  readJsonlHead,
  readJsonlLines,
  textFromContent,
  TEXT_ONLY_LENS,
  toTurnRole,
  type DiscoverOptions,
  type ReadSessionResult,
  type SessionSourceAdapter,
  type TurnLens,
  type SourceSessionRef,
} from "../learning-source-adapter";

/**
 * `~/.claude/projects/<slug>/<session-uuid>.jsonl`.
 *
 * Every line repeats the session metadata (`sessionId`, `cwd`, `gitBranch`,
 * `version`), and there is no header line — the opposite of Codex, which has a
 * header and no per-line branch. The normalized envelope is their intersection.
 */
export const claudeCodeSessionsAdapter: SessionSourceAdapter = {
  id: "claude-code-sessions",

  roots(home: string): string[] {
    return [join(home, ".claude", "projects")];
  },

  discover(home: string, options?: DiscoverOptions): SourceSessionRef[] {
    const [root] = this.roots(home);
    const refs = listJsonlFiles(root, true).map((path) =>
      fileRef("claude-code-sessions", path, sessionIdFromPath(path))
    );
    // The containing directory name encodes the cwd, so project filtering needs
    // no file I/O at all; the header is only consulted as a fallback.
    return applyDiscoverFilters(refs, options, (ref) => cwdOfRef(ref.path));
  },

  read(ref: SourceSessionRef, roots: string[], lens: TurnLens = TEXT_ONLY_LENS): ReadSessionResult {
    return readClaudeCodeSession(ref, roots, lens);
  },
};

export function readClaudeCodeSession(
  ref: SourceSessionRef,
  roots: string[],
  lens: TurnLens = TEXT_ONLY_LENS
): ReadSessionResult {
  assertInsideRoot(ref.path, roots);
  const { lines, lineCount, raw } = readJsonlLines(ref.path);

  const turns: NormalizedTurn[] = [];
  let redactions = 0;
  let cwd: string | null = null;
  let branch: string | null = null;
  let version: string | null = null;
  let sessionId: string | null = null;
  const timestamps: string[] = [];

  for (const line of lines) {
    cwd ??= asString(line.cwd);
    branch ??= asString(line.gitBranch);
    version ??= asString(line.version);
    sessionId ??= asString(line.sessionId);

    const role = toTurnRole(line.type);
    if (!role) continue;

    const timestamp = asString(line.timestamp);
    const text = messageText(line, lens);
    if (!text) continue;

    const normalized = normalizeTurn(turns.length, role, timestamp, text);
    if (!normalized) continue;
    turns.push(normalized.turn);
    redactions += normalized.redactions;
    if (timestamp) timestamps.push(timestamp);
  }

  timestamps.sort();
  const session: NormalizedSession = {
    source: "claude-code-sessions",
    // Derived from the filename, so it is unique even when several transcripts
    // share one client session id.
    transcript_id: ref.session_id,
    session_id: sessionId ?? ref.session_id,
    path: ref.path,
    cwd,
    branch,
    client_version: version,
    started_at: timestamps[0] ?? null,
    ended_at: timestamps[timestamps.length - 1] ?? null,
    turn_count: turns.length,
    turns,
  };

  return { session, manifest: manifestEntry(session, ref.path, raw, lineCount), redactions };
}

function messageText(line: Record<string, unknown>, lens: TurnLens): string {
  // Turn content is under `message.content` for user/assistant lines and
  // directly under `content` for system lines.
  const message = asRecord(line.message);
  if (message) return textFromContent(message.content, lens);
  return textFromContent(line.content, lens);
}

function sessionIdFromPath(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  return name.replace(/\.jsonl$/, "");
}

function cwdOfRef(path: string): string | null {
  for (const line of readJsonlHead(path, 12)) {
    const cwd = asString(line.cwd);
    if (cwd) return cwd;
  }
  return null;
}
