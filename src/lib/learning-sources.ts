import { existsSync } from "node:fs";
import {
  SOURCE_MANIFEST_VERSION,
  TURN_NORMALIZER_VERSION,
  type LearningSourceId,
  type NormalizedSession,
  type SourceManifest,
  type SourceManifestEntry,
} from "../domain/learning-source";
import { claudeCodeSessionsAdapter } from "./adapters/claude-code-sessions";
import { codexSessionsAdapter } from "./adapters/codex-sessions";
import type { DiscoverOptions, SessionSourceAdapter } from "./learning-source-adapter";

const ADAPTERS: Record<LearningSourceId, SessionSourceAdapter> = {
  "codex-sessions": codexSessionsAdapter,
  "claude-code-sessions": claudeCodeSessionsAdapter,
};

export function sourceAdapter(id: LearningSourceId): SessionSourceAdapter {
  return ADAPTERS[id];
}

export function allSourceAdapters(): SessionSourceAdapter[] {
  return Object.values(ADAPTERS);
}

export type SourceInventory = {
  source: LearningSourceId;
  roots: string[];
  available: boolean;
  session_count: number;
  /**
   * File modification times, not conversation times. A session resumed for a
   * minute yesterday has yesterday's mtime, and a sync or restore rewrites them
   * wholesale — so these are named for what they actually are.
   */
  newest_file_modified_at: string | null;
  oldest_file_modified_at: string | null;
};

/**
 * Read-only inventory: what history exists per client, without opening a single
 * transcript body. `learn sources` is how a user sees the blast radius of a
 * review before authorizing one (§3.2 explicit trigger, dry-run by default).
 */
export function inventorySource(
  adapter: SessionSourceAdapter,
  home: string,
  options?: DiscoverOptions
): SourceInventory {
  const roots = adapter.roots(home);
  const available = roots.some((root) => existsSync(root));
  const refs = available ? adapter.discover(home, options) : [];
  const times = refs.map((ref) => ref.modified_at).sort();
  return {
    source: adapter.id,
    roots,
    available,
    session_count: refs.length,
    newest_file_modified_at: times[times.length - 1] ?? null,
    oldest_file_modified_at: times[0] ?? null,
  };
}

export type CollectedSessions = {
  sessions: NormalizedSession[];
  manifest: SourceManifest;
};

/**
 * Reads the discovered sessions and builds the source manifest alongside them,
 * so the artifact that records provenance is produced by the same pass that
 * read the data — not reconstructed afterwards from memory.
 */
export function collectSessions(
  adapter: SessionSourceAdapter,
  home: string,
  options: DiscoverOptions | undefined,
  now: Date
): CollectedSessions {
  const roots = adapter.roots(home);
  const refs = adapter.discover(home, options);

  const sessions: NormalizedSession[] = [];
  const entries: SourceManifestEntry[] = [];
  let redactions = 0;

  let skippedEmpty = 0;
  for (const ref of refs) {
    const result = adapter.read(ref, roots);
    // §3.2 requires the manifest to report every file read, so a session that
    // yielded no usable turns still gets an entry — it was opened and hashed,
    // and an audit asking "what did codetrap read?" must not be told otherwise.
    entries.push(result.manifest);
    redactions += result.redactions;
    if (result.session.turn_count === 0) {
      skippedEmpty += 1;
      continue;
    }
    sessions.push(result.session);
  }

  return {
    sessions,
    manifest: {
      version: SOURCE_MANIFEST_VERSION,
      normalizer_version: TURN_NORMALIZER_VERSION,
      generated_at: now.toISOString(),
      roots,
      entries,
      totals: {
        files_read: entries.length,
        sessions: sessions.length,
        skipped_empty: skippedEmpty,
        bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
        lines: entries.reduce((sum, entry) => sum + entry.line_count, 0),
        redactions,
      },
    },
  };
}

export function parseSinceDays(value: string | undefined, now: Date): Date | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d+)\s*([dwm])?$/i);
  if (!match) throw new Error(`Invalid --since: ${value}. Expected a form like 30d, 2w, or 1m.`);
  const amount = Number.parseInt(match[1], 10);
  const unit = (match[2] ?? "d").toLowerCase();
  const days = unit === "w" ? amount * 7 : unit === "m" ? amount * 30 : amount;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
