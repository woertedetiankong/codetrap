export const SOURCE_MANIFEST_VERSION = 1;

/**
 * Bumped whenever the noise filter or turn-indexing changes.
 *
 * Evidence refs are `<session-id>#<turn-index>` where the index is assigned
 * after noise filtering. Adding a noise prefix shifts every later index, so a
 * ref minted under an older normalizer would silently resolve to a *different*
 * excerpt. Recording the version lets staging refuse rather than mis-attribute.
 */
export const TURN_NORMALIZER_VERSION = 2;

/**
 * The history sources codetrap can read itself (§6.1, pull mode). Agent-native
 * sources — memories, internal task summaries — are never read by the CLI; they
 * arrive through `learn stage` as agent-submitted candidates (§6.2).
 */
export const LEARNING_SOURCE_IDS = ["codex-sessions", "claude-code-sessions"] as const;
export type LearningSourceId = (typeof LEARNING_SOURCE_IDS)[number];

/** Which client's history produced a record, for §13.4 provenance. */
export const SOURCE_AGENT_BY_ID: Record<LearningSourceId, string> = {
  "codex-sessions": "codex",
  "claude-code-sessions": "claude-code",
};

export const TURN_ROLES = ["user", "assistant", "system", "tool"] as const;
export type TurnRole = (typeof TURN_ROLES)[number];

/**
 * One turn, client-agnostic.
 *
 * `text` is already redacted by the adapter — nothing downstream should ever
 * see raw transcript content (§3.2).
 */
export interface NormalizedTurn {
  index: number;
  role: TurnRole;
  timestamp: string | null;
  text: string;
}

/**
 * A session in the shape the compiler layer works with.
 *
 * Fields absent from a given client are explicitly `null` rather than omitted:
 * Codex has no per-line git branch and Claude Code has no session header, so
 * the envelope is their intersection plus nulls. Without that rule the two
 * adapters would produce differently-shaped objects and §16 1C's parity gate
 * would be unmeetable.
 */
export interface NormalizedSession {
  source: LearningSourceId;
  /**
   * Unique per transcript file. Claude Code writes subagent transcripts as
   * separate `agent-*.jsonl` files that carry the *parent* session's id, so
   * `session_id` alone is not unique — 15 files shared one id in this repo's
   * own history, which made evidence refs collide across them.
   */
  transcript_id: string;
  /** The client's own session id. Real provenance, but not unique per file. */
  session_id: string;
  path: string;
  cwd: string | null;
  branch: string | null;
  client_version: string | null;
  started_at: string | null;
  ended_at: string | null;
  turn_count: number;
  turns: NormalizedTurn[];
}

export interface SourceManifestEntry {
  source: LearningSourceId;
  transcript_id: string;
  session_id: string;
  path: string;
  bytes: number;
  sha256: string;
  line_count: number;
  cwd: string | null;
  branch: string | null;
  first_timestamp: string | null;
  last_timestamp: string | null;
}

/**
 * §3.2 requires every read to report the roots it used and the files it touched.
 * The manifest is the artifact that makes a review auditable after the fact,
 * and the thing `learn stage` verifies evidence refs against.
 */
export interface SourceManifest {
  version: typeof SOURCE_MANIFEST_VERSION;
  /** The turn-indexing scheme these refs were minted under. */
  normalizer_version: number;
  generated_at: string;
  roots: string[];
  entries: SourceManifestEntry[];
  totals: {
    /** Files opened and hashed — including those that yielded no usable turns. */
    files_read: number;
    /** Sessions that contributed evidence. */
    sessions: number;
    /** Files read but dropped because every turn was harness noise. */
    skipped_empty: number;
    bytes: number;
    lines: number;
    redactions: number;
  };
}

export function parseLearningSourceId(value: string | undefined | null): LearningSourceId {
  const normalized = String(value ?? "").trim();
  if ((LEARNING_SOURCE_IDS as readonly string[]).includes(normalized)) {
    return normalized as LearningSourceId;
  }
  throw new Error(
    `Invalid source: ${normalized || "(none)"}. Expected one of: ${LEARNING_SOURCE_IDS.join(", ")}`
  );
}
