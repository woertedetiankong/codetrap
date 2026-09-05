import type { ObservationOverviewWebPayload, ObservationRunWebPayload, ObservationRunsWebPayload } from "./observation-view";
import type { ObservationEvalsWebPayload } from "./evals-view";
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid observation response"); return v as Record<string, unknown>; };
const array = (v: unknown): unknown[] => { if (!Array.isArray(v)) throw new Error("Invalid observation list"); return v; };
const text = (v: unknown) => { if (typeof v !== "string") throw new Error("Invalid observation text"); };
function envelope(raw: unknown, project: string, availability = "availability") {
  const v = object(raw);
  if (v.project_root !== project || !["ready", "not_configured", "unavailable"].includes(String(v[availability]))) throw new Error("Observation project identity mismatch");
  return v;
}
function runs(v: unknown) { for (const value of array(v)) { const r = object(value); text(r.id); if (r.status !== null) text(r.status); text(r.completeness); if (typeof r.event_count !== "number") throw new Error("Invalid Run count"); } }
export function parseRuns(raw: unknown, project: string): ObservationRunsWebPayload {
  const v = envelope(raw, project); runs(v.runs); return v as unknown as ObservationRunsWebPayload;
}
export function parseOverview(raw: unknown, project: string): ObservationOverviewWebPayload {
  const v = envelope(raw, project); runs(v.recent_runs);
  if (v.overview !== null) { const o = object(v.overview); for (const key of ["total_events", "total_runs", "completed_runs", "search_count", "exposure_count", "validation_passed", "validation_failed"]) if (typeof o[key] !== "number") throw new Error("Invalid overview count"); object(o.evidence); }
  if (v.connection) { const c = object(v.connection); text(c.state); array(c.clients).forEach(object); }
  if (v.hook_health) object(v.hook_health);
  return v as unknown as ObservationOverviewWebPayload;
}
export function parseRun(raw: unknown, project: string, id: string): ObservationRunWebPayload {
  const v = envelope(raw, project);
  if (v.run !== null) { runs([v.run]); if (object(v.run).id !== id) throw new Error("Observation Run identity mismatch"); }
  for (const event of array(v.timeline)) { const e = object(event); text(e.type); text(e.occurred_at); object(e.facts); if (!Number.isSafeInteger(e.seq)) throw new Error("Invalid event order"); }
  return v as unknown as ObservationRunWebPayload;
}
export function parseEvals(raw: unknown, project: string): ObservationEvalsWebPayload {
  const v = envelope(raw, project, "observation_availability"), r = object(v.retrieval), c = object(v.controlled);
  text(r.availability); text(r.source);
  if (typeof c.can_run !== "boolean") throw new Error("Invalid evaluation availability");
  for (const p of array(c.profiles)) text(object(p).id);
  for (const e of array(c.experiments)) { const x = object(e); text(x.id); object(x.summary); array(x.cases); }
  array(c.corrupt_results);
  for (const key of ["candidate_groups", "candidates"]) for (const g of array(v[key])) { const x = object(g); text(x.id); text(x.review_status); text(x.reason); }
  for (const key of ["fixture_traps", "legacy_fixture_traps"]) for (const trap of array(v[key] ?? [])) { const x = object(trap); text(x.title); if (!Number.isSafeInteger(x.id)) throw new Error("Invalid evaluation lesson"); }
  if (v.observed !== null) object(v.observed);
  return v as unknown as ObservationEvalsWebPayload;
}
