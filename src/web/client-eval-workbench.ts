import type { ControlledEvalWebExperiment, RetrievalEvalWebSummary } from "./evals-view";
import type { ControlledEvalCaseComparison } from "../lib/controlled-eval";

export interface EvalPresentation {
  t(key: string, params?: Record<string, unknown>): string;
  escapeHtml(value: unknown): string;
  escapeAttr(value: unknown): string;
  formatDisplayDate(value: unknown): string;
}
const score = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value * 100)}%`;

export function evalCoverage(retrieval: RetrievalEvalWebSummary, ui: EvalPresentation): string {
  const { t, escapeHtml: e } = ui;
  if (retrieval.availability !== "ready") return "";
  return `<div class="bench-coverage"><strong>${e(t("bench.coverage"))}</strong><span>${e(t("bench.coverageCounts", { positive: retrieval.positive_cases, negative: retrieval.negative_cases, total: retrieval.total_cases }))}</span>${retrieval.total_cases && !retrieval.negative_cases ? `<p class="bench-warning">${e(t("bench.noNegatives"))}</p>` : ""}</div>`;
}

function expectedText(item: ControlledEvalCaseComparison, experiment: ControlledEvalWebExperiment, ui: EvalPresentation): string {
  if (!item.gold_trap_ids.length) return ui.t("bench.noMatch");
  return item.gold_trap_ids.map(id => experiment.snapshot_evidence?.expected_traps.find(trap => trap.id === id)?.title ?? `#${id}`).join(" · ");
}

export function evalCaseTable(experiment: ControlledEvalWebExperiment, cases: ControlledEvalCaseComparison[], ui: EvalPresentation): string {
  const { t, escapeHtml: e, escapeAttr: a } = ui;
  if (!cases.length) return `<div class="evals-inline-empty">${e(t("evals.noCasesForFilter"))}</div>`;
  const result = (side: ControlledEvalCaseComparison["baseline"], positive: boolean) => `<strong class="bench-status ${side.passed ? "pass" : "fail"}">${e(t(side.passed ? "evals.pass" : "evals.fail"))}</strong><small>${positive ? `R@3 ${e(score(side.recallAt3))}` : e(t("bench.negativeMetric"))}</small><span class="bench-top-title">${e(side.top_results[0]?.title || t("bench.noResults"))}</span>`;
  return `<div class="bench-table-scroll" tabindex="0" role="region" aria-label="${a(t("evals.caseEvidence"))}"><table class="bench-case-table"><thead><tr><th scope="col">${e(t("bench.query"))}</th><th scope="col">${e(t("evals.baseline"))}</th><th scope="col">${e(t("evals.candidate"))}</th><th scope="col">${e(t("bench.change"))}</th></tr></thead><tbody>${cases.map(item => `<tr class="${a(item.classification)}"><th scope="row"><button type="button" data-controlled-case-id="${a(item.id)}" aria-label="${a(`${t("bench.inspect")}: ${item.query}`)}">${e(item.query)}</button><small>${e(expectedText(item, experiment, ui))}</small></th><td>${result(item.baseline, !!item.gold_trap_ids.length)}</td><td>${result(item.candidate, !!item.gold_trap_ids.length)}</td><td><span class="bench-outcome ${a(item.classification)}">${e(t(`evals.classification.${item.classification}`))}</span></td></tr>`).join("")}</tbody></table></div>`;
}

