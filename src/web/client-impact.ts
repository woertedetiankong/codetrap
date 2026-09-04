/*
 * Impact browser functions are authored as real functions, then serialized
 * into the existing inline client. Keeping HTML template literals here avoids
 * a fragile second level of backtick/${} escaping inside client-script.ts.
 */
declare const state: any;
declare function el(id: string): any;
declare function t(key: string, params?: Record<string, unknown>): string;
declare function escapeHtml(value: unknown): string;
declare function escapeAttr(value: unknown): string;
declare function valueLabel(value: unknown): string;
declare function formatDisplayDate(value: unknown): string;
declare function api(path: string, options?: Record<string, unknown>): Promise<any>;
declare function syncWorkspaceRoute(replace?: boolean): void;
declare function showStatus(message: string, isError?: boolean): void;
declare function captureImpactScrollPosition(): { detail: number; queue: number };
declare function restoreImpactScrollPosition(position: { detail: number; queue: number }): void;

export function renderImpactQueue() {
  if (state.impactView === "evals") {
    renderImpactEvalQueue();
    return;
  }
  const queueMeta = el("queue-meta");
  queueMeta.textContent = state.projectRoot
    ? state.observationDemoRun ? t("impact.demoQueueMeta") : t("impact.queueMeta", { count: state.observationRuns.length })
    : t("empty.noProjects");
  if (!state.projectRoot) {
    el("candidates").innerHTML = '<div class="empty">' + escapeHtml(t("empty.noProjects")) + "</div>";
    return;
  }
  if (state.observationDemoRun) {
    const run = state.observationDemoRun.run;
    el("candidates").innerHTML = `
      <button type="button" class="row impact-run-row impact-demo-row active" data-impact-demo-open>
        <span class="impact-run-id">${escapeHtml(run.id)}</span>
        <span class="subtle">${escapeHtml(t("impact.demoQueueCopy"))}</span>
        <span class="meta">
          <span class="pill approved">${escapeHtml(t("impact.demoBadge"))}</span>
          <span class="pill">${escapeHtml(t("impact.events"))} ${run.event_count}</span>
        </span>
      </button>`;
    bindImpactOnboarding();
    return;
  }
  if (!state.observationRuns.length) {
    if (state.observationAvailability === "not_configured") {
      el("candidates").innerHTML = `<div class="empty impact-queue-empty"><strong>${escapeHtml(t("impact.queueNotConfiguredTitle"))}</strong><span>${escapeHtml(t("impact.queueNotConfiguredCopy"))}</span></div>`;
    } else {
      el("candidates").innerHTML = '<div class="empty">' + escapeHtml(t("impact.noRunsCopy")) + "</div>";
    }
    return;
  }
  el("candidates").innerHTML = state.observationRuns.map((run: any) => `
    <button type="button" class="row impact-run-row ${run.id === state.observationRunId ? "active" : ""}" data-observation-run="${escapeAttr(run.id)}">
      <span class="impact-run-id">${escapeHtml(run.id)}</span>
      <span class="subtle">${escapeHtml(run.started_at ? impactRelativeTime(run.started_at) : t("impact.noStart"))}</span>
      <span class="meta">
        ${impactStateDot(run.status)}
        <span class="pill ${run.completeness === "complete" ? "approved" : "warn"}">${escapeHtml(valueLabel(run.completeness))}</span>
        <span class="pill">${escapeHtml(run.source_client || "other")}</span>
        <span class="pill">${escapeHtml(t("impact.events"))} ${run.event_count}</span>
      </span>
    </button>
  `).join("");
  document.querySelectorAll("[data-observation-run]").forEach((button: any) => {
    button.addEventListener("click", () => loadImpactRun(button.dataset.observationRun));
  });
}

/**
 * Name a Run by what a person can act on — when it ran, which client, how long
 * it took. The opaque id stays on the page, but as identity rather than as the
 * largest text on it.
 */
export function impactRunHeadline(run: any) {
  const when = run.started_at ? impactRelativeTime(run.started_at) : t("impact.noStart");
  return t("impact.runHeadline", {
    client: run.source_client || "other",
    when,
    duration: impactDuration(run.duration_ms),
  });
}

export function impactStateDot(status: unknown) {
  const value = String(status || "unknown");
  const dotState = value === "completed" ? "done" : value === "failed" ? "error" : value === "unknown" ? "idle" : "ongoing";
  return `<span class="impact-state ${dotState}"><i aria-hidden="true"></i><span>${escapeHtml(valueLabel(value))}</span></span>`;
}

export function renderImpactDetail() {
  const tabs = impactTabs(state.impactView);
  el("detail-title").textContent = state.impactView === "runs"
    ? t("impact.runTimeline")
    : state.impactView === "evals" ? t("evals.title") : t("impact.overview");
  if (!state.projectRoot) {
    el("detail-meta").textContent = t("empty.noProjects");
    el("detail").innerHTML = `<div class="impact-shell">${tabs}${impactEmptyContent("--", t("empty.noProjects"), t("impact.notConfiguredCopy"))}</div>`;
    bindImpactTabs();
    return;
  }
  if (state.observationError) {
    el("detail-meta").textContent = state.projectRoot;
    el("detail").innerHTML = `<div class="impact-shell">${tabs}
      <div class="impact-notice error"><h3>${escapeHtml(t("impact.readErrorTitle"))}</h3><p>${escapeHtml(t("impact.readErrorCopy"))}</p><p>${escapeHtml(state.observationError)}</p></div>
      <div class="impact-empty-actions"><button type="button" class="primary" data-impact-retry>${escapeHtml(t("impact.retry"))}</button></div>
    </div>`;
    bindImpactTabs();
    return;
  }
  if (state.observationLoading && !state.observationOverview && !state.observationRunDetail && !state.observationEvals) {
    el("detail-meta").textContent = state.projectRoot;
    el("detail").innerHTML = `<div class="impact-shell">${tabs}${impactEmptyContent("···", el("detail-title").textContent, t("impact.loading"))}</div>`;
    bindImpactTabs();
    return;
  }
  if (state.impactView === "runs") renderImpactRunDetail();
  else if (state.impactView === "evals") renderImpactEvals();
  else renderImpactOverview();
}

/**
 * Re-render the detail pane in place. Filtering or selecting inside a view
 * rebuilds `#detail` wholesale, which would otherwise drop the scroll
 * container back to the top and carry the control the user just clicked off
 * screen.
 */
export function renderImpactDetailKeepingScroll() {
  const position = captureImpactScrollPosition();
  renderImpactDetail();
  restoreImpactScrollPosition(position);
}

