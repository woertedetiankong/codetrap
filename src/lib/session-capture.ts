import type { CandidateTrap, SessionMetadata, SessionNote } from "../domain/session";
import { CATEGORIES, SCOPES, SEVERITIES, type Category, type Scope, type Severity } from "./constants";
import { scoreCandidateTrap } from "./trap-quality";

type CandidateDraft = Pick<CandidateTrap, "trap" | "evidence">;

export function proposeCandidateTraps(session: SessionMetadata, notes: SessionNote[]): CandidateTrap[] {
  const candidates: CandidateTrap[] = [];
  for (const note of notes) {
    const draft = explicitTrapDraft(session, note);
    if (!draft) continue;

    const scored = scoreCandidateTrap(draft);
    candidates.push({
      id: `cand-${String(candidates.length + 1).padStart(3, "0")}`,
      status: "proposed",
      quality_score: scored.score,
      quality: scored.quality,
      ...draft,
    });
  }
  return candidates;
}

function explicitTrapDraft(session: SessionMetadata, note: SessionNote): CandidateDraft | null {
  const fields = parseLabeledFields(note.text);
  const title = fields.title ?? fields.trap_title;
  const context = fields.context ?? fields.trigger;
  const mistake = fields.mistake ?? fields.avoid;
  const fix = fields.fix ?? fields.do_instead;
  if (!title || !context || !mistake || !fix) return null;

  return {
    trap: {
      title,
      category: parseCategory(fields.category),
      scope: parseScope(fields.scope),
      context,
      mistake,
      fix,
      severity: parseSeverity(fields.severity),
      tags: splitList(fields.tags),
      path_globs: splitList(fields.path_globs ?? fields.paths ?? fields.related_files) || note.related_files,
      module: fields.module ?? session.module,
      owner: fields.owner ?? session.owner,
    },
    evidence: [evidenceFromNote(session, note, "Captured from explicit session candidate fields.")],
  };
}

function evidenceFromNote(session: SessionMetadata, note: SessionNote, noteText: string) {
  return {
    source_type: note.kind === "test_failure" ? "test_failure" : "conversation",
    source_ref: note.source_ref ?? `session:${session.id}`,
    related_files: note.related_files,
    note: noteText,
  };
}

function parseLabeledFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 _-]{1,40}):\s*(.+)$/);
    if (!match) continue;
    fields[normalizeFieldName(match[1])] = match[2].trim();
  }
  return fields;
}

function normalizeFieldName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function splitList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function parseCategory(value: string | undefined): Category {
  if (value && (CATEGORIES as readonly string[]).includes(value)) return value as Category;
  return "other";
}

function parseSeverity(value: string | undefined): Severity {
  if (value && (SEVERITIES as readonly string[]).includes(value)) return value as Severity;
  return "warning";
}

function parseScope(value: string | undefined): Scope {
  if (value && (SCOPES as readonly string[]).includes(value)) return value as Scope;
  return "project";
}
