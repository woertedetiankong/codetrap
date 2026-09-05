import { createLatestRequests } from "./browser/latest-request";
import { parseEvals, parseOverview, parseRun } from "./client-impact-data";
import type { ImpactState } from "./client-impact-state";
export function createImpactRequests(deps: {
  state: ImpactState & { projectRoot: string | null; mainView: string };
  api(path: string, options?: RequestInit): Promise<unknown>;
  changed(background: boolean): void;
  route(): void;
}) {
  const { state } = deps, gate = createLatestRequests();
  const loading = new Set<string>();
  function reset() { gate.reset(); loading.clear(); }
  const signature = () => JSON.stringify([state.observationAvailability, state.observationOverview, state.observationConnection, state.observationHookHealth, state.observationRuns, state.observationRunDetail, state.observationEvals, state.evalExternalChangesDeferred, state.observationError]);
  async function read(kind: "overview" | "evals" | "run", background = false, runId = state.observationRunId) {
    const project = state.projectRoot;
    if (!project || kind === "run" && !runId) return;
    const latest = gate.start(kind), view = state.impactView, before = signature();
    const valid = () => latest() && state.projectRoot === project && (kind !== "run" || state.observationRunId === runId && state.impactView === "runs");
    if (!background) { loading.add(kind); state.observationLoading = true; state.observationError = ""; deps.changed(false); }
    try {
      const params = new URLSearchParams({ project, ...(kind === "run" ? { id: runId! } : { limit: "100" }) });
      const raw = await deps.api("/api/observations/" + kind + "?" + params, { cache: "no-store" });
      if (!valid()) return;
      if (kind === "overview") {
        const value = parseOverview(raw, project);
        state.observationAvailability = value.availability; state.observationOverview = value.overview;
        state.observationConnection = value.connection; state.observationHookHealth = value.hook_health; state.observationRuns = value.recent_runs;
        if (value.recent_runs.length) state.observationDemoRun = null;
        if (!background && state.impactView === "runs" && !state.observationRunId && value.recent_runs[0]) { state.observationRunId = value.recent_runs[0].id; deps.route(); }
      } else if (kind === "run") state.observationRunDetail = parseRun(raw, project, runId!);
      else {
        const value = parseEvals(raw, project);
        if (background && state.evalReviewDraft && JSON.stringify(value) !== JSON.stringify(state.observationEvals)) { state.evalExternalChangesDeferred = true; return; }
        state.observationEvals = value; state.observationEvalsProjectRoot = project; state.evalExternalChangesDeferred = false;
        if (!value.controlled.experiments.some(e => e.id === state.controlledEvalExperimentId)) state.controlledEvalExperimentId = value.controlled.experiments[0]?.id || null;
      }
      if (state.impactView === view) state.observationError = "";
    } catch (error) { if (valid() && state.impactView === view) state.observationError = error instanceof Error ? error.message : String(error); }
    finally {
      if (latest()) loading.delete(kind);
      state.observationLoading = loading.size > 0;
      if (valid() && state.mainView === "impact" && (state.impactView === view || kind === "overview") && (!background || before !== signature())) deps.changed(background);
    }
  }
  return { reset, read };
}
