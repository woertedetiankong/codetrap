import type { ProjectEvalSuite } from "../lib/project-eval-suite";
import type { EvalSuiteOperations } from "../lib/eval-suite-operations";
import { createFormDrafts } from "./browser/form-drafts";
interface SuiteAdapter {
  currentProject?(): string | null;
  api<T>(path: string, options?: RequestInit): Promise<T>;
  text(key: string): string;
  changed(project: string): void;
}
type Status = ReturnType<ProjectEvalSuite["status"]>;
type Preview = ReturnType<ProjectEvalSuite["preview"]>;
type CasePreview = ReturnType<EvalSuiteOperations["previewCase"]>;

export function createEvalSuiteUI(ui: SuiteAdapter) {
  const t = (key: string) => ui.text("suite." + key);
  const e = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const get = <T>(project: string, path = "", params: Record<string, string> = {}) => ui.api<T>("/api/eval-suite" + path + "?" + new URLSearchParams({ project, ...params }));
  const post = <T>(project: string, path: string, value: Record<string, unknown>) => ui.api<T>("/api/eval-suite/" + path, { method: "POST", body: JSON.stringify({ projectRoot: project, executor: "user", ...value }) });
  const backups = createFormDrafts(ui.text);
  let dialogOpen = false, pending = 0;
  window.addEventListener("beforeunload", event => { if (pending || !backups.safeToLeave()) { event.preventDefault(); event.returnValue = ""; } });
  async function mount(panel: HTMLElement, project: string) {
    panel.innerHTML = `<p role="status">${e(t("loading"))}</p>`;
    try {
      const status = await get<Status>(project);
      if (!panel.isConnected) return;
      panel.innerHTML = `<div class="evals-section-head"><h3>${e(t("title"))}</h3><span class="pill">${e(t(status.state))}</span></div><p>${e(t("copy." + status.state))}</p><div class="revision-actions">
        ${status.state === "missing" ? `<button type="button" class="primary" data-suite="library">${e(t("prepare"))}</button>` : ""}
        ${status.state === "legacy" ? `<button type="button" class="primary" data-suite="legacy">${e(t("import"))}</button>` : ""}
        ${status.state === "local" ? `<button type="button" class="primary" data-suite="case">${e(t("add"))}</button>` : ""}
        ${status.sha256 ? `<button type="button" class="ghost" data-suite="export">${e(t("export"))}</button>` : ""}</div><p class="subtle">${e(status.count ?? "—")} ${e(t("lessons"))} · ${e(status.cases ?? "—")} ${e(t("cases"))}</p><p class="subtle" data-suite-status role="status"></p>`;
      panel.querySelectorAll<HTMLButtonElement>("[data-suite]").forEach(button => button.addEventListener("click", async () => {
        if (button.dataset.suite !== "export") { void open(project, button.dataset.suite as "library" | "legacy" | "case", status); return; }
        button.disabled = true;
        try {
          const file = await get<{ content: string; filename: string }>(project, "/export", { digest: status.sha256! });
          const url = URL.createObjectURL(new Blob([file.content], { type: "application/json" }));
          const link = document.createElement("a"); link.href = url; link.download = file.filename; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { if (panel.isConnected) panel.querySelector("[data-suite-status]")!.textContent = String(error); }
        finally { button.disabled = false; }
      }));
    } catch (error) { if (panel.isConnected) panel.innerHTML = `<p role="alert">${e(String(error))}</p>`; }
  }
  async function open(project: string, mode: "library" | "legacy" | "case", status: Status) {
    if (dialogOpen) return;
    dialogOpen = true;
    const dialog = document.createElement("dialog");
    dialog.className = "revision-dialog suite-dialog";
    dialog.setAttribute("aria-labelledby", "suite-title");
    document.body.append(dialog);
    dialog.addEventListener("close", () => { dialogOpen = false; dialog.remove(); });
    dialog.innerHTML = `<header><h2 id="suite-title">${e(t(mode === "case" ? "add" : "preview"))}</h2><button type="button" class="ghost" data-suite-close>${e(t("close"))}</button></header><p>${e(t(mode === "case" ? "caseHelp" : "snapshotHelp"))}</p><div data-suite-message role="status" tabindex="-1"></div><div data-suite-content></div>`;
    dialog.querySelector("[data-suite-close]")!.addEventListener("click", () => dialog.close());
    const content = dialog.querySelector<HTMLElement>("[data-suite-content]")!;
    const message = dialog.querySelector<HTMLElement>("[data-suite-message]")!;
    let busy = false;
    const show = (text: string, failed = false) => { message.textContent = text; message.setAttribute("role", failed ? "alert" : "status"); };
    const locked = async (action: () => Promise<void>) => {
      if (busy || ui.currentProject && ui.currentProject() !== project) return;
      busy = true; pending++; backups.refresh();
      const fieldset = content.querySelector<HTMLFieldSetElement>("fieldset");
      const buttons = [...content.querySelectorAll<HTMLButtonElement>("button")];
      const states = buttons.map(b => b.disabled);
      if (fieldset) fieldset.disabled = true;
      buttons.forEach(b => b.disabled = true); show(t("loading"));
      try { await action(); } catch (error) { show(error instanceof Error ? error.message : String(error), true); }
      finally { busy = false; pending--; backups.refresh(); if (fieldset) fieldset.disabled = false; buttons.forEach((b, i) => b.disabled = states[i]!); message.focus({ preventScroll: true }); }
    };
    dialog.showModal();
    if (mode !== "case") {
      await locked(async () => {
        const preview = await get<Preview>(project, "/preview", { origin: mode });
        if (!dialog.isConnected) return;
        content.innerHTML = `<p><strong>${preview.traps.length}</strong> ${e(t("lessons"))} · ${preview.cases} ${e(t("cases"))}</p><details class="revision-before"><summary>${e(t("inspect"))}</summary><ul>${preview.traps.map(trap => `<li>#${trap.fixture_id} · ${e(trap.title)} <small>(${e(trap.scope ? trap.scope + " #" + trap.trap_id : t("unknownSource"))})</small></li>`).join("")}</ul></details><p class="subtle">${e(t("snapshotBoundary"))}</p><button type="button" class="primary" data-suite-create>${e(t("confirm"))}</button>`;
        content.querySelector("[data-suite-create]")!.addEventListener("click", () => void locked(async () => {
          await post(project, "create", { origin: mode, digest: preview.digest });
          show(t("created")); content.innerHTML = `<p>${e(t("createdHelp"))}</p>`; ui.changed(project);
        }));
        show("");
      });
      return;
    }
    let preview: CasePreview | null = null;
    let requestId = crypto.randomUUID();
    const traps = status.traps;
    const source = (trap: Status["traps"][number]) => trap.source_ref?.scope ? `${trap.source_ref.scope} #${trap.source_ref.trap_id}` : t("unknownSource");
    content.innerHTML = `<form><fieldset><label>${e(t("query"))}<textarea name="query" rows="3" maxlength="500" required></textarea></label>
      <label>${e(t("expectation"))}<select name="judgment"><option value="useful_hit">${e(t("relevant"))}</option><option value="no_relevant_trap">${e(t("none"))}</option></select></label>
      <p class="subtle">${e(t("idsHelp"))}</p><div class="eval-trap-picker">${traps.map(trap => `<label class="eval-trap-option"><input type="checkbox" name="gold" value="${trap.id}"><span><b>#${trap.id}</b> ${e(trap.title)}<small>${e(source(trap))}</small></span></label>`).join("")}</div></fieldset>
      <div data-case-preview></div><div class="revision-actions"><button type="button" class="ghost" data-case-preview-button>${e(t("testPreview"))}</button><button type="button" class="primary" data-case-accept disabled>${e(t("accept"))}</button></div></form>`;
    const read = () => ({ query: content.querySelector<HTMLTextAreaElement>('[name="query"]')!.value,
      judgment: content.querySelector<HTMLSelectElement>('[name="judgment"]')!.value,
      mode: "fts", corpus_sha256: status.corpus_sha256, goldTrapIds: [...content.querySelectorAll<HTMLInputElement>('[name="gold"]:checked')].map(n => Number(n.value)) });
    const accept = content.querySelector<HTMLButtonElement>("[data-case-accept]")!;
    content.querySelector("form")!.addEventListener("submit", event => event.preventDefault());
    const recovery = document.createElement("div"); content.prepend(recovery);
    const context = JSON.stringify({ corpus: status.corpus_sha256, suite: status.sha256, traps: status.traps });
    let dirty = false;
    const remember = () => {
      const value = read(); dirty = !!value.query || value.judgment !== "useful_hit" || !!value.goldTrapIds.length;
      backups.remember("eval-case", [project], context, dirty ? { query: value.query, judgment: value.judgment, goldTrapIds: JSON.stringify(value.goldTrapIds) } : null);
    };
    backups.mount(recovery, () => ({ form: "eval-case", owner: [project], context, active: dirty, editable: !ui.currentProject || ui.currentProject() === project, busy, discard: () => { content.querySelector<HTMLFormElement>("form")!.reset(); changed(); }, restore: fields => {
      content.querySelector<HTMLTextAreaElement>('[name="query"]')!.value = fields.query || "";
      content.querySelector<HTMLSelectElement>('[name="judgment"]')!.value = fields.judgment || "useful_hit";
      const ids: unknown = JSON.parse(fields.goldTrapIds || "[]");
      content.querySelectorAll<HTMLInputElement>('[name="gold"]').forEach(box => box.checked = Array.isArray(ids) && ids.includes(Number(box.value)));
      changed();
    } }));
    function changed() {
      preview = null; accept.disabled = true; content.querySelector("[data-case-preview]")!.textContent = "";
      const none = read().judgment === "no_relevant_trap";
      content.querySelectorAll<HTMLInputElement>('[name="gold"]').forEach(box => { if (none) box.checked = false; box.disabled = none; });
      remember();
    }
    content.querySelector("fieldset")!.addEventListener("input", changed);
    content.querySelector("[data-case-preview-button]")!.addEventListener("click", () => void locked(async () => {
      preview = await post<CasePreview>(project, "case-preview", { input: read() });
      requestId = crypto.randomUUID();
      content.querySelector("[data-case-preview]")!.innerHTML = `<div class="revision-before"><strong>${e(preview.case.query)}</strong><p>${e(t(preview.case.judgment === "no_relevant_trap" ? "none" : "relevant"))} · ${preview.case.goldTrapIds.map(id => "#" + id).join(", ")}</p><p>${preview.before_count} → ${preview.after_count} ${e(t("cases"))}</p></div>`;
      show(t("previewOnly"));
    }).then(() => { if (preview) accept.disabled = false; }));
    accept.addEventListener("click", () => void locked(async () => {
      if (!preview) return;
      const submittedVersion = backups.version("eval-case", [project]);
      const result = await post<{ commit_id: string }>(project, "case-accept", { input: read(), digest: preview.digest, requestId });
      backups.clear("eval-case", [project], submittedVersion);
      content.innerHTML = `<p>${e(t("caseAdded"))}</p><code>${e(result.commit_id)}</code><p class="subtle">${e(t("receiptHelp"))}</p>`;
      show(t("done")); ui.changed(project);
    }));
  }
  return { mount };
}
