import { basename, join } from "node:path";
import type {
  CandidateTrap,
  SessionIndexEntry,
  SessionMetadata,
  SessionNote,
  SessionNoteCounts,
} from "../domain/session";
import { SESSION_NOTE_KINDS } from "../domain/session";
import { trimOuterBlankLines } from "./text-lines";

export const SESSIONS_DIR = "sessions";
export const ACTIVE_SESSION_FILE = "active.json";
export const SESSION_INDEX_FILE = "index.json";
export const SESSION_FILE = "session.json";
export const NOTES_FILE = "implementation-notes.md";
export const RECAP_FILE = "recap.md";
export const CANDIDATES_FILE = "candidate-traps.json";

export function createSessionId(goal: string, now: Date, exists: (id: string) => boolean): string {
  const date = now.toISOString().slice(0, 10);
  const base = `${date}-${slugify(goal)}`;
  let candidate = base;
  let suffix = 2;
  while (exists(candidate)) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64)
    .replace(/^-|-$/g, "");
  return slug || "session";
}

export function sessionRelativeDir(id: string): string {
  return join(".codetrap", SESSIONS_DIR, id);
}

export function sessionRelativeFile(id: string, file: string): string {
  return join(sessionRelativeDir(id), file);
}

export function formatImplementationNotesHeader(session: SessionMetadata): string {
  return [
    `# Implementation Notes: ${session.goal}`,
    "",
    `Session: ${session.id}`,
    `Status: ${session.status}`,
    "",
    "## Timeline",
    "",
  ].join("\n");
}

