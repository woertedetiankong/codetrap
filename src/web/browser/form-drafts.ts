import { createFormDraftStore, FORM_DRAFT_PREFIX, formOwnerKey, type FormFields, type FormKind, type FormSnapshot } from "./form-draft-store";
import type { StoredSnapshot } from "./snapshot-store";
import type { Translate } from "./platform";
export interface FormRecovery {
  form: FormKind; owner: string[]; context: string; active: boolean; editable: boolean; busy: boolean;
  restore(fields: FormFields): void; discard?(): void;
}
export function createFormDrafts(t: Translate) {
  const store = createFormDraftStore(), owned = new Map<string, StoredSnapshot<FormSnapshot>>(), failures = new Set<string>();
  const revisions = new Map<string, number>(), intents = new Map<string, string>();
  const mounted = new Map<HTMLElement, () => FormRecovery | null>();
  function remember(form: FormKind, owner: string[], context: string, fields: FormFields | null) {
    const key = formOwnerKey(form, owner), previous = owned.get(key);
    const intent = JSON.stringify([context, fields]);
    if (intents.get(key) !== intent) { intents.set(key, intent); revisions.set(key, (revisions.get(key) || 0) + 1); }
    try {
      if (!fields) { if (previous) store.remove(previous); owned.delete(key); }
      else if (!previous || previous.snapshot.context !== context || JSON.stringify(previous.snapshot.fields) !== JSON.stringify(fields) || failures.has(key)) owned.set(key, store.put({ form, owner, context, fields }, previous));
      failures.delete(key);
    } catch { failures.add(key); }
    refresh();
  }
  function safeToLeave() { try { return !failures.size && [...owned.values()].every(store.contains); } catch { return false; } }
  function render(host: HTMLElement, describe: () => FormRecovery | null) {
    const d = describe(); if (!d) { host.replaceChildren(); return; }
    const ownerKey = formOwnerKey(d.form, d.owner), previous = host.dataset.owner === ownerKey ? host.querySelector<HTMLSelectElement>("select")?.value : undefined;
    let records: StoredSnapshot<FormSnapshot>[] = [], invalid = false, error = false;
    try { const result = store.list(); invalid = result.skipped > 0; records = result.records.filter(r => formOwnerKey(r.snapshot.form, r.snapshot.owner) === ownerKey && !(d.active && r.snapshot.context === d.context && owned.get(ownerKey)?.key === r.key)); } catch { error = true; }
    host.dataset.owner = ownerKey; host.replaceChildren(); host.className = "form-draft-recovery";
    const status = document.createElement("p"); status.className = "subtle"; status.setAttribute("role", "status");
    status.textContent = t(error || !safeToLeave() ? "drafts.failed" : invalid ? "drafts.invalid" : d.active ? "drafts.saved" : "drafts.retention"); host.append(status);
    if (d.active && d.discard) {
      const discard = document.createElement("button"); discard.type = "button"; discard.className = "ghost"; discard.dataset.draftDiscard = ""; discard.textContent = t("review.discard"); discard.disabled = d.busy;
      discard.addEventListener("click", () => { const current = describe(); if (current && !current.busy && formOwnerKey(current.form, current.owner) === ownerKey) current.discard?.(); }); host.append(discard);
    }
    if (!records.length) return;
    const box = document.createElement("section"); box.className = "section learning-agent-card";
    const heading = document.createElement("h3"); heading.textContent = t("drafts.recover");
    const label = document.createElement("label"); label.textContent = t("drafts.choose");
    const select = document.createElement("select"); select.dataset.draftChoice = "";
    const stale = previous !== undefined && !records.some(r => r.snapshot.id === previous);
    if (stale) { const option = new Option(t("drafts.changedSelection"), ""); option.disabled = true; select.add(option); }
    for (const r of records) select.add(new Option(new Date(r.snapshot.updatedAt).toLocaleString(document.documentElement.lang || "en") + " · " + Object.values(r.snapshot.fields)[0]?.slice(0, 45), r.snapshot.id));
    if (stale) select.value = ""; else if (previous) select.value = previous;
    label.append(select);
    const details = document.createElement("details"), summary = document.createElement("summary"), pre = document.createElement("pre"); summary.textContent = t("drafts.inspect"); pre.className = "learning-recovery-preview"; details.append(summary, pre);
    const notice = document.createElement("p"); notice.dataset.draftNotice = "";
    const actions = document.createElement("div"); actions.className = "learning-agent-actions";
    const remove = document.createElement("button"), restore = document.createElement("button");
    remove.type = restore.type = "button"; remove.textContent = t("drafts.delete"); restore.textContent = t("drafts.restore"); remove.className = "ghost"; restore.className = "primary"; remove.dataset.draftDelete = ""; restore.dataset.draftRestore = "";
    const selected = () => records.find(r => r.snapshot.id === select.value);
    function hints() {
      const snapshot = selected()?.snapshot, current = describe();
      pre.textContent = snapshot ? Object.entries(snapshot.fields).map(([key, value]) => `${key}:\n${value}`).join("\n\n") : "";
      notice.textContent = t(!snapshot ? "drafts.changedSelection" : !current?.editable || snapshot.context !== current.context ? "drafts.contextChanged" : current.active ? "drafts.active" : "drafts.boundary");
      restore.disabled = !snapshot || !current || current.busy || !current.editable || current.active || snapshot.context !== current.context;
      remove.disabled = !snapshot || !!current?.busy; select.disabled = !!current?.busy;
    }
    const act = (recover: boolean) => {
      const record = selected(), current = describe(); if (!record || !current || current.busy || formOwnerKey(current.form, current.owner) !== ownerKey) return;
      if (recover && (!current.editable || current.active || current.context !== record.snapshot.context)) return;
      try {
        if (!store.list().records.some(r => r.key === record.key && r.raw === record.raw)) { render(host, describe); return; }
        if (recover) current.restore({ ...record.snapshot.fields });
        if (!recover || !failures.has(ownerKey)) store.remove(record);
      } catch { failures.add(ownerKey); }
      refresh();
    };
    select.addEventListener("change", hints); remove.addEventListener("click", () => act(false)); restore.addEventListener("click", () => act(true));
    actions.append(remove, restore); box.append(heading, label, details, notice, actions); host.append(box); hints();
  }
  function refresh() { for (const [host, describe] of mounted) { if (!host.isConnected) mounted.delete(host); else render(host, describe); } }
  window.addEventListener("storage", e => { if (e.key === null || e.key.startsWith(FORM_DRAFT_PREFIX)) refresh(); });
  return { remember, safeToLeave, refresh,
    version: (form: FormKind, owner: string[]) => revisions.get(formOwnerKey(form, owner)) || 0,
    clear(form: FormKind, owner: string[], submittedVersion: number) {
      if ((revisions.get(formOwnerKey(form, owner)) || 0) === submittedVersion) remember(form, owner, "cleared", null);
    },
    mount(host: HTMLElement, describe: () => FormRecovery | null) { mounted.set(host, describe); render(host, describe); } };
}