export function evalExperimentResult(experiment: ControlledEvalWebExperiment, cases: ControlledEvalCaseComparison[], filters: string, currentDigest: string | null | undefined, ui: EvalPresentation): string {
  const { t, escapeHtml: e } = ui;
  const s = experiment.summary;
  const positive = experiment.cases.filter(item => item.gold_trap_ids.length).length;
  const verdict = !s.total_cases ? t("bench.zeroCases") : s.regressions ? t("evals.regressionFound", { count: s.regressions }) : s.candidate_failed_cases ? t("bench.failures", { count: s.candidate_failed_cases }) : s.improvements ? t("bench.improvedVerdict", { count: s.improvements }) : t("evals.noRegressionFound");
  const side = (kind: "baseline" | "candidate") => `<section><span>${e(t(`evals.${kind}`))} · ${e(t(`evals.side.${experiment.configuration[kind].id}`))}</span><strong>${e(t("bench.passingCount", { passed: s.total_cases - s[`${kind}_failed_cases`], total: s.total_cases }))}<small>${e(t("bench.passing"))}</small></strong><p>Recall@3 ${e(positive ? score(s[`${kind}_metrics`].recall_at_3) : "—")} · MRR ${e(positive ? score(s[`${kind}_metrics`].mrr) : "—")}</p></section>`;
  return `<article class="bench-result">
    <header class="bench-result-head"><div><span class="overview-eyebrow">${e(t("bench.result"))} · ${e(t(`evals.profile.${experiment.profile}.short`))}</span><h3>${e(verdict)}</h3></div><div><span>${e(t("bench.examples", { count: s.total_cases, trials: experiment.configuration.trials }))}</span><small>${e(t(experiment.reproducible ? "evals.reproducible" : "evals.notReproducible"))} · ${e(ui.formatDisplayDate(experiment.created_at))}</small></div></header>
    ${currentDigest && currentDigest !== experiment.suite.sha256 ? `<p class="bench-warning">${e(t("bench.outdated"))}</p>` : ""}
    ${experiment.snapshot_evidence?.availability !== "ready" ? `<p class="bench-warning">${e(t("bench.snapshotMissing"))}</p>` : ""}
    <div class="bench-score-pair">${side("baseline")}${side("candidate")}</div>
    <div class="bench-result-counts"><span class="fail">${e(t("evals.regressionCount", { count: s.regressions }))}</span><span class="pass">${e(t("evals.improvementCount", { count: s.improvements }))}</span><span>${e(t("evals.changedCount", { count: s.changed }))}</span></div>
    <p class="bench-method">${e(t(`evals.profile.${experiment.profile}.question`))}</p>
    <div class="controlled-cases-head"><h4>${e(t("evals.caseEvidence"))}</h4>${filters}</div>
    ${evalCaseTable(experiment, cases, ui)}
    <details class="bench-disclosure" data-eval-disclosure="audit"><summary>${e(t("bench.audit"))}</summary><p>${e(t("bench.repeats"))}</p><p>${e(t("bench.negativeHelp"))}</p><dl class="bench-audit"><dt>Experiment</dt><dd>${e(experiment.id)}</dd><dt>Suite SHA256</dt><dd>${e(experiment.suite.sha256)}</dd><dt>Configuration</dt><dd>${e(experiment.configuration.fingerprint)}</dd><dt>Git</dt><dd>${e(experiment.repository.revision || t("evals.revisionUnknown"))}${experiment.repository.dirty ? " + dirty" : ""}</dd><dt>${e(t("evals.averageDuration", { duration: s.baseline_average_duration_ms }))}</dt><dd>${e(t("evals.baseline"))}</dd><dt>${e(t("evals.averageDuration", { duration: s.candidate_average_duration_ms }))}</dt><dd>${e(t("evals.candidate"))}</dd><dt>${e(t("evals.seedLabel"))}</dt><dd>${e(experiment.configuration.seed)}</dd></dl></details>
  </article>`;
}

export function evalCaseDetail(experiment: ControlledEvalWebExperiment, item: ControlledEvalCaseComparison, ui: EvalPresentation): string {
  const { t, escapeHtml: e } = ui;
  const positive = !!item.gold_trap_ids.length;
  const side = (kind: "baseline" | "candidate") => {
    const result = item[kind];
    return `<section><h3>${e(t(`evals.${kind}`))} <span class="bench-status ${result.passed ? "pass" : "fail"}">${e(t(result.passed ? "evals.pass" : "evals.fail"))}</span></h3><p>${e(t(`evals.side.${experiment.configuration[kind].id}`))}</p><p>${positive ? `Recall@3 ${e(score(result.recallAt3))} · Recall@5 ${e(score(result.recallAt5))} · MRR ${e(score(result.reciprocalRank))}` : e(t("bench.negativeHelp"))}</p>${result.error ? `<p class="bench-warning">${e(result.error)}</p>` : ""}<h4>${e(t("bench.topFive"))}</h4>${result.top_results.length ? `<ol>${result.top_results.map(trap => `<li><span>${e(trap.title)}</span><small>#${e(trap.id)} ${item.gold_trap_ids.includes(trap.id) ? `<b>${e(t(experiment.configuration[kind].memory === "expected_traps_masked" ? "bench.masked" : "bench.expected"))}</b>` : ""}</small></li>`).join("")}</ol>` : `<p>${e(t("bench.noResults"))}</p>`}</section>`;
  };
  return `<header class="bench-dialog-head"><h2 id="bench-case-title">${e(item.query)}</h2><button type="button" data-case-close>${e(t("bench.close"))}</button></header><p class="bench-snapshot ${experiment.snapshot_evidence?.availability === "ready" ? "" : "bench-warning"}">${e(t(experiment.snapshot_evidence?.availability === "ready" ? "bench.snapshot" : "bench.snapshotMissing"))}</p><p class="bench-expected">${e(expectedText(item, experiment, ui))}</p><div class="bench-detail-pair">${side("baseline")}${side("candidate")}</div><details class="bench-disclosure"><summary>${e(t("bench.audit"))}</summary><p>${e(item.fixture_mode)} · ${e(t("evals.fixtureQueryIndex", { index: item.evidence.query_index }))}</p><code>${e(item.evidence.fixture)}</code><p>Suite SHA256: ${e(experiment.suite.sha256)}</p></details>`;
}