export function formatSessionNote(note: SessionNote): string {
  const lines = [
    `### ${note.created_at} ${note.kind}`,
    "",
    escapeNoteBody(note.text.trim()),
  ];
  if (note.source_ref) {
    lines.push("", `Source ref: ${note.source_ref}`);
  }
  if (note.related_files.length > 0) {
    lines.push("", "Related files:", ...note.related_files.map((file) => `- ${file}`));
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function parseSessionNotes(markdown: string): SessionNote[] {
  const lines = markdown.split(/\r?\n/);
  const notes: SessionNote[] = [];
  let current: { created_at: string; kind: SessionNote["kind"]; lines: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(/^###\s+(\S+)\s+(\S+)\s*$/);
    if (match && isSessionNoteKind(match[2])) {
      if (current) notes.push(parseNoteBlock(current.created_at, current.kind, current.lines));
      current = { created_at: match[1], kind: match[2], lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) notes.push(parseNoteBlock(current.created_at, current.kind, current.lines));
  return notes;
}

export function noteCounts(notes: SessionNote[]): SessionNoteCounts {
  const counts: SessionNoteCounts = {};
  for (const note of notes) {
    counts[note.kind] = (counts[note.kind] ?? 0) + 1;
  }
  return counts;
}

export function formatRecap(
  session: SessionMetadata,
  notes: SessionNote[],
  candidates: CandidateTrap[] = []
): string {
  const decisions = notes.filter((note) => note.kind === "decision");
  const deviations = notes.filter((note) => note.kind === "deviation");
  const tradeoffs = notes.filter((note) => note.kind === "tradeoff");
  const failures = notes.filter((note) => note.kind === "failure" || note.kind === "test_failure");
  const questions = notes.filter((note) => note.kind === "open_question");
  const observations = notes.filter((note) => note.kind === "observation" || note.kind === "correction" || note.kind === "review");

  return [
    `# Session Recap: ${session.goal}`,
    "",
    "## Goal",
    "",
    session.goal,
    "",
    "## What Changed",
    "",
    formatNoteList(observations, "No implementation observations were captured."),
    "",
    "## Decisions",
    "",
    formatNoteList(decisions, "No decisions were captured."),
    "",
    "## Deviations From Spec",
    "",
    formatNoteList(deviations, "No deviations were captured."),
    "",
    "## Tradeoffs",
    "",
    formatNoteList(tradeoffs, "No tradeoffs were captured."),
    "",
    "## Failures And Fixes",
    "",
    formatNoteList(failures, "No failures were captured."),
    "",
    "## Open Questions",
    "",
    formatNoteList(questions, "No open questions were captured."),
    "",
    "## Candidate Traps",
    "",
    candidates.length > 0
      ? candidates.map((candidate) => `- ${candidate.id}: ${candidate.trap.title} (${candidate.quality_score.toFixed(2)})`).join("\n")
      : "No candidate traps were proposed.",
    "",
    "## Accepted Traps",
    "",
    formatAcceptedCandidates(candidates),
    "",
  ].join("\n");
}

export function recapSummary(session: SessionMetadata, notes: SessionNote[], candidates: CandidateTrap[]): string {
  const noteCount = notes.length;
  const candidateCount = candidates.length;
  return `Captured ${noteCount} note${noteCount === 1 ? "" : "s"} for ${session.goal}; proposed ${candidateCount} candidate trap${candidateCount === 1 ? "" : "s"}.`;
}

export function sessionIndexEntry(
  session: SessionMetadata,
  notes: SessionNote[],
  candidates: CandidateTrap[],
  summary: string | null
): SessionIndexEntry {
  return {
    id: session.id,
    goal: session.goal,
    status: session.status,
    created_at: session.created_at,
    closed_at: session.closed_at,
    module: session.module,
    owner: session.owner,
    note_counts: noteCounts(notes),
    candidate_count: candidates.length,
    accepted_count: candidates.filter((candidate) => candidate.status === "accepted").length,
    summary,
  };
}

export function summarizeNoteText(text: string, maxLength = 96): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function parseNoteBlock(created_at: string, kind: SessionNote["kind"], lines: string[]): SessionNote {
  const textLines: string[] = [];
  const relatedFiles: string[] = [];
  let sourceRef: string | null = null;
  let inRelatedFiles = false;

  for (const line of trimOuterBlankLines(lines)) {
    // Escaped body lines round-trip verbatim and are never treated as
    // metadata, so a note body can't inject a note header, Source ref, or
    // Related files block (M20).
    const unescaped = unescapeNoteBodyLine(line);
    if (unescaped !== null) {
      inRelatedFiles = false;
      textLines.push(unescaped);
      continue;
    }

    const sourceMatch = line.match(/^Source ref:\s*(.+)$/);
    if (sourceMatch) {
      sourceRef = sourceMatch[1].trim() || null;
      inRelatedFiles = false;
      continue;
    }
    if (line.trim() === "Related files:") {
      inRelatedFiles = true;
      continue;
    }
    if (inRelatedFiles) {
      const relatedFileMatch = line.match(/^-\s+(.+)$/);
      if (relatedFileMatch) {
        relatedFiles.push(relatedFileMatch[1].trim());
        continue;
      }
      inRelatedFiles = false;
    }
    textLines.push(line);
  }

  return {
    created_at,
    kind,
    text: trimOuterBlankLines(textLines).join("\n").trim(),
    related_files: relatedFiles,
    source_ref: sourceRef,
  };
}

function formatNoteList(notes: SessionNote[], empty: string): string {
  if (notes.length === 0) return empty;
  return notes.map((note) => `- ${summarizeNoteText(note.text)}${formatRelatedFiles(note.related_files)}`).join("\n");
}

function formatRelatedFiles(relatedFiles: string[]): string {
  if (relatedFiles.length === 0) return "";
  const displayed = relatedFiles.slice(0, 3).map((file) => basename(file)).join(", ");
  return ` [${displayed}]`;
}

function formatAcceptedCandidates(candidates: CandidateTrap[]): string {
  const accepted = candidates.filter((candidate) => candidate.status === "accepted");
  if (accepted.length === 0) return "No candidate traps have been accepted yet.";
  return accepted
    .map((candidate) => `- ${candidate.id}: Trap #${candidate.accepted_trap_id} (${candidate.accepted_scope})`)
    .join("\n");
}

function isSessionNoteKind(value: string): value is SessionNote["kind"] {
  return (SESSION_NOTE_KINDS as readonly string[]).includes(value);
}

// A note body line is "structural" if, written verbatim, the notes parser
// would misread it as a note header or hoist it into Source ref / Related
// files metadata. We escape such lines (and any line already backslash-armored
// over a structural core) with a single leading backslash so the round-trip is
// lossless and a note body cannot inject metadata (M20). This protects fenced
// code too, since escaping is line-based and fence-agnostic.
function isStructuralNoteLine(line: string): boolean {
  const header = line.match(/^###\s+(\S+)\s+(\S+)\s*$/);
  if (header && isSessionNoteKind(header[2])) return true;
  if (/^Source ref:\s*(.+)$/.test(line)) return true;
  if (line.trim() === "Related files:") return true;
  return false;
}

function escapeNoteBody(text: string): string {
  return text.split("\n").map(escapeNoteBodyLine).join("\n");
}

function escapeNoteBodyLine(line: string): string {
  const core = line.replace(/^\\+/, "");
  return isStructuralNoteLine(core) ? `\\${line}` : line;
}

// Returns the unescaped line when `line` is an escaped structural line (strip
// exactly one backslash), or null when it is ordinary text to be read as-is.
function unescapeNoteBodyLine(line: string): string | null {
  if (!line.startsWith("\\")) return null;
  const core = line.replace(/^\\+/, "");
  return isStructuralNoteLine(core) ? line.slice(1) : null;
}
