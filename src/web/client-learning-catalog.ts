import { createLatestRequests } from "./browser/latest-request";
import { parseLearningLibrary, type LearningCollection, type LearningInsight, type LearningMembership } from "./browser/learning-data";
import { parseRuns } from "./client-impact-data";
import type { ObservationWebRun } from "./observation-view";
import type { LearningImpactState } from "../domain/learning-impact";
export interface LearningCatalogState {
  learningLoad: "idle" | "loading" | "ready" | "error";
  learningInsights: LearningInsight[]; learningCollections: LearningCollection[]; learningCollectionItems: LearningMembership[];
  collapsedLearningCollections: Set<string>; learningScope: "all" | "project";
  learningFilters: { query: string; status: string; sourceType: string; tag: string }; learningFiltersOpen: boolean;
  insightId: string | null; learningRuns: ObservationWebRun[]; learningRunsProjectRoot: string | null;
  learningRunsLoad: "idle" | "loading" | "ready" | "error"; learningCollectionBusy: boolean;
}
export const createLearningCatalogState = (): LearningCatalogState => ({ learningLoad: "idle", learningInsights: [], learningCollections: [], learningCollectionItems: [], collapsedLearningCollections: new Set(),
  learningScope: "all", learningFilters: { query: "", status: "", sourceType: "", tag: "" }, learningFiltersOpen: false, insightId: null,
  learningRuns: [], learningRunsProjectRoot: null, learningRunsLoad: "idle", learningCollectionBusy: false });
export function createLearningCatalog(deps: {
  state: LearningCatalogState & { projectRoot: string | null; routeInsightKey: string | null; mainView: string };
  api(path: string, options?: RequestInit): Promise<unknown>;
  current(): LearningInsight | null; revision(): number; render(): void; runsChanged(): void;
}) {
  const { state } = deps, gate = createLatestRequests();
  function reset() { gate.reset(); state.learningRuns = []; state.learningRunsProjectRoot = null; state.learningRunsLoad = "idle"; state.learningLoad = state.projectRoot ? "loading" : "idle"; }
  async function load(): Promise<void> {
    const project = state.projectRoot, scope = state.learningScope, revision = deps.revision(), latest = gate.start("catalog");
    const valid = () => latest() && state.projectRoot === project && state.learningScope === scope;
    state.learningLoad = project ? "loading" : "idle"; deps.render(); if (!project) return;
    try {
      const value = parseLearningLibrary(await deps.api("/api/insights?" + new URLSearchParams({ project, scope }), { cache: "no-store" }), project, scope);
      if (!valid()) return; if (revision !== deps.revision()) return load();
      state.learningInsights = value.insights; state.learningCollections = value.collections; state.learningCollectionItems = value.collection_items; state.learningLoad = "ready";
      if (!state.routeInsightKey && !value.insights.some(i => i.library_key === state.insightId)) state.insightId = value.insights[0]?.library_key || null;
    } catch { if (!valid()) return; if (revision !== deps.revision()) return load(); state.learningLoad = "error"; }
    deps.render(); if (state.mainView === "learning" && state.learningLoad === "ready") void runs();
  }
  async function runs() {
    const insight = deps.current(), project = insight?.origin_project_root;
    if (!project || state.learningRunsProjectRoot === project && state.learningRunsLoad !== "error") return;
    const latest = gate.start("runs"), valid = () => latest() && deps.current()?.origin_project_root === project;
    state.learningRunsLoad = "loading"; deps.runsChanged();
    try {
      const value = parseRuns(await deps.api("/api/observations/runs?" + new URLSearchParams({ project, limit: "30" }), { cache: "no-store" }), project);
      if (!valid()) return; state.learningRuns = value.runs; state.learningRunsProjectRoot = project; state.learningRunsLoad = value.availability === "unavailable" ? "error" : "ready";
    } catch { if (!valid()) return; state.learningRuns = []; state.learningRunsLoad = "error"; }
    deps.runsChanged();
  }
  function replace(key: string, impact: LearningImpactState) {
    state.learningInsights = state.learningInsights.map(item => item.library_key === key ? { ...item, learning_impact: impact, consulted_count: impact.progress.status === "learned" ? 1 : 0, last_consulted_at: impact.progress.status === "learned" ? impact.progress.updated_at : null } : item);
  }
  async function collection(action: "update" | "reorder", owner: LearningCollection, fields: { title: string } | { insightIds: string[] }) {
    if (state.learningCollectionBusy) return false;
    const selectedProject = state.projectRoot, scope = state.learningScope;
    state.learningCollectionBusy = true;
    try {
      const raw = await deps.api("/api/learning/collection/" + action, { method: "POST", body: JSON.stringify({ projectRoot: owner.origin_project_root, id: owner.id, ...fields }) });
      if (!raw || typeof raw !== "object" || !("success" in raw) || raw.success !== true || !("project_root" in raw) || raw.project_root !== owner.origin_project_root) throw new Error("Unconfirmed collection update");
      if (state.projectRoot === selectedProject && state.learningScope === scope) await load();
      return true;
    } finally { state.learningCollectionBusy = false; }
  }
  return { reset, load, runs, replace, collection };
}
