import { createLearningDraftStore, LEARNING_DRAFT_PREFIX, type DraftSnapshot, type StoredLearningDraft, type DraftContent } from "./learning-draft-store";
import { learningKey, targetOf, type LearningFields, type LearningInsight, type LearningTarget } from "./learning-data";
import type { Translate } from "./platform";
interface Edits { practice?: { value: string; baseline?: string }; proposal?: { value: LearningFields } }
export function createLearningRecovery(deps: {
  entry(target: LearningTarget): Edits | undefined;
  current(): LearningInsight | null; active(): boolean; busy(): boolean;
  restore(snapshot: DraftSnapshot, insight: LearningInsight): void;
  t: Translate; escapeHtml(value: unknown): string;
}) {
  const store = createLearningDraftStore(() => window.localStorage);
  const owned = new Map<string, StoredLearningDraft>(), failed = new Set<string>();
  let recoveryError = false;
  const keyOf = (target: LearningTarget, kind: DraftContent["kind"]) => learningKey(target) + ":" + kind;
  const contents = (entry?: Edits): Array<DraftContent | null> => [entry?.practice ? { kind: "practice", value: entry.practice.value, baseline: entry.practice.baseline || "" } : null, entry?.proposal ? { kind: "proposal", value: entry.proposal.value } : null];
  const contentOf = (snapshot: DraftSnapshot): DraftContent => snapshot.kind === "practice" ? { kind: "practice", value: snapshot.value, baseline: snapshot.baseline } : { kind: "proposal", value: snapshot.value };
  function sync(target: LearningTarget) {
    const values = contents(deps.entry(target));
    for (const [index, kind] of (["practice", "proposal"] as const).entries()) {
      const key = keyOf(target, kind), previous = owned.get(key), content = values[index];
      if (!content && !previous) { failed.delete(key); continue; }
      if (content && previous && JSON.stringify(contentOf(previous.snapshot)) === JSON.stringify(content) && !failed.has(key)) continue;
      try {
        if (content) owned.set(key, store.put(target, content, previous));
        else if (previous) { store.remove(previous); owned.delete(key); }
        failed.delete(key);
      } catch { failed.add(key); }
    }
  }
  function safeToLeave() {
    if (failed.size) return false;
    try { return [...owned.values()].every(record => window.localStorage.getItem(record.key) === record.raw); }
    catch { return false; }
  }
  function render(insight: LearningInsight) {
    if (!deps.active()) return;
    const host = document.getElementById("learning-draft-recovery"), status = document.getElementById("learning-draft-storage");
    if (!host || !status) return;
    const target = targetOf(insight), entry = deps.entry(target), t = deps.t, esc = deps.escapeHtml;
    let records: StoredLearningDraft[] = [], skipped = 0, unavailable = false;
    try { const result = store.list(target); records = result.records.filter(r => ![...owned.values()].some(o => o.key === r.key)); skipped = result.skipped; }
    catch { unavailable = true; }
    const problem = recoveryError || unavailable || failed.size > 0 || !safeToLeave();
    status.textContent = t(problem ? "learningRecovery.unavailable" : skipped ? "learningRecovery.invalid" : entry?.practice || entry?.proposal ? "learningRecovery.stored" : "learningRecovery.retention");
    status.className = problem ? "inline-error" : "subtle";
    host.hidden = !records.length;
    if (!records.length) { host.replaceChildren(); return; }
    const previous = host.querySelector<HTMLSelectElement>("select")?.value;
    const staleChoice = previous !== undefined && !records.some(r => r.snapshot.id === previous);
    // This panel is independent of the editor; storage events never rerender fields.
    host.innerHTML = `<h3>${esc(t("learningRecovery.title"))}</h3><p>${esc(t("learningRecovery.hint"))}</p>
      <label for="learning-recovery-choice">${esc(t("learningRecovery.choose"))}</label>
      <select id="learning-recovery-choice">${staleChoice ? `<option value="" disabled>${esc(t("learningRecovery.chooseAgain"))}</option>` : ""}${records.map(r => `<option value="${esc(r.snapshot.id)}">${esc(t("learningRecovery." + r.snapshot.kind))} · ${esc(new Date(r.snapshot.updatedAt).toLocaleString(document.documentElement.lang || "en"))} · ${esc((r.snapshot.kind === "practice" ? r.snapshot.value : r.snapshot.value.title).replace(/\s+/g, " ").slice(0, 40))}</option>`).join("")}</select>
      <details><summary>${esc(t("learningRecovery.inspect"))}</summary><pre class="learning-recovery-preview"></pre></details>
      <p id="learning-recovery-notice"></p><div class="learning-agent-actions"><button type="button" class="ghost" id="learning-recovery-delete">${esc(t("learningRecovery.delete"))}</button><button type="button" class="primary" id="learning-recovery-restore">${esc(t("learningRecovery.restore"))}</button></div>`;
    const select = host.querySelector<HTMLSelectElement>("select")!, restore = host.querySelector<HTMLButtonElement>("#learning-recovery-restore")!, remove = host.querySelector<HTMLButtonElement>("#learning-recovery-delete")!;
    if (staleChoice) select.value = "";
    else if (records.some(r => r.snapshot.id === previous)) select.value = previous!;
    const selected = () => records.find(r => r.snapshot.id === select.value);
    function hint() {
      const record = selected();
      if (!record) {
        host!.querySelector("#learning-recovery-notice")!.textContent = t("learningRecovery.chooseAgain");
        host!.querySelector("pre")!.textContent = ""; restore.disabled = true; remove.disabled = true; select.disabled = deps.busy(); return;
      }
      const snapshot = record.snapshot, existing = deps.entry(target)?.[snapshot.kind];
      const changed = snapshot.kind === "practice" && snapshot.baseline !== (insight.learning_impact.progress.practice_note || "");
      const promoted = snapshot.kind === "proposal" && !!insight.learning_impact.promotion;
      host!.querySelector("#learning-recovery-notice")!.textContent = t(existing ? "learningRecovery.active" : changed ? "learningRecovery.changed" : promoted ? "learningRecovery.promoted" : "learningRecovery.check");
      host!.querySelector("pre")!.textContent = snapshot.kind === "practice" ? snapshot.value : Object.entries(snapshot.value).map(([key, value]) => `${t("label." + (key === "path_globs" ? "pathGlobs" : key))}:\n${value}`).join("\n\n");
      restore.disabled = deps.busy() || !!existing; remove.disabled = deps.busy(); select.disabled = deps.busy();
    }
    select.addEventListener("change", hint); hint();
    function act(recover: boolean) {
      if (deps.busy() || !deps.current() || learningKey(targetOf(deps.current()!)) !== learningKey(target)) return;
      const record = selected(); if (!record) return;
      const snapshot = record.snapshot, key = keyOf(target, snapshot.kind);
      if (recover && deps.entry(target)?.[snapshot.kind]) return;
      try {
        // Re-read after selection: another tab may already have consumed this key.
        if (!store.list(target).records.some(r => r.key === record.key && r.raw === record.raw)) { render(insight); return; }
        if (recover) deps.restore(snapshot, insight);
        // Keep the source copy if storing the restored in-tab draft failed.
        if (!recover || !failed.has(key)) store.remove(record);
        recoveryError = false;
      } catch { recoveryError = true; }
      render(insight);
    }
    restore.addEventListener("click", () => act(true)); remove.addEventListener("click", () => act(false));
  }
  window.addEventListener("storage", event => {
    if (event.key === null || event.key.startsWith(LEARNING_DRAFT_PREFIX)) { const insight = deps.current(); if (insight) render(insight); }
  });
  return { sync, render, safeToLeave };
}
