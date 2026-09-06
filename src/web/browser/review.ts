import type { ReviewedSessionCandidate } from "../../domain/session-review";
import { candidateContext, candidateFields, createReviewModel, type ReviewFields } from "./review-model";
import { createFormDrafts } from "./form-drafts";
import { reviewKey, type ReviewTarget, type ReviewReceipt } from "./review-data";
import type { Translate } from "./platform";

interface Dependencies {
  context(): { project: string | null; active: boolean };
  api(path: string, options?: RequestInit): Promise<unknown>;
  t: Translate;
  renderSessions(): void;
  renderReview(): void;
  navigate(): void;
  showStatus(message: string, error?: boolean): void;
  showReceipt(receipt: ReviewReceipt, options: { projectRoot: string; target: ReviewTarget; undoSuppression?: string }): void;
  externalBusy(): boolean;
  busyChanged?(): void;
}
export function createReviewUI(deps: Dependencies) {
  const backups = createFormDrafts(deps.t);
  const model = createReviewModel({ api: deps.api,
    draftChanged: (target, fields, context) => backups.remember("review", [target.projectRoot, target.sessionId, target.candidateId], context, fields),
    changed(part) {
      if (part === "sessions") { deps.renderSessions(); if (deps.context().active) deps.renderReview(); }
      else if (part === "candidates" && deps.context().active) deps.renderReview();
      else if (part === "draft") renderDraftState();
      if (part === "busy") { setBusy(); deps.busyChanged?.(); }
    },
    notify: (key, error, params) => deps.showStatus(deps.t(key, params), error),
    receipt: (receipt, target, suppression) => deps.showReceipt(receipt, { projectRoot: target.projectRoot, target, undoSuppression: suppression }),
  });
  let rejectTarget: ReviewTarget | null = null;
  const editingTargets = new Set<string>();
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  function setBusy() {
    const busy = model.state.busy || deps.externalBusy();
    for (const id of ["rename-session", "delete-session"]) { const button = el<HTMLButtonElement>(id); if (button) button.disabled = busy; }
    if (!deps.context().active) return;
    for (const id of ["save", "approve", "apply-insight", "accept", "reject", "accept-anyway", "supersede", "supersedes", "rollback", "review-discard", "review-edit-toggle"]) {
      const control = el<HTMLButtonElement | HTMLInputElement>(id); if (control) control.disabled = busy;
    }
    if (model.current()?.status === "proposed") el("candidate-form")?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select").forEach(control => { control.disabled = busy; });
  }
  function renderDraftState() {
    if (!deps.context().active) return;
    const hint = el("candidate-draft-state");
    if (hint) { hint.textContent = deps.t(model.dirty() ? "hint.unsavedDraftAccepted" : "hint.acceptUsesCurrentDraft"); hint.classList.toggle("dirty", model.dirty()); }
    let discard = el<HTMLButtonElement>("review-discard");
    if (model.dirty() && hint && !discard) {
      discard = document.createElement("button"); discard.id = "review-discard"; discard.type = "button"; discard.className = "ghost";
      discard.textContent = deps.t("review.discard"); hint.after(discard); discard.addEventListener("click", () => model.discard());
    }
    if (!model.dirty()) discard?.remove(); setBusy();
  }
  function attachForm(candidate: ReviewedSessionCandidate) {
    const form = el<HTMLFormElement>("candidate-form"), target = model.target();
    if (target) {
      const host = document.createElement("div");
      if (form) form.before(host); else el("detail")?.prepend(host);
      backups.mount(host, () => {
        const current = model.current(), selected = model.target();
        if (!current || !selected || reviewKey(target) !== reviewKey(selected)) return null;
        return { form: "review", owner: [selected.projectRoot, selected.sessionId, selected.candidateId], context: candidateContext(current),
          active: model.dirty(), editable: current.status === "proposed", busy: model.state.busy || deps.externalBusy(),
          restore: fields => { model.edit(selected, fields, candidateFields(current)); deps.renderReview(); } };
      });
    }
    if (form && target) {
      const baseline = candidateFields(candidate), fields = model.fields() || baseline;
      for (const [name, value] of Object.entries(fields)) {
        const control = form.elements.namedItem(name);
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) control.value = value;
      }
      const preview = el("review-preview"), toggle = el<HTMLButtonElement>("review-edit-toggle");
      const updatePreview = () => {
        preview?.querySelectorAll<HTMLElement>("[data-review-preview]").forEach(node => {
          const name = node.dataset.reviewPreview!, control = form.elements.namedItem(name);
          node.textContent = control instanceof HTMLSelectElement ? control.selectedOptions[0]?.textContent || "—"
            : control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.value || "—" : "—";
        });
      };
      if (preview && toggle) {
        const key = reviewKey(target);
        const setEditing = (editing: boolean, focus = false) => {
          if (editing) editingTargets.add(key); else editingTargets.delete(key);
          form.hidden = !editing; preview.hidden = editing;
          toggle.setAttribute("aria-expanded", String(editing));
          toggle.textContent = deps.t(editing ? candidate.status === "proposed" ? "reader.done" : "reader.read" : candidate.status === "proposed" ? "reader.edit" : "reader.fields");
          updatePreview();
          if (focus) { if (editing && candidate.status === "proposed") el("title")?.focus(); else toggle.focus(); }
        };
        setEditing(editingTargets.has(key));
        toggle.addEventListener("click", () => setEditing(form.hidden === true, true));
      }
      if (candidate.status !== "proposed") { renderDraftState(); setBusy(); return; }
      const update = () => {
        const fields: ReviewFields = {}, data = new FormData(form);
        for (const name of Object.keys(baseline)) fields[name] = String(data.get(name) || "");
        model.edit(target, fields, baseline);
        updatePreview();
      };
      form.addEventListener("input", update); form.addEventListener("change", update);
      form.addEventListener("submit", event => event.preventDefault());
    }
    renderDraftState(); setBusy();
  }
  function bindActions(candidate: ReviewedSessionCandidate) {
    for (const action of ["save", "approve", "accept", "apply-insight", "rollback"] as const) {
      el(action)?.addEventListener("click", () => {
        if (deps.externalBusy()) return;
        if (action === "rollback" && !confirm(deps.t(candidate.candidate_kind === "insight" ? "confirm.removeFromLearning" : "confirm.rollback"))) return;
        void model.mutate(action);
      });
    }
    el("accept-anyway")?.addEventListener("click", () => { if (!deps.externalBusy()) void model.mutate("accept", { acceptAnyway: true }); });
    el("supersede")?.addEventListener("click", () => {
      const id = Number(el<HTMLInputElement>("supersedes")?.value);
      if (!Number.isSafeInteger(id) || id < 1) { deps.showStatus(deps.t("status.supersedesRequired"), true); return; }
      if (!deps.externalBusy()) void model.mutate("accept", { supersedesId: id });
    });
    el("reject")?.addEventListener("click", () => {
      rejectTarget = model.target();
      const dialog = el<HTMLDialogElement>("reject-dialog"); if (!dialog || !rejectTarget) return;
      const labels: Record<string, string> = { "reject-dialog-title": "dialog.rejectTitle", "reject-dialog-scope": "dialog.rejectScope", "reject-dialog-undo": "dialog.rejectUndo", "reject-reason-label": "label.rejectReason", "reject-cancel": "action.cancel", "reject-confirm": "action.confirmReject" };
      for (const [id, key] of Object.entries(labels)) { const target = el(id); if (target) target.textContent = deps.t(key); }
      el("reject-dialog-candidate")!.textContent = deps.t("dialog.rejectCandidate", { title: candidate.candidate_kind === "insight" ? candidate.destination_payload?.title || candidate.trap.title : candidate.trap.title });
      el<HTMLInputElement>("reject-reason")!.value = ""; dialog.showModal();
      requestAnimationFrame(() => el("reject-reason")?.focus());
    });
    setBusy();
  }
  el("reject-cancel")?.addEventListener("click", () => { rejectTarget = null; el<HTMLDialogElement>("reject-dialog")?.close(); });
  el("reject-form")?.addEventListener("submit", event => {
    event.preventDefault(); const target = rejectTarget; rejectTarget = null;
    const reason = el<HTMLInputElement>("reject-reason")?.value.trim() || "";
    el<HTMLDialogElement>("reject-dialog")?.close();
    if (!target || deps.externalBusy()) return;
    if (!model.target() || reviewKey(model.target()!) !== reviewKey(target)) { deps.showStatus(deps.t("review.targetChanged"), true); return; }
    void model.mutate("reject", { reason }, target);
  });
  window.addEventListener("beforeunload", event => { if (!backups.safeToLeave() || model.state.busy) { event.preventDefault(); event.returnValue = ""; } });
  function loadView(part: "sessions" | "candidates", container: HTMLElement): boolean {
    const status = part === "sessions" ? model.state.sessionsLoad : model.state.candidatesLoad;
    if (status === "ready" || status === "idle") return false;
    container.replaceChildren(); const box = document.createElement("div"); box.className = "empty"; box.setAttribute("role", "status");
    const text = document.createElement("p"); text.textContent = deps.t(status === "loading" ? "review.loading" : "review.loadFailed"); box.append(text);
    if (status === "error") {
      const retry = document.createElement("button"); retry.className = "ghost"; retry.type = "button"; retry.dataset.reviewRetry = part; retry.textContent = deps.t("library.retry");
      retry.addEventListener("click", async () => { if (part === "sessions") { if (await model.loadSessions() && deps.context().active) await model.loadCandidates(); } else await model.loadCandidates(); }); box.append(retry);
    }
    container.append(box); return true;
  }
  return { get state() { return model.state; }, reset: model.reset, current: model.current, dirty: model.dirty, conflicts: model.conflicts,
    loadSessions: model.loadSessions, loadCandidates: model.loadCandidates, refresh: model.refresh,
    clearSelection: () => model.selectCandidate(null),
    async selectSession(id: string | null) { model.selectSession(id); deps.navigate(); deps.renderSessions(); await model.loadCandidates(); },
    selectCandidate(id: string | null) { model.selectCandidate(id); deps.navigate(); deps.renderReview(); },
    selectView(view: "inbox" | "reviewed") { model.selectView(view); deps.navigate(); deps.renderReview(); },
    attachForm, bindActions, loadView, syncBusy: setBusy,
    attachMissingRecovery() {
      const target = model.target(), detail = el("detail"); if (!target || !detail) return;
      const host = document.createElement("div"); detail.append(host);
      backups.mount(host, () => model.target() && reviewKey(model.target()!) === reviewKey(target) ? { form: "review", owner: [target.projectRoot, target.sessionId, target.candidateId], context: "missing", active: false, editable: false, busy: model.state.busy, restore() {} } : null);
    },
    sessionAction: model.manageSession,
  };
}
