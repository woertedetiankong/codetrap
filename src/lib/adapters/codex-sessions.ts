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

  read(ref: SourceSessionRef, roots: string[], lens: TurnLens = TEXT_ONLY_LENS): ReadSessionResult {
    return readCodexSession(ref, roots, lens);
  },
};

export function readCodexSession(
  ref: SourceSessionRef,
  roots: string[],
  lens: TurnLens = TEXT_ONLY_LENS
): ReadSessionResult {
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

    // The wider lens also admits the item kinds the message-only filter drops:
    // Codex records reasoning and tool calls as sibling response_items rather
    // than as content blocks inside a message.
    const wide = codexWideItem(payload, lens);
    if (wide !== null) {
      const widened = normalizeTurn(turns.length, "tool", timestamp, wide);
      if (widened) {
        turns.push(widened.turn);
        redactions += widened.redactions;
        if (timestamp) timestamps.push(timestamp);
      }
      continue;
    }

    if (payload.type !== "message") continue;

    const role = toTurnRole(payload.role);
    if (!role) continue;

    const text = textFromContent(payload.content, lens);
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
    // Derived from the filename, so it is unique even when several transcripts
    // share one client session id.
    transcript_id: ref.session_id,
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

/**
 * Codex puts reasoning and tool traffic in sibling `response_item`s rather than
 * inside a message, so the wider lens has to admit those item types explicitly.
 * Returns null when the item is not one of them.
 */
function codexWideItem(payload: Record<string, unknown>, lens: TurnLens): string | null {
  const type = String(payload.type ?? "");
  if (lens.reasoning && type === "reasoning") {
    const text = textFromContent(payload.summary ?? payload.content, lens);
    return text ? `[reasoning]\n${text}` : null;
  }
  if (lens.tools && (type === "function_call" || type === "local_shell_call" || type === "custom_tool_call")) {
    const name = String(payload.name ?? type);
    const argsText = typeof payload.arguments === "string" ? payload.arguments : "";
    return `[${name}]\n${argsText}`.trim();
  }
  if (lens.tools && (type === "function_call_output" || type === "local_shell_call_output")) {
    const out = payload.output;
    const text = typeof out === "string" ? out : textFromContent(out, lens);
    return text ? `[tool_result] ${text}` : null;
  }
  return null;
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
