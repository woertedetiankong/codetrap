import type { LibraryDetail, LibraryList, LibraryScope, LibraryTrap, TrapExperienceWebPayload } from "../client-library-contract";

// Validate the consumed transport fields. Unknown extra server fields are ignored.
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Library response");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid Library text");
  return value;
}
function nullable(value: unknown): string | null { return value === null ? null : string(value); }
function count(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) throw new Error("Invalid Library number");
  return value;
}
function array<T>(value: unknown, decode: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Invalid Library list");
  return value.map(decode);
}
function choice<const T extends readonly string[]>(value: unknown, choices: T): T[number] {
  if (typeof value !== "string" || !choices.includes(value)) throw new Error("Invalid Library status");
  return value as T[number];
}
function optionalChoice<const T extends readonly string[]>(value: unknown, choices: T): T[number] | null {
  return value === null ? null : choice(value, choices);
}
function scope(value: unknown): LibraryScope { return choice(value, ["project", "global"]); }
function trap(value: unknown): LibraryTrap {
  const v = object(value);
  return {
    id: count(v.id, 1), scope: scope(v.scope), title: string(v.title), category: string(v.category),
    severity: string(v.severity), status: choice(v.status, ["active", "archived", "superseded"]),
    context: string(v.context), mistake: string(v.mistake), fix: string(v.fix),
    tags: array(v.tags, string), path_globs: array(v.path_globs, string),
    module: nullable(v.module), owner: nullable(v.owner), hit_count: count(v.hit_count), useful_count: count(v.useful_count),
    last_validated: nullable(v.last_validated), created_at: string(v.created_at), updated_at: string(v.updated_at),
    state_key: nullable(v.state_key), supersedes_id: v.supersedes_id === null ? null : count(v.supersedes_id, 1),
    valid_from: string(v.valid_from), valid_until: nullable(v.valid_until), before_code: nullable(v.before_code), after_code: nullable(v.after_code),
  };
}
export function parseLibraryList(value: unknown, project: string): LibraryList {
  const v = object(value);
  if (v.project_root !== project) throw new Error("Library project mismatch");
  const traps = array(v.traps, trap);
  if (new Set(traps.map(item => `${item.scope}:${item.id}`)).size !== traps.length) throw new Error("Duplicate Library identity");
  return { project_root: project, traps };
}
export function parseLibraryDetail(value: unknown, expected: Pick<LibraryTrap, "scope" | "id">): LibraryDetail {
  const v = object(value), item = trap(v.trap);
  if (scope(v.scope) !== expected.scope || item.scope !== expected.scope || item.id !== expected.id) throw new Error("Library lesson mismatch");
  return { scope: expected.scope, trap: item, evidence: array(v.evidence, entry => {
    const e = object(entry);
    return { source_type: string(e.source_type), source_ref: nullable(e.source_ref), note: nullable(e.note), related_files: array(e.related_files, string) };
  }) };
}
export function parseLibraryExperience(value: unknown, project: string, expected: Pick<LibraryTrap, "scope" | "id">, offset: number): TrapExperienceWebPayload {
  const v = object(value), item = object(v.trap), sources = object(v.sources), o = object(v.observations);
  if (v.project_root !== project || item.scope !== expected.scope || item.id !== expected.id || o.offset !== offset) throw new Error("Library experience mismatch");
  if (typeof o.has_more !== "boolean") throw new Error("Invalid Library pagination");
  return { project_root: project, trap: { id: expected.id, scope: expected.scope },
    sources: { availability: choice(sources.availability, ["ready", "unavailable"]), insights: array(sources.insights, entry => {
      const s = object(entry);
      return { insight_id: string(s.insight_id), title: string(s.title), session_id: string(s.session_id), candidate_id: string(s.candidate_id) };
    }) },
    observations: {
      availability: choice(o.availability, ["ready", "not_configured", "unavailable"]),
      exposure_count: count(o.exposure_count), current_revision_exposures: count(o.current_revision_exposures), other_revision_exposures: count(o.other_revision_exposures),
      run_count: count(o.run_count), helpful: count(o.helpful), irrelevant: count(o.irrelevant), harmful: count(o.harmful), miss_reports: count(o.miss_reports), superseded_feedback: count(o.superseded_feedback),
      offset: count(o.offset), limit: count(o.limit, 1), has_more: o.has_more,
      runs: array(o.runs, entry => {
        const r = object(entry);
        return { id: string(r.id), source_client: optionalChoice(r.source_client, ["codex", "claude-code", "other"]), started_at: nullable(r.started_at),
          status: optionalChoice(r.status, ["completed", "failed", "cancelled", "unknown"]), completeness: choice(r.completeness, ["complete", "partial", "unknown"]),
          latest_validation_status: optionalChoice(r.latest_validation_status, ["passed", "failed", "cancelled", "unknown"]),
          exposure_count: count(r.exposure_count), current_revision_exposures: count(r.current_revision_exposures), other_revision_exposures: count(r.other_revision_exposures),
          feedback: optionalChoice(r.feedback, ["helpful", "irrelevant", "harmful", "should_have_matched"]), miss_reports: count(r.miss_reports) };
      }),
    },
  };
}
