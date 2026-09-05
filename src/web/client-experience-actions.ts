// Transitional business-state adapter; dependencies are real runtime values.
interface Dependencies {
  state: any;
  t(key: string, params?: Record<string, unknown>): string;
  resetLibrary(): void;
  resetReview(): void;
  currentLearningInsight(): any;
  snapshotLearningDraftFromDom(): void;
  showStatus(message: string, error?: boolean): void;
  resetObservationState(): void;
  renderProjects(): void;
  renderSessions(): void;
  renderActiveView(): void;
  revealCompactDetail(): void;
  jumpToTrap(scope: string, id: number): Promise<void>;
  loadImpactRun(id: string): Promise<void>;
  loadLearningInsights(): Promise<void>;
  selectLearningInsight(key: string): void;
}
export function createExperienceActions(deps: Dependencies) {
  const { state } = deps;
  const { t, resetLibrary, resetReview, currentLearningInsight, snapshotLearningDraftFromDom, showStatus, resetObservationState, renderProjects, renderSessions, renderActiveView, revealCompactDetail, jumpToTrap, loadImpactRun, loadLearningInsights, selectLearningInsight } = deps;
function selectExperienceProject(project: string): void {
  if (state.projectRoot === project) return;
  state.projectRoot = project;
  resetReview();
  resetLibrary();
  resetObservationState();
  renderProjects();
  renderSessions();
}

async function openLearningConfirmedTrap(): Promise<void> {
  const insight = currentLearningInsight();
  const promotion = insight?.learning_impact?.promotion;
  if (!insight || promotion?.status !== "accepted" || !promotion.accepted_trap_id || !promotion.accepted_scope) return;
  snapshotLearningDraftFromDom();
  selectExperienceProject(insight.origin_project_root);
  try { await jumpToTrap(promotion.accepted_scope, promotion.accepted_trap_id); }
  catch (error) { showStatus((error as Error).message, true); }
}

async function openLearningLinkedRun(): Promise<void> {
  const insight = currentLearningInsight();
  const runId = insight?.learning_impact?.progress?.linked_run_id;
  if (insight && runId) await openExperienceRun(insight.origin_project_root, runId);
}

async function openExperienceRun(project: string, runId: string): Promise<void> {
  snapshotLearningDraftFromDom();
  selectExperienceProject(project);
  state.mainView = "impact";
  state.impactView = "runs";
  state.observationRunId = runId;
  state.observationRunDetail = null;
  renderActiveView();
  revealCompactDetail();
  await loadImpactRun(runId);
}

async function openExperienceInsight(project: string, id: string): Promise<void> {
  selectExperienceProject(project);
  state.mainView = "learning";
  state.learningScope = "project";
  state.learningFilters = { query: "", status: "", sourceType: "", tag: "" };
  state.insightId = project + "::" + id;
  state.routeInsightKey = state.insightId;
  state.compactDetail = true;
  renderActiveView();
  try {
    await loadLearningInsights();
    if (state.mainView !== "learning" || state.projectRoot !== project) return;
    if (!state.learningInsights.some((item: any) => item.id === id && item.origin_project_root === project)) {
      showStatus(t("experience.sourceMissing"), true);
      return;
    }
    selectLearningInsight(project + "::" + id);
  } catch (error) { showStatus((error as Error).message, true); }
}


return { selectExperienceProject, openLearningConfirmedTrap, openLearningLinkedRun, openExperienceRun, openExperienceInsight };
}
