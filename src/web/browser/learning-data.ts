import type { LearningAgentCandidateDraft, LearningImpactState } from "../../domain/learning-impact";
export type LearningTarget = { project: string; id: string; title: string; libraryKey: string };
export type LearningFields = Record<keyof LearningAgentCandidateDraft, string>;
export interface LearningInsight {
  id: string; origin_project_root: string; origin_project_name: string; library_key: string; title: string;
  summary: string; body: string; tags: string[]; source_refs: string[]; learning_impact: LearningImpactState;
  [key: string]: unknown;
}
export interface LearningCollection extends Record<string, unknown> { id: string; library_key: string; origin_project_root: string; title: string; updated_at: string; source_type?: string }
export interface LearningMembership extends Record<string, unknown> { collection_id: string; insight_id: string; collection_key: string; insight_key: string; origin_project_root: string; position: number }
export const targetOf = (insight: LearningInsight): LearningTarget => ({ project: insight.origin_project_root, id: insight.id, title: insight.title, libraryKey: insight.library_key });
export const learningKey = (target: LearningTarget) => JSON.stringify([target.project, target.id]);
const obj = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid Learning response"); return v as Record<string, unknown>; };
const text = (v: unknown): string => { if (typeof v !== "string") throw new Error("Invalid Learning field"); return v; };
const list = (v: unknown): string[] => { if (!Array.isArray(v)) throw new Error("Invalid Learning list"); return v.map(text); };
function identity(value: Record<string, unknown>, target: LearningTarget) {
  if (value.project_root !== target.project || value.insight_id !== target.id) throw new Error("Learning response identity mismatch");
}
export function parseImpact(raw: unknown, target: LearningTarget, envelope = true): LearningImpactState {
  const v = obj(raw), p = obj(v.progress);
  if ((envelope && v.project_root !== target.project) || p.insight_id !== target.id) throw new Error("Learning progress identity mismatch");
  if (!["not_started", "in_progress", "learned"].includes(text(p.status)) || ![null, "helpful", "unclear", "outdated"].includes(p.feedback as string | null)) throw new Error("Invalid Learning progress");
  for (const key of ["actor_ref", "updated_at"]) text(p[key]);
  for (const key of ["linked_run_id", "practice_note"]) if (p[key] !== null) text(p[key]);
  if (typeof p.legacy_derived !== "boolean") throw new Error("Invalid Learning progress origin");
  if (v.promotion !== null) {
    const promotion = obj(v.promotion); text(promotion.session_id); text(promotion.candidate_id);
    if (!["proposed", "accepted", "rejected", "missing"].includes(text(promotion.status))) throw new Error("Invalid Learning promotion");
    if (promotion.accepted_trap_id !== null && (!Number.isSafeInteger(promotion.accepted_trap_id) || Number(promotion.accepted_trap_id) < 1)) throw new Error("Invalid promoted lesson");
    if (![null, "project", "global"].includes(promotion.accepted_scope as string | null)) throw new Error("Invalid promoted scope");
  }
  return v as unknown as LearningImpactState;
}
export function parsePreview(raw: unknown, target: LearningTarget): LearningAgentCandidateDraft {
  const v = obj(raw); identity(v, target);
  if (v.success !== true || v.destination !== "candidate_inbox") throw new Error("Unconfirmed Learning preview");
  const d = obj(v.draft);
  for (const key of ["title", "context", "mistake", "fix"]) text(d[key]);
  if (!["project", "global"].includes(text(d.scope))) throw new Error("Invalid Learning scope");
  list(d.tags); list(d.path_globs); if (d.module !== null) text(d.module);
  return d as LearningAgentCandidateDraft;
}
export function parseCreation(raw: unknown, target: LearningTarget) {
  const v = obj(raw); identity(v, target); const candidate = obj(v.candidate);
  if (v.success !== true || v.destination !== "candidate_inbox" || !["proposed", "accepted", "rejected"].includes(text(candidate.status))) throw new Error("Unconfirmed Learning candidate");
  return { sessionId: text(v.session_id), candidateId: text(candidate.id), title: text(candidate.title) };
}
export const draftFields = (draft: LearningAgentCandidateDraft): LearningFields => ({ ...draft, tags: draft.tags.join(", "), path_globs: draft.path_globs.join(", "), module: draft.module || "" });
export function draftPayload(fields: LearningFields): LearningAgentCandidateDraft {
  const split = (s: string) => s.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  return { ...fields, scope: fields.scope === "global" ? "global" : "project", tags: split(fields.tags), path_globs: split(fields.path_globs), module: fields.module.trim() || null };
}
export function parseLearningLibrary(raw: unknown, project: string, scope: string) {
  const v = obj(raw);
  if (v.project_root !== project || v.scope !== scope || !Array.isArray(v.insights) || !Array.isArray(v.collections) || !Array.isArray(v.collection_items)) throw new Error("Learning library identity mismatch");
  const insights = v.insights.map(raw => {
    const i = obj(raw);
    for (const k of ["id", "origin_project_root", "origin_project_name", "library_key", "title", "summary", "body"]) text(i[k]);
    list(i.tags); list(i.source_refs);
    if (i.library_key !== i.origin_project_root + "::" + i.id || (scope === "project" && i.origin_project_root !== project)) throw new Error("Learning source mismatch");
    parseImpact(i.learning_impact, targetOf(i as unknown as LearningInsight), false);
    return i as unknown as LearningInsight;
  });
  if (new Set(insights.map(i => i.library_key)).size !== insights.length) throw new Error("Duplicate Learning identity");
  const collections = v.collections.map(raw => {
    const c = obj(raw); for (const k of ["id", "library_key", "origin_project_root", "title", "updated_at"]) text(c[k]);
    if (c.library_key !== c.origin_project_root + "::" + c.id || scope === "project" && c.origin_project_root !== project) throw new Error("Learning collection source mismatch");
    return c as LearningCollection;
  });
  const collectionKeys = new Set(collections.map(c => c.library_key)), insightKeys = new Set(insights.map(i => i.library_key));
  const collection_items = v.collection_items.map(raw => {
    const m = obj(raw); for (const k of ["collection_id", "insight_id", "collection_key", "insight_key", "origin_project_root"]) text(m[k]);
    if (m.collection_key !== m.origin_project_root + "::" + m.collection_id || m.insight_key !== m.origin_project_root + "::" + m.insight_id || !collectionKeys.has(String(m.collection_key)) || !insightKeys.has(String(m.insight_key)) || !Number.isSafeInteger(m.position)) throw new Error("Learning membership source mismatch");
    return m as LearningMembership;
  });
  return { insights, collections, collection_items };
}
