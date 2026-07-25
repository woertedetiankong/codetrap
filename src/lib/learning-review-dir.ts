import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { LearningSourceId, NormalizedSession, SourceManifest } from "../domain/learning-source";
import { CODETRAP_DIR } from "./constants";
import { writeFileAtomic } from "./fs-json";
import { excerpt, MAX_EXCERPT_CHARS } from "./learning-redaction";

export const LEARNING_DIR = "learning";
export const REVIEWS_DIR = "reviews";
export const SOURCE_MANIFEST_FILE = "source-manifest.json";
export const EVIDENCE_PACK_FILE = "evidence-pack.json";
export const CANDIDATES_FILE = "lesson-candidates.json";
export const PROMPT_FILE = "discovery-prompt.md";

/** §7.2: both clients produce identical artifacts under this path. */
export function reviewsRoot(projectRoot: string): string {
  return join(projectRoot, CODETRAP_DIR, LEARNING_DIR, REVIEWS_DIR);
}

export function reviewDir(projectRoot: string, reviewId: string): string {
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
  session_id: string;
  turn_index: number;
  role: string;
  timestamp: string | null;
  excerpt: string;
};

export type EvidencePack = {
  version: 1;
  review_id: string;
  source: LearningSourceId;
  generated_at: string;
  session_count: number;
  evidence_count: number;
  excerpt_char_cap: number;
  items: EvidenceItem[];
};

export function buildEvidencePack(args: {
  reviewId: string;
  source: LearningSourceId;
  sessions: NormalizedSession[];
  now: Date;
  perSessionCap?: number;
}): EvidencePack {
  const perSessionCap = args.perSessionCap ?? 40;
  const items: EvidenceItem[] = [];

  for (const session of args.sessions) {
    for (const turn of session.turns.slice(0, perSessionCap)) {
      items.push({
        ref: evidenceRef(session.session_id, turn.index),
        source: session.source,
        session_id: session.session_id,
        turn_index: turn.index,
        role: turn.role,
        timestamp: turn.timestamp,
        excerpt: excerpt(turn.text),
      });
    }
  }

  return {
    version: 1,
    review_id: args.reviewId,
    source: args.source,
    generated_at: args.now.toISOString(),
    session_count: args.sessions.length,
    evidence_count: items.length,
    excerpt_char_cap: MAX_EXCERPT_CHARS,
    items,
  };
}

/** The stable pointer form `learn stage` verifies claimed evidence against. */
export function evidenceRef(sessionId: string, turnIndex: number): string {
  return `${sessionId}#${turnIndex}`;
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