export function renderImpactOverview() {
  const tabs = impactTabs("overview");
  el("detail-meta").textContent = state.observationOverview?.last_event_at
    ? t("impact.lastEvent", { time: formatDisplayDate(state.observationOverview.last_event_at) })
    : t("impact.noLastEvent");
  if (state.observationAvailability === "not_configured") {
    el("detail").innerHTML = `<div class="impact-shell">${tabs}${renderAgentObservationHealthNotice()}${impactFirstRunContent("01", t("impact.notConfiguredTitle"), t("impact.notConfiguredCopy"))}</div>`;
    bindImpactTabs();
    return;
  }
  if (!state.observationOverview || state.observationOverview.total_runs === 0) {
    el("detail").innerHTML = `<div class="impact-shell">${tabs}${renderAgentObservationHealthNotice()}${impactFirstRunContent("00", t("impact.noRunsTitle"), t("impact.noRunsCopy"))}</div>`;
    bindImpactTabs();
    return;
  }
  const overview = state.observationOverview;
  const evidence = overview.evidence || {};
  const strip = impactStatsStrip(overview);
  // Every tile is always rendered. A zero is the answer to "did anything come
  // back from those exposures", so hiding it makes "none" indistinguishable
  // from "not measured"; it is de-emphasised instead.
  const metricTiles: [unknown, string][] = [
    [overview.total_runs, t("impact.metric.runs")],
    [overview.completed_runs, t("impact.metric.completed")],
    [overview.exposure_count, t("impact.metric.exposures")],
    [overview.validation_passed, t("impact.metric.validation")],
    [overview.helpful_feedback, t("impact.metric.helpful")],
  ];
  el("detail").innerHTML = `<div class="impact-shell">
    ${tabs}
    ${renderAgentObservationHealthNotice()}
    <section class="impact-hero">
      <div class="impact-hero-grid">
        <div>
          <div class="impact-kicker">${escapeHtml(t("impact.kicker"))}</div>
          <h2>${escapeHtml(t("impact.headline"))}</h2>
          <p>${escapeHtml(t("impact.intro"))}</p>
          ${strip.length ? `<div class="impact-stats-strip">${strip.map((group: string) => `<span>${escapeHtml(group)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="impact-hero-side">
          <div class="impact-local-badge">${escapeHtml(t("impact.localOnly"))}</div>
        </div>
      </div>
    </section>
    ${metricTiles.length ? `<section class="impact-metrics">${metricTiles.map(([value, label]) => impactMetric(value, label)).join("")}</section>` : ""}
    ${overview.partial_or_unknown_runs > 0 ? `<section class="impact-notice warn" style="margin-top:12px"><h3>${escapeHtml(t("impact.partialTitle"))}</h3><p>${escapeHtml(t("impact.partialCopy"))}</p></section>` : ""}
    <section class="impact-grid">
      <div class="impact-card">
        <h3>${escapeHtml(t("impact.evidenceMix"))}</h3>
        ${impactMixBar(evidence)}
      </div>
      <div class="impact-notice">
        <h3>${escapeHtml(t("impact.privacyTitle"))}</h3>
        <p>${escapeHtml(t("impact.privacyCopy"))}</p>
      </div>
    </section>
  </div>`;
  bindImpactTabs();
}

export function renderAgentObservationHealthNotice() {
  const health = state.observationHookHealth;
  if (!health || health.status === "healthy") return "";
  if (health.status === "unavailable") {
    return `<section class="impact-notice warn impact-hook-health unavailable" role="status">
      <div class="impact-hook-health-mark">?</div>
      <div><h3>${escapeHtml(t("impact.hookHealthUnavailableTitle"))}</h3>
      <p>${escapeHtml(t("impact.hookHealthUnavailableCopy"))}</p>
      <code>${escapeHtml(health.state_file || ".codetrap/observations/agent-hook-state.json")}</code>
      <small>${escapeHtml(t("impact.hookHealthUnavailableAction"))}</small></div>
    </section>`;
  }
  const blocked = health.status === "blocked";
  const pending = Number(health.pending_start_count || 0);
  return `<section class="impact-notice warn impact-hook-health ${blocked ? "blocked" : ""}" role="status">
    <div class="impact-hook-health-mark">${blocked ? "\u00d7" : "!"}</div>
    <div><h3>${escapeHtml(t(blocked ? "impact.hookHealthBlockedTitle" : "impact.hookHealthAttentionTitle"))}</h3>
    <p>${escapeHtml(t("impact.hookHealthCopy", { active: health.active_count, capacity: health.capacity, stale: health.stale_count, days: health.stale_after_days }))}</p>
    ${pending ? `<p>${escapeHtml(t("impact.hookHealthPending", { count: pending }))}</p>` : ""}
    <code>codetrap observe recover --older-than-days ${escapeHtml(health.stale_after_days)} --json</code>
    <small>${escapeHtml(t("impact.hookHealthRecovery"))}</small></div>
  </section>`;
}

export function impactStatsStrip(overview: any) {
  const groups: string[] = [];
  groups.push(t("impact.strip.runs", { runs: Number(overview.total_runs || 0).toLocaleString(), completed: Number(overview.completed_runs || 0).toLocaleString() }));
  groups.push(t("impact.strip.exposures", { count: Number(overview.exposure_count || 0).toLocaleString() }));
  groups.push(t("impact.strip.validations", { count: Number(overview.validation_passed || 0).toLocaleString() }));
  groups.push(t("impact.strip.helpful", { count: Number(overview.helpful_feedback || 0).toLocaleString() }));
  return groups;
}

export function impactMixBar(evidence: any) {
  const items: [string, number, string][] = [
    ["observed", Number(evidence.observed_fact || 0), t("impact.observedFacts")],
    ["human", Number(evidence.human_label || 0), t("impact.humanLabels")],
    ["inference", Number(evidence.derived_inference || 0), t("impact.derivedInferences")],
    ["eval", Number(evidence.controlled_eval || 0), t("impact.controlledEvals")],
  ].filter(([, value]) => Number(value) > 0) as [string, number, string][];
  const total = items.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return "";
  // One class means the bar would be a single full-width block, which says
  // nothing a sentence does not say better.
  if (items.length === 1) {
    const [key, value, label] = items[0]!;
    return `<p class="impact-mix-single ${escapeAttr(key)}"><b>${escapeHtml(value.toLocaleString())}</b> ${escapeHtml(label)}<small>${escapeHtml(t("impact.mixSingle"))}</small></p>`;
  }
  const bar = items.map(([key, value]) => `<span class="impact-mix-seg ${escapeAttr(key)}" style="width:${((value / total) * 100).toFixed(2)}%"></span>`).join("");
  const legend = items.map(([key, value, label]) => `<span class="impact-mix-item ${escapeAttr(key)}"><i aria-hidden="true"></i><b>${escapeHtml(value.toLocaleString())}</b>${escapeHtml(label)}</span>`).join("");
  return `<div class="impact-mix-bar" role="img" aria-label="${escapeAttr(t("impact.evidenceMix"))}">${bar}</div><div class="impact-mix-legend">${legend}</div>`;
}

export function renderImpactRunDetail() {
  const demo = Boolean(state.observationDemoRun);
  const payload = state.observationDemoRun || state.observationRunDetail;
  const run = payload?.run;
  el("detail-meta").textContent = run?.started_at
    ? t("impact.runStarted", { time: formatDisplayDate(run.started_at) })
    : t("impact.noStart");
  if (!run) {
    el("detail").innerHTML = `<div class="impact-shell">${impactTabs("runs")}${impactEmptyContent("→", t("impact.runs"), t("impact.selectRun"))}</div>`;
    bindImpactTabs();
    return;
  }
  el("detail").innerHTML = `<div class="impact-shell">
    ${impactTabs("runs")}
    ${demo ? `<section class="impact-demo-banner" role="status"><div><span>${escapeHtml(t("impact.demoBadge"))}</span><strong>${escapeHtml(t("impact.demoNoticeTitle"))}</strong><p>${escapeHtml(t("impact.demoNoticeCopy"))}</p></div><button type="button" class="secondary" data-impact-demo-exit>${escapeHtml(t("impact.backToRealData"))}</button></section>` : ""}
    <div class="impact-run-head">
      <div><div class="impact-kicker">${escapeHtml(t("impact.runSummary"))}</div>
        <h2>${escapeHtml(impactRunHeadline(run))}</h2>
        <code class="impact-run-identity">${escapeHtml(run.id)}</code></div>
      <div class="impact-local-badge">${escapeHtml(demo ? t("impact.demoBadge") : t("impact.localOnly"))}</div>
    </div>
    <section class="impact-run-meta">
      ${impactSmallMetric(valueLabel(run.status || "unknown"), t("impact.status"))}
      ${impactSmallMetric(valueLabel(run.completeness), t("impact.completeness"))}
      ${impactSmallMetric(run.source_client || "other", t("impact.client"))}
      ${impactSmallMetric(valueLabel(run.latest_validation_status || "unknown"), t("impact.validation"))}
      ${impactSmallMetric(impactDuration(run.duration_ms), t("impact.duration"))}
      ${impactSmallMetric(impactTokens(run), t("impact.tokens"))}
      ${impactSmallMetric(run.search_count, t("impact.searches"))}
      ${impactSmallMetric(run.exposure_count, t("impact.exposures"))}
    </section>
    ${run.completeness !== "complete" ? `<section class="impact-notice warn"><h3>${escapeHtml(t("impact.partialTitle"))}</h3><p>${escapeHtml(t("impact.partialCopy"))}</p></section>` : ""}
    <section class="impact-card impact-timeline-card" style="margin-top:12px">
      <h3>${escapeHtml(t("impact.runTimeline"))}</h3>
      ${impactGantt(impactFilteredEvents(payload.timeline), run.started_at || null)}
      ${impactEventFilters(payload.timeline)}
      <div class="impact-timeline">${impactFilteredEvents(payload.timeline).map((event: any) => renderImpactEvent(event, run.started_at || null)).join("") || `<div class="empty">${escapeHtml(t("impact.filterEmpty"))}</div>`}</div>
    </section>
    <section class="impact-notice" style="margin-top:12px"><h3>${escapeHtml(t("impact.privacyTitle"))}</h3><p>${escapeHtml(t("impact.privacyCopy"))}</p></section>
  </div>`;
  bindImpactTabs();
  bindImpactEventControls();
}

export function impactFirstRunContent(mark: string, title: string, copy: string) {
  const actions = `<button type="button" class="primary" data-impact-demo-preview>${escapeHtml(t("impact.previewDemo"))}</button>
    <button type="button" class="secondary" data-impact-guide aria-expanded="${state.observationGuideOpen}">${escapeHtml(t(state.observationGuideOpen ? "impact.hideConnectionGuide" : "impact.showConnectionGuide"))}</button>
    <button type="button" class="secondary" data-impact-tab="evals">${escapeHtml(t("impact.viewOfflineEvals"))}</button>`;
  return `${impactEmptyContent(mark, title, copy, actions, t("impact.notConfiguredHint"))}
    ${impactOnboardingFlow()}
    ${state.observationGuideOpen ? impactConnectionGuide() : ""}`;
}

export function impactOnboardingFlow() {
  const steps = [
    ["01", "impact.flowAgentTitle", "impact.flowAgentCopy"],
    ["02", "impact.flowMetadataTitle", "impact.flowMetadataCopy"],
    ["03", "impact.flowEvidenceTitle", "impact.flowEvidenceCopy"],
  ];
  return `<section class="impact-onboarding-flow" aria-label="${escapeAttr(t("impact.flowLabel"))}">${steps.map(([index, title, copy]) => `
    <article><span>${index}</span><div><strong>${escapeHtml(t(title))}</strong><p>${escapeHtml(t(copy))}</p></div></article>`).join("")}</section>`;
}

export function impactConnectionGuide() {
  return `<section class="impact-connection-guide">
    <div class="impact-connection-head"><div><span>${escapeHtml(t("impact.connectionKicker"))}</span><h3>${escapeHtml(t("impact.connectionTitle"))}</h3></div><span class="pill info">${escapeHtml(t("impact.automaticBadge"))}</span></div>
    <p>${escapeHtml(t("impact.connectionCopy"))}</p>
    <div class="impact-auto-setup">
      <div><h4>${escapeHtml(t("impact.automaticTitle"))}</h4><p>${escapeHtml(t("impact.automaticCopy"))}</p></div>
      <div class="impact-auto-grid">
        ${impactAutoClient("Codex", "codetrap observe enable codex", "codetrap observe enable codex --apply")}
        ${impactAutoClient("Claude Code", "codetrap observe enable claude", "codetrap observe enable claude --apply")}
      </div>
      <p class="impact-auto-foot">${escapeHtml(t("impact.automaticTrust"))}<br>${escapeHtml(t("impact.automaticDisable"))}</p>
    </div>
    <div class="impact-manual-label"><span>${escapeHtml(t("impact.manualFallback"))}</span><span class="pill warn">${escapeHtml(t("impact.explicitCapture"))}</span></div>
    <div class="impact-agent-prompt"><span>${escapeHtml(t("impact.agentPromptLabel"))}</span><code>${escapeHtml(t("impact.agentPrompt"))}</code><button type="button" class="secondary" data-impact-copy-prompt>${escapeHtml(t("impact.copyAgentPrompt"))}</button><small data-impact-copy-status aria-live="polite"></small></div>
  </section>`;
}

export function impactAutoClient(label: string, preview: string, apply: string) {
  return `<article><strong>${escapeHtml(label)}</strong><span>${escapeHtml(t("impact.automaticPreview"))}</span><code>${escapeHtml(preview)}</code><span>${escapeHtml(t("impact.automaticApply"))}</span><code>${escapeHtml(apply)}</code></article>`;
}

export function createImpactDemoRun() {
  const completedAt = Date.now();
  const startedAt = completedAt - 42_000;
  const occurredAt = (offset: number) => new Date(startedAt + offset).toISOString();
  return {
    run: {
      id: t("impact.demoRunId"),
      started_at: occurredAt(0),
      completed_at: occurredAt(42_000),
      status: "completed",
      completeness: "complete",
      source_client: "codex",
      latest_validation_status: "passed",
      duration_ms: 42_000,
      input_tokens: null,
      output_tokens: null,
      search_count: 1,
      exposure_count: 1,
      validation_count: 1,
      feedback_count: 0,
      event_count: 5,
    },
    timeline: [
      { seq: 1, type: "run/started", occurred_at: occurredAt(0), evidence_class: "observed_fact", sensitivity: "metadata_only", facts: { source_client: "codex", completeness: "complete" } },
      { seq: 2, type: "trap/search-completed", occurred_at: occurredAt(7_000), evidence_class: "observed_fact", sensitivity: "metadata_only", facts: { mode: "hybrid", result_count: 1, diagnostic_count: 0 } },
      { seq: 3, type: "trap/exposed", occurred_at: occurredAt(8_000), evidence_class: "observed_fact", sensitivity: "metadata_only", facts: { trap_id: 7, rank: 1 } },
      { seq: 4, type: "validation/completed", occurred_at: occurredAt(34_000), evidence_class: "observed_fact", sensitivity: "metadata_only", facts: { kind: "test", status: "passed", passed: 3, failed: 0, duration_ms: 1_100 } },
      { seq: 5, type: "run/completed", occurred_at: occurredAt(42_000), evidence_class: "observed_fact", sensitivity: "metadata_only", facts: { status: "completed", completeness: "complete", duration_ms: 42_000 } },
    ],
  };
}

export function openImpactDemo() {
  if (!state.observationDemoRun) state.observationDemoRun = createImpactDemoRun();
  state.observationGuideOpen = false;
  state.observationRunId = null;
  state.observationRunDetail = null;
  state.impactView = "runs";
  syncWorkspaceRoute();
  el("queue-title").textContent = t("impact.runs");
  renderImpactQueue();
  renderImpactDetail();
}

export function closeImpactDemo() {
  state.observationDemoRun = null;
  state.impactView = "overview";
  syncWorkspaceRoute();
  el("queue-title").textContent = t("impact.runs");
  renderImpactQueue();
  renderImpactDetail();
}

export function bindImpactOnboarding() {
  document.querySelectorAll("[data-impact-demo-preview], [data-impact-demo-open]").forEach((button: any) => {
    button.addEventListener("click", openImpactDemo);
  });
  document.querySelectorAll("[data-impact-demo-exit]").forEach((button: any) => {
    button.addEventListener("click", closeImpactDemo);
  });
  document.querySelectorAll("[data-impact-guide]").forEach((button: any) => {
    button.addEventListener("click", () => {
      state.observationGuideOpen = !state.observationGuideOpen;
      renderImpactDetail();
    });
  });
  document.querySelectorAll("[data-impact-copy-prompt]").forEach((button: any) => {
    button.addEventListener("click", async () => {
      const status = document.querySelector("[data-impact-copy-status]");
      try {
        await navigator.clipboard.writeText(t("impact.agentPrompt"));
        button.textContent = t("impact.copied");
        if (status) status.textContent = t("impact.copySuccess");
      } catch {
        if (status) status.textContent = t("impact.copyFailed");
      }
    });
  });
}

export function impactTabs(active: string) {
  return `<div class="impact-tabs" role="tablist" aria-label="${escapeAttr(t("nav.impact"))}">
    <button type="button" role="tab" aria-selected="${active === "overview"}" class="${active === "overview" ? "active" : ""}" data-impact-tab="overview">${escapeHtml(t("impact.overview"))}</button>
    <button type="button" role="tab" aria-selected="${active === "runs"}" class="${active === "runs" ? "active" : ""}" data-impact-tab="runs">${escapeHtml(t("impact.runs"))}</button>
    <button type="button" role="tab" aria-selected="${active === "evals"}" class="${active === "evals" ? "active" : ""}" data-impact-tab="evals">${escapeHtml(t("evals.title"))}</button>
  </div>`;
}

export function bindImpactTabs() {
  document.querySelectorAll("[data-impact-tab]").forEach((button: any) => {
    button.addEventListener("click", () => {
      if (button.dataset.impactTab === "overview") {
        state.impactView = "overview";
        syncWorkspaceRoute();
        el("queue-title").textContent = t("impact.runs");
        renderImpactQueue();
        renderImpactDetail();
        return;
      }
      if (button.dataset.impactTab === "evals") {
        state.impactView = "evals";
        syncWorkspaceRoute();
        el("queue-title").textContent = t("evals.reviewQueue");
        renderImpactQueue();
        renderImpactDetail();
        loadImpactEvals();
        return;
      }
      const runId = state.observationRunId || state.observationRuns[0]?.id;
      if (runId) loadImpactRun(runId);
      else {
        state.impactView = "runs";
        syncWorkspaceRoute();
        el("queue-title").textContent = t("impact.runs");
        renderImpactQueue();
        renderImpactDetail();
      }
    });
  });
  document.querySelectorAll("[data-impact-retry]").forEach((button: any) => {
    button.addEventListener("click", () => loadImpact());
  });
  bindImpactOnboarding();
}

export function renderImpactEvals() {
  const payload = state.observationEvals;
  el("detail-meta").textContent = t("evals.localReadOnly");
  if (!payload) {
    el("detail").innerHTML = `<div class="impact-shell">${impactTabs("evals")}${impactEmptyContent("E", t("evals.noDataTitle"), t("evals.noDataCopy"))}</div>`;
    bindImpactTabs();
    return;
  }
  const retrieval = payload.retrieval || {};
  const observed = payload.observed;
  const controlled = payload.controlled || {};
  const candidates = filteredEvalCandidates();
  const candidateCount = (payload.candidate_groups || []).length;
  el("detail").innerHTML = `<div class="impact-shell evals-shell">
    ${impactTabs("evals")}
    <section class="evals-hero">
      <div>
        <div class="impact-kicker">${escapeHtml(t("evals.kicker"))}</div>
        <h2>${escapeHtml(t("evals.headline"))}</h2>
        <p>${escapeHtml(t("evals.intro"))}</p>
      </div>
      <div class="evals-verdict"><span>${escapeHtml(t("evals.noSingleScore"))}</span><strong>4</strong><small>${escapeHtml(t("evals.evidenceLanes"))}</small></div>
    </section>
    <section class="evals-lanes" aria-label="${escapeAttr(t("evals.evidenceLanes"))}">
      ${evalLane("01", t("evals.retrievalLane"), t("evals.retrievalLaneCopy"), retrieval.availability === "ready" ? "ready" : "setup")}
      ${evalLane("02", t("evals.controlledLane"), t("evals.controlledLaneCopy"), controlled.availability === "partial" ? "review" : controlled.experiments?.length ? "ready" : "setup")}
      ${evalLane("03", t("evals.observedLane"), t("evals.observedLaneCopy"), observed ? "ready" : "setup")}
      ${evalLane("04", t("evals.candidateLane"), t("evals.candidateLaneCopy"), candidateCount ? "review" : "clear")}
    </section>
    <section class="evals-section">
      <div class="evals-section-head"><div><span>01 / RETRIEVAL</span><h3>${escapeHtml(t("evals.retrievalTitle"))}</h3></div><span class="pill">${escapeHtml(t("evals.deterministic"))}</span></div>
      ${renderRetrievalEval(retrieval)}
    </section>
    <section class="evals-section">
      <div class="evals-section-head"><div><span>02 / CONTROLLED</span><h3>${escapeHtml(t("evals.controlledTitle"))}</h3></div><span class="pill">${escapeHtml(t("evals.zeroCost"))}</span></div>
      ${renderControlledEvals(controlled)}
    </section>
    <section class="evals-section">
      <div class="evals-section-head"><div><span>03 / OBSERVED</span><h3>${escapeHtml(t("evals.observedTitle"))}</h3></div><span class="pill warn">${escapeHtml(t("evals.associationOnly"))}</span></div>
      ${renderObservedEvals(observed, payload.observation_availability)}
    </section>
    <section class="evals-section">
      <div class="evals-section-head"><div><span>04 / REVIEW</span><h3>${escapeHtml(t("evals.candidatesTitle", { count: candidateCount }))}</h3></div><span class="pill">${escapeHtml(t("evals.unconfirmed"))}</span></div>
      ${evalCandidateFilters()}
      <div class="eval-candidate-list">${candidates.length ? candidates.map(renderEvalCandidate).join("") : `<div class="evals-inline-empty">${escapeHtml(t(candidateCount ? "evals.filterEmpty" : "evals.candidatesEmpty"))}</div>`}</div>
      ${renderEvalReviewPanel(selectedEvalCandidate(), payload)}
    </section>
  </div>`;
  bindImpactTabs();
  bindEvalControls();
  bindControlledEvalControls();
}

export function renderImpactEvalQueue() {
  const payload = state.observationEvals;
  const candidates = filteredEvalCandidates();
  el("queue-title").textContent = t("evals.reviewQueue");
  el("queue-meta").textContent = t("evals.queueMeta", { shown: candidates.length, total: (payload?.candidate_groups || []).length });
  if (!state.projectRoot) {
    el("candidates").innerHTML = '<div class="empty">' + escapeHtml(t("empty.noProjects")) + "</div>";
    return;
  }
  if (!payload) {
    el("candidates").innerHTML = '<div class="empty">' + escapeHtml(t("evals.noDataCopy")) + "</div>";
    return;
  }
  if (!candidates.length) {
    el("candidates").innerHTML = (payload.candidate_groups || []).length
      ? '<div class="empty">' + escapeHtml(t("evals.filterEmpty")) + "</div>"
      : `<div class="empty impact-queue-empty"><strong>${escapeHtml(t("evals.queueEmptyTitle"))}</strong><span>${escapeHtml(t("evals.queueEmptyCopy"))}</span></div>`;
    return;
  }
  el("candidates").innerHTML = candidates.map((group: any) => {
    const count = Number(group.occurrence_count || 1);
    return `<button type="button" class="row eval-queue-row" data-eval-run="${escapeAttr(evalGroupLatestRunId(group))}">
    <span class="eval-reason-code">${escapeHtml(valueLabel(group.reason))}</span>
    <strong>${escapeHtml(evalGroupTitle(group))}</strong>
    <span class="subtle">${escapeHtml(t("evals.lastSeen", { time: formatDisplayDate(group.last_occurred_at) }))}</span>
    <span class="meta"><span class="pill warn">${escapeHtml(valueLabel(group.review_status))}</span>${count > 1 ? `<span class="pill occurrences">${escapeHtml(t("evals.occurrences", { count }))}</span>` : ""}<span class="pill">${escapeHtml(t("evals.runsSeen", { count: (group.run_ids || []).length }))}</span></span>
  </button>`;
  }).join("");
  bindEvalRunLinks(el("candidates"));
}

export function renderRetrievalEval(retrieval: any) {
  if (retrieval.availability === "ready") {
    return `<div class="eval-metric-grid">
      ${evalScoreMetric(retrieval.recall_at_3, "Recall@3", t("evals.cases", { count: retrieval.total_cases }))}
      ${evalScoreMetric(retrieval.recall_at_5, "Recall@5", t("evals.cases", { count: retrieval.total_cases }))}
      ${evalScoreMetric(retrieval.mrr, "MRR", t("evals.failedCases", { count: retrieval.failed_cases }))}
      ${evalCountMetric(retrieval.miss_cases, t("evals.misses"), t("evals.inspectOnly"))}
    </div><p class="eval-source">${escapeHtml(t("evals.fixtureSource", { source: retrieval.source }))}</p>`;
  }
  const invalid = retrieval.availability === "invalid";
  return `<div class="impact-notice ${invalid ? "error" : ""}"><h3>${escapeHtml(t(invalid ? "evals.fixtureInvalidTitle" : "evals.fixtureMissingTitle"))}</h3><p>${escapeHtml(t(invalid ? "evals.fixtureInvalidCopy" : "evals.fixtureMissingCopy", { source: retrieval.source }))}</p><code>${escapeHtml(retrieval.source || "src/tests/fixtures/search-eval.json")}</code></div>`;
}

export function renderControlledEvals(controlled: any) {
  const availability = controlled?.availability || "not_configured";
  if (availability !== "ready" && availability !== "partial") {
    const invalid = availability === "invalid";
    return `<div class="impact-notice ${invalid ? "error" : ""}"><h3>${escapeHtml(t(invalid ? "evals.controlledUnavailableTitle" : "evals.controlledMissingTitle"))}</h3><p>${escapeHtml(t(invalid ? "evals.controlledUnavailableCopy" : "evals.controlledMissingCopy"))}</p></div>`;
  }
  const profiles = controlled.profiles || [];
  const experiments = controlled.experiments || [];
  const corruptResults = controlled.corrupt_results || [];
  const partialWarning = availability === "partial"
    ? `<div class="impact-notice warn controlled-store-warning" role="status"><h3>${escapeHtml(t("evals.controlledPartialTitle"))}</h3><p>${escapeHtml(t("evals.controlledPartialCopy", { count: corruptResults.length }))}</p><code>${escapeHtml(corruptResults.slice(0, 3).map((item: any) => item.file).join(", "))}</code></div>`
    : "";
  const experiment = selectedControlledExperiment(controlled);
  const profile = profiles.find((item: any) => item.id === state.controlledEvalProfile) || profiles[0];
  const error = state.controlledEvalError
    ? `<div class="impact-notice error controlled-eval-error"><strong>${escapeHtml(t("evals.controlledRunFailed"))}</strong><p>${escapeHtml(state.controlledEvalError)}</p></div>`
    : "";
  const history = experiments.length
    ? `<label class="controlled-history"><span>${escapeHtml(t("evals.experimentHistory"))}</span><select data-controlled-history>${experiments.map((item: any) => `<option value="${escapeAttr(item.id)}" ${item.id === experiment?.id ? "selected" : ""}>${escapeHtml(formatDisplayDate(item.created_at))} · ${escapeHtml(t(`evals.profile.${item.profile}.short`))}</option>`).join("")}</select></label>`
    : `<span class="controlled-no-history">${escapeHtml(t("evals.noExperiments"))}</span>`;
  return `<div class="controlled-eval-bench">
    <div class="controlled-blueprint" aria-hidden="true"><span>BASELINE</span><i></i><span>CANDIDATE</span></div>
    <form class="controlled-run-form" data-controlled-eval-form>
      <div class="controlled-run-copy"><span>${escapeHtml(t("evals.controlledQuestionLabel"))}</span><strong>${escapeHtml(profile ? t(`evals.profile.${profile.id}.name`) : "—")}</strong><p>${escapeHtml(profile ? t(`evals.profile.${profile.id}.question`) : "")}</p></div>
      <label class="eval-field"><span>${escapeHtml(t("evals.profileLabel"))}</span><select name="profile">${profiles.map((item: any) => `<option value="${escapeAttr(item.id)}" ${item.id === state.controlledEvalProfile ? "selected" : ""}>${escapeHtml(t(`evals.profile.${item.id}.name`))}</option>`).join("")}</select></label>
      <label class="eval-field"><span>${escapeHtml(t("evals.trialsLabel"))}</span><select name="trials">${[1, 2, 3, 4, 5].map((count) => `<option value="${count}" ${Number(state.controlledEvalTrials) === count ? "selected" : ""}>${escapeHtml(t("evals.trialCount", { count }))}</option>`).join("")}</select></label>
      <label class="eval-field controlled-seed"><span>${escapeHtml(t("evals.seedLabel"))}</span><input name="seed" maxlength="80" value="${escapeAttr(state.controlledEvalSeed)}"></label>
      <button type="submit" class="primary controlled-run-button" ${state.controlledEvalBusy ? "disabled" : ""}>${escapeHtml(t(state.controlledEvalBusy ? "evals.runningExperiment" : "evals.runExperiment"))}</button>
      <div class="controlled-guardrails"><span>0 ${escapeHtml(t("evals.modelCalls"))}</span><span>${escapeHtml(t("evals.inMemoryOnly"))}</span><span>${escapeHtml(t("evals.fixtureUnchanged"))}</span></div>
    </form>
    ${partialWarning}
    ${error}
    <div class="controlled-history-row">${history}<small>${escapeHtml(t("evals.controlledBoundary"))}</small></div>
    ${experiment ? renderControlledExperiment(experiment) : renderControlledEmpty()}
  </div>`;
}

export function selectedControlledExperiment(controlled: any = state.observationEvals?.controlled) {
  const experiments = controlled?.experiments || [];
  return experiments.find((item: any) => item.id === state.controlledEvalExperimentId) || experiments[0] || null;
}

export function renderControlledEmpty() {
  return `<div class="controlled-empty"><span>Δ</span><div><strong>${escapeHtml(t("evals.noExperimentTitle"))}</strong><p>${escapeHtml(t("evals.noExperimentCopy"))}</p></div></div>`;
}

export function renderControlledExperiment(experiment: any) {
  const summary = experiment.summary || {};
  const hasRegression = Number(summary.regressions || 0) > 0;
  const attentionCases = controlledExperimentCases(experiment);
  const fingerprint = String(experiment.configuration?.fingerprint || "").slice(0, 12);
  const fixtureSha = String(experiment.suite?.sha256 || "").slice(0, 12);
  const revision = experiment.repository?.revision ? String(experiment.repository.revision).slice(0, 10) : t("evals.revisionUnknown");
  return `<article class="controlled-result ${hasRegression ? "has-regression" : "clear"}">
    <header class="controlled-result-head">
      <div class="controlled-verdict-mark"><span>${hasRegression ? "!" : "✓"}</span><div><small>${escapeHtml(t("evals.controlledVerdict"))}</small><strong>${escapeHtml(t(hasRegression ? "evals.regressionFound" : "evals.noRegressionFound", { count: summary.regressions || 0 }))}</strong></div></div>
      <div class="controlled-result-facts"><span>${escapeHtml(t("evals.sampleSize", { count: summary.total_cases || 0 }))}</span><span>${escapeHtml(t(experiment.reproducible ? "evals.reproducible" : "evals.notReproducible"))}</span><span>${escapeHtml(t("evals.completedIn", { duration: experiment.duration_ms || 0 }))}</span></div>
    </header>
    <div class="controlled-sides">
      ${renderControlledSide("baseline", experiment.configuration?.baseline, summary.baseline_metrics, summary.baseline_failed_cases, summary.baseline_average_duration_ms)}
      <div class="controlled-delta"><span>Δ</span><strong>${escapeHtml(formatControlledDelta(summary.duration_delta_ms))}</strong><small>${escapeHtml(t("evals.durationDelta"))}</small></div>
      ${renderControlledSide("candidate", experiment.configuration?.candidate, summary.candidate_metrics, summary.candidate_failed_cases, summary.candidate_average_duration_ms)}
    </div>
    <div class="controlled-summary-strip"><span class="regressed">${escapeHtml(t("evals.regressionCount", { count: summary.regressions || 0 }))}</span><span class="improved">${escapeHtml(t("evals.improvementCount", { count: summary.improvements || 0 }))}</span><span>${escapeHtml(t("evals.changedCount", { count: summary.changed || 0 }))}</span><span>${escapeHtml(t("evals.intentionalVariable"))}: ${escapeHtml(t(`evals.profile.${experiment.profile}.variable`))}</span></div>
    <div class="controlled-audit"><code>${escapeHtml(experiment.id)}</code><span>fixture ${escapeHtml(fixtureSha)}</span><span>config ${escapeHtml(fingerprint)}</span><span>git ${escapeHtml(revision)}${experiment.repository?.dirty ? " + dirty" : ""}</span><span>${escapeHtml(t("evals.trialsAudit", { count: experiment.configuration?.trials || 1 }))}</span></div>
    <div class="controlled-cases-head"><div><span>${escapeHtml(t("evals.caseEvidence"))}</span><strong>${escapeHtml(t("evals.regressionsFirst"))}</strong></div>${controlledCaseFilters()}</div>
    <div class="controlled-case-list" tabindex="0" aria-label="${escapeAttr(t("evals.caseEvidence"))}">${attentionCases.length ? attentionCases.map(renderControlledCase).join("") : `<div class="evals-inline-empty">${escapeHtml(t("evals.noCasesForFilter"))}</div>`}</div>
  </article>`;
}

export function renderControlledSide(kind: string, identity: any, metrics: any, failed: number, duration: number) {
  return `<section class="controlled-side ${escapeAttr(kind)}"><span>${escapeHtml(kind === "baseline" ? t("evals.baseline") : t("evals.candidate"))}</span><h4>${escapeHtml(identity?.id ? t(`evals.side.${identity.id}`) : "—")}</h4><div><b>${escapeHtml(formatControlledScore(metrics?.recall_at_3))}</b><small>Recall@3</small></div><div><b>${escapeHtml(formatControlledScore(metrics?.mrr))}</b><small>MRR</small></div><div><b>${escapeHtml(failed || 0)}</b><small>${escapeHtml(t("evals.failed"))}</small></div><footer>${escapeHtml(t("evals.averageDuration", { duration: duration || 0 }))}</footer></section>`;
}

export function controlledCaseFilters() {
  return `<div class="eval-filters controlled-case-filters" aria-label="${escapeAttr(t("evals.caseFilterLabel"))}">${[
    ["attention", "evals.filterAttention"],
    ["regressed", "evals.filterRegressions"],
    ["all", "evals.filterAllCases"],
  ].map(([value, key]) => `<button type="button" data-controlled-case-filter="${value}" class="${state.controlledEvalCaseFilter === value ? "active" : ""}">${escapeHtml(t(key))}</button>`).join("")}</div>`;
}

export function controlledExperimentCases(experiment: any) {
  const cases = experiment?.cases || [];
  if (state.controlledEvalCaseFilter === "regressed") return cases.filter((item: any) => item.classification === "regressed");
  if (state.controlledEvalCaseFilter === "attention") return cases.filter((item: any) => item.classification !== "unchanged_pass");
  return cases;
}

export function renderControlledCase(item: any) {
  const baselineTop = item.baseline?.top_results?.[0]?.title || t("evals.noTopResult");
  const candidateTop = item.candidate?.top_results?.[0]?.title || t("evals.noTopResult");
  return `<article class="controlled-case ${escapeAttr(item.classification)}" id="controlled-${escapeAttr(item.id)}"><div class="controlled-case-index"><span>${escapeHtml(t(`evals.classification.${item.classification}`))}</span><b>#${escapeHtml(item.evidence?.query_index || "—")}</b></div><div class="controlled-case-main"><h4>${escapeHtml(item.query)}</h4><p>${escapeHtml(t("evals.expectedIds", { ids: item.gold_trap_ids?.length ? item.gold_trap_ids.map((id: any) => `#${id}`).join(", ") : t("evals.noRelevantTrap") }))}</p><div class="controlled-case-compare"><span><i>${escapeHtml(t("evals.baseline"))}</i><b>${escapeHtml(item.baseline?.passed ? t("evals.pass") : t("evals.fail"))}</b><small>R@3 ${escapeHtml(formatControlledScore(item.baseline?.recallAt3))} · ${escapeHtml(baselineTop)}</small></span><em>→</em><span><i>${escapeHtml(t("evals.candidate"))}</i><b>${escapeHtml(item.candidate?.passed ? t("evals.pass") : t("evals.fail"))}</b><small>R@3 ${escapeHtml(formatControlledScore(item.candidate?.recallAt3))} · ${escapeHtml(candidateTop)}</small></span></div></div><footer><code>${escapeHtml(item.evidence?.fixture || "")}</code><span>${escapeHtml(t("evals.fixtureQueryIndex", { index: item.evidence?.query_index || "—" }))}</span></footer></article>`;
}

export function bindControlledEvalControls() {
  const form = document.querySelector("[data-controlled-eval-form]") as any;
  if (form) {
    form.querySelector('[name="profile"]')?.addEventListener("change", (event: any) => {
      state.controlledEvalProfile = event.target.value;
      renderImpactDetailKeepingScroll();
    });
    form.querySelector('[name="trials"]')?.addEventListener("change", (event: any) => {
      state.controlledEvalTrials = Number(event.target.value);
    });
    form.querySelector('[name="seed"]')?.addEventListener("input", (event: any) => {
      state.controlledEvalSeed = event.target.value;
    });
    form.addEventListener("submit", (event: any) => {
      event.preventDefault();
      runControlledEval(form);
    });
  }
  document.querySelector("[data-controlled-history]")?.addEventListener("change", (event: any) => {
    state.controlledEvalExperimentId = event.target.value;
    state.controlledEvalCaseFilter = "attention";
    renderImpactDetailKeepingScroll();
  });
  document.querySelectorAll("[data-controlled-case-filter]").forEach((button: any) => {
    button.addEventListener("click", () => {
      state.controlledEvalCaseFilter = button.dataset.controlledCaseFilter;
      renderImpactDetailKeepingScroll();
    });
  });
}

export async function runControlledEval(form: any) {
  if (state.controlledEvalBusy) return;
  const data = new FormData(form);
  state.controlledEvalProfile = String(data.get("profile") || "memory_contribution_v1");
  state.controlledEvalTrials = Number(data.get("trials") || 2);
  state.controlledEvalSeed = String(data.get("seed") || "codetrap-controlled-v1").trim();
  state.controlledEvalBusy = true;
  state.controlledEvalError = "";
  renderImpactDetail();
  try {
    const result = await api("/api/observations/controlled-evals/run", {
      method: "POST",
      body: JSON.stringify({
        projectRoot: state.projectRoot,
        profile: state.controlledEvalProfile,
        trials: state.controlledEvalTrials,
        seed: state.controlledEvalSeed,
      }),
    });
    state.controlledEvalExperimentId = result.experiment.id;
    state.controlledEvalCaseFilter = "attention";
    await loadImpactEvals();
    showStatus(t("evals.controlledRunComplete"));
  } catch (error) {
    state.controlledEvalError = error instanceof Error ? error.message : String(error);
  } finally {
    state.controlledEvalBusy = false;
    if (state.mainView === "impact" && state.impactView === "evals") renderImpactDetail();
  }
}

export function formatControlledScore(value: unknown) {
  return value === null || value === undefined ? "—" : Number(value).toFixed(2);
}

export function formatControlledDelta(value: unknown) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)} ms`;
}

export function renderObservedEvals(observed: any, availability: string) {
  if (!observed) {
    return `<div class="impact-notice"><h3>${escapeHtml(t("evals.observationMissingTitle"))}</h3><p>${escapeHtml(t("evals.observationMissingCopy"))}</p></div>`;
  }
  if (!observed.evaluable_runs) {
    return `<div class="impact-notice"><h3>${escapeHtml(t("evals.observationEmptyTitle"))}</h3><p>${escapeHtml(t("evals.observationEmptyCopy"))}</p></div>`;
  }
  return `<div class="eval-rate-grid">
    ${evalRateMetric(observed.rates.helpful, t("evals.helpfulRate"))}
    ${evalRateMetric(observed.rates.noise, t("evals.noiseRate"))}
    ${evalRateMetric(observed.rates.validation_pass, t("evals.validationRate"))}
    ${evalRateMetric(observed.rates.miss_report, t("evals.missRate"))}
  </div>
  <div class="eval-observed-strip">
    <span>${escapeHtml(t("evals.evaluableRuns", { count: observed.evaluable_runs, total: observed.total_runs }))}</span>
    <span>${escapeHtml(t("evals.missReports", { count: observed.miss_reports }))}</span>
    <span>${escapeHtml(t("evals.failedAfterExposure", { count: observed.failed_after_exposure_runs }))}</span>
    ${observed.superseded_feedback ? `<span>${escapeHtml(t("evals.supersededFeedback", { count: observed.superseded_feedback }))}</span>` : ""}
    ${observed.partial_or_unknown_runs ? `<span class="warn">${escapeHtml(t("evals.partialRuns", { count: observed.partial_or_unknown_runs }))}</span>` : ""}
  </div>`;
}

export function evalLane(index: string, title: string, copy: string, status: string) {
  return `<article class="eval-lane ${escapeAttr(status)}"><span>${escapeHtml(index)}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div><i></i></article>`;
}

export function evalScoreMetric(value: unknown, label: string, note: string) {
  const score = value === null || value === undefined ? "—" : Math.round(Number(value) * 1000) / 10 + "%";
  return `<div class="eval-score"><span>${escapeHtml(label)}</span><strong>${escapeHtml(score)}</strong><small>${escapeHtml(note)}</small></div>`;
}

export function evalCountMetric(value: unknown, label: string, note: string) {
  return `<div class="eval-score"><span>${escapeHtml(label)}</span><strong>${escapeHtml(Number(value || 0).toLocaleString())}</strong><small>${escapeHtml(note)}</small></div>`;
}

export function evalRateMetric(metric: any, label: string) {
  const value = metric?.value;
  const display = value === null || value === undefined ? "—" : Math.round(Number(value) * 100) + "%";
  return `<div class="eval-rate"><div class="eval-rate-dial" style="--rate:${escapeAttr(value === null || value === undefined ? 0 : Math.max(0, Math.min(1, Number(value))))}"><strong>${escapeHtml(display)}</strong></div><div><span>${escapeHtml(label)}</span><small>${escapeHtml(t("evals.ratio", { numerator: metric?.numerator || 0, denominator: metric?.denominator || 0 }))}</small></div></div>`;
}

export function evalCandidateFilters() {
  return `<div class="eval-filters" role="group" aria-label="${escapeAttr(t("evals.filterLabel"))}">${[
    ["all", "evals.filterAll"],
    ["miss", "evals.filterMiss"],
    ["guidance", "evals.filterGuidance"],
    ["validation", "evals.filterValidation"],
  ].map(([value, key]) => `<button type="button" class="${state.evalCandidateFilter === value ? "active" : ""}" data-eval-filter="${value}">${escapeHtml(t(key))}</button>`).join("")}</div>`;
}

export function filteredEvalCandidates() {
  // Review works on grouped findings: one row per normalized signature, not
  // one row per occurrence.
  const candidates = state.observationEvals?.candidate_groups || [];
  if (state.evalCandidateFilter === "miss") return candidates.filter((item: any) => item.reason === "reported_miss");
  if (state.evalCandidateFilter === "guidance") return candidates.filter((item: any) => item.reason === "irrelevant_guidance" || item.reason === "harmful_guidance");
  if (state.evalCandidateFilter === "validation") return candidates.filter((item: any) => item.reason === "validation_failed_after_exposure");
  return candidates;
}

export function renderEvalCandidate(candidate: any) {
  const detail = candidate.trap_id !== null && candidate.trap_id !== undefined
    ? t("evals.trapEvidence", { id: candidate.trap_id })
    : candidate.validation_kind ? t("evals.validationEvidence", { kind: valueLabel(candidate.validation_kind) }) : t("evals.runEvidence");
  const selected = candidate.id === state.evalReviewCandidateId;
  const statusClass = candidate.review_status === "accepted" ? "approved" : candidate.review_status === "rejected" ? "danger" : "warn";
  const count = Number(candidate.occurrence_count || 1);
  const runId = evalGroupLatestRunId(candidate);
  const occurrences = count > 1
    ? `<span class="pill occurrences">${escapeHtml(t("evals.occurrences", { count }))}</span>`
    : "";
  const span = count > 1
    ? `<span class="eval-candidate-span">${escapeHtml(t("evals.occurrenceSpan", {
        runs: (candidate.run_ids || []).length,
        first: formatDisplayDate(candidate.first_occurred_at),
        last: formatDisplayDate(candidate.last_occurred_at),
      }))}</span>`
    : "";
  return `<article class="eval-candidate ${selected ? "selected" : ""}">
    <div class="eval-candidate-index">${count > 1 ? escapeHtml(String(count)) + "&times;" : "1&times;"}</div>
    <div><div class="meta"><span class="pill warn">${escapeHtml(valueLabel(candidate.reason))}</span><span class="pill ${statusClass}">${escapeHtml(valueLabel(candidate.review_status))}</span>${occurrences}</div><h4>${escapeHtml(evalGroupTitle(candidate))}</h4><p>${escapeHtml(detail)} · ${escapeHtml(candidate.ground_truth === "confirmed" ? t("evals.confirmedGroundTruth") : t("evals.notGroundTruth"))}</p>${span}</div>
    <div class="eval-candidate-actions"><button type="button" class="${selected ? "primary" : "secondary"}" data-eval-review="${escapeAttr(candidate.id)}">${escapeHtml(t(selected ? "evals.reviewing" : "evals.reviewCandidate"))}</button><button type="button" class="ghost" data-eval-run="${escapeAttr(runId)}">${escapeHtml(t("evals.inspectRun"))}</button></div>
  </article>`;
}

/** Latest Run the finding was seen in — the most useful one to open. */
export function evalGroupLatestRunId(group: any) {
  const runs = group.run_ids || [];
  return runs.length ? runs[runs.length - 1] : group.run_id;
}

/** Name the finding by what it concerns, not by the Run it happened to occur in. */
export function evalGroupTitle(group: any) {
  if (group.trap_id !== null && group.trap_id !== undefined) return t("evals.groupTrapTitle", { id: group.trap_id });
  if (group.validation_kind) return t("evals.groupValidationTitle", { kind: valueLabel(group.validation_kind) });
  return t("evals.groupRunTitle", { run: evalGroupLatestRunId(group) });
}

export function selectedEvalCandidate() {
  if (!state.evalReviewCandidateId) return null;
  return (state.observationEvals?.candidate_groups || []).find((group: any) => group.id === state.evalReviewCandidateId) || null;
}

export function renderEvalReviewPanel(candidate: any, payload: any) {
  if (!candidate) {
    return `<div class="impact-notice eval-review-intro"><h3>${escapeHtml(t("evals.groundTruthTitle"))}</h3><p>${escapeHtml(t("evals.groundTruthCopy"))}</p></div>`;
  }
  const localReview = state.evalReviewDraft?.candidateId === candidate.id ? state.evalReviewDraft : null;
  const draft = localReview?.case || candidate.draft_case || {};
  const rejectionReason = localReview?.rejectionReason || "";
  const preview = state.evalReviewPreview;
  const fixtureTraps = payload?.fixture_traps || [];
  const error = state.evalReviewError
    ? `<div class="impact-notice error eval-review-error"><strong>${escapeHtml(t("evals.actionFailed"))}</strong><p>${escapeHtml(state.evalReviewError)}</p></div>`
    : "";
  const header = `<header class="eval-review-head"><div><span class="eval-review-step">HUMAN GATE / ${escapeHtml(candidate.id)}</span><h3>${escapeHtml(t("evals.reviewTitle"))}</h3><p>${escapeHtml(t("evals.reviewBoundary"))}</p></div><button type="button" class="ghost" data-eval-review-close aria-label="${escapeAttr(t("action.cancel"))}">×</button></header>`;
  const deferred = `<div class="impact-notice warn eval-external-update" role="status" data-eval-deferred-update ${state.evalExternalChangesDeferred ? "" : "hidden"}><strong>${escapeHtml(t("evals.externalChangesDeferredTitle"))}</strong><p>${escapeHtml(t("evals.externalChangesDeferredCopy"))}</p></div>`;
  if (candidate.review_status === "conflict") {
    return `<section class="eval-review-workbench">${header}${deferred}${error}<div class="impact-notice error"><h3>${escapeHtml(t("evals.conflictTitle"))}</h3><p>${escapeHtml(t("evals.conflictCopy"))}</p></div></section>`;
  }
  if (candidate.review_status === "rejected") {
    return `<section class="eval-review-workbench">${header}${deferred}${error}<div class="eval-review-decision rejected"><span>${escapeHtml(t("evals.rejectedLabel"))}</span><strong>${escapeHtml(t("evals.rejectedTitle"))}</strong><p>${escapeHtml(candidate.review_ref?.rejection_reason || t("evals.rejectedCopy"))}</p></div></section>`;
  }
  if (candidate.review_status === "accepted") {
    return `<section class="eval-review-workbench">${header}${deferred}${error}<div class="eval-review-decision accepted"><span>${escapeHtml(t("evals.confirmedLabel"))}</span><strong>${escapeHtml(t("evals.acceptedTitle"))}</strong><p>${escapeHtml(t("evals.acceptedCopy"))}</p>${renderEvalCaseSummary(draft)}</div><div class="eval-review-actions"><button type="button" class="danger" data-eval-review-rollback ${state.evalReviewBusy ? "disabled" : ""}>${escapeHtml(t("evals.rollbackCase"))}</button></div></section>`;
  }
  const selectedIds = new Set(Array.isArray(draft.goldTrapIds) ? draft.goldTrapIds.map(Number) : []);
  const judgment = draft.judgment || (candidate.reason === "irrelevant_guidance" || candidate.reason === "harmful_guidance" ? "noisy_hit" : "miss");
  const trapOptions = fixtureTraps.length
    ? fixtureTraps.map((trap: any) => `<label class="eval-trap-option"><input type="checkbox" name="goldTrapIds" value="${escapeAttr(trap.id)}" ${selectedIds.has(Number(trap.id)) ? "checked" : ""}><span><b>#${escapeHtml(trap.id)}</b>${escapeHtml(trap.title)}</span></label>`).join("")
    : `<div class="evals-inline-empty">${escapeHtml(t("evals.noFixtureTraps"))}</div>`;
  return `<section class="eval-review-workbench">${header}${deferred}${error}
    <div class="eval-review-flow" aria-label="${escapeAttr(t("evals.reviewFlowLabel"))}"><span class="done">${escapeHtml(t("evals.flowEvidence"))}</span><i>→</i><span class="active">${escapeHtml(t("evals.flowHuman"))}</span><i>→</i><span>${escapeHtml(t("evals.flowFixture"))}</span></div>
    <form class="eval-review-form" data-eval-review-form>
      <label class="eval-field eval-query-field"><span>${escapeHtml(t("evals.queryLabel"))}</span><small>${escapeHtml(t("evals.queryHelp"))}</small><textarea name="query" rows="3" placeholder="${escapeAttr(t("evals.queryPlaceholder"))}">${escapeHtml(draft.query || "")}</textarea></label>
      <div class="eval-review-grid"><label class="eval-field"><span>${escapeHtml(t("evals.modeLabel"))}</span><select name="mode">${["fts", "hybrid", "semantic"].map((mode) => `<option value="${mode}" ${(draft.mode || "hybrid") === mode ? "selected" : ""}>${escapeHtml(mode)}</option>`).join("")}</select></label><label class="eval-field"><span>${escapeHtml(t("evals.judgmentLabel"))}</span><select name="judgment">${["miss", "noisy_hit", "useful_hit", "no_relevant_trap"].map((value) => `<option value="${value}" ${judgment === value ? "selected" : ""}>${escapeHtml(valueLabel(value))}</option>`).join("")}</select></label></div>
      <fieldset class="eval-trap-picker"><legend>${escapeHtml(t("evals.expectedLabel"))}</legend><p>${escapeHtml(t("evals.expectedHelp"))}</p><div>${trapOptions}</div></fieldset>
      <label class="eval-field"><span>${escapeHtml(t("evals.noteLabel"))}</span><input name="note" value="${escapeAttr(draft.note || "")}" placeholder="${escapeAttr(t("evals.notePlaceholder"))}"></label>
      <label class="eval-field eval-reject-field"><span>${escapeHtml(t("evals.rejectReasonLabel"))}</span><input name="rejectionReason" value="${escapeAttr(rejectionReason)}" placeholder="${escapeAttr(t("evals.rejectReasonPlaceholder"))}"></label>
      ${preview ? `<div class="eval-preview"><span>${escapeHtml(t("evals.previewReady"))}</span><strong>${escapeHtml(t("evals.previewCounts", { before: preview[0]?.before_query_count ?? 0, after: preview[0]?.after_query_count ?? 0 }))}</strong><code>${escapeHtml(preview[0]?.path || payload?.retrieval?.source || "")}</code><small>${escapeHtml(t("evals.previewNotWritten"))}</small></div>` : ""}
      <div class="eval-review-actions"><button type="button" class="secondary" data-eval-review-save ${state.evalReviewBusy ? "disabled" : ""}>${escapeHtml(t("evals.saveDraft"))}</button><button type="button" class="primary" data-eval-review-accept ${state.evalReviewBusy || !fixtureTraps.length ? "disabled" : ""}>${escapeHtml(t("evals.acceptCase"))}</button><span>${escapeHtml(t("evals.acceptWarning"))}</span><button type="button" class="ghost danger-text" data-eval-review-reject ${state.evalReviewBusy ? "disabled" : ""}>${escapeHtml(t("evals.rejectSignal"))}</button></div>
    </form>
  </section>`;
}

