import type { TrapExperienceWebPayload } from "./client-library-contract";

interface ExperiencePresentation {
  text(key: string, params?: Record<string, unknown>): string;
  escape(value: unknown): string;
  date(value: unknown): string;
  valueLabel(value: unknown): string;
}

/** Explicit relations only. No layout engine and no inferred adoption edge. */
export function experiencePathContent(data: TrapExperienceWebPayload, ui: ExperiencePresentation): string {
  const { text: t, escape: e, valueLabel: label } = ui;
  const obs = data.observations;
  const ready = obs.availability === "ready";
  const ratings = obs.helpful + obs.irrelevant + obs.harmful;
  const sourcesReady = data.sources.availability === "ready";
  const nodes = [
    ["experience.source", sourcesReady ? String(data.sources.insights.length) : "—", t("experience.sourceDetail")],
    ["experience.confirmed", `#${data.trap.id}`, label(data.trap.scope)],
    ["experience.exposed", ready ? String(obs.exposure_count) : "—", ready ? t("experience.inRuns", { count: obs.run_count }) : t("experience.activityUnknown")],
    ["experience.feedback", ready ? String(ratings) : "—", t("experience.ratingBasis")],
  ];
  return `<div class="experience-heading"><div><span class="eyebrow">${e(t("experience.kicker"))}</span><h3>${e(t("experience.title"))}</h3></div><button type="button" class="ghost" data-experience-retry>${e(t("experience.refresh"))}</button></div>
    <p class="experience-scope-note">${e(t("experience.projectOnly"))}</p>
    <ol class="experience-path" aria-label="${e(t("experience.pathLabel"))}">${nodes.map(([title, value, detail], index) => `<li><span class="experience-node-label"><i>${index + 1}</i>${e(t(title!))}</span><strong>${e(value)}</strong><small>${e(detail)}</small></li>`).join("")}</ol>
    <div class="experience-sources">${sourcesReady
      ? data.sources.insights.length ? data.sources.insights.map((source) => `<button type="button" class="experience-source-link" data-experience-insight="${e(source.insight_id)}"><span>${e(t("experience.fromLearning"))}</span><strong>${e(source.title)}</strong><span aria-hidden="true">↗</span></button>`).join("") : `<p>${e(t("experience.noSource"))}</p>`
      : `<p role="status">${e(t("experience.sourcesUnavailable"))}</p>`}</div>
    ${ready ? `<div class="experience-facts">
      <span>${e(t("experience.revisions", { current: obs.current_revision_exposures, other: obs.other_revision_exposures }))}</span>
      <span>${e(t("experience.ratings", { helpful: obs.helpful, irrelevant: obs.irrelevant, harmful: obs.harmful }))}</span>
      ${obs.miss_reports ? `<span>${e(t("experience.misses", { count: obs.miss_reports }))}</span>` : ""}
      ${obs.superseded_feedback ? `<span>${e(t("experience.corrected", { count: obs.superseded_feedback }))}</span>` : ""}
    </div>` : `<p class="experience-empty" role="status">${e(t(obs.availability === "not_configured" ? "experience.notConfigured" : "experience.unavailable"))}</p>`}
    ${ready ? `<div class="experience-runs-head"><h4>${e(t("experience.runsTitle"))}</h4><span>${e(t("experience.page", { shown: obs.runs.length ? `${obs.offset + 1}–${obs.offset + obs.runs.length}` : "0", total: obs.run_count }))}</span></div>
    <div class="experience-run-list">${obs.runs.map((run) => `<button type="button" class="experience-run" data-experience-run="${e(run.id)}">
      <span class="experience-run-heading"><strong>${e(run.source_client || "other")} · ${e(label(run.status || "unknown"))}</strong><time>${e(run.started_at ? ui.date(run.started_at) : t("impact.noStart"))}</time></span>
      <span class="experience-run-facts"><span>${e(t("experience.exposureCount", { count: run.exposure_count }))}</span><span>${e(t("experience.runFeedback", { feedback: run.feedback ? label(run.feedback) : t("experience.noFeedback") }))}</span><span>${e(t("experience.validation", { status: label(run.latest_validation_status || "unknown") }))}</span></span>
      <span class="experience-run-id"><code>${e(run.id)}</code><span>${e(t("experience.openRun"))} ↗</span></span>
    </button>`).join("") || `<p class="experience-empty">${e(t("experience.noRuns"))}</p>`}</div>
    ${obs.offset > 0 || obs.has_more ? `<div class="experience-pagination"><button type="button" class="ghost" data-experience-offset="${Math.max(0, obs.offset - obs.limit)}" ${obs.offset ? "" : "disabled"}>${e(t("experience.previous"))}</button><button type="button" class="ghost" data-experience-offset="${obs.offset + obs.limit}" ${obs.has_more ? "" : "disabled"}>${e(t("experience.next"))}</button></div>` : ""}` : ""}
    <p class="experience-boundary">${e(t("experience.boundary"))}</p>`;
}
