import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { TURN_NORMALIZER_VERSION, type LearningSourceId, type NormalizedSession, type SourceManifest } from "../domain/learning-source";
import { CODETRAP_DIR } from "./constants";
import { writeFileAtomic } from "./fs-json";
import { excerpt, lessonSignalScore, MAX_EXCERPT_CHARS } from "./learning-redaction";

export const LEARNING_DIR = "learning";
export const REVIEWS_DIR = "reviews";
export const SOURCE_MANIFEST_FILE = "source-manifest.json";
export const EVIDENCE_PACK_FILE = "evidence-pack.json";
export const CANDIDATES_FILE = "lesson-candidates.json";
export const PROMPT_FILE = "discovery-prompt.md";
export const TOMBSTONE_FILE = "deleted.json";

/** §7.2: both clients produce identical artifacts under this path. */
export function reviewsRoot(projectRoot: string): string {
  return join(projectRoot, CODETRAP_DIR, LEARNING_DIR, REVIEWS_DIR);
}

const SAFE_REVIEW_ID = /^[A-Za-z0-9._-]+$/;

/**
 * A review id becomes a path segment and `deleteReview` recursively removes it,
 * so an unvalidated id is an arbitrary-directory delete: `learn delete ../..`
 * would have wiped the entire `.codetrap` directory — traps.db included.
 */
export function assertSafeReviewId(reviewId: string): void {
  if (!SAFE_REVIEW_ID.test(reviewId) || reviewId === "." || reviewId === "..") {
    throw new Error(`Invalid review id: ${reviewId}`);
  }
}

export function reviewDir(projectRoot: string, reviewId: string): string {
  assertSafeReviewId(reviewId);
  return join(reviewsRoot(projectRoot), reviewId);
}

export function createReviewId(source: LearningSourceId, now: Date, exists: (id: string) => boolean): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const base = `${stamp}-${source}`;
  let id = base;
  let suffix = 2;
  while (exists(id)) id = `${base}-${suffix++}`;
  return id;
}

