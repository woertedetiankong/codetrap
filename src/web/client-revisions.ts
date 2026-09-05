import type { RevisionContext, RevisionView, RevisionList } from "./revision-view";
import type { RevisionFields, ExperienceScope, RevisionCase } from "../domain/experience-revision";

interface RevisionUIAdapter {
  api<T>(path: string, options?: RequestInit): Promise<T>;
  text(key: string): string;
  changed(project: string): void;
  openRun(project: string, id: string): void;
}
interface Editor extends RevisionFields { reason: string; positive: string; negative: string }

/** All runtime dependencies are explicit; this function survives standalone bundling. */
export function createRevisionUI(ui: RevisionUIAdapter) {
  const t = (key: string) => ui.text("revision." + key);
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const get = <T>(project: string, suffix: string, params: Record<string, string>) => ui.api<T>("/api/experience-revisions" + suffix + "?" + new URLSearchParams({ project, ...params }));
  const post = <T>(project: string, action: string, value: Record<string, unknown>) => ui.api<T>("/api/experience-revisions/" + action, { method: "POST", body: JSON.stringify({ projectRoot: project, executor: "user", ...value }) });
  let opened: HTMLDialogElement | null = null;

  async function history(panel: HTMLElement, project: string, scope: ExperienceScope, trapId: number) {
    panel.innerHTML = `<h3>${escape(t("history"))}</h3><p role="status">${escape(t("loading"))}</p>`;
    try {
      const entries = await get<RevisionList>(project, "", { scope, trapId: String(trapId) });
      if (!panel.isConnected) return;
      panel.innerHTML = `<h3>${escape(t("history"))}</h3>` + (entries.length ? entries.map(e => `<button type="button" class="revision-history-item" data-revision-id="${escape(e.id)}"><span>${escape(e.title)}</span><span class="pill">${escape(t(e.status))}</span></button>`).join("") : `<p class="subtle">${escape(t("empty"))}</p>`);
      panel.querySelectorAll<HTMLButtonElement>("[data-revision-id]").forEach(b => b.addEventListener("click", () => void open(project, { id: b.dataset.revisionId! })));
    } catch (error) { if (panel.isConnected) panel.innerHTML = `<h3>${escape(t("history"))}</h3><p role="alert">${escape(String(error))}</p>`; }
  }

  async function open(project: string, target: { id: string } | { eventId: string }) {
    // A second entry point never discards an open editor.
    if (opened?.open) { opened.focus(); return; }
    const dialog = document.createElement("dialog");
    dialog.className = "revision-dialog";
    dialog.setAttribute("aria-labelledby", "revision-title");
    document.body.append(dialog);
    opened = dialog;
    dialog.addEventListener("close", () => { dialog.remove(); if (opened === dialog) opened = null; });
    let view: RevisionView | null = null;
    let context: RevisionContext | null = null;
    let editor: Editor | null = null;
    let id = "id" in target ? target.id : "rev-" + crypto.randomUUID();
    let eventId = "eventId" in target ? target.eventId : "";
    let busy = false;
    let dirty = false;
    let message = "";
    let failed = false;
    let pendingFeedback: { eventId: string; feedback: string; requestId: string } | null = null;
    const currentSource = () => view?.source ?? context?.source;
    const canEdit = () => view ? view.status === "draft" : Boolean(context?.editable);
    const formValue = (name: string) => dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value ?? "";
    function collect() {
      if (!editor || !canEdit()) return;
      for (const key of ["title", "context", "mistake", "fix", "reason", "positive", "negative"] as const) editor[key] = formValue(key);
      editor.tags = formValue("tags").split(/[,，]/).map(s => s.trim()).filter(Boolean);
    }
    function populate(value: RevisionView) {
      view = value;
      eventId = value.source.event_id;
      editor = { ...value.fields, reason: value.reason,
        positive: value.cases.filter(c => c.expectation === "include").map(c => c.query).join("\n"),
        negative: value.cases.filter(c => c.expectation === "exclude").map(c => c.query).join("\n") };
      dirty = false;
    }
    const field = (name: keyof Editor, label: string, value: string, max: number, rows = 3) => `<label>${escape(label)}<textarea name="${name}" rows="${rows}" maxlength="${max}" ${canEdit() ? "" : "readonly"}>${escape(value)}</textarea></label>`;
    function render() {
      if (!dialog.isConnected) return;
      const source = currentSource();
      const editable = canEdit();
      const before = view?.base ?? context?.current;
      const ready = !busy && !dirty && view?.status === "draft" && view.base_current && view.evaluation?.passed;
      const feedbackReady = view || context?.source_type === "trap/feedback-recorded";
      dialog.innerHTML = `<header><div><span class="revision-kicker">CODETRAP · ${escape(t("history"))}</span><h2 id="revision-title">${escape(t("title"))}</h2></div><button type="button" class="ghost" data-action="close">${escape(t("close"))}</button></header>
        <p class="subtle">${escape(t("intro"))}</p>
        <div class="revision-status" tabindex="-1" role="${failed ? "alert" : "status"}">${escape(busy ? t("busy") : message)}</div>
        ${source ? `<div class="revision-source"><button type="button" class="ghost" data-action="run">${escape(t("source"))} · ${escape(source.run_id)}</button><span class="pill">${escape(source.scope)} #${source.trap_id}</span>${view ? `<span class="pill">${escape(t(view.status))}</span>` : ""}<small>${escape(t("version"))}: ${escape(source.revision)}</small></div>` : ""}
        ${source?.scope === "global" ? `<p class="revision-notice">${escape(t("global"))}</p>` : ""}
        ${context && !context.same_revision || view && !view.base_current && view.status === "draft" ? `<p class="revision-notice">${escape(t("stale"))}</p>` : ""}
        ${view ? `<section><h3>${escape(t("feedback"))}</h3><p>${escape(t("sourceFeedback"))} · ${escape(t(view.source.feedback ?? "unrated"))}</p></section>` : ""}
        ${context && !view ? `<section><h3>${escape(t("feedback"))}</h3><p>${escape(t(context.source.feedback ? "sourceFeedback" : "latestFeedback"))} · ${escape(context.source.feedback ? t(context.source.feedback) : context.feedback ? t(context.feedback) : t("unrated"))}</p>${context.feedback && context.source.feedback && context.feedback !== context.source.feedback ? `<p>${escape(t("latestFeedback"))} · ${escape(t(context.feedback))}</p>` : ""}<div class="revision-actions">${["helpful", "irrelevant", "harmful", "should_have_matched"].map(f => `<button type="button" class="ghost" data-feedback="${f}" ${busy ? "disabled" : ""}>${escape(t(f))}</button>`).join("")}</div></section>` : ""}
        ${context && !context.editable ? `<p>${escape(t("notEditable"))}</p>` : ""}
        ${editor ? `<fieldset ${busy ? "disabled" : ""}><section><h3>${escape(t("edit"))}</h3>
          ${before ? `<details class="revision-before"><summary>${escape(t("before"))}</summary>${["title", "context", "mistake", "fix", "tags"].map(k => `<h4>${escape(t("field." + k))}</h4><p>${escape(k === "tags" ? before.tags.join(", ") : before[k as keyof RevisionFields])}</p>`).join("")}</details>` : ""}
          ${field("reason", t("reason"), editor.reason, 2000)}
          ${field("title", t("field.title"), editor.title, 240, 1)}
          <div class="revision-grid">${field("context", t("field.context"), editor.context, 6000, 4)}${field("mistake", t("field.mistake"), editor.mistake, 6000, 4)}</div>
          ${field("fix", t("field.fix"), editor.fix, 12000, 4)}${field("tags", t("field.tags"), editor.tags.join(", "), 2430, 1)}</section>
          <section><h3>${escape(t("tests"))}</h3><p class="subtle">${escape(t("testHelp"))}</p><div class="revision-grid">${field("positive", t("positive"), editor.positive, 10020)}${field("negative", t("negative"), editor.negative, 10020)}</div>
          ${view?.evaluation ? `<p>${escape(t("tested"))} ${view.corpus_count}</p><div class="revision-results"><table><thead><tr><th>${escape(t("query"))}</th><th>${escape(t("baseline"))}</th><th>${escape(t("candidate"))}</th></tr></thead><tbody>${view.evaluation.cases.map(c => `<tr><td>${escape(c.query)}<small>${escape(t(c.expectation))}</small></td><td>${escape(t(c.baseline ? "pass" : "fail"))}</td><td class="${c.candidate ? "revision-pass" : "revision-fail"}">${escape(t(c.candidate ? "pass" : "fail"))}${c.error ? `<small>${escape(c.error)}</small>` : ""}</td></tr>`).join("")}</tbody></table></div>` : ""}
          <p data-dirty class="subtle">${escape(dirty ? t("dirty") : "")}</p></section></fieldset>
          <footer>${editable ? `<div class="revision-actions"><button type="button" class="ghost" data-action="save" ${!feedbackReady || busy ? "disabled" : ""}>${escape(t("save"))}</button><button type="button" class="ghost" data-action="evaluate" ${!feedbackReady || busy ? "disabled" : ""}>${escape(t("evaluate"))}</button><button type="button" class="primary" data-action="accept" ${ready ? "" : "disabled"}>${escape(t("accept"))}</button>${view ? `<button type="button" class="ghost" data-action="reject" ${busy || dirty ? "disabled" : ""}>${escape(t("reject"))}</button>` : ""}</div>${!feedbackReady ? `<p>${escape(t("feedbackRequired"))}</p>` : ""}` : ""}
          ${view?.status === "accepted" ? `<button type="button" class="ghost" data-action="rollback" ${busy ? "disabled" : ""}>${escape(t("rollback"))}</button>` : ""}<p class="subtle">${escape(t("local"))}</p></footer>` : ""}
        ${view?.commit ? `<section><h3>${escape(t("activity"))}</h3><p>${escape(t("appliedAt"))}: ${escape(view.commit.accepted_at)}</p>${view.commit.rolled_back_at ? `<p>${escape(t("revertedAt"))}: ${escape(view.commit.rolled_back_at)}</p>` : ""}${view.activity?.availability === "unavailable" ? `<p>${escape(t("activityUnavailable"))}</p>` : view.activity?.runs.length ? view.activity.runs.map(r => `<p><button type="button" class="ghost" data-run="${escape(r.id)}">${escape(r.id)}</button> · ${r.exposures} ${escape(t("exposures"))} · ${escape(r.feedback ? t(r.feedback) : t("unrated"))}</p>`).join("") : `<p class="subtle">${escape(t("activityEmpty"))}</p>`}</section>` : ""}`;
      dialog.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(b => b.addEventListener("click", () => {
        if (b.dataset.action === "close") { dialog.close(); return; }
        if (b.dataset.action === "run" && source) { dialog.close(); ui.openRun(project, source.run_id); return; }
        void action(b.dataset.action!);
      }));
      dialog.querySelectorAll<HTMLButtonElement>("[data-feedback]").forEach(b => b.addEventListener("click", () => void action("feedback", b.dataset.feedback)));
      dialog.querySelectorAll<HTMLButtonElement>("[data-run]").forEach(b => b.addEventListener("click", () => { dialog.close(); ui.openRun(project, b.dataset.run!); }));
      dialog.querySelectorAll("textarea").forEach(input => input.addEventListener("input", () => {
        dirty = true;
        const apply = dialog.querySelector<HTMLButtonElement>('[data-action="accept"]');
        if (apply) apply.disabled = true;
        const reject = dialog.querySelector<HTMLButtonElement>('[data-action="reject"]');
        if (reject) reject.disabled = true;
        dialog.querySelector("[data-dirty]")!.textContent = t("dirty");
      }));
    }
    async function save() {
      if (!editor) return;
      const cases: RevisionCase[] = (["positive", "negative"] as const).flatMap(key => editor![key].split("\n").map(s => s.trim()).filter(Boolean).map(query => ({ query, expectation: key === "positive" ? "include" as const : "exclude" as const })));
      populate(await post<RevisionView>(project, "draft", { id, eventId, digest: view?.digest, draft: { ...editor, cases } }));
    }
    async function action(action: string, feedback?: string) {
      if (busy) return;
      collect();
      const position = dialog.scrollTop;
      busy = true; failed = false; message = ""; render(); dialog.scrollTop = position;
      try {
        if (action === "feedback") {
          if (!pendingFeedback || pendingFeedback.feedback !== feedback) pendingFeedback = { eventId, feedback: feedback!, requestId: crypto.randomUUID() };
          const result = await post<{ event_id: string }>(project, "feedback", pendingFeedback);
          eventId = result.event_id;
          context = await get<RevisionContext>(project, "/context", { eventId });
          pendingFeedback = null;
          message = t("feedbackSaved");
        } else if (action === "save" || action === "evaluate") {
          await save();
          if (action === "evaluate") populate(await post<RevisionView>(project, "evaluate", { id, digest: view!.digest }));
          message = t(action === "save" ? "saved" : view!.evaluation?.passed ? "pass" : "fail");
        } else if (view && ["accept", "reject", "rollback"].includes(action)) {
          populate(await post<RevisionView>(project, action, { id, digest: view.digest }));
          message = t(view.status);
        }
        ui.changed(project);
      } catch (error) { message = error instanceof Error ? error.message : String(error); failed = true; }
      finally {
        busy = false; render();
        (dialog.querySelector<HTMLElement>(`[data-action="${action}"]:not(:disabled)`) ?? dialog.querySelector<HTMLElement>(".revision-status"))?.focus({ preventScroll: true });
        dialog.scrollTop = position;
      }
    }
    message = t("loading"); render(); dialog.showModal();
    try {
      if ("id" in target) populate(await get<RevisionView>(project, "/item", { id }));
      else {
        context = await get<RevisionContext>(project, "/context", { eventId });
        if (context.current && context.editable) editor = { ...context.current, reason: "", positive: "", negative: "" };
      }
      message = "";
    } catch (error) { message = String(error); failed = true; }
    render();
    dialog.querySelector<HTMLButtonElement>('[data-action="close"]')?.focus({ preventScroll: true });
  }
  return { openEvent: (project: string, eventId: string) => open(project, { eventId }), history };
}
