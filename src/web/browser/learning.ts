import type { LearningImpactState } from "../../domain/learning-impact";
import { createLearningModel } from "./learning-model";
import { learningKey, targetOf, type LearningFields, type LearningInsight, type LearningTarget } from "./learning-data";
import type { Translate } from "./platform";
export function createLearningWorkflow(deps: {
  current(): LearningInsight | null; active(): boolean; externalBusy(): boolean;
  api(path: string, options?: RequestInit): Promise<unknown>;
  t: Translate; escapeHtml(value: unknown): string;
  render(): void; applyImpact(target: LearningTarget, impact: LearningImpactState): void;
  created(target: LearningTarget): Promise<void>;
  showStatus(message: string, error?: boolean): void;
  busyChanged(): void;
}) {
  const current = () => { const insight = deps.current(); return insight ? targetOf(insight) : null; };
  const selected = (target: LearningTarget) => deps.active() && current() && learningKey(current()!) === learningKey(target);
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const model = createLearningModel({ api: deps.api, blocked: deps.externalBusy,
    changed(target, part) { if (selected(target)) { if (part === "render") render(); else if (part === "draft") hints(); } if (part === "busy") { locks(); deps.busyChanged(); } },
    applyImpact: deps.applyImpact, created: deps.created,
    notify(key, target, error) { deps.showStatus(deps.t(selected(target) ? key : error ? "learningFlow.failedElsewhere" : "learningFlow.completedElsewhere", { title: target.title, project: target.project }), error); },
  });
  function render() {
    const scroll = document.querySelector("#detail > .scroll")?.scrollTop || 0;
    const target = current(), active = document.activeElement;
    const field = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null;
    const focus = field && el("detail")?.contains(field) ? { id: field.id, name: field.name, start: field.selectionStart, end: field.selectionEnd } : null;
    deps.render(); const node = document.querySelector("#detail > .scroll"); if (node) node.scrollTop = scroll;
    if (focus && target && selected(target)) {
      const next = focus.id ? el<HTMLInputElement | HTMLTextAreaElement>(focus.id) : el<HTMLFormElement>("learning-agent-candidate-form")?.elements.namedItem(focus.name);
      if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) { next.focus({ preventScroll: true }); if (focus.start !== null) next.setSelectionRange(focus.start, focus.end); }
    }
  }
  function locks() {
    if (!deps.active()) return;
    const busy = model.busy || deps.externalBusy();
    for (const id of ["save-learning-practice", "discard-learning-practice", "begin-learning-candidate", "preview-learning-candidate", "create-learning-candidate", "cancel-learning-candidate", "learning-run-link"]) {
      const control = el<HTMLButtonElement | HTMLSelectElement>(id); if (control) control.disabled = busy;
    }
    document.querySelectorAll<HTMLButtonElement>("[data-learning-status],[data-learning-feedback],[data-collection-rename]").forEach(button => { button.disabled = busy; });
    el("learning-agent-candidate-form")?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select").forEach(control => { control.disabled = model.operation?.action === "create" || deps.externalBusy(); });
  }
  function hints() {
    const t = current(); if (!t || !deps.active()) return;
    const entry = model.entry(t), state = el("learning-practice-state");
    if (state) state.textContent = deps.t(entry?.practice ? "experience.unsaved" : "experience.saved");
    const discard = el("discard-learning-practice"); if (discard) discard.hidden = !entry?.practice;
    const validation = el("learning-proposal-state");
    if (validation) validation.textContent = deps.t(entry?.proposal && entry.validatedVersion === entry.proposal.version ? "learningFlow.validated" : "learningFlow.unvalidated");
    const error = el("learning-flow-error"); if (error) { error.textContent = entry?.error || ""; error.hidden = !entry?.error; }
    locks();
  }
  function capture() {
    const t = current(), form = el<HTMLFormElement>("learning-agent-candidate-form");
    if (!t || !form || form.dataset.learningKey !== learningKey(t) || !model.entry(t)?.proposal) return;
    const fields = {} as LearningFields;
    // Disabled controls still carry the submitted draft; FormData would omit them.
    for (const key of Object.keys(model.entry(t)!.proposal!.value) as Array<keyof LearningFields>) {
      const control = form.elements.namedItem(key);
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) fields[key] = control.value;
    }
    model.editProposal(t, fields);
  }
  function bind() {
    const insight = deps.current(); if (!insight) return;
    const t = targetOf(insight), form = el<HTMLFormElement>("learning-agent-candidate-form"), note = el<HTMLTextAreaElement>("learning-practice-note");
    if (form) form.dataset.learningKey = learningKey(t);
    if (note) note.addEventListener("input", () => model.editPractice(t, note.value, insight.learning_impact.progress.practice_note || ""));
    form?.addEventListener("input", capture); form?.addEventListener("change", capture); form?.addEventListener("submit", event => event.preventDefault());
    for (const [id, action] of [["save-learning-practice", "practice"], ["begin-learning-candidate", "begin"], ["preview-learning-candidate", "preview"], ["create-learning-candidate", "create"]] as const) {
      el(id)?.addEventListener("click", () => { capture(); void model.act(t, action); });
    }
    el("cancel-learning-candidate")?.addEventListener("click", () => model.discard(t, "proposal"));
    el("discard-learning-practice")?.addEventListener("click", () => model.discard(t, "practice"));
    document.querySelectorAll<HTMLButtonElement>("[data-learning-status]").forEach(button => button.addEventListener("click", () => { capture(); void model.act(t, "status", button.dataset.learningStatus); }));
    document.querySelectorAll<HTMLButtonElement>("[data-learning-feedback]").forEach(button => button.addEventListener("click", () => { capture(); void model.act(t, "feedback", button.dataset.learningFeedback); }));
    el<HTMLSelectElement>("learning-run-link")?.addEventListener("change", event => { capture(); void model.act(t, "run", (event.currentTarget as HTMLSelectElement).value); });
    hints();
  }
  function practice(insight: LearningInsight): string {
    const target = targetOf(insight), entry = model.entry(target), saved = insight.learning_impact.progress.practice_note || "", value = entry?.practice?.value ?? saved;
    const t = deps.t, esc = deps.escapeHtml;
    return `<section class="section learning-practice"><div class="learning-impact-heading"><div><div class="eyebrow">${esc(t("experience.practiceKicker"))}</div><h3><label for="learning-practice-note">${esc(t("experience.practiceTitle"))}</label></h3></div><span class="pill scope">${esc(t("learningImpact.private"))}</span></div>
      <p id="learning-practice-hint">${esc(t("experience.practiceHint"))}</p><textarea id="learning-practice-note" rows="3" maxlength="1000" aria-describedby="learning-practice-hint" placeholder="${esc(t("experience.practicePlaceholder"))}">${esc(value)}</textarea>
      <div class="learning-practice-footer"><span id="learning-practice-state" role="status"></span><button type="button" id="discard-learning-practice" class="ghost" ${entry?.practice ? "" : "hidden"}>${esc(t("review.discard"))}</button><button type="button" class="primary" id="save-learning-practice">${esc(t("experience.savePractice"))}</button></div></section>`;
  }
  window.addEventListener("beforeunload", event => { if (model.hasDrafts() || model.busy) { event.preventDefault(); event.returnValue = ""; } });
  return { get busy() { return model.busy; }, get revision() { return model.revision; }, capture, bind, practice, syncBusy: locks,
    entry: (insight: LearningInsight) => model.entry(targetOf(insight)),
  };
}
