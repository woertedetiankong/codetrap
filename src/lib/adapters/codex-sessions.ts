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
  toTurnRole,
  type DiscoverOptions,
  type ReadSessionResult,
  type SessionSourceAdapter,
  type SourceSessionRef,
} from "../learning-source-adapter";

/**
 * `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<ts>-<uuid>.jsonl`.
 *
 * A leading `session_meta` line carries id/cwd/cli_version; turns arrive as
 * `response_item` envelopes wrapping a message. Codex records no git branch, so
 * `branch` normalizes to null rather than being omitted — the envelope must have
 * the same keys from both adapters for §16 1C's parity gate to mean anything.
 */
export const codexSessionsAdapter: SessionSourceAdapter = {
  id: "codex-sessions",

  roots(home: string): string[] {
    return [join(home, ".codex", "sessions")];
  },

  discover(home: string, options?: DiscoverOptions): SourceSessionRef[] {
    const [root] = this.roots(home);
    const refs = listJsonlFiles(root, true).map((path) =>
      fileRef("codex-sessions", path, sessionIdFromPath(path))
    );
    // session_meta is the first line, so one short read answers the filter.
    return applyDiscoverFilters(refs, options, (ref) => cwdOfRef(ref.path));
  },

  read(ref: SourceSessionRef, roots: string[]): ReadSessionResult {
    return readCodexSession(ref, roots);
  },
};

export function readCodexSession(ref: SourceSessionRef, roots: string[]): ReadSessionResult {
  assertInsideRoot(ref.path, roots);
  const { lines, lineCount, raw } = readJsonlLines(ref.path);

  const turns: NormalizedTurn[] = [];
  let redactions = 0;
  let cwd: string | null = null;
  let version: string | null = null;
  let sessionId: string | null = null;
  const timestamps: string[] = [];

  for (const line of lines) {
    const payload = asRecord(line.payload);
    const timestamp = asString(line.timestamp);

    if (line.type === "session_meta" && payload) {
      sessionId ??= asString(payload.id);
      cwd ??= asString(payload.cwd);
      version ??= asString(payload.cli_version);
      continue;
    }

    if (line.type !== "response_item" || !payload) continue;
    if (payload.type !== "message") continue;

    const role = toTurnRole(payload.role);
    if (!role) continue;

    const text = textFromContent(payload.content);
    if (!text) continue;

    const normalized = normalizeTurn(turns.length, role, timestamp, text);
    if (!normalized) continue;
    turns.push(normalized.turn);
    redactions += normalized.redactions;
    if (timestamp) timestamps.push(timestamp);
  }

  timestamps.sort();
  const session: NormalizedSession = {
    source: "codex-sessions",
    session_id: sessionId ?? ref.session_id,
    path: ref.path,
    cwd,
    // Codex rollouts carry no git branch. Explicitly null, never omitted.
    branch: null,
    client_version: version,
    started_at: timestamps[0] ?? null,
    ended_at: timestamps[timestamps.length - 1] ?? null,
    turn_count: turns.length,
    turns,
  };

  return { session, manifest: manifestEntry(session, ref.path, raw, lineCount), redactions };
}

function sessionIdFromPath(path: string): string {
  const name = (path.split(/[\\/]/).pop() ?? path).replace(/\.jsonl$/, "");
  // rollout-2025-10-07T20-38-05-<uuid> -> <uuid>
  const match = name.match(/^rollout-\d{4}-\d{2}-\d{2}T[\d-]+-(.+)$/);
  return match?.[1] ?? name;
}

function cwdOfRef(path: string): string | null {
  for (const line of readJsonlHead(path, 4)) {
    if (line.type !== "session_meta") continue;
    const payload = asRecord(line.payload);
    if (payload) return asString(payload.cwd);
  }
  return null;
}
