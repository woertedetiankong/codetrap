import type { ObservationOverviewWebPayload, ObservationRunWebPayload, ObservationRunsWebPayload } from "./observation-view";
import type { ObservationEvalsWebPayload } from "./evals-view";
import type { ImpactWorkbenchPayload } from "./impact-workbench-view";
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
export function parseWorkbench(raw: unknown, project: string): ImpactWorkbenchPayload {
  const v = envelope(raw, project), revisions = object(v.revisions);
  if (typeof revisions.unavailable !== "boolean") throw new Error("Invalid revision availability");
  for (const row of array(revisions.items)) {
    const r=object(row); text(r.id); text(r.title); text(r.created_at); const source=object(r.source);
    text(source.event_id); text(source.run_id); text(source.revision);
    if (!["project", "global"].includes(String(source.scope)) || !Number.isSafeInteger(source.trap_id)
      || !["draft", "accepted", "rejected", "rolled_back"].includes(String(r.status))) throw new Error("Invalid revision summary");
  }
  for (const row of array(v.issues)) { const i=object(row); text(i.id); text(i.event_id); text(i.run_id); if (!["feedback", "miss"].includes(String(i.kind))) throw new Error("Invalid issue kind"); array(i.sources).forEach(x=>{const s=object(x);text(s.run_id);text(s.event_id);text(s.feedback);}); }
  if(v.pending!==null){ const p=object(v.pending);text(p.event_id);text(p.run_id); }
  array(v.pending_run_ids).forEach(text);
  return v as unknown as ImpactWorkbenchPayload;
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
  if (v.lesson_titles !== undefined) for (const title of Object.values(object(v.lesson_titles))) text(title);
  if (v.lesson_previews !== undefined) for (const raw of Object.values(object(v.lesson_previews))) { const p = object(raw); for (const key of ["title", "context", "mistake", "fix"]) text(p[key]); array(p.tags).forEach(text); }
  if (v.improvements !== undefined) {
    const evidence = object(v.improvements);
    if (typeof evidence.unavailable !== "boolean") throw new Error("Invalid revision availability");
    for (const value of array(evidence.items)) {
      const item = object(value); text(item.id); text(item.source_revision);
      if (!["project", "global"].includes(String(item.scope)) || !Number.isSafeInteger(item.trap_id) || Number(item.trap_id) < 1
        || !["draft", "accepted", "rejected", "rolled_back"].includes(String(item.status))
        || !["passed", "failed", "untested"].includes(String(item.evaluation))
        || (item.later_runs !== null && (!Number.isSafeInteger(item.later_runs) || Number(item.later_runs) < 0))) throw new Error("Invalid revision evidence");
    }
  }
  return v as unknown as ObservationRunWebPayload;
}
export function parseEvals(raw: unknown, project: string): ObservationEvalsWebPayload {
  const v = envelope(raw, project, "observation_availability"), r = object(v.retrieval), c = object(v.controlled);
  text(r.availability); text(r.source);
  for (const key of ["total_cases", "positive_cases", "negative_cases"]) if (!Number.isSafeInteger(r[key]) || Number(r[key]) < 0) throw new Error("Invalid evaluation coverage");
  const modes = object(r.modes);
  for (const key of ["fts", "hybrid", "semantic"]) if (!Number.isSafeInteger(modes[key]) || Number(modes[key]) < 0) throw new Error("Invalid evaluation modes");
  if (r.engine !== "keyword_vector_v1" || Number(r.positive_cases) + Number(r.negative_cases) !== r.total_cases || Number(modes.fts) + Number(modes.hybrid) + Number(modes.semantic) !== r.total_cases) throw new Error("Inconsistent evaluation coverage");
  if (typeof c.can_run !== "boolean") throw new Error("Invalid evaluation availability");
  for (const p of array(c.profiles)) text(object(p).id);
  for (const e of array(c.experiments)) {
    const x = object(e); text(x.id); object(x.summary); array(x.cases);
    const snapshot = object(x.snapshot_evidence);
    if (!["ready", "unavailable"].includes(String(snapshot.availability))) throw new Error("Invalid snapshot availability");
    for (const value of array(snapshot.expected_traps)) { const trap = object(value); text(trap.title); if (!Number.isSafeInteger(trap.id) || Number(trap.id) < 1) throw new Error("Invalid snapshot lesson"); }
    if (snapshot.availability === "unavailable" && (snapshot.expected_traps as unknown[]).length) throw new Error("Unavailable snapshot has titles");
  }
  array(c.corrupt_results);
  for (const key of ["candidate_groups", "candidates"]) for (const g of array(v[key])) { const x = object(g); text(x.id); text(x.review_status); text(x.reason); }
  for (const key of ["fixture_traps", "legacy_fixture_traps"]) for (const trap of array(v[key] ?? [])) { const x = object(trap); text(x.title); if (!Number.isSafeInteger(x.id)) throw new Error("Invalid evaluation lesson"); }
  if (v.observed !== null) object(v.observed);
  return v as unknown as ObservationEvalsWebPayload;
}
