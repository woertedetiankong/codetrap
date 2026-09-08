import { createImpactApp } from "./client-impact-app";
import { evalCoverage, evalExperimentResult, evalCaseDetail } from "./client-eval-workbench";
import { createFormDrafts } from "./browser/form-drafts";
import type { FormFields } from "./browser/form-draft-store";
import type { createEvalSuiteUI } from "./client-eval-suite";
import type { createRevisionUI } from "./client-revisions";

import type { ImpactState } from "./client-impact-state";
// Rendering remains separate from typed state and request ownership.
interface Dependencies {
  state: ImpactState & { projectRoot: string; mainView: string; locale: string; projects: Array<{root:string;name:string}> };
  selectProject(root: string): void;
  evalSuiteUI: ReturnType<typeof createEvalSuiteUI>;
  revisionUI: ReturnType<typeof createRevisionUI>;
  el(id: string): any;
  t(key: string, params?: Record<string, unknown>): string;
  escapeHtml(value: unknown): string;
  escapeAttr(value: unknown): string;
  valueLabel(value: unknown): string;
  formatDisplayDate(value: unknown): string;
  api(path: string, options?: Record<string, unknown>): Promise<any>;
  syncWorkspaceRoute(replace?: boolean): void;
  showStatus(message: string, isError?: boolean): void;
  captureImpactScrollPosition(): { detail: number; queue: number };
  restoreImpactScrollPosition(position: { detail: number; queue: number }): void;
  loadImpactRun(runId: string): Promise<void>;
  loadImpactEvals(): Promise<void>;
  loadImpact(): Promise<void>;
  jumpToTrap(scope: string, id: string | number): Promise<void>;
}
export function createImpactUI(deps: Dependencies) {
  const { state, evalSuiteUI, revisionUI, el, t, escapeHtml, escapeAttr, valueLabel, formatDisplayDate, api, syncWorkspaceRoute, showStatus, captureImpactScrollPosition, restoreImpactScrollPosition, loadImpactRun, loadImpactEvals, loadImpact, jumpToTrap } = deps;
  const apple = createImpactApp({ state, api, t, escape: escapeHtml, date: formatDisplayDate, value: valueLabel,
    route: () => syncWorkspaceRoute(), refresh: loadImpact, run: loadImpactRun, selectProject: deps.selectProject, trap: jumpToTrap,
    snapshot: snapshotEvalReviewDraftFromDom, feedback: revisionUI.recordFeedback, loadEvaluation: loadImpactEvals,
    retrieval: () => state.observationEvals ? `<p class="ia-muted">${escapeHtml(t("bench.boundary"))}</p>${evalCoverage(state.observationEvals.retrieval, evalUI)}${renderControlledEvals(state.observationEvals.controlled)}<details class="ia-disclosure" data-eval-disclosure="suite"><summary>${escapeHtml(t("bench.maintain"))}</summary><section id="eval-suite-panel"></section></details>` : `<p>${escapeHtml(t("impact.loading"))}</p>`,
    review: () => state.observationEvals ? `${evalCandidateFilters()}<div class="eval-candidate-list">${filteredEvalCandidates().map(renderEvalCandidate).join("") || escapeHtml(t("evals.candidatesEmpty"))}</div>${renderEvalReviewPanel(selectedEvalCandidate(),state.observationEvals)}` : `<p>${escapeHtml(t("impact.loading"))}</p>`,
    bindEvaluation: () => { bindEvalControls(); bindControlledEvalControls(); mountEvalRecovery(); bindEvalDisclosures(); const panel=el("eval-suite-panel"); if(panel)void evalSuiteUI.mount(panel,state.projectRoot); }
  });
  const backups = createFormDrafts(t);
  const evalDisclosures = new Map<string, boolean>();
  const evalUI = { t, escapeHtml, escapeAttr, formatDisplayDate };
  const candidateDrafts = new Map<string, { fields: FormFields; context: string }>();
  const runDrafts = new Map<string, { fields: FormFields; context: string }>();
  const candidateKey = (project: string, id: string) => JSON.stringify([project, id]);
  const suiteContext = () => JSON.stringify({ source: state.observationEvals?.retrieval.source, sha: state.observationEvals?.retrieval.sha256, traps: state.observationEvals?.fixture_traps, legacy: state.observationEvals?.legacy_fixture_traps, legacySha: state.observationEvals?.legacy_fixture_sha256 });
  const reviewContext = (candidate: any) => JSON.stringify([suiteContext(), candidate?.review_status, candidate?.review_ref, candidate?.draft_case, candidate?.fixture_path]);
  const runContext = () => JSON.stringify([suiteContext(), state.observationEvals?.controlled.profiles]);
  function installCandidateFields(id: string, fields: FormFields) {
    state.evalReviewDraft = { candidateId: id, case: { query: fields.query || "", mode: fields.mode || "hybrid", judgment: fields.judgment || "miss", goldTrapIds: JSON.parse(fields.goldTrapIds || "[]"), note: fields.note || "" }, rejectionReason: fields.rejectionReason || "" };
    state.evalReviewPreview = null;
  }
  function mountEvalRecovery() {
    const candidate = selectedEvalCandidate(), project = state.projectRoot;
    const panel = document.querySelector<HTMLElement>(".eval-review-workbench");
    if (panel && candidate && project) {
      const host = document.createElement("div"); panel.prepend(host);
      backups.mount(host, () => {
        const current = selectedEvalCandidate();
        if (!current || state.projectRoot !== project || current.id !== candidate.id) return null;
        return { form: "eval-candidate", owner: [project, candidate.id], context: reviewContext(current), active: !!state.evalReviewDraft && state.evalReviewDraft.candidateId === candidate.id, editable: ["review_required", "draft", "rolled_back"].includes(current.review_status), busy: state.evalReviewBusy,
          discard: () => { candidateDrafts.delete(candidateKey(project, candidate.id)); state.evalReviewDraft = null; state.evalReviewPreview = null; backups.remember("eval-candidate", [project, candidate.id], "cleared", null); renderImpactDetailKeepingScroll(); },
          restore: fields => { candidateDrafts.set(candidateKey(project, candidate.id), { fields, context: reviewContext(current) }); backups.remember("eval-candidate", [project, candidate.id], reviewContext(current), fields); installCandidateFields(candidate.id, fields); renderImpactDetailKeepingScroll(); } };
      });
    }
    const form = document.querySelector<HTMLFormElement>("[data-controlled-eval-form]");
    if (form && project) {
      const entry = runDrafts.get(project);
      if (entry) for (const [name, value] of Object.entries(entry.fields)) { const c = form.elements.namedItem(name); if (c instanceof HTMLInputElement || c instanceof HTMLSelectElement) c.value = value; }
      const host = document.createElement("div"); form.before(host);
      backups.mount(host, () => state.projectRoot !== project ? null : { form: "eval-run", owner: [project], context: runContext(), active: runDrafts.has(project), editable: !!state.observationEvals?.controlled.can_run, busy: state.controlledEvalBusy,
        discard: () => { runDrafts.delete(project); backups.remember("eval-run", [project], "cleared", null); state.controlledEvalProfile = "memory_contribution_v1"; state.controlledEvalTrials = 2; state.controlledEvalSeed = "codetrap-controlled-v1"; renderImpactDetailKeepingScroll(); },
        restore: fields => { runDrafts.set(project, { fields, context: runContext() }); backups.remember("eval-run", [project], runContext(), fields); state.controlledEvalProfile = fields.profile; state.controlledEvalTrials = Number(fields.trials); state.controlledEvalSeed = fields.seed; renderImpactDetailKeepingScroll(); } });
      form.addEventListener("input", () => {
        const data = new FormData(form), fields = { profile: String(data.get("profile") || ""), trials: String(data.get("trials") || ""), seed: String(data.get("seed") || "") };
        const context = runDrafts.get(project)?.context || runContext(); runDrafts.set(project, { fields, context }); backups.remember("eval-run", [project], context, fields);
      });
    }
  }
  window.addEventListener("beforeunload", event => { if (!backups.safeToLeave() || state.evalReviewBusy || state.controlledEvalBusy) { event.preventDefault(); event.returnValue = ""; } });
function renderImpactQueue() {}

/**
 * Name a Run by what a person can act on — when it ran, which client, how long
 * it took. The opaque id stays on the page, but as identity rather than as the
 * largest text on it.
 */
function impactRunHeadline(run: any) {
  const when = run.started_at ? impactRelativeTime(run.started_at) : t("impact.noStart");
  return t("impact.runHeadline", {
    client: run.source_client || "other",
    when,
    duration: impactDuration(run.duration_ms),
  });
}

function syncImpactOverviewLayout() {
  const shell = document.querySelector(".shell");
  shell?.classList.remove("impact-overview-mode", "impact-evals-mode");
  shell?.classList.toggle("impact-apple-mode", state.mainView === "impact");
}
function renderImpactDetail() { syncImpactOverviewLayout(); apple.render(); }

/**
 * Re-render the detail pane in place. Filtering or selecting inside a view
 * rebuilds `#detail` wholesale, which would otherwise drop the scroll
 * container back to the top and carry the control the user just clicked off
 * screen.
 */
function renderImpactDetailKeepingScroll() {
  const position = captureImpactScrollPosition();
  renderImpactDetail();
  restoreImpactScrollPosition(position);
}

function bindEvalDisclosures() {
  const project = state.projectRoot;
  document.querySelectorAll<HTMLDetailsElement>("[data-eval-disclosure]").forEach(section => {
    const key = JSON.stringify([project, section.dataset.evalDisclosure]);
    const expanded = evalDisclosures.get(key);
    if (expanded !== undefined) section.open = expanded;
    section.addEventListener("toggle", () => { if (section.isConnected) evalDisclosures.set(key, section.open); });
  });
}

function renderControlledEvals(controlled: any) {
  const availability = controlled?.availability || "not_configured";
  if (availability !== "ready" && availability !== "partial") {
    const invalid = availability === "invalid";
    return `<div class="impact-notice ${invalid ? "error" : ""}"><h3>${escapeHtml(t(invalid ? "evals.controlledUnavailableTitle" : "evals.controlledMissingTitle"))}</h3><p>${escapeHtml(t(invalid ? "evals.controlledUnavailableCopy" : "evals.controlledMissingCopy"))}</p></div>`;
  }
  const profiles = controlled.profiles || [];
  const experiments = controlled.experiments || [];
  const corruptResults = controlled.corrupt_results || [];
  const partialWarning = corruptResults.length > 0
    ? `<div class="impact-notice warn controlled-store-warning" role="status"><h3>${escapeHtml(t("evals.controlledPartialTitle"))}</h3><p>${escapeHtml(t("evals.controlledPartialCopy", { count: corruptResults.length }))}</p><code>${escapeHtml(corruptResults.slice(0, 3).map((item: any) => item.file).join(", "))}</code></div>`
    : "";
  const experiment = selectedControlledExperiment(controlled);
  const error = state.controlledEvalError
    ? `<div class="impact-notice error controlled-eval-error"><strong>${escapeHtml(t("evals.controlledRunFailed"))}</strong><p>${escapeHtml(state.controlledEvalError)}</p></div>`
    : "";
  const history = experiments.length
    ? `<label class="controlled-history"><span>${escapeHtml(t("evals.experimentHistory"))}</span><select data-controlled-history>${experiments.map((item: any) => `<option value="${escapeAttr(item.id)}" ${item.id === experiment?.id ? "selected" : ""}>${escapeHtml(formatDisplayDate(item.created_at))} · ${escapeHtml(t(`evals.profile.${item.profile}.short`))}</option>`).join("")}</select></label>`
    : `<span class="controlled-no-history">${escapeHtml(t("evals.noExperiments"))}</span>`;
  return `<div class="controlled-eval-bench">
    ${controlled.can_run === false ? `<p class="impact-notice">${escapeHtml(t("suite.runUnavailable"))}</p>` : ""}
    <details class="ia-new-check" data-eval-disclosure="new-test" ${experiment ? "" : "open"}><summary>${escapeHtml(t("evals.runExperiment"))}</summary><form class="controlled-run-form" data-controlled-eval-form>
      <label class="eval-field"><span>${escapeHtml(t("evals.profileLabel"))}</span><select name="profile">${profiles.map((item: any) => `<option value="${escapeAttr(item.id)}" ${item.id === state.controlledEvalProfile ? "selected" : ""}>${escapeHtml(t(`evals.profile.${item.id}.name`))}</option>`).join("")}</select></label>
      <button type="submit" class="primary controlled-run-button" ${state.controlledEvalBusy || controlled.can_run === false ?  "disabled" : ""}>${escapeHtml(t(state.controlledEvalBusy ? "evals.runningExperiment" : "evals.runExperiment"))}</button>
      <details class="bench-settings" data-eval-disclosure="settings"><summary>${escapeHtml(t("bench.settings"))}</summary><div>
      <label class="eval-field"><span>${escapeHtml(t("evals.trialsLabel"))}</span><select name="trials">${[1, 2, 3, 4, 5].map((count) => `<option value="${count}" ${Number(state.controlledEvalTrials) === count ? "selected" : ""}>${escapeHtml(t("evals.trialCount", { count }))}</option>`).join("")}</select></label>
      <label class="eval-field controlled-seed"><span>${escapeHtml(t("evals.seedLabel"))}</span><input name="seed" maxlength="80" value="${escapeAttr(state.controlledEvalSeed)}"></label>
      </div><p>${escapeHtml(t("bench.repeats"))}</p></details>
    </form></details>
    ${partialWarning}
    ${error}
    <div class="controlled-history-row">${history}</div>
    ${experiment ? renderControlledExperiment(experiment) : renderControlledEmpty()}
  </div>`;
}

function selectedControlledExperiment(controlled: any = state.observationEvals?.controlled) {
  const experiments = controlled?.experiments || [];
  return experiments.find((item: any) => item.id === state.controlledEvalExperimentId) || experiments[0] || null;
}

function renderControlledEmpty() {
  return `<div class="bench-empty"><h3>${escapeHtml(t("bench.empty"))}</h3><p>${escapeHtml(t("bench.emptyCopy"))}</p></div>`;
}

function renderControlledExperiment(experiment: any) {
  return evalExperimentResult(experiment, controlledExperimentCases(experiment), controlledCaseFilters(), state.observationEvals?.retrieval.sha256, evalUI);
}

function controlledCaseFilters() {
  return `<div class="eval-filters controlled-case-filters" aria-label="${escapeAttr(t("evals.caseFilterLabel"))}">${[
    ["attention", "bench.filterAttention"],
    ["improved", "bench.filterImproved"],
    ["regressed", "evals.filterRegressions"],
    ["all", "evals.filterAllCases"],
  ].map(([value, key]) => `<button type="button" data-controlled-case-filter="${value}" aria-pressed="${state.controlledEvalCaseFilter === value}" class="${state.controlledEvalCaseFilter === value ? "active" : ""}">${escapeHtml(t(key))}</button>`).join("")}</div>`;
}

function controlledExperimentCases(experiment: any) {
  const cases = experiment?.cases || [];
  if (["regressed", "improved"].includes(state.controlledEvalCaseFilter)) return cases.filter((item: any) => item.classification === state.controlledEvalCaseFilter);
  if (state.controlledEvalCaseFilter === "attention") return cases.filter((item: any) => item.classification !== "unchanged_pass");
  return cases;
}

function openControlledCase(id: string, trigger: HTMLElement) {
  const experiment = selectedControlledExperiment();
  const cases = controlledExperimentCases(experiment);
  let index = cases.findIndex((item: any) => item.id === id);
  if (index < 0) return;
  const dialog = document.createElement("dialog");
  dialog.className = "bench-case-dialog ia-sheet";
  dialog.setAttribute("aria-labelledby", "bench-case-title");
  const render = () => {
    dialog.innerHTML = `<div class="sheet-content">` + evalCaseDetail(experiment, cases[index], evalUI) + `<nav class="bench-case-nav" aria-label="${escapeAttr(t("evals.caseEvidence"))}"><button type="button" data-case-prev ${index === 0 ? "disabled" : ""}>${escapeHtml(t("bench.previous"))}</button><span>${escapeHtml(t("bench.position", { index: index + 1, total: cases.length }))}</span><button type="button" data-case-next ${index === cases.length - 1 ? "disabled" : ""}>${escapeHtml(t("bench.next"))}</button></nav></div>`;
    dialog.querySelector("[data-case-close]")?.addEventListener("click", () => dialog.close());
    for (const [selector, delta] of [["[data-case-prev]", -1], ["[data-case-next]", 1]] as const) dialog.querySelector(selector)?.addEventListener("click", () => { index += delta; render(); dialog.querySelector<HTMLButtonElement>(selector === "[data-case-next]" && index < cases.length - 1 || selector === "[data-case-prev]" && index > 0 ? selector : "[data-case-close]")?.focus(); dialog.scrollTop = 0; });
  };
  render();
  document.body.append(dialog);
  dialog.addEventListener("close", () => { dialog.remove(); if (trigger.isConnected) trigger.focus(); });
  dialog.showModal();
}

function bindControlledEvalControls() {
  document.querySelectorAll<HTMLButtonElement>("[data-controlled-case-id]").forEach(button => button.addEventListener("click", () => openControlledCase(button.dataset.controlledCaseId!, button)));
  const form = document.querySelector("[data-controlled-eval-form]") as any;
  if (form) {
    form.querySelectorAll("input,select").forEach((control: HTMLInputElement | HTMLSelectElement) => control.disabled = state.controlledEvalBusy);
    form.querySelector('[name="profile"]')?.addEventListener("change", (event: any) => {
      state.controlledEvalProfile = event.target.value;
      renderImpactDetailKeepingScroll();
      document.querySelector<HTMLSelectElement>('[data-controlled-eval-form] [name="profile"]')?.focus({ preventScroll: true });
    });
    form.querySelector('[name="trials"]')?.addEventListener("change", (event: any) => {
      state.controlledEvalTrials = Number(event.target.value);
    });
    form.querySelector('[name="seed"]')?.addEventListener("input", (event: any) => {
      state.controlledEvalSeed = event.target.value;
    });
    form.addEventListener("submit", (event: any) => {
      event.preventDefault();
      runControlledEval(form);
    });
  }
  document.querySelector("[data-controlled-history]")?.addEventListener("change", (event: any) => {
    state.controlledEvalExperimentId = event.target.value;
    state.controlledEvalCaseFilter = "attention";
    renderImpactDetailKeepingScroll();
    document.querySelector<HTMLSelectElement>("[data-controlled-history]")?.focus({ preventScroll: true });
  });
  document.querySelectorAll("[data-controlled-case-filter]").forEach((button: any) => {
    button.addEventListener("click", () => {
      state.controlledEvalCaseFilter = button.dataset.controlledCaseFilter;
      renderImpactDetailKeepingScroll();
      document.querySelector<HTMLButtonElement>('[data-controlled-case-filter][aria-pressed="true"]')?.focus({ preventScroll: true });
    });
  });
}

async function runControlledEval(form: any) {
  if (state.controlledEvalBusy) return;
  const project = state.projectRoot, submitted = runDrafts.get(state.projectRoot);
  const data = new FormData(form);
  state.controlledEvalProfile = String(data.get("profile") || "memory_contribution_v1");
  state.controlledEvalTrials = Number(data.get("trials") || 2);
  state.controlledEvalSeed = String(data.get("seed") || "codetrap-controlled-v1").trim();
  state.controlledEvalBusy = true;
  state.controlledEvalError = "";
  renderImpactDetail();
  try {
    const result = await api("/api/observations/controlled-evals/run", {
      method: "POST",
      body: JSON.stringify({
        projectRoot: project,
        profile: state.controlledEvalProfile,
        trials: state.controlledEvalTrials,
        seed: state.controlledEvalSeed,
      }),
    });
    if (result.success !== true || result.experiment?.status !== "completed" || typeof result.experiment.id !== "string") throw new Error(t("error.invalidResponse"));
    if (runDrafts.get(project) === submitted) { runDrafts.delete(project); backups.remember("eval-run", [project], "cleared", null); }
    if (state.projectRoot !== project) return;
    state.controlledEvalExperimentId = result.experiment.id;
    state.controlledEvalCaseFilter = "attention";
    await loadImpactEvals();
    showStatus(t("evals.controlledRunComplete"));
  } catch (error) {
    if (state.projectRoot === project) state.controlledEvalError = error instanceof Error ? error.message : String(error);
  } finally {
    state.controlledEvalBusy = false;
    if (state.mainView === "impact") renderImpactDetail();
  }
}

function evalCandidateFilters() {
  return `<div class="eval-filters" role="group" aria-label="${escapeAttr(t("evals.filterLabel"))}">${[
    ["all", "evals.filterAll"],
    ["miss", "evals.filterMiss"],
    ["guidance", "evals.filterGuidance"],
    ["validation", "evals.filterValidation"],
  ].map(([value, key]) => `<button type="button" class="${state.evalCandidateFilter === value ? "active" : ""}" data-eval-filter="${value}">${escapeHtml(t(key))}</button>`).join("")}</div>`;
}

function filteredEvalCandidates() {
  // Review works on grouped findings: one row per normalized signature, not
  // one row per occurrence.
  const candidates = state.observationEvals?.candidate_groups || [];
  if (state.evalCandidateFilter === "miss") return candidates.filter((item: any) => item.reason === "reported_miss");
  if (state.evalCandidateFilter === "guidance") return candidates.filter((item: any) => item.reason === "irrelevant_guidance" || item.reason === "harmful_guidance");
  if (state.evalCandidateFilter === "validation") return candidates.filter((item: any) => item.reason === "validation_failed_after_exposure");
  return candidates;
}

function renderEvalCandidate(candidate: any) {
  const detail = candidate.trap_id !== null && candidate.trap_id !== undefined
    ? [candidate.trap_scope ? valueLabel(candidate.trap_scope) : "", t("evals.trapEvidence", { id: candidate.trap_id })].filter(Boolean).join(" · ")
    : candidate.validation_kind ? t("evals.validationEvidence", { kind: valueLabel(candidate.validation_kind) }) : t("evals.runEvidence");
  const selected = candidate.id === state.evalReviewCandidateId;
  const statusClass = candidate.review_status === "accepted" ? "approved" : candidate.review_status === "rejected" ? "danger" : "warn";
  const count = Number(candidate.occurrence_count || 1);
  const runId = evalGroupLatestRunId(candidate);
  const occurrences = count > 1
    ? `<span class="pill occurrences">${escapeHtml(t("evals.occurrences", { count }))}</span>`
    : "";
  const span = count > 1
    ? `<span class="eval-candidate-span">${escapeHtml(t("evals.occurrenceSpan", {
        runs: (candidate.run_ids || []).length,
        first: formatDisplayDate(candidate.first_occurred_at),
        last: formatDisplayDate(candidate.last_occurred_at),
      }))}</span>`
    : "";
  return `<article class="eval-candidate ${selected ? "selected" : ""}">
    <div class="eval-candidate-index">${count > 1 ? escapeHtml(String(count)) + "&times;" : "1&times;"}</div>
    <div><div class="meta"><span class="pill warn">${escapeHtml(valueLabel(candidate.reason))}</span><span class="pill ${statusClass}">${escapeHtml(valueLabel(candidate.review_status))}</span>${occurrences}</div><h4>${escapeHtml(evalGroupTitle(candidate))}</h4><p>${escapeHtml(detail)} · ${escapeHtml(candidate.ground_truth === "confirmed" ? t("evals.confirmedGroundTruth") : t("evals.notGroundTruth"))}</p>${span}</div>
    <div class="eval-candidate-actions"><button type="button" class="${selected ? "primary" : "secondary"}" data-eval-review="${escapeAttr(candidate.id)}">${escapeHtml(t(selected ? "evals.reviewing" : "evals.reviewCandidate"))}</button><button type="button" class="ghost" data-eval-run="${escapeAttr(runId)}">${escapeHtml(t("evals.inspectRun"))}</button></div>
  </article>`;
}

/** Latest Run the finding was seen in — the most useful one to open. */
function evalGroupLatestRunId(group: any) {
  const runs = group.run_ids || [];
  return runs.length ? runs[runs.length - 1] : group.run_id;
}

/** Name the finding by what it concerns, not by the Run it happened to occur in. */
function evalGroupTitle(group: any) {
  if (group.trap_id !== null && group.trap_id !== undefined) return [group.trap_scope ? valueLabel(group.trap_scope) : "", t("evals.groupTrapTitle", { id: group.trap_id })].filter(Boolean).join(" · ");
  if (group.validation_kind) return t("evals.groupValidationTitle", { kind: valueLabel(group.validation_kind) });
  return t("evals.groupRunTitle", { run: evalGroupLatestRunId(group) });
}

function selectedEvalCandidate() {
  if (!state.evalReviewCandidateId) return null;
  return (state.observationEvals?.candidate_groups || []).find((group: any) => group.id === state.evalReviewCandidateId) || null;
}

function renderEvalReviewPanel(candidate: any, payload: any) {
  if (!candidate) {
    return `<div class="impact-notice eval-review-intro"><h3>${escapeHtml(t("evals.groundTruthTitle"))}</h3><p>${escapeHtml(t("evals.groundTruthCopy"))}</p></div>`;
  }
  const saved = candidateDrafts.get(candidateKey(state.projectRoot, candidate.id));
  if (!state.evalReviewDraft && saved && saved.context === reviewContext(candidate)) installCandidateFields(candidate.id, saved.fields);
  const localReview = state.evalReviewDraft?.candidateId === candidate.id ? state.evalReviewDraft : null;
  const draft = localReview?.case || candidate.draft_case || {};
  const rejectionReason = localReview?.rejectionReason || "";
  const preview = state.evalReviewPreview;
  const oldTarget = candidate?.fixture_path === "src/tests/fixtures/search-eval.json" && payload?.retrieval?.source !== candidate.fixture_path;
  const fixtureTraps = oldTarget ? payload?.legacy_fixture_traps || [] : payload?.fixture_traps || [];
  const error = state.evalReviewError
    ? `<div class="impact-notice error eval-review-error"><strong>${escapeHtml(t("evals.actionFailed"))}</strong><p>${escapeHtml(state.evalReviewError)}</p></div>`
    : "";
  const header = `<header class="eval-review-head"><div><span class="eval-review-step">HUMAN GATE / ${escapeHtml(candidate.id)}</span><h3>${escapeHtml(t("evals.reviewTitle"))}</h3><p>${escapeHtml(t("evals.reviewBoundary"))}</p></div><button type="button" class="ghost" data-eval-review-close aria-label="${escapeAttr(t("action.cancel"))}">×</button></header>`;
  const deferred = `<div class="impact-notice warn eval-external-update" role="status" data-eval-deferred-update ${state.evalExternalChangesDeferred ? "" : "hidden"}><strong>${escapeHtml(t("evals.externalChangesDeferredTitle"))}</strong><p>${escapeHtml(t("evals.externalChangesDeferredCopy"))}</p></div>`;
  if (candidate.review_status === "conflict") {
    return `<section class="eval-review-workbench">${header}${deferred}${error}<div class="impact-notice error" role="alert"><h3>${escapeHtml(t("evals.conflictTitle"))}</h3><p>${escapeHtml(t("evals.conflictCopy"))}</p></div></section>`;
  }
  if (candidate.review_status === "rejected") {
    return `<section class="eval-review-workbench">${header}${deferred}${error}<div class="eval-review-decision rejected"><span>${escapeHtml(t("evals.rejectedLabel"))}</span><strong>${escapeHtml(t("evals.rejectedTitle"))}</strong><p>${escapeHtml(candidate.review_ref?.rejection_reason || t("evals.rejectedCopy"))}</p></div></section>`;
  }
  if (candidate.review_status === "accepted") {
    return `<section class="eval-review-workbench">${header}${deferred}${error}<div class="eval-review-decision accepted"><span>${escapeHtml(t("evals.confirmedLabel"))}</span><strong>${escapeHtml(t("evals.acceptedTitle"))}</strong><p>${escapeHtml(t("evals.acceptedCopy"))}</p>${renderEvalCaseSummary(draft)}</div><div class="eval-review-actions"><button type="button" class="danger" data-eval-review-rollback ${state.evalReviewBusy ? "disabled" : ""}>${escapeHtml(t("evals.rollbackCase"))}</button></div></section>`;
  }
  const selectedIds = new Set(Array.isArray(draft.goldTrapIds) ? draft.goldTrapIds.map(Number) : []);
  const judgment = draft.judgment || (candidate.reason === "irrelevant_guidance" || candidate.reason === "harmful_guidance" ? "noisy_hit" : "miss");
  const trapOptions = fixtureTraps.length
    ? fixtureTraps.map((trap: any) => `<label class="eval-trap-option"><input type="checkbox" name="goldTrapIds" value="${escapeAttr(trap.id)}" ${selectedIds.has(Number(trap.id)) ? "checked" : ""}><span><b>#${escapeHtml(trap.id)}</b>${escapeHtml(trap.title)}</span></label>`).join("")
    : `<div class="evals-inline-empty">${escapeHtml(t("evals.noFixtureTraps"))}</div>`;
  return `<section class="eval-review-workbench">${header}${deferred}${error}
    <div class="eval-review-flow" aria-label="${escapeAttr(t("evals.reviewFlowLabel"))}"><span class="done">${escapeHtml(t("evals.flowEvidence"))}</span><i>→</i><span class="active">${escapeHtml(t("evals.flowHuman"))}</span><i>→</i><span>${escapeHtml(t("evals.flowFixture"))}</span></div>
    <form class="eval-review-form" data-eval-review-form>
      <label class="eval-field eval-query-field"><span>${escapeHtml(t("evals.queryLabel"))}</span><small>${escapeHtml(t("evals.queryHelp"))}</small><textarea name="query" rows="3" placeholder="${escapeAttr(t("evals.queryPlaceholder"))}">${escapeHtml(draft.query || "")}</textarea></label>
      <div class="eval-review-grid"><label class="eval-field"><span>${escapeHtml(t("evals.modeLabel"))}</span><select name="mode">${["fts", "hybrid", "semantic"].map((mode) => `<option value="${mode}" ${(draft.mode || "hybrid") === mode ? "selected" : ""}>${escapeHtml(mode)}</option>`).join("")}</select></label><label class="eval-field"><span>${escapeHtml(t("evals.judgmentLabel"))}</span><select name="judgment">${["miss", "noisy_hit", "useful_hit", "no_relevant_trap"].map((value) => `<option value="${value}" ${judgment === value ? "selected" : ""}>${escapeHtml(valueLabel(value))}</option>`).join("")}</select></label></div>
      <fieldset class="eval-trap-picker"><legend>${escapeHtml(t("evals.expectedLabel"))}</legend><p>${escapeHtml(t("evals.expectedHelp"))}</p><div>${trapOptions}</div>${oldTarget ? `<p>${escapeHtml(t("suite.oldTarget"))}</p>` : ""}</fieldset>
      <label class="eval-field"><span>${escapeHtml(t("evals.noteLabel"))}</span><input name="note" value="${escapeAttr(draft.note || "")}" placeholder="${escapeAttr(t("evals.notePlaceholder"))}"></label>
      <label class="eval-field eval-reject-field"><span>${escapeHtml(t("evals.rejectReasonLabel"))}</span><input name="rejectionReason" value="${escapeAttr(rejectionReason)}" placeholder="${escapeAttr(t("evals.rejectReasonPlaceholder"))}"></label>
      ${preview ? `<div class="eval-preview"><span>${escapeHtml(t("evals.previewReady"))}</span><strong>${escapeHtml(t("evals.previewCounts", { before: preview[0]?.before_query_count ?? 0, after: preview[0]?.after_query_count ?? 0 }))}</strong><code>${escapeHtml(preview[0]?.path || payload?.retrieval?.source || "")}</code><small>${escapeHtml(t("evals.previewNotWritten"))}</small></div>` : ""}
      <div class="eval-review-actions"><button type="button" class="secondary" data-eval-review-save ${state.evalReviewBusy ? "disabled" : ""}>${escapeHtml(t("evals.saveDraft"))}</button><button type="button" class="primary" data-eval-review-accept ${state.evalReviewBusy || !fixtureTraps.length ? "disabled" : ""}>${escapeHtml(t("evals.acceptCase"))}</button><span>${escapeHtml(t("evals.acceptWarning"))}</span><button type="button" class="ghost danger-text" data-eval-review-reject ${state.evalReviewBusy ? "disabled" : ""}>${escapeHtml(t("evals.rejectSignal"))}</button></div>
    </form>
  </section>`;
}

function renderEvalCaseSummary(draft: any) {
  const ids = Array.isArray(draft.goldTrapIds) && draft.goldTrapIds.length ? draft.goldTrapIds.map((id: any) => `#${id}`).join(", ") : t("evals.noRelevantTrap");
  return `<dl class="eval-case-summary"><div><dt>${escapeHtml(t("evals.queryLabel"))}</dt><dd>${escapeHtml(draft.query || "—")}</dd></div><div><dt>${escapeHtml(t("evals.judgmentLabel"))}</dt><dd>${escapeHtml(valueLabel(draft.judgment || "unknown"))}</dd></div><div><dt>${escapeHtml(t("evals.expectedLabel"))}</dt><dd>${escapeHtml(ids)}</dd></div></dl>`;
}

function bindEvalControls() {
  document.querySelectorAll("[data-eval-filter]").forEach((button: any) => {
    button.addEventListener("click", () => {
      snapshotEvalReviewDraftFromDom();
      state.evalExternalChangesDeferred = false;
      state.evalCandidateFilter = button.dataset.evalFilter;
      renderImpactQueue();
      renderImpactDetailKeepingScroll();
    });
  });
  document.querySelectorAll("[data-eval-review]").forEach((button: any) => {
    button.addEventListener("click", () => {
      state.evalExternalChangesDeferred = false;
      snapshotEvalReviewDraftFromDom();
      state.evalReviewCandidateId = button.dataset.evalReview;
      state.evalReviewDraft = null;
      const saved = candidateDrafts.get(candidateKey(state.projectRoot, button.dataset.evalReview));
      if (saved && saved.context === reviewContext(selectedEvalCandidate())) installCandidateFields(button.dataset.evalReview, saved.fields);
      state.evalReviewPreview = null;
      state.evalReviewError = "";
      renderImpactDetail();
      document.querySelector(".eval-review-workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelector("[data-eval-review-close]")?.addEventListener("click", () => {
    state.evalExternalChangesDeferred = false;
    snapshotEvalReviewDraftFromDom();
    state.evalReviewCandidateId = null;
    state.evalReviewDraft = null;
    state.evalReviewPreview = null;
    state.evalReviewError = "";
    renderImpactDetailKeepingScroll();
  });
  const form = document.querySelector<HTMLFormElement>("[data-eval-review-form]");
  if (form) {
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea").forEach(control => control.disabled = state.evalReviewBusy);
    form.dataset.candidateId = selectedEvalCandidate()?.id;
    form.dataset.project = state.projectRoot;
    form.dataset.context = reviewContext(selectedEvalCandidate());
    form.addEventListener("input", snapshotEvalReviewDraftFromDom);
    form.addEventListener("change", snapshotEvalReviewDraftFromDom);
    form.querySelector('[name="judgment"]')?.addEventListener("change", (event: any) => {
      const noRelevant = event.target.value === "no_relevant_trap";
      form.querySelectorAll('[name="goldTrapIds"]').forEach((input: any) => {
        if (noRelevant) input.checked = false;
        input.disabled = noRelevant;
      });
    });
    form.querySelector("[data-eval-review-save]")?.addEventListener("click", () => runEvalReviewAction("draft", form));
    form.querySelector("[data-eval-review-accept]")?.addEventListener("click", () => runEvalReviewAction("accept", form));
    form.querySelector("[data-eval-review-reject]")?.addEventListener("click", () => runEvalReviewAction("reject", form));
  }
  document.querySelector("[data-eval-review-rollback]")?.addEventListener("click", () => runEvalReviewAction("rollback", null));
  bindEvalRunLinks(el("detail"));
}

function syncEvalDeferredNotice() {
  const notice=document.querySelector<HTMLElement>('[data-eval-deferred-update]');
  if(notice)notice.hidden=!state.evalExternalChangesDeferred;
}
function evalReviewDraftFromForm(form: any, normalize = true) {
  const data = new FormData(form);
  const judgment = String(data.get("judgment") || "miss");
  const query = String(data.get("query") || "");
  const note = String(data.get("note") || "");
  return {
    query: normalize ? query.trim() : query,
    mode: String(data.get("mode") || "hybrid"),
    judgment,
    goldTrapIds: judgment === "no_relevant_trap" ? [] : data.getAll("goldTrapIds").map((id) => Number(id)),
    note: normalize ? note.trim() : note,
  };
}

function snapshotEvalReviewDraftFromDom() {
  const candidate = selectedEvalCandidate();
  const form = document.querySelector<HTMLFormElement>("[data-eval-review-form]");
  if (!candidate || !form || form.dataset.candidateId !== candidate.id || form.dataset.project !== state.projectRoot || form.dataset.context !== reviewContext(candidate) || state.evalReviewBusy) return state.evalReviewDraft;
  state.evalReviewDraft = {
    candidateId: candidate.id,
    case: evalReviewDraftFromForm(form, false),
    rejectionReason: String(new FormData(form).get("rejectionReason") || ""),
  };
  const fields = { ...state.evalReviewDraft.case, goldTrapIds: JSON.stringify(state.evalReviewDraft.case.goldTrapIds), rejectionReason: state.evalReviewDraft.rejectionReason };
  const key = candidateKey(state.projectRoot, candidate.id), context = candidateDrafts.get(key)?.context || reviewContext(candidate);
  const base = candidate.draft_case;
  const baseline = { query: base?.query || "", mode: base?.mode || "hybrid", judgment: base?.judgment || (["irrelevant_guidance", "harmful_guidance"].includes(candidate.reason) ? "noisy_hit" : "miss"), goldTrapIds: JSON.stringify(base?.goldTrapIds || []), note: base?.note || "", rejectionReason: "" };
  if (JSON.stringify(fields) === JSON.stringify(baseline)) { candidateDrafts.delete(key); state.evalReviewDraft = null; backups.remember("eval-candidate", [state.projectRoot, candidate.id], context, null); }
  else { candidateDrafts.set(key, { fields, context }); backups.remember("eval-candidate", [state.projectRoot, candidate.id], context, fields); }
  return state.evalReviewDraft;
}

async function runEvalReviewAction(action: string, form: any) {
  const candidate = selectedEvalCandidate();
  if (!candidate || state.evalReviewBusy) return;
  if (action === "accept" && !confirm(t("evals.confirmAccept"))) return;
  if (action === "reject" && !confirm(t("evals.confirmReject"))) return;
  if (action === "rollback" && !confirm(t("evals.confirmRollback"))) return;
  const project = state.projectRoot, key = candidateKey(project, candidate.id);
  const selected = () => state.projectRoot === project && state.evalReviewCandidateId === candidate.id;
  const submittedDraft = form ? evalReviewDraftFromForm(form) : null;
  const rejectionReason = form ? String(new FormData(form).get("rejectionReason") || "").trim() : "";
  snapshotEvalReviewDraftFromDom();
  const submitted = candidateDrafts.get(key);
  state.evalReviewBusy = true;
  state.evalReviewError = "";
  renderImpactDetail();
  try {
    const body: Record<string, unknown> = {
      projectRoot: project,
      observationCandidateId: candidate.id,
    };
    if (action === "draft" || action === "accept") body.draft = submittedDraft;
    if (action === "reject") body.reason = rejectionReason;
    const result = await api(`/api/observations/eval-candidate/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (result.success !== true || result.observation_candidate_id !== candidate.id || action === "draft" && !Array.isArray(result.preview)) throw new Error(t("error.invalidResponse"));
    if (candidateDrafts.get(key) === submitted) { candidateDrafts.delete(key); backups.remember("eval-candidate", [project, candidate.id], "cleared", null); }
    if (!selected()) return;
    state.evalReviewDraft = null;
    state.evalReviewPreview = action === "draft" ? result.preview : null;
    await loadImpactEvals();
    showStatus(t(`evals.status.${action}`));
  } catch (error) {
    if (selected()) state.evalReviewError = error instanceof Error ? error.message : String(error);
  } finally {
    state.evalReviewBusy = false;
    if (state.mainView === "impact") renderImpactDetail();
  }
}

function bindEvalRunLinks(root: any = document) {
  root.querySelectorAll("[data-eval-run]").forEach((button: any) => {
    button.addEventListener("click", () => loadImpactRun(button.dataset.evalRun));
  });
}

function impactRelativeTime(value: unknown) {
  const at = Date.parse(String(value || ""));
  if (!Number.isFinite(at)) return formatDisplayDate(value);
  const diff = Date.now() - at;
  if (diff < 45_000) return t("impact.relative.now");
  if (diff < 60 * 60_000) return t("impact.relative.minutes", { n: Math.round(diff / 60_000) });
  if (diff < 24 * 60 * 60_000) return t("impact.relative.hours", { n: Math.round(diff / 3_600_000) });
  if (diff < 7 * 24 * 60 * 60_000) return t("impact.relative.days", { n: Math.round(diff / 86_400_000) });
  return formatDisplayDate(value);
}

function impactDuration(value: unknown) {
  if (value === null || value === undefined) return "—";
  const ms = Number(value);
  if (ms < 1000) return Math.round(ms) + " ms";
  if (ms < 60000) return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + " s";
  return (ms / 60000).toFixed(1) + " min";
}

return { renderImpactQueue, syncImpactOverviewLayout, renderImpactDetail, syncEvalDeferredNotice, snapshotEvalReviewDraftFromDom };
}
