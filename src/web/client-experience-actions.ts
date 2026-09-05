// Transitional business-state adapter; dependencies are real runtime values.
interface Dependencies {
  state: any;
  el(id: string): any;
  t(key: string, params?: Record<string, unknown>): string;
  escapeHtml(value: unknown): string;
  api(path: string, options?: RequestInit): Promise<any>;
  resetLibrary(): void;
  resetReview(): void;
  currentLearningInsight(): any;
  learningProgress(insight: any): any;
  snapshotLearningDraftFromDom(): void;
  captureLearningScrollPosition(): number;
  replaceLearningImpact(key: string, impact: any, scroll: number): void;
  renderLearningDetail(): void;
  restoreLearningScrollPosition(scroll: number): void;
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
  const { el, t, escapeHtml, api, resetLibrary, resetReview, currentLearningInsight, learningProgress, snapshotLearningDraftFromDom, captureLearningScrollPosition, replaceLearningImpact, renderLearningDetail, restoreLearningScrollPosition, showStatus, resetObservationState, renderProjects, renderSessions, renderActiveView, revealCompactDetail, jumpToTrap, loadImpactRun, loadLearningInsights, selectLearningInsight } = deps;
function renderLearningPractice(insight: any): string {
  const draft = state.practiceDrafts.get(insight.library_key);
  const saved = learningProgress(insight).practice_note || "";
  const value = draft === undefined ? saved : draft;
  return `<section class="section learning-practice"><div class="learning-impact-heading"><div><div class="eyebrow">${escapeHtml(t("experience.practiceKicker"))}</div><h3><label for="learning-practice-note">${escapeHtml(t("experience.practiceTitle"))}</label></h3></div><span class="pill scope">${escapeHtml(t("learningImpact.private"))}</span></div>
    <p id="learning-practice-hint">${escapeHtml(t("experience.practiceHint"))}</p>
    <textarea id="learning-practice-note" rows="3" maxlength="1000" aria-describedby="learning-practice-hint" placeholder="${escapeHtml(t("experience.practicePlaceholder"))}">${escapeHtml(value)}</textarea>
    <div class="learning-practice-footer"><span id="learning-practice-state" role="status">${escapeHtml(t(value !== saved ? "experience.unsaved" : "experience.saved"))}</span><button type="button" class="primary" id="save-learning-practice" ${state.practiceSaving ? "disabled" : ""}>${escapeHtml(t(state.practiceSaving ? "experience.saving" : "experience.savePractice"))}</button></div></section>`;
}

function bindLearningPractice(): void {
  const insight = currentLearningInsight();
  const input = el("learning-practice-note");
  if (!input || !insight) return;
  input.addEventListener("input", () => {
    state.practiceDrafts.set(insight.library_key, input.value);
    el("learning-practice-state").textContent = t(input.value !== (learningProgress(insight).practice_note || "") ? "experience.unsaved" : "experience.saved");
  });
  el("save-learning-practice")?.addEventListener("click", saveLearningPractice);
}

async function saveLearningPractice(): Promise<void> {
  const insight = currentLearningInsight();
  const input = el("learning-practice-note");
  if (!insight || !input || state.practiceSaving || state.detailActionInFlight) return;
  const value = input.value;
  const scroll = captureLearningScrollPosition();
  state.practiceDrafts.set(insight.library_key, value);
  snapshotLearningDraftFromDom();
  state.practiceSaving = true;
  state.detailActionInFlight = true;
  el("save-learning-practice").disabled = true;
  el("save-learning-practice").textContent = t("experience.saving");
  try {
    const impact = await api("/api/learning/practice-note", { method: "POST", body: JSON.stringify({ projectRoot: insight.origin_project_root, id: insight.id, practiceNote: value || null }) });
    // A user can keep editing or change chapters while the save is in flight.
    if (state.practiceDrafts.get(insight.library_key) === value) state.practiceDrafts.delete(insight.library_key);
    snapshotLearningDraftFromDom();
    replaceLearningImpact(insight.library_key, impact, scroll);
    showStatus(t("experience.practiceSaved"));
  } catch (error) {
    showStatus((error as Error).message, true);
  } finally {
    state.practiceSaving = false;
    state.detailActionInFlight = false;
    if (state.mainView === "learning") {
      const position = captureLearningScrollPosition();
      snapshotLearningDraftFromDom();
      renderLearningDetail();
      restoreLearningScrollPosition(position);
    }
  }
}

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
  const runId = learningProgress(insight).linked_run_id;
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


return { renderLearningPractice, bindLearningPractice, selectExperienceProject, openLearningConfirmedTrap, openLearningLinkedRun, openExperienceRun, openExperienceInsight };
}
