import type { ObservationWebRun, ObservationRunWebPayload } from "./observation-view";

/** An unfinished record is not proof that the Agent process is still alive. */
export function runDisplayStatus(run: Pick<ObservationWebRun, "status" | "started_at" | "completed_at">): string {
  return run.status || (run.started_at && !run.completed_at ? "awaiting_completion" : "unknown");
}

export function runEvidenceContent(payload: Pick<ObservationRunWebPayload, "run" | "timeline" | "improvements" | "lesson_titles">, t: (key: string) => string, escape: (value: unknown) => string): string {
  const run = payload.run;
  if (!run) return "";
  const sources = new Map<string, typeof payload.timeline[number]>();
  for (const event of payload.timeline) {
    const f = event.facts;
    if (event.event_id && ["trap/exposed", "trap/feedback-recorded"].includes(event.type)
      && ["project", "global"].includes(String(f.trap_scope)) && Number.isSafeInteger(f.trap_id) && Number(f.trap_id) > 0) sources.set(`${f.trap_scope}:${f.trap_id}`, event);
  }
  const lessons = [...sources.values()];
  const revisions = payload.improvements?.items || [];
  const diagnostics = payload.timeline.some(e => e.type === "trap/search-completed" && Number(e.facts.diagnostic_count) > 0);
  const summary = lessons.length ? "focus.found" : !run.search_count ? "focus.quiet" : "focus.empty";
  const lessonCard = (event: typeof lessons[number]) => {
    const feedback = event.type === "trap/feedback-recorded" ? event.facts.feedback : null;
    return `<article class="feedback-lesson" data-feedback-row>
      <button type="button" class="feedback-lesson-title" data-experience-review="${escape(event.event_id)}">${escape(payload.lesson_titles?.[event.event_id!] || `${t("focus.lesson")} · ${event.facts.trap_scope} #${event.facts.trap_id}`)}</button>
      ${payload.lesson_titles?.[event.event_id!] ? `<div class="feedback-choices" role="group" aria-label="${escape(t("focus.prompt"))}">${["helpful", "irrelevant", "harmful"].map(value => `<button type="button" class="ghost" data-quick-feedback="${value}" data-feedback-event="${escape(event.event_id)}" aria-pressed="${feedback === value}" ${feedback === value ? "disabled" : ""}>${escape(t("focus." + value))}</button>`).join("")}</div>` : `<p class="subtle">${escape(t("focus.inspectFirst"))}</p>`}
      <small role="status" data-feedback-message>${feedback ? escape(t("focus.received") + " · " + t("revision." + feedback)) : ""}</small>
    </article>`;
  };
  return `<section class="impact-card run-evidence" aria-label="${escape(t("focus.title"))}">
    <div class="feedback-summary"><h2>${escape(t(summary))}${lessons.length ? ` <span class="pill">${lessons.length}</span>` : ""}</h2><p class="subtle">${escape(t(lessons.length ? "focus.prompt" : "focus.noAction"))}</p></div>
    ${diagnostics ? `<details class="feedback-diagnostic"><summary>${escape(t("focus.diagnostic"))}</summary><p>${escape(t("evidence.diagnostics"))}</p></details>` : ""}
    ${lessons.slice(0, 3).map(lessonCard).join("")}
    ${lessons.length > 3 ? `<details class="feedback-more"><summary>${escape(t("focus.more"))} (${lessons.length - 3})</summary>${lessons.slice(3).map(lessonCard).join("")}</details>` : ""}
    ${revisions.length || payload.improvements?.unavailable ? `<section class="feedback-progress"><h3>${escape(t("focus.progress"))}</h3>
      ${payload.improvements?.unavailable ? `<p role="status">${escape(t("evidence.unavailable"))}</p>` : ""}
      ${revisions.map(item => `<button type="button" class="feedback-revision" data-evidence-revision="${escape(item.id)}"><strong>${escape(t("focus.lesson"))} · ${escape(item.scope)} #${item.trap_id}</strong><span>${escape(t("revision." + item.status))} · ${escape(t("evidence." + item.evaluation))}</span><small>${escape(t(item.later_runs ? "focus.followup" : item.status === "accepted" ? "focus.waitingUse" : "focus.openRevision"))}${item.later_runs ? ` · ${item.later_runs}` : ""}</small></button>`).join("")}</section>` : lessons.some(e => e.type === "trap/feedback-recorded" && e.facts.feedback !== "helpful") ? `<p class="subtle feedback-next">${escape(t("focus.feedbackNext"))}</p>` : ""}
  </section>`;
}