export function listReviewIds(projectRoot: string): string[] {
  const root = reviewsRoot(projectRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * One evidence item: a pointer plus a capped excerpt, never the transcript.
 *
 * §3.2: "Do not copy full session transcripts into codetrap. Store source
 * manifest, evidence pointers, short excerpts, hashes, dates, and necessary
 * metadata."
 */
export type EvidenceItem = {
  ref: string;
  source: LearningSourceId;
  transcript_id: string;
  session_id: string;
  turn_index: number;
  role: string;
  timestamp: string | null;
  excerpt: string;
};

export type EvidencePack = {
  version: 1;
  /** Mirrors the manifest, so a stale pack is detectable without it. */
  normalizer_version: number;
  review_id: string;
  source: LearningSourceId;
  generated_at: string;
  session_count: number;
  evidence_count: number;
  excerpt_char_cap: number;
  /** §4.2 evidence-pack budget, and what had to be dropped to meet it. */
  budget: {
    max_bytes: number;
    bytes: number;
    dropped_items: number;
    per_session_cap: number;
  };
  items: EvidenceItem[];
};

/** §4.2: target <= 80 KB UTF-8 per 10-candidate batch (roughly 20k tokens). */
export const EVIDENCE_PACK_MAX_BYTES = 80 * 1024;

/** Items every session is guaranteed, so recurrence stays visible. */
const SESSION_FLOOR = 2;

export function buildEvidencePack(args: {
  reviewId: string;
  source: LearningSourceId;
  sessions: NormalizedSession[];
  now: Date;
  perSessionCap?: number;
  maxBytes?: number;
  /** `failures` ranks lesson-bearing turns first; `spread` samples evenly. */
  focus?: "failures" | "spread";
}): EvidencePack {
  const maxBytes = args.maxBytes ?? EVIDENCE_PACK_MAX_BYTES;

  // The per-session cap bounds what each session *proposes*, not what survives.
  // Deriving it from the budget starved sessions that had a lot to offer: a
  // session with twenty failures could only put forward eight while a session
  // with none put forward eight too. Propose generously; the global budget fill
  // below decides by value.
  const perSessionCap = args.perSessionCap ?? 40;

  // Every session proposes its share, then the budget is filled globally by
  // signal. Filling in iteration order instead would let the last sessions lose
  // their evidence regardless of how much it carried — the budget would decide
  // by position rather than by value.
  const proposed: { item: EvidenceItem; score: number; order: number }[] = [];
  let order = 0;
  for (const session of args.sessions) {
    for (const turn of selectTurns(session.turns, perSessionCap, args.focus)) {
      proposed.push({
        item: {
          // Keyed on the transcript, not the session: subagent files share the
          // parent's session id, so a session-keyed ref resolved to several
          // different excerpts.
          ref: evidenceRef(session.transcript_id, turn.index),
          source: session.source,
          transcript_id: session.transcript_id,
          session_id: session.session_id,
          turn_index: turn.index,
          role: turn.role,
          timestamp: turn.timestamp,
          excerpt: excerpt(turn.text),
        },
        score: args.focus === "spread" ? 0 : lessonSignalScore(turn.text),
        order: order++,
      });
    }
  }

  const kept = new Set<number>();
  let bytes = 0;
  let dropped = 0;
  const take = (entry: { item: EvidenceItem; order: number }): boolean => {
    if (kept.has(entry.order)) return true;
    const size = Buffer.byteLength(JSON.stringify(entry.item), "utf-8");
    if (bytes + size > maxBytes) return false;
    kept.add(entry.order);
    bytes += size;
    return true;
  };

  // Two passes. A floor per session first, because a lesson seen in four
  // sessions is stronger evidence than one seen once — and pure value-sorting
  // concentrated the whole pack into the handful of sessions that happened to
  // fail most, discarding the recurrence signal entirely.
  const bySession = new Map<string, typeof proposed>();
  for (const entry of proposed) {
    // Grouped per transcript: grouping by session id collapsed a main session
    // and its 15 subagent transcripts into one, so they shared a single floor.
    const list = bySession.get(entry.item.transcript_id) ?? [];
    list.push(entry);
    bySession.set(entry.item.transcript_id, list);
  }
  for (const list of bySession.values()) {
    const best = [...list].sort((a, b) => b.score - a.score || a.order - b.order);
    for (const entry of best.slice(0, SESSION_FLOOR)) take(entry);
  }

  // Then the remaining budget goes to whatever carries the most signal.
  for (const entry of [...proposed].sort((a, b) => b.score - a.score || a.order - b.order)) {
    if (!take(entry)) dropped += 1;
  }

  // Chronological again, so the reader still gets a narrative.
  const items = proposed.filter((entry) => kept.has(entry.order)).map((entry) => entry.item);

  return {
    version: 1,
    normalizer_version: TURN_NORMALIZER_VERSION,
    review_id: args.reviewId,
    source: args.source,
    generated_at: args.now.toISOString(),
    session_count: args.sessions.length,
    evidence_count: items.length,
    excerpt_char_cap: MAX_EXCERPT_CHARS,
    budget: { max_bytes: maxBytes, bytes, dropped_items: dropped, per_session_cap: perSessionCap },
    items,
  };
}

/**
 * Chooses which turns of a session enter the pack.
 *
 * `spread` samples evenly — representative, but on a 1000-turn session a
 * budgeted cap of 8 sees ~1% and mostly misses the rare failures that carry
 * lessons. `failures` ranks by `lessonSignalScore` and keeps the top slice,
 * then restores chronological order so the reader still sees a narrative.
 */
export function selectTurns<T extends { text: string; index: number }>(
  turns: T[],
  cap: number,
  focus: "failures" | "spread" = "failures"
): T[] {
  if (cap <= 0 || turns.length <= cap) return turns;
  if (focus === "spread") return sampleTurns(turns, cap);

  const scored = turns
    .map((turn) => ({ turn, score: lessonSignalScore(turn.text) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map((entry) => entry.turn);

  // A session with no failure signal at all still deserves representation.
  if (scored.length < cap) {
    const chosen = new Set(scored.map((turn) => turn.index));
    for (const turn of sampleTurns(turns, cap)) {
      if (scored.length >= cap) break;
      if (chosen.has(turn.index)) continue;
      chosen.add(turn.index);
      scored.push(turn);
    }
  }
  return scored.sort((a, b) => a.index - b.index);
}

/**
 * Spreads the cap evenly across the session instead of taking the head.
 *
 * `slice(0, cap)` sampled the first N turns, which on a long session is its
 * opening few percent — where the user states the task and nothing has gone
 * wrong yet. Every pack was therefore biased toward intentions and away from
 * the failures, edits and corrections that occur later, which is precisely the
 * material a lesson is made of.
 */
export function sampleTurns<T>(turns: T[], cap: number): T[] {
  if (cap <= 0 || turns.length <= cap) return turns;
  const step = turns.length / cap;
  const sampled: T[] = [];
  for (let index = 0; index < cap; index += 1) {
    sampled.push(turns[Math.floor(index * step)]);
  }
  return sampled;
}

/** The stable pointer form `learn stage` verifies claimed evidence against. */
export function evidenceRef(transcriptId: string, turnIndex: number): string {
  return `${transcriptId}#${turnIndex}`;
}

export type WrittenReview = {
  review_id: string;
  review_dir: string;
  source_manifest_path: string;
  evidence_pack_path: string;
  prompt_path: string;
};

/**
 * Review directories hold redacted excerpts of the user's own sessions. They are
 * inside the working tree, so a `git add -A` in a repo that does not already
 * ignore `.codetrap/` would publish exactly what §3.2 protects. The ignore file
 * is written at creation rather than left to the user (Phase 0 risk 6).
 */
function ensureLearningGitignore(projectRoot: string): void {
  const dir = join(projectRoot, CODETRAP_DIR, LEARNING_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, ".gitignore");
  if (existsSync(path)) return;
  writeFileAtomic(path, [
    "# Learning reviews hold redacted excerpts of your own agent sessions.",
    "# They are local working artifacts and must not be committed.",
    "*",
    "",
  ].join("\n"));
}

export function writeReviewDir(args: {
  projectRoot: string;
  reviewId: string;
  manifest: SourceManifest;
  pack: EvidencePack;
  prompt: string;
}): WrittenReview {
  ensureLearningGitignore(args.projectRoot);
  const dir = reviewDir(args.projectRoot, args.reviewId);
  mkdirSync(dir, { recursive: true });

  const manifestPath = join(dir, SOURCE_MANIFEST_FILE);
  const packPath = join(dir, EVIDENCE_PACK_FILE);
  const promptPath = join(dir, PROMPT_FILE);

  writeFileAtomic(manifestPath, `${JSON.stringify(args.manifest, null, 2)}\n`);
  writeFileAtomic(packPath, `${JSON.stringify(args.pack, null, 2)}\n`);
  writeFileAtomic(promptPath, args.prompt);

  return {
    review_id: args.reviewId,
    review_dir: dir,
    source_manifest_path: manifestPath,
    evidence_pack_path: packPath,
    prompt_path: promptPath,
  };
}

export type ReviewTombstone = {
  version: 1;
  review_id: string;
  source: LearningSourceId;
  deleted_at: string;
  /** Non-sensitive audit metadata a committed trap's provenance still needs. */
  retained: {
    generated_at: string;
    roots: string[];
    files_read: number;
    sessions: number;
    bytes: number;
    redactions: number;
    evidence_count: number;
    file_hashes: string[];
  };
  note: string;
};

/**
 * §3.2: "deleting a review removes stored excerpts while preserving only
 * non-sensitive audit metadata required for durable destinations."
 *
 * A trap committed from this review keeps pointing at the review id, so the id,
 * the roots, the counts and the file hashes must survive. The excerpts — the
 * only part that carries the user's actual content — do not.
 */
export function deleteReview(projectRoot: string, reviewId: string, now: Date): ReviewTombstone {
  const dir = reviewDir(projectRoot, reviewId);
  if (!existsSync(dir)) throw new Error(`No such review: ${reviewId}`);

  const manifestPath = join(dir, SOURCE_MANIFEST_FILE);
  const packPath = join(dir, EVIDENCE_PACK_FILE);
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf-8")) as SourceManifest
    : null;
  const pack = existsSync(packPath)
    ? JSON.parse(readFileSync(packPath, "utf-8")) as EvidencePack
    : null;

  const tombstone: ReviewTombstone = {
    version: 1,
    review_id: reviewId,
    source: pack?.source ?? manifest?.entries[0]?.source ?? "claude-code-sessions",
    deleted_at: now.toISOString(),
    retained: {
      generated_at: manifest?.generated_at ?? now.toISOString(),
      roots: manifest?.roots ?? [],
      files_read: manifest?.totals.files_read ?? 0,
      sessions: manifest?.totals.sessions ?? 0,
      bytes: manifest?.totals.bytes ?? 0,
      redactions: manifest?.totals.redactions ?? 0,
      evidence_count: pack?.evidence_count ?? 0,
      // Hashes identify what was read without reproducing any of it.
      file_hashes: manifest?.entries.map((entry) => entry.sha256) ?? [],
    },
    note: "Excerpts deleted. Only non-sensitive audit metadata is retained (§3.2).",
  };

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileAtomic(join(dir, TOMBSTONE_FILE), `${JSON.stringify(tombstone, null, 2)}\n`);
  return tombstone;
}

export function isDeletedReview(projectRoot: string, reviewId: string): boolean {
  return existsSync(join(reviewDir(projectRoot, reviewId), TOMBSTONE_FILE));
}

/**
 * §7.3's shared discovery prompt, with the client-specific source list filled
 * in. One core, two source lists — the same rule as the adapters.
 */
export function discoveryPrompt(args: {
  reviewId: string;
  source: LearningSourceId;
  sessionCount: number;
  limit: number;
}): string {
  const client = args.source === "codex-sessions" ? "Codex" : "Claude Code";
  const clientSources = args.source === "codex-sessions"
    ? ["Codex local sessions and rollout summaries", "Codex Memories, only if the user explicitly allows access"]
    : ["Claude Code session transcripts", "Claude Code session summaries and memory directory, only if the user explicitly allows access"];

  return [
    `# Learning review — ${args.reviewId}`,
    "",
    `Source: \`${args.source}\` (${client})`,
    `Sessions in this pack: ${args.sessionCount}`,
    `Candidate limit: ${args.limit}`,
    "",
    "## Red lines for this run",
    "",
    "This run is dry-run only. Do not write traps.db, edit AGENTS/CLAUDE guidance,",
    "install skills, create agents, enable automations, or merge eval fixtures.",
    "Staging a candidate is not committing it; a human authorizes every durable write.",
    "",
    "## Task",
    "",
    "Look back over the work in `evidence-pack.json` and identify reusable lessons",
    "worth staging for codetrap review.",
    "",
    "Use available evidence in this order:",
    "",
    ...clientSources.map((entry) => `- ${entry}`),
    "- Existing traps, pending candidates, AGENTS/CLAUDE guidance, skills, custom",
    "  agents, automations, docs and eval fixtures — so you extend what exists",
    "  instead of duplicating it.",
    "",
    "Look for lessons that are repeated, costly, error-prone, context-heavy, or",
    "likely to improve future agent behavior. Also surface lessons whose value is",
    "the user's understanding — rationale, tradeoffs, mental models — even when no",
    "agent action exists; mark those with an `insight` destination hint and leave",
    "`candidate_kind` as `unclassified`.",
    "",
    "For every user-study insight, follow this teaching instruction:",
    "",
    "> 用ASCII流程图结合通俗易懂的例子讲解",
    "",
    "Put a compact ASCII flow diagram and a concrete, plain-language example in",
    "`recommended_action`; that field becomes the insight body after Phase 2",
    "migration. Explain what the reader should notice. Do not imply that saving",
    "or marking an insight trains the model. This format applies only to insights,",
    "not concise runtime pitfall candidates.",
    "",
    "Choose the smallest appropriate destination hypothesis. Phase 1 stabilizes only",
    "`pitfall_trap` and `unclassified`; do not force an uncertain lesson into a",
    "speculative destination.",
    "",
    "## Quality bar",
    "",
    "- No trigger condition means it cannot become a guardrail.",
    "- No recommended action means it cannot enter runtime.",
    "- Insufficient evidence means suppress or watch, never forced durability.",
    "- Every `evidence[].ref` must be a real ref from `evidence-pack.json`.",
    "  Staging verifies each one and fails the candidate if it does not resolve.",
    "",
    "## Output",
    "",
    `Write \`${CANDIDATES_FILE}\` into this directory as a JSON array of at most`,
    `${args.limit} candidates, each shaped:`,
    "",
    "```json",
    "{",
    '  "title": "...",',
    '  "candidate_kind": "pitfall_trap",',
    '  "destination_hint": "trap",',
    '  "trigger": "when this should be recalled",',
    '  "lesson": "what was learned",',
    '  "recommended_action": "what to do differently",',
    '  "rationale": "why that action is right and what breaks otherwise",',
    '  "category": "convention",',
    '  "scope": "project",',
    '  "severity": "warning",',
    '  "tags": ["..."],',
    '  "evidence": [{ "ref": "<session-id>#<turn-index>", "note": "why this supports the lesson" }]',
    "}",
    "```",
    "",
    "Then run:",
    "",
    "```bash",
    `codetrap learn stage --review-dir <this directory> --json`,
    "```",
    "",
    "Finish by reporting what was staged, what you deliberately skipped and why,",
    "what needs more evidence, and confirmation that no durable destination was",
    "modified.",
    "",
  ].join("\n");
}
