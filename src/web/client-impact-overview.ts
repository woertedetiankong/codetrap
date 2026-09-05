import type { ObservationOverviewProjection } from "../domain/observation";
import type { ObservationWebRun } from "./observation-view";

interface OverviewPresentation {
  text(key: string, params?: Record<string, unknown>): string;
  escape(value: unknown): string;
  relativeTime(value: unknown): string;
  duration(value: unknown): string;
  valueLabel(value: unknown): string;
}

/** A typed presentation component: no global browser state or data fetching. */
export function impactOverviewContent(
  overview: ObservationOverviewProjection,
  runs: ObservationWebRun[],
  ui: OverviewPresentation,
): string {
  const { text: t, escape: e } = ui;
  const ratings = overview.helpful_feedback + overview.harmful_feedback + overview.irrelevant_feedback;
  const validations = overview.validation_passed + overview.validation_failed;
  const negative = overview.harmful_feedback + overview.irrelevant_feedback;
  const metrics = [
    { value: overview.total_runs, label: "overview.runs", detail: t("overview.completed", { count: overview.completed_runs }) },
    { value: overview.exposure_count, label: "overview.exposures", detail: t("overview.searches", { count: overview.search_count }) },
    { value: ratings ? `${overview.helpful_feedback} / ${ratings}` : "—", label: "overview.helpful", detail: t(ratings ? "overview.ratingBasis" : "overview.awaitingFeedback") },
    { value: validations ? `${overview.validation_passed} / ${validations}` : "—", label: "overview.validation", detail: t(validations ? "overview.validationBasis" : "overview.awaitingValidation") },
  ];
  const signals = [
    { count: negative, title: "overview.negative", detail: t("overview.negativeDetail", { harmful: overview.harmful_feedback, irrelevant: overview.irrelevant_feedback }), target: "evals" },
    { count: overview.miss_reports, title: "overview.misses", detail: t("overview.missesDetail"), target: "evals" },
    { count: overview.partial_or_unknown_runs, title: "overview.incomplete", detail: t("overview.incompleteDetail"), target: "runs" },
  ];
  return `<section class="impact-hero overview-hero">
    <div class="impact-kicker">${e(t("overview.kicker"))}</div>
    <h2>${e(t("overview.headline"))}</h2>
    <p>${e(t("overview.intro"))}</p>
    <span class="overview-local">${e(t("impact.localOnly"))} · ${e(t("overview.allTime"))}</span>
  </section>
  <section class="overview-metrics" aria-label="${e(t("overview.metricsLabel"))}">
    ${metrics.map((metric) => `<article><span>${e(t(metric.label))}</span><strong>${e(metric.value)}</strong><small>${e(metric.detail)}</small></article>`).join("")}
  </section>
  <div class="overview-columns">
    <section class="overview-activity">
      <div class="overview-section-head"><div><span class="overview-eyebrow">${e(t("overview.activityKicker"))}</span><h3>${e(t("overview.recentRuns"))}</h3></div><button type="button" class="ghost" data-impact-tab="runs">${e(t("overview.allRuns"))} <span aria-hidden="true">↗</span></button></div>
      <div class="overview-run-list">${runs.slice(0, 5).map((run) => `<button type="button" class="overview-run" data-overview-run="${e(run.id)}">
        <span class="overview-run-marker ${run.status === "failed" ? "failed" : run.status === "completed" ? "completed" : "unknown"}" aria-hidden="true">${run.status === "completed" ? "✓" : run.status === "failed" ? "!" : "·"}</span>
        <span class="overview-run-main"><strong>${e(run.source_client || "other")} <span>${e(ui.valueLabel(run.status || "unknown"))}</span></strong><small>${e(t("overview.runSummary", { exposures: run.exposure_count, feedback: run.feedback_count }))}</small><code>${e(run.id)}</code></span>
        <span class="overview-run-time"><time>${e(run.started_at ? ui.relativeTime(run.started_at) : t("impact.noStart"))}</time><small>${e(ui.duration(run.duration_ms))}</small></span>
      </button>`).join("") || `<p class="subtle">${e(t("impact.noRunsCopy"))}</p>`}</div>
    </section>
    <section class="overview-attention">
      <span class="overview-eyebrow">${e(t("overview.nextKicker"))}</span>
      <h3>${e(t(negative || overview.miss_reports ? "overview.reviewNext" : ratings ? "overview.followNext" : "overview.feedbackNext"))}</h3>
      <p>${e(t("overview.nextCopy"))}</p>
      <div class="overview-signals">${signals.map((signal) => `<button type="button" class="overview-signal ${signal.count ? "has-signal" : ""}" data-impact-tab="${signal.target}"><span><strong>${e(t(signal.title))}</strong><small>${e(signal.detail)}</small></span><b>${e(signal.count)}</b></button>`).join("")}</div>
      <button type="button" class="primary" data-impact-tab="evals">${e(t("overview.reviewEvidence"))} <span aria-hidden="true">→</span></button>
    </section>
  </div>
  <footer class="overview-evidence-note"><strong>${e(t("overview.evidenceTitle"))}</strong><p>${e(t("overview.evidenceCopy"))}</p><small>${e(t("overview.corrections", { count: overview.superseded_feedback }))}</small></footer>`;
}

// Compatibility adapter for the standalone inline client; the component above
// can also be imported normally when the rest of the client becomes modules.