export function renderEvalCaseSummary(draft: any) {
  const ids = Array.isArray(draft.goldTrapIds) && draft.goldTrapIds.length ? draft.goldTrapIds.map((id: any) => `#${id}`).join(", ") : t("evals.noRelevantTrap");
  return `<dl class="eval-case-summary"><div><dt>${escapeHtml(t("evals.queryLabel"))}</dt><dd>${escapeHtml(draft.query || "—")}</dd></div><div><dt>${escapeHtml(t("evals.judgmentLabel"))}</dt><dd>${escapeHtml(valueLabel(draft.judgment || "unknown"))}</dd></div><div><dt>${escapeHtml(t("evals.expectedLabel"))}</dt><dd>${escapeHtml(ids)}</dd></div></dl>`;
}

export function bindEvalControls() {
  document.querySelectorAll("[data-eval-filter]").forEach((button: any) => {
    button.addEventListener("click", () => {
      snapshotEvalReviewDraftFromDom();
      state.evalExternalChangesDeferred = false;
      state.evalCandidateFilter = button.dataset.evalFilter;
      renderImpactQueue();
      renderImpactDetailKeepingScroll();
    });
  });
  document.querySelectorAll("[data-eval-review]").forEach((button: any) => {
    button.addEventListener("click", () => {
      state.evalExternalChangesDeferred = false;
      state.evalReviewCandidateId = button.dataset.evalReview;
      state.evalReviewDraft = null;
      state.evalReviewPreview = null;
      state.evalReviewError = "";
      renderImpactDetail();
      document.querySelector(".eval-review-workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelector("[data-eval-review-close]")?.addEventListener("click", () => {
    state.evalExternalChangesDeferred = false;
    state.evalReviewCandidateId = null;
    state.evalReviewDraft = null;
    state.evalReviewPreview = null;
    state.evalReviewError = "";
    renderImpactDetailKeepingScroll();
  });
  const form = document.querySelector("[data-eval-review-form]") as any;
  if (form) {
    form.querySelector('[name="judgment"]')?.addEventListener("change", (event: any) => {
      const noRelevant = event.target.value === "no_relevant_trap";
      form.querySelectorAll('[name="goldTrapIds"]').forEach((input: any) => {
        if (noRelevant) input.checked = false;
        input.disabled = noRelevant;
      });
    });
    form.querySelector("[data-eval-review-save]")?.addEventListener("click", () => runEvalReviewAction("draft", form));
    form.querySelector("[data-eval-review-accept]")?.addEventListener("click", () => runEvalReviewAction("accept", form));
    form.querySelector("[data-eval-review-reject]")?.addEventListener("click", () => runEvalReviewAction("reject", form));
  }
  document.querySelector("[data-eval-review-rollback]")?.addEventListener("click", () => runEvalReviewAction("rollback", null));
  bindEvalRunLinks(el("detail"));
}

export function syncEvalDeferredNotice() {
  const notice = document.querySelector("[data-eval-deferred-update]") as HTMLElement | null;
  if (notice) notice.hidden = !state.evalExternalChangesDeferred;
}

export function evalReviewDraftFromForm(form: any, normalize = true) {
  const data = new FormData(form);
  const judgment = String(data.get("judgment") || "miss");
  const query = String(data.get("query") || "");
  const note = String(data.get("note") || "");
  return {
    query: normalize ? query.trim() : query,
    mode: String(data.get("mode") || "hybrid"),
    judgment,
    goldTrapIds: judgment === "no_relevant_trap" ? [] : data.getAll("goldTrapIds").map((id) => Number(id)),
    note: normalize ? note.trim() : note,
  };
}

export function snapshotEvalReviewDraftFromDom() {
  const candidate = selectedEvalCandidate();
  const form = document.querySelector("[data-eval-review-form]") as any;
  if (!candidate || !form) return state.evalReviewDraft;
  state.evalReviewDraft = {
    candidateId: candidate.id,
    case: evalReviewDraftFromForm(form, false),
    rejectionReason: String(new FormData(form).get("rejectionReason") || ""),
  };
  return state.evalReviewDraft;
}

export async function runEvalReviewAction(action: string, form: any) {
  const candidate = selectedEvalCandidate();
  if (!candidate || state.evalReviewBusy) return;
  if (action === "accept" && !confirm(t("evals.confirmAccept"))) return;
  if (action === "reject" && !confirm(t("evals.confirmReject"))) return;
  if (action === "rollback" && !confirm(t("evals.confirmRollback"))) return;
  const submittedDraft = form ? evalReviewDraftFromForm(form) : null;
  const rejectionReason = form ? String(new FormData(form).get("rejectionReason") || "").trim() : "";
  if (submittedDraft) state.evalReviewDraft = { candidateId: candidate.id, case: submittedDraft, rejectionReason };
  state.evalReviewBusy = true;
  state.evalReviewError = "";
  renderImpactDetail();
  try {
    const body: Record<string, unknown> = {
      projectRoot: state.projectRoot,
      observationCandidateId: candidate.id,
    };
    if (action === "draft" || action === "accept") body.draft = submittedDraft;
    if (action === "reject") body.reason = rejectionReason;
    const result = await api(`/api/observations/eval-candidate/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.evalReviewPreview = action === "draft" ? result.preview : null;
    await loadImpactEvals();
    showStatus(t(`evals.status.${action}`));
  } catch (error) {
    state.evalReviewError = error instanceof Error ? error.message : String(error);
  } finally {
    state.evalReviewBusy = false;
    if (state.mainView === "impact" && state.impactView === "evals") renderImpactDetail();
  }
}

export function bindEvalRunLinks(root: any = document) {
  root.querySelectorAll("[data-eval-run]").forEach((button: any) => {
    button.addEventListener("click", () => loadImpactRun(button.dataset.evalRun));
  });
}

export function impactMetric(value: unknown, label: string) {
  const count = Number(value || 0);
  return `<div class="impact-metric${count === 0 ? " zero" : ""}"><strong>${escapeHtml(count.toLocaleString())}</strong><span>${escapeHtml(label)}</span></div>`;
}

export function impactSmallMetric(value: unknown, label: string) {
  return `<div class="metric"><div class="metric-value">${escapeHtml(value ?? "—")}</div><div class="metric-label">${escapeHtml(label)}</div></div>`;
}

export function impactEmpty(mark: string, title: string, copy: string) {
  el("detail-meta").textContent = state.projectRoot || t("empty.noProjects");
  return `<div class="impact-shell">${impactEmptyContent(mark, title, copy)}</div>`;
}

export function impactEmptyContent(mark: string, title: string, copy: string, actions = "", hint = "") {
  return `<section class="impact-empty"><div><div class="impact-empty-mark">${escapeHtml(mark)}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p>${actions ? `<div class="impact-empty-actions">${actions}</div>` : ""}${hint ? `<span class="impact-empty-hint">${escapeHtml(hint)}</span>` : ""}</div></section>`;
}

export function renderImpactEvent(event: any, baseIso: string | null = null) {
  const category = impactEventCategory(event.type);
  const keyline = impactEventKeyline(event.type, event.facts || {});
  const offset = impactEventOffset(event.occurred_at, baseIso);
  const classPill = event.evidence_class && event.evidence_class !== "observed_fact"
    ? `<span class="pill ${escapeAttr(impactEvidencePillClass(event.evidence_class))}">${escapeHtml(valueLabel(event.evidence_class))}</span>`
    : "";
  const factEntries = Object.entries(event.facts || {})
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `<span class="impact-fact"><strong>${escapeHtml(t("impact.fact." + key))}:</strong> ${impactFactMarkup(key, value)}</span>`)
    .join("");
  return `<details class="impact-event ${escapeAttr(event.evidence_class)} cat-${escapeAttr(category)}" id="impact-event-${escapeAttr(String(event.seq))}">
    <summary>
      <span class="impact-event-marker" aria-hidden="true">${impactEventGlyph(category)}</span>
      <span class="impact-event-title">${escapeHtml(t("impact.event." + event.type))}</span>
      ${keyline ? `<span class="impact-event-key">${escapeHtml(keyline)}</span>` : ""}
      ${classPill}
      <time>${escapeHtml(offset)}</time>
    </summary>
    <div class="impact-event-body">
      <div class="impact-facts">${factEntries || '<span class="subtle">' + escapeHtml(t("impact.eventFacts")) + "</span>"}</div>
      <span class="subtle impact-event-sensitivity">${escapeHtml(valueLabel(event.sensitivity))}</span>
    </div>
  </details>`;
}

export function impactEventCategory(type: string) {
  if (type === "trap/search-completed") return "search";
  if (type === "trap/exposed") return "expose";
  if (type === "trap/feedback-recorded" || type === "trap/missed-reported") return "feedback";
  if (type === "validation/completed") return "validate";
  if (type.startsWith("run/")) return "run";
  if (type.startsWith("learning/")) return "learning";
  if (type.startsWith("candidate/")) return "candidate";
  if (type.startsWith("share/")) return "share";
  if (type.startsWith("eval/")) return "eval";
  return "other";
}

export function impactEvidencePillClass(evidenceClass: string) {
  if (evidenceClass === "human_label") return "warn";
  if (evidenceClass === "derived_inference") return "proposed";
  if (evidenceClass === "controlled_eval") return "approved";
  return "";
}

export function impactEventGlyph(category: string) {
  const paths: Record<string, string> = {
    run: '<path d="M3.5 2.5l6 3.5-6 3.5z"/>',
    search: '<circle cx="5" cy="5" r="3.2"/><path d="M7.4 7.4L10.5 10.5"/>',
    expose: '<path d="M1.5 6s1.9-3.2 4.5-3.2S10.5 6 10.5 6 8.6 9.2 6 9.2 1.5 6 1.5 6z"/><circle cx="6" cy="6" r="1.4"/>',
    feedback: '<path d="M2 2.5h8v5H5.5L3.5 10V7.5H2z"/>',
    validate: '<path d="M2 6.2l2.6 2.6L10 3.4"/>',
    learning: '<path d="M2 2.5h3.5a1.5 1.5 0 0 1 1.5 1.5 1.5 1.5 0 0 1 1.5-1.5H12v7H8.5A1.5 1.5 0 0 0 7 11a1.5 1.5 0 0 0-1.5-1.5H2z"/><path d="M7 4v7"/>',
    candidate: '<path d="M2 2h4l4 4-4 4H2z"/><circle cx="4.2" cy="6" r="0.9"/>',
    share: '<path d="M5 8L8 5"/><path d="M4.2 6.8L2.8 8.2a2 2 0 0 0 2.8 2.8L7 9.6"/><path d="M7.9 5.1l1.4-1.4a2 2 0 0 1 2.8 2.8L10.7 8"/>',
    eval: '<path d="M2.5 10V7"/><path d="M6 10V4"/><path d="M9.5 10V5.5"/>',
  };
  return `<svg viewBox="0 0 12 12" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[category] || '<circle cx="6" cy="6" r="3.4"/>'}</svg>`;
}

export function impactEventKeyline(type: string, facts: Record<string, unknown>) {
  const preferences: Record<string, string[]> = {
    "run/started": ["source_client"],
    "run/completed": ["duration_ms"],
    "trap/search-completed": ["mode", "result_count"],
    "trap/exposed": ["trap_id", "rank"],
    "trap/feedback-recorded": ["trap_id", "feedback"],
    "trap/missed-reported": ["expected_trap_id"],
    "validation/completed": ["kind", "status"],
    "learning/insight-shelved": ["collection_id"],
    "learning/status-changed": ["status"],
    "learning/feedback-recorded": ["feedback"],
    "learning/promoted-to-candidate": ["candidate_id"],
    "learning/linked-to-run": ["linked_run_id"],
    "candidate/status-changed": ["status", "revision"],
    "share/created": ["target_kind"],
    "share/revoked": ["target_kind"],
    "share/expired": ["target_kind"],
    "eval/experiment-completed": ["candidate_passed", "total_cases"],
  };
  const keys = preferences[type] || [];
  const parts = keys
    .map((key) => (facts[key] === null || facts[key] === undefined ? null : impactFactValue(key, facts[key])))
    .filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

export function impactEventOffset(occurredAt: unknown, baseIso: string | null) {
  const at = Date.parse(String(occurredAt || ""));
  const base = baseIso ? Date.parse(baseIso) : NaN;
  if (!Number.isFinite(at)) return formatDisplayDate(occurredAt);
  if (!Number.isFinite(base)) return formatDisplayDate(occurredAt);
  return impactOffsetLabel(Math.max(0, at - base));
}

export function impactOffsetLabel(ms: number) {
  if (ms < 1000) return "+" + Math.round(ms) + "ms";
  if (ms < 10000) return "+" + (ms / 1000).toFixed(1) + "s";
  if (ms < 60000) return "+" + Math.round(ms / 1000) + "s";
  if (ms < 600000) return "+" + (ms / 60000).toFixed(1) + " min";
  return "+" + Math.round(ms / 60000) + " min";
}

export function impactRelativeTime(value: unknown) {
  const at = Date.parse(String(value || ""));
  if (!Number.isFinite(at)) return formatDisplayDate(value);
  const diff = Date.now() - at;
  if (diff < 45_000) return t("impact.relative.now");
  if (diff < 60 * 60_000) return t("impact.relative.minutes", { n: Math.round(diff / 60_000) });
  if (diff < 24 * 60 * 60_000) return t("impact.relative.hours", { n: Math.round(diff / 3_600_000) });
  if (diff < 7 * 24 * 60 * 60_000) return t("impact.relative.days", { n: Math.round(diff / 86_400_000) });
  return formatDisplayDate(value);
}

export function impactFactMarkup(key: string, value: unknown) {
  if (key === "trap_id" || key === "expected_trap_id") {
    return `<button type="button" class="impact-trap-link" data-impact-trap="${escapeAttr(String(value))}" title="${escapeAttr(t("impact.openTrap", { id: value }))}">${escapeHtml(impactFactValue(key, value))}</button>`;
  }
  return escapeHtml(impactFactValue(key, value));
}

export function impactGantt(events: any[], baseIso: string | null) {
  if (!baseIso || !events || events.length < 2) return "";
  const base = Date.parse(baseIso);
  if (!Number.isFinite(base)) return "";
  const times = events.map((event) => Date.parse(String(event.occurred_at || ""))).filter((value) => Number.isFinite(value));
  if (times.length < 2) return "";
  const span = Math.max(1, Math.max(...times) - base);
  const hits = events.map((event) => {
    const at = Date.parse(String(event.occurred_at || ""));
    if (!Number.isFinite(at)) return "";
    const left = Math.min(99, Math.max(0, ((at - base) / span) * 100));
    const duration = Number((event.facts || {}).duration_ms || 0);
    const width = duration > 0 ? Math.max(1.2, (duration / span) * 100) : 0;
    const label = `${t("impact.event." + event.type)} · ${impactOffsetLabel(Math.max(0, at - base))}${duration > 0 ? " · " + impactDuration(duration) : ""}`;
    return `<button type="button" class="impact-gantt-hit cat-${escapeAttr(impactEventCategory(event.type))}" style="left:${left.toFixed(2)}%;${width ? "width:" + width.toFixed(2) + "%;" : ""}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" data-impact-goto="${escapeAttr(String(event.seq))}"></button>`;
  }).join("");
  return `<div class="impact-gantt" role="group" aria-label="${escapeAttr(t("impact.ganttLabel"))}"><span class="impact-gantt-track">${hits}</span></div>`;
}

export function impactEventFilters(timeline: any[]) {
  if (!timeline || timeline.length < 3) return "";
  const present = new Set<string>(timeline.map((event) => impactEventCategory(event.type)));
  const chips: [string, string][] = [["all", "impact.filter.all"]];
  if (present.has("search")) chips.push(["search", "impact.filter.search"]);
  if (present.has("expose")) chips.push(["expose", "impact.filter.expose"]);
  if (present.has("validate")) chips.push(["validate", "impact.filter.validate"]);
  if (present.has("feedback")) chips.push(["feedback", "impact.filter.feedback"]);
  if (["learning", "candidate", "share", "eval", "other"].some((category) => present.has(category))) chips.push(["other", "impact.filter.other"]);
  if (chips.length < 2) return "";
  return `<div class="impact-event-filters" role="group" aria-label="${escapeAttr(t("impact.runTimeline"))}">${chips.map(([value, key]) => `<button type="button" class="${(state.impactEventFilter || "all") === value ? "active" : ""}" data-impact-event-filter="${escapeAttr(value)}">${escapeHtml(t(key))}</button>`).join("")}</div>`;
}

export function impactFilteredEvents(timeline: any[]) {
  const filter = state.impactEventFilter || "all";
  const events = timeline || [];
  if (filter === "all") return events;
  if (filter === "other") return events.filter((event) => ["learning", "candidate", "share", "eval", "other"].includes(impactEventCategory(event.type)));
  return events.filter((event) => impactEventCategory(event.type) === filter);
}

export function bindImpactEventControls() {
  document.querySelectorAll("[data-impact-event-filter]").forEach((button: any) => {
    button.addEventListener("click", () => {
      state.impactEventFilter = button.dataset.impactEventFilter || "all";
      renderImpactDetailKeepingScroll();
    });
  });
  document.querySelectorAll("[data-impact-goto]").forEach((button: any) => {
    button.addEventListener("click", () => {
      const target = document.getElementById("impact-event-" + button.dataset.impactGoto);
      if (!target) return;
      if (target.tagName === "DETAILS") (target as any).open = true;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.remove("impact-flash");
      void (target as any).offsetWidth;
      target.classList.add("impact-flash");
    });
  });
  document.querySelectorAll("[data-impact-trap]").forEach((button: any) => {
    button.addEventListener("click", () => impactOpenTrap(button.dataset.impactTrap));
  });
}

export async function impactOpenTrap(id: unknown) {
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) return;
  const known = (state.traps || []).find((trap: any) => Number(trap.id) === numeric);
  if (known) {
    await jumpToTrap(known.scope, known.id);
    return;
  }
  await jumpToTrap("project", numeric);
  const found = (state.traps || []).some((trap: any) => Number(trap.id) === numeric);
  if (!found) await jumpToTrap("global", numeric);
}

export function impactFactValue(key: string, value: unknown) {
  if (key === "duration_ms") return impactDuration(Number(value));
  if (key === "trap_id" || key === "expected_trap_id") return "#" + value;
  if (typeof value === "number") return value.toLocaleString();
  return valueLabel(value);
}

export function impactDuration(value: unknown) {
  if (value === null || value === undefined) return "—";
  const ms = Number(value);
  if (ms < 1000) return Math.round(ms) + " ms";
  if (ms < 60000) return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + " s";
  return (ms / 60000).toFixed(1) + " min";
}

export function impactTokens(run: any) {
  const total = Number(run.input_tokens || 0) + Number(run.output_tokens || 0);
  return total ? total.toLocaleString() : "—";
}

declare function loadImpactRun(runId: string): Promise<void>;
declare function loadImpactEvals(): Promise<void>;
declare function loadImpact(): Promise<void>;
declare function jumpToTrap(scope: string, id: string | number): Promise<void>;

const CLIENT_IMPACT_FUNCTIONS = [
  renderImpactQueue,
  renderImpactDetail,
  renderImpactDetailKeepingScroll,
  renderImpactOverview,
  renderAgentObservationHealthNotice,
  renderImpactRunDetail,
  impactRunHeadline,
  impactFirstRunContent,
  impactOnboardingFlow,
  impactConnectionGuide,
  impactAutoClient,
  createImpactDemoRun,
  openImpactDemo,
  closeImpactDemo,
  bindImpactOnboarding,
  renderImpactEvals,
  renderImpactEvalQueue,
  impactTabs,
  bindImpactTabs,
  renderRetrievalEval,
  renderControlledEvals,
  selectedControlledExperiment,
  renderControlledEmpty,
  renderControlledExperiment,
  renderControlledSide,
  controlledCaseFilters,
  controlledExperimentCases,
  renderControlledCase,
  bindControlledEvalControls,
  runControlledEval,
  formatControlledScore,
  formatControlledDelta,
  renderObservedEvals,
  evalLane,
  evalScoreMetric,
  evalCountMetric,
  evalRateMetric,
  evalCandidateFilters,
  filteredEvalCandidates,
  renderEvalCandidate,
  evalGroupLatestRunId,
  evalGroupTitle,
  selectedEvalCandidate,
  renderEvalReviewPanel,
  renderEvalCaseSummary,
  bindEvalControls,
  evalReviewDraftFromForm,
  snapshotEvalReviewDraftFromDom,
  syncEvalDeferredNotice,
  runEvalReviewAction,
  bindEvalRunLinks,
  impactMetric,
  impactSmallMetric,
  impactStatsStrip,
  impactMixBar,
  impactStateDot,
  impactEmpty,
  impactEmptyContent,
  renderImpactEvent,
  impactEventCategory,
  impactEvidencePillClass,
  impactEventGlyph,
  impactEventKeyline,
  impactEventOffset,
  impactOffsetLabel,
  impactRelativeTime,
  impactFactMarkup,
  impactGantt,
  impactEventFilters,
  impactFilteredEvents,
  bindImpactEventControls,
  impactOpenTrap,
  impactFactValue,
  impactDuration,
  impactTokens,
];

export const WEB_IMPACT_CLIENT_SCRIPT = CLIENT_IMPACT_FUNCTIONS
  .map((fn) => `    ${fn.toString().replace(/\n/g, "\n    ")}`)
  .join("\n\n");
