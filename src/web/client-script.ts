import { WEB_TEXT_JSON } from "./client-text";

export function webClientScript(textJson = WEB_TEXT_JSON): string {
  return `    const qs = new URLSearchParams(location.search);
    const token = qs.get("token") || sessionStorage.getItem("codetrap-token") || "";
    if (token) sessionStorage.setItem("codetrap-token", token);
    const savedLocale = localStorage.getItem("codetrap-locale");
    const initialLocale = savedLocale === "zh" ? "zh" : "en";

    const TEXT = ${textJson};

    const state = {
      locale: initialLocale,
      mainView: "review",
      projects: [],
      sessions: [],
      candidates: [],
      traps: [],
      trapKey: null,
      trapDetails: {},
      trapLoadingKey: null,
      trapSearch: "",
      trapFilters: { scope: "", status: "", category: "", module: "", owner: "" },
      trapSort: "updated",
      insightTraps: [],
      insightFilters: { scope: "", status: "all" },
      projectRoot: null,
      sessionId: null,
      candidateId: null,
      candidateView: "inbox",
      options: { categories: [], severities: [], scopes: [] },
      conflicts: []
    };

    const el = (id) => document.getElementById(id);

    function t(key, params = {}) {
      const text = TEXT[state.locale]?.[key] ?? TEXT.en[key] ?? key;
      return Object.entries(params).reduce((value, [name, replacement]) =>
        value.replaceAll("{" + name + "}", String(replacement)), text);
    }

    function valueLabel(value) {
      const key = "value." + value;
      const label = t(key);
      return label === key ? String(value ?? "") : label;
    }

    function optionPairs(values) {
      return values.map((value) => [value, valueLabel(value)]);
    }

    function renderShellText() {
      document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";
      document.title = "codetrap " + t("app.subtitle");
      el("app-subtitle").textContent = t("app.subtitle");
      el("refresh").textContent = t("action.refresh");
      el("refresh").title = t("action.refresh");
      el("project-add").textContent = t("action.add");
      el("project-path").placeholder = t("placeholder.projectPath");
      el("sessions-title").textContent = t("section.sessions");
      document.querySelector("[data-main-view='review']").textContent = t("nav.review");
      document.querySelector("[data-main-view='library']").textContent = t("nav.library");
      document.querySelector("[data-main-view='insights']").textContent = t("nav.insights");
      document.querySelectorAll("[data-locale]").forEach((button) => {
        button.classList.toggle("active", button.dataset.locale === state.locale);
      });
    }

    function setLocale(locale) {
      if (locale !== "en" && locale !== "zh") return;
      state.locale = locale;
      localStorage.setItem("codetrap-locale", locale);
      renderShellText();
      renderProjects();
      renderSessions();
      renderActiveView();
    }

    async function api(path, options = {}) {
      const headers = { "X-Codetrap-Token": token, ...(options.headers || {}) };
      if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
      const res = await fetch(path, { ...options, headers });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) {
        const err = new Error(data?.error || res.statusText);
        err.payload = data;
        throw err;
      }
      return data;
    }

    function showStatus(message, isError = false) {
      const box = el("status");
      box.textContent = message;
      box.className = "status show" + (isError ? " error" : "");
      clearTimeout(showStatus.timer);
      showStatus.timer = setTimeout(() => box.className = "status", 3200);
    }

    async function bootstrap() {
      const data = await api("/api/bootstrap");
      state.projects = data.projects;
      state.projectRoot = data.current_project_root || data.projects[0]?.root || null;
      state.options = data.options;
      renderShellText();
      renderProjects();
      await loadSessions();
      renderActiveView();
    }

    async function loadSessions() {
      if (!state.projectRoot) {
        state.sessions = [];
        state.candidates = [];
        state.traps = [];
        state.insightTraps = [];
        renderSessions();
        renderActiveView();
        return;
      }
      const data = await api("/api/sessions?project=" + encodeURIComponent(state.projectRoot));
      state.sessions = data.sessions;
      if (!state.sessionId || !state.sessions.some((s) => s.id === state.sessionId)) {
        state.sessionId = state.sessions[0]?.id || null;
      }
      renderSessions();
      if (state.mainView === "library") {
        await loadTraps();
      } else if (state.mainView === "insights") {
        await loadInsightTraps();
      } else {
        await loadCandidates();
      }
    }

    async function loadCandidates() {
      if (!state.projectRoot || !state.sessionId) {
        state.candidates = [];
        if (state.mainView === "review") {
          renderCandidates();
          renderDetail();
        }
        return;
      }
      const data = await api("/api/candidates?project=" + encodeURIComponent(state.projectRoot) + "&session=" + encodeURIComponent(state.sessionId));
      state.candidates = data.candidates;
      selectVisibleCandidate();
      if (state.mainView === "review") {
        renderCandidates();
        renderDetail();
      }
    }

    async function loadTraps() {
      if (!state.projectRoot) {
        state.traps = [];
        state.trapKey = null;
        if (state.mainView === "library") {
          renderLibrary();
          renderTrapDetail();
        }
        return;
      }
      const params = new URLSearchParams({ project: state.projectRoot });
      Object.entries(state.trapFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const data = await api("/api/traps?" + params.toString());
      state.traps = data.traps;
      state.trapDetails = {};
      selectVisibleTrap();
      if (state.mainView === "library") {
        renderLibrary();
        renderTrapDetail();
      }
    }

    async function loadInsightTraps() {
      if (!state.projectRoot) {
        state.insightTraps = [];
        if (state.mainView === "insights") {
          renderInsightsView();
          renderInsightDetail();
        }
        return;
      }
      const params = new URLSearchParams({ project: state.projectRoot });
      Object.entries(state.insightFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const data = await api("/api/traps?" + params.toString());
      state.insightTraps = data.traps;
      if (state.mainView === "insights") {
        renderInsightsView();
        renderInsightDetail();
      }
    }

    function renderMainViewButtons() {
      document.querySelectorAll("[data-main-view]").forEach((button) => {
        button.classList.toggle("active", button.dataset.mainView === state.mainView);
      });
    }

    function renderActiveView() {
      renderMainViewButtons();
      if (state.mainView === "library") {
        el("queue-title").textContent = t("title.trapLibrary");
        el("detail-title").textContent = t("title.trapDetail");
        el("candidate-tabs").classList.add("hidden");
        renderLibrary();
        renderTrapDetail();
      } else if (state.mainView === "insights") {
        el("queue-title").textContent = t("title.growthInsights");
        el("detail-title").textContent = t("title.insightDetail");
        el("candidate-tabs").classList.add("hidden");
        renderInsightsView();
        renderInsightDetail();
      } else {
        el("queue-title").textContent = t("title.candidateInbox");
        el("detail-title").textContent = t("title.candidateDetail");
        el("candidate-tabs").classList.remove("hidden");
        renderCandidates();
        renderDetail();
      }
    }

    function renderProjects() {
      el("projects").innerHTML = state.projects.length ? state.projects.map((project) => \`
        <button class="row \${project.root === state.projectRoot ? "active" : ""}" data-project="\${escapeAttr(project.root)}">
          <span class="row-title">\${escapeHtml(project.name)}</span>
          <span class="subtle">\${escapeHtml(project.root)}</span>
        </button>
      \`).join("") : '<div class="empty">' + escapeHtml(t("empty.noProjects")) + '</div>';
      document.querySelectorAll("[data-project]").forEach((button) => {
        button.addEventListener("click", async () => {
          state.projectRoot = button.dataset.project;
          state.sessionId = null;
          state.candidateId = null;
          state.trapKey = null;
          state.trapDetails = {};
          state.insightTraps = [];
          renderProjects();
          await loadSessions();
        });
      });
    }

    function renderSessions() {
      el("sessions").innerHTML = state.sessions.length ? state.sessions.map((session) => \`
        <div class="row \${session.id === state.sessionId ? "active" : ""}">
          <button type="button" class="row-main" data-session="\${escapeAttr(session.id)}">
            <span class="row-title">\${escapeHtml(session.goal)}</span>
            <span class="meta">
              <span class="pill">\${escapeHtml(valueLabel(session.status))}</span>
              <span class="pill">\${escapeHtml(t("pill.candidates", { count: session.candidate_count || 0 }))}</span>
              <span class="pill accepted">\${escapeHtml(t("pill.accepted", { count: session.accepted_count || 0 }))}</span>
            </span>
          </button>
          <button type="button" class="row-action danger" data-delete-session="\${escapeAttr(session.id)}">\${escapeHtml(t("action.deleteSession"))}</button>
        </div>
      \`).join("") : '<div class="empty">' + escapeHtml(t("empty.noSessions")) + '</div>';
      document.querySelectorAll("[data-session]").forEach((button) => {
        button.addEventListener("click", async () => {
          state.sessionId = button.dataset.session;
          state.candidateId = null;
          renderSessions();
          await loadCandidates();
        });
      });
      document.querySelectorAll("[data-delete-session]").forEach((button) => {
        button.addEventListener("click", async () => {
          await deleteSession(button.dataset.deleteSession);
        });
      });
    }

    async function deleteSession(sessionId) {
      if (!sessionId || !confirm(t("prompt.deleteSession", { id: sessionId }))) return;
      try {
        await api("/api/session/delete", {
          method: "POST",
          body: JSON.stringify({ projectRoot: state.projectRoot, sessionId })
        });
        if (state.sessionId === sessionId) {
          state.sessionId = null;
          state.candidateId = null;
          state.candidates = [];
        }
        await loadSessions();
        showStatus(t("status.sessionDeleted"));
      } catch (error) {
        showStatus(error.message, true);
      }
    }

    async function cleanupDeletedCandidates() {
      if (!state.sessionId) return;
      try {
        const data = await api("/api/session/cleanup", {
          method: "POST",
          body: JSON.stringify({ projectRoot: state.projectRoot, sessionId: state.sessionId })
        });
        if (data.removed_candidate_ids?.includes(state.candidateId)) {
          state.candidateId = null;
        }
        await loadSessions();
        showStatus(t("status.deletedCandidatesCleaned"));
      } catch (error) {
        showStatus(error.message, true);
      }
    }

    function renderCandidates() {
      if (state.mainView !== "review") return;
      const pendingCount = state.candidates.filter((candidate) => candidate.status === "proposed").length;
      const reviewedCount = state.candidates.length - pendingCount;
      const sorted = sortedVisibleCandidates();
      selectVisibleCandidate(sorted);
      const session = state.sessions.find((item) => item.id === state.sessionId);
      el("queue-meta").textContent = session
        ? t("meta.sessionCounts", { goal: session.goal, pending: pendingCount, reviewed: reviewedCount })
        : t("meta.noSession");
      renderCandidateViewTabs(pendingCount, reviewedCount);
      el("candidates").innerHTML = sorted.length ? sorted.map((candidate) => \`
        <div class="row \${candidate.id === state.candidateId ? "active" : ""} \${candidate.status} \${reviewCssClass(candidate)}">
          <button type="button" class="row-main" data-candidate="\${escapeAttr(candidate.id)}">
            <span class="row-title">\${escapeHtml(candidate.trap.title)}</span>
            <span class="meta">
              <span class="pill \${candidate.status} \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>
              <span class="pill">\${escapeHtml(t("pill.quality", { score: Number(candidate.quality_score).toFixed(2) }))}</span>
              \${candidate.quality.warnings.length ? '<span class="pill warn">' + escapeHtml(t("pill.warnings", { count: candidate.quality.warnings.length })) + '</span>' : ''}
            </span>
          </button>
          \${renderCandidateRowAction(candidate)}
        </div>
      \`).join("") : '<div class="empty">' + escapeHtml(t(state.candidateView === "inbox" ? "empty.noPending" : "empty.noReviewed")) + '</div>';
      document.querySelectorAll("[data-candidate]").forEach((button) => {
        button.addEventListener("click", () => {
          state.candidateId = button.dataset.candidate;
          state.conflicts = [];
          renderCandidates();
          renderDetail();
        });
      });
      bindTrapJumpButtons();
    }

    function renderCandidateRowAction(candidate) {
      const review = candidate.review;
      if (!review || review.status !== "accepted") return "";
      return \`<button type="button" class="row-action" data-view-trap-scope="\${escapeAttr(review.scope)}" data-view-trap-id="\${escapeAttr(review.trap_id)}">\${escapeHtml(t("action.viewTrap"))}</button>\`;
    }

    function renderLibrary() {
      if (state.mainView !== "library") return;
      el("queue-title").textContent = t("title.trapLibrary");
      el("candidate-tabs").classList.add("hidden");
      el("candidates").innerHTML = \`
        <div class="library-tools">
          <input id="trap-search" placeholder="\${escapeAttr(t("placeholder.searchTraps"))}" value="\${escapeAttr(state.trapSearch)}">
          <div class="filter-grid">
            \${filterSelect("trap-filter-scope", t("label.scope"), state.trapFilters.scope, [["", t("option.projectGlobal")], ...optionPairs(state.options.scopes)])}
            \${filterSelect("trap-filter-status", t("label.status"), state.trapFilters.status, [["", valueLabel("active")], ["all", valueLabel("all")], ["archived", valueLabel("archived")], ["superseded", valueLabel("superseded")]])}
            \${filterSelect("trap-filter-category", t("label.category"), state.trapFilters.category, [["", t("option.allCategories")], ...optionPairs(state.options.categories)])}
            \${filterSelect("trap-sort", t("label.sort"), state.trapSort, [["updated", t("sort.updated")], ["severity", t("sort.severity")], ["hits", t("sort.hits")], ["category", t("sort.category")], ["title", t("sort.title")]])}
            <div class="field"><label for="trap-filter-module">\${escapeHtml(t("label.module"))}</label><input id="trap-filter-module" value="\${escapeAttr(state.trapFilters.module)}" placeholder="\${escapeAttr(t("placeholder.anyModule"))}"></div>
            <div class="field"><label for="trap-filter-owner">\${escapeHtml(t("label.owner"))}</label><input id="trap-filter-owner" value="\${escapeAttr(state.trapFilters.owner)}" placeholder="\${escapeAttr(t("placeholder.anyOwner"))}"></div>
            <button type="button" id="trap-filter-clear" class="ghost">\${escapeHtml(t("action.clearFilters"))}</button>
          </div>
        </div>
        <div id="library-insights"></div>
        <div id="trap-rows" class="trap-rows"></div>
      \`;
      bindLibraryControls();
      renderTrapResults();
    }

    function filterSelect(id, label, value, options) {
      return \`<div class="field"><label for="\${id}">\${label}</label><select id="\${id}">\${options.map(([optionValue, optionLabel]) => \`<option value="\${escapeAttr(optionValue)}" \${optionValue === value ? "selected" : ""}>\${escapeHtml(optionLabel)}</option>\`).join("")}</select></div>\`;
    }

    function bindLibraryControls() {
      const search = el("trap-search");
      if (search) {
        search.addEventListener("input", () => {
          state.trapSearch = search.value;
          state.trapKey = null;
          renderTrapResults();
          renderTrapDetail();
        });
      }
      bindTrapFilter("trap-filter-scope", "scope");
      bindTrapFilter("trap-filter-status", "status");
      bindTrapFilter("trap-filter-category", "category");
      bindTrapFilter("trap-filter-module", "module");
      bindTrapFilter("trap-filter-owner", "owner");
      const sort = el("trap-sort");
      if (sort) {
        sort.addEventListener("change", () => {
          state.trapSort = sort.value;
          state.trapKey = null;
          renderTrapResults();
          renderTrapDetail();
        });
      }
      const clear = el("trap-filter-clear");
      if (clear) {
        clear.addEventListener("click", async () => {
          state.trapFilters = { scope: "", status: "", category: "", module: "", owner: "" };
          state.trapSearch = "";
          state.trapKey = null;
          await loadTraps();
        });
      }
    }

    function bindTrapFilter(id, key) {
      const control = el(id);
      if (!control) return;
      const apply = async () => {
        state.trapFilters[key] = control.value.trim();
        state.trapKey = null;
        await loadTraps();
      };
      control.addEventListener("change", apply);
      control.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          apply();
        }
      });
    }

    function renderTrapResults() {
      const rows = el("trap-rows");
      const insights = el("library-insights");
      if (!rows || !insights) return;
      const visible = visibleTraps();
      selectVisibleTrap(visible);
      el("queue-meta").textContent = state.projectRoot
        ? t("meta.libraryCounts", { shown: visible.length, loaded: state.traps.length, sort: sortLabel(state.trapSort) })
        : t("meta.noProject");
      insights.innerHTML = renderInsights(visible);
      rows.innerHTML = visible.length ? visible.map((trap) => \`
        <button class="row \${trapKey(trap) === state.trapKey ? "active" : ""}" data-trap-key="\${escapeAttr(trapKey(trap))}">
          <span class="row-title">\${escapeHtml(trap.title)}</span>
          <span class="meta">
            <span class="pill \${escapeAttr(trap.severity)}">\${escapeHtml(valueLabel(trap.severity))}</span>
            <span class="pill">\${escapeHtml(valueLabel(trap.category))}</span>
            <span class="pill scope">\${escapeHtml(valueLabel(trap.scope))}</span>
            <span class="pill \${escapeAttr(trap.status)}">\${escapeHtml(valueLabel(trap.status))}</span>
            <span class="pill">\${escapeHtml(t("pill.hits", { count: Number(trap.hit_count || 0) }))}</span>
          </span>
          <span class="subtle">\${escapeHtml(trap.updated_at || trap.created_at || "")}</span>
        </button>
      \`).join("") : '<div class="empty">' + escapeHtml(t("empty.noTrapMatches")) + '</div>';
      document.querySelectorAll("[data-trap-key]").forEach((button) => {
        button.addEventListener("click", () => {
          state.trapKey = button.dataset.trapKey;
          renderTrapResults();
          renderTrapDetail();
        });
      });
    }

    function renderInsights(traps) {
      const serious = traps.filter((trap) => trap.severity === "error" || trap.severity === "critical").length;
      const topCategory = topValue(traps.map((trap) => trap.category));
      const topModule = topValue(traps.map((trap) => trap.module).filter(Boolean));
      const topTag = topValue(traps.flatMap((trap) => trap.tags || []));
      const mostViewed = [...traps].sort((a, b) => Number(b.hit_count || 0) - Number(a.hit_count || 0))[0];
      return \`<div class="summary-grid">
        \${metric(t("metric.loadedTraps"), traps.length || "0", t("metric.currentFilters"))}
        \${metric(t("metric.highSeverity"), serious || "0", t("metric.errorCritical"))}
        \${metric(t("metric.topCategory"), topCategory ? valueLabel(topCategory) : "-", t("metric.repeatedPattern"))}
        \${metric(t("metric.focusArea"), topModule || topTag || "-", topModule ? t("metric.module") : t("metric.tag"))}
        \${metric(t("metric.mostViewed"), mostViewed ? "#" + mostViewed.id : "-", mostViewed ? mostViewed.title : t("metric.noHits"))}
      </div>\`;
    }

    function renderInsightsView() {
      if (state.mainView !== "insights") return;
      const traps = state.insightTraps;
      const serious = traps.filter((trap) => trap.severity === "error" || trap.severity === "critical").length;
      const topCategory = topValue(traps.map((trap) => trap.category));
      const topModule = topValue(traps.map((trap) => trap.module).filter(Boolean));
      const topTag = topValue(traps.flatMap((trap) => trap.tags || []));
      const mostViewed = sortTraps(traps, "hits")[0];
      el("queue-title").textContent = t("title.growthInsights");
      el("candidate-tabs").classList.add("hidden");
      el("queue-meta").textContent = state.projectRoot
        ? t("meta.insightCounts", { count: traps.length, status: valueLabel(state.insightFilters.status || "all") })
        : t("meta.noProject");
      el("candidates").innerHTML = \`
        <div class="library-tools">
          <div class="filter-grid">
            \${filterSelect("insight-filter-scope", t("label.scope"), state.insightFilters.scope, [["", t("option.projectGlobal")], ...optionPairs(state.options.scopes)])}
            \${filterSelect("insight-filter-status", t("label.status"), state.insightFilters.status, [["all", valueLabel("all")], ["active", valueLabel("active")], ["archived", valueLabel("archived")], ["superseded", valueLabel("superseded")]])}
          </div>
        </div>
        <div class="summary-grid">
          \${metric(t("metric.confirmedTraps"), traps.length || "0", t("metric.selectedScope"))}
          \${metric(t("metric.highSeverity"), serious || "0", t("metric.errorCritical"))}
          \${metric(t("metric.topCategory"), topCategory ? valueLabel(topCategory) : "-", t("metric.largestPattern"))}
          \${metric(t("metric.focusArea"), topModule || topTag || "-", topModule ? t("metric.module") : t("metric.tag"))}
          \${metric(t("metric.mostViewed"), mostViewed ? "#" + mostViewed.id : "-", mostViewed ? mostViewed.title : t("metric.noHits"))}
        </div>
        <div class="insight-grid">
          \${renderInsightRankBlock(t("insight.categories"), topValues(traps.map((trap) => trap.category), 6, true), traps.length)}
          \${renderInsightRankBlock(t("insight.modules"), topValues(traps.map((trap) => trap.module).filter(Boolean), 6), traps.length)}
          \${renderInsightRankBlock(t("insight.tags"), topValues(traps.flatMap((trap) => trap.tags || []), 8), traps.length)}
          \${renderInsightRankBlock(t("insight.severityMix"), topValues(traps.map((trap) => trap.severity), 5, true), traps.length)}
        </div>
      \`;
      bindInsightControls();
    }

    function renderInsightDetail() {
      if (state.mainView !== "insights") return;
      const traps = state.insightTraps;
      const recent = sortTraps(traps, "updated").slice(0, 8);
      const mostViewed = sortTraps(traps, "hits").filter((trap) => Number(trap.hit_count || 0) > 0).slice(0, 8);
      const seriousRecent = sortTraps(traps.filter((trap) => trap.severity === "error" || trap.severity === "critical"), "updated").slice(0, 8);
      el("detail-title").textContent = t("title.insightDetail");
      el("detail-meta").textContent = state.projectRoot ? (state.insightFilters.scope ? valueLabel(state.insightFilters.scope) : t("option.projectGlobal")) : t("meta.selectProject");
      el("detail").innerHTML = \`
        <div class="scroll">
          <div class="section">
            <div class="title">\${escapeHtml(t("title.recentTraps"))}</div>
            \${renderInsightTrapRows(recent)}
          </div>
          <div class="section">
            <div class="title">\${escapeHtml(t("title.mostViewed"))}</div>
            \${renderInsightTrapRows(mostViewed)}
          </div>
          <div class="section">
            <div class="title">\${escapeHtml(t("title.recentHighSeverity"))}</div>
            \${renderInsightTrapRows(seriousRecent)}
          </div>
        </div>
      \`;
      bindTrapJumpButtons();
    }

    function bindInsightControls() {
      const scope = el("insight-filter-scope");
      if (scope) {
        scope.addEventListener("change", async () => {
          state.insightFilters.scope = scope.value;
          await loadInsightTraps();
        });
      }
      const status = el("insight-filter-status");
      if (status) {
        status.addEventListener("change", async () => {
          state.insightFilters.status = status.value;
          await loadInsightTraps();
        });
      }
    }

    function renderInsightRankBlock(label, items, total) {
      return \`<div class="insight-block">
        <div class="title">\${escapeHtml(label)}</div>
        <div class="rank-list">
          \${items.length ? items.map((item) => renderRankRow(item, total)).join("") : '<div class="empty">' + escapeHtml(t("empty.noData")) + '</div>'}
        </div>
      </div>\`;
    }

    function renderRankRow(item, total) {
      const width = total > 0 ? Math.max(6, Math.round((item.count / total) * 100)) : 0;
      return \`<div class="rank-row">
        <div class="rank-label">\${escapeHtml(item.label)}</div>
        <div class="rank-count">\${item.count}</div>
        <div class="bar-track"><div class="bar-fill" style="width:\${width}%"></div></div>
      </div>\`;
    }

    function renderInsightTrapRows(traps) {
      return traps.length ? traps.map((trap) => \`
        <button type="button" class="row" data-view-trap-scope="\${escapeAttr(trap.scope)}" data-view-trap-id="\${escapeAttr(trap.id)}">
            <span class="row-title">\${escapeHtml(trap.title)}</span>
          <span class="meta">
            <span class="pill \${escapeAttr(trap.severity)}">\${escapeHtml(valueLabel(trap.severity))}</span>
            <span class="pill">\${escapeHtml(valueLabel(trap.category))}</span>
            <span class="pill scope">\${escapeHtml(valueLabel(trap.scope))}</span>
            <span class="pill \${escapeAttr(trap.status)}">\${escapeHtml(valueLabel(trap.status))}</span>
            <span class="pill">\${escapeHtml(t("pill.hits", { count: Number(trap.hit_count || 0) }))}</span>
          </span>
          <span class="subtle">\${escapeHtml(trap.updated_at || trap.created_at || "")}</span>
        </button>
      \`).join("") : '<div class="empty">' + escapeHtml(t("empty.noTraps")) + '</div>';
    }

    function metric(label, value, detail) {
      return \`<div class="metric"><div class="metric-label">\${escapeHtml(label)}</div><div class="metric-value">\${escapeHtml(value)}</div><div class="subtle">\${escapeHtml(detail)}</div></div>\`;
    }

    function topValue(values) {
      const counts = new Map();
      values.forEach((value) => {
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || "";
    }

    function topValues(values, limit, translateValues = false) {
      const counts = new Map();
      values.forEach((value) => {
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, limit)
        .map(([label, count]) => ({ label: translateValues ? valueLabel(label) : label, count }));
    }

    function visibleTraps() {
      const query = state.trapSearch.trim().toLowerCase();
      const traps = query ? state.traps.filter((trap) => trapSearchText(trap).includes(query)) : state.traps;
      return sortTraps(traps, state.trapSort);
    }

    function sortTraps(traps, sortKey) {
      const sorted = [...traps];
      sorted.sort((a, b) => {
        if (sortKey === "severity") return severityRank(b.severity) - severityRank(a.severity) || byUpdatedDesc(a, b) || byTitle(a, b);
        if (sortKey === "hits") return Number(b.hit_count || 0) - Number(a.hit_count || 0) || byUpdatedDesc(a, b) || byTitle(a, b);
        if (sortKey === "category") return byText(a.category, b.category) || byTitle(a, b);
        if (sortKey === "title") return byTitle(a, b);
        return byUpdatedDesc(a, b) || byTitle(a, b);
      });
      return sorted;
    }

    function sortLabel(sortKey) {
      return sortKey === "severity" ? t("sortLabel.severity")
        : sortKey === "hits" ? t("sortLabel.hits")
        : sortKey === "category" ? t("sortLabel.category")
        : sortKey === "title" ? t("sortLabel.title")
        : t("sortLabel.updated");
    }

    function byUpdatedDesc(a, b) {
      return byText(b.updated_at || b.created_at || "", a.updated_at || a.created_at || "");
    }

    function byTitle(a, b) {
      return byText(a.title, b.title);
    }

    function byText(a, b) {
      return String(a || "").localeCompare(String(b || ""));
    }

    function severityRank(severity) {
      return severity === "critical" ? 4 : severity === "error" ? 3 : severity === "warning" ? 2 : severity === "info" ? 1 : 0;
    }

    function trapSearchText(trap) {
      return [
        trap.title,
        trap.category,
        trap.severity,
        trap.status,
        trap.scope,
        trap.context,
        trap.mistake,
        trap.fix,
        trap.module,
        trap.owner,
        ...(trap.tags || []),
        ...(trap.path_globs || []),
      ].filter(Boolean).join(" ").toLowerCase();
    }

    function selectVisibleTrap(traps = visibleTraps()) {
      if (!traps.some((trap) => trapKey(trap) === state.trapKey)) {
        state.trapKey = traps[0] ? trapKey(traps[0]) : null;
      }
    }

    function currentTrap() {
      return state.traps.find((trap) => trapKey(trap) === state.trapKey) || null;
    }

    function trapKey(trap) {
      return trap.scope + ":" + trap.id;
    }

    function bindTrapJumpButtons() {
      document.querySelectorAll("[data-view-trap-scope][data-view-trap-id]").forEach((button) => {
        if (button.dataset.jumpBound === "true") return;
        button.dataset.jumpBound = "true";
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          const id = Number.parseInt(button.dataset.viewTrapId, 10);
          if (!button.dataset.viewTrapScope || !Number.isInteger(id)) return;
          await jumpToTrap(button.dataset.viewTrapScope, id);
        });
      });
    }

    async function jumpToTrap(scope, id) {
      const key = scope + ":" + id;
      state.mainView = "library";
      state.candidateId = null;
      state.trapSearch = "";
      state.trapFilters = { scope, status: "all", category: "", module: "", owner: "" };
      state.trapKey = key;
      renderMainViewButtons();
      await loadTraps();
      if (state.traps.some((trap) => trapKey(trap) === key)) {
        state.trapKey = key;
        renderTrapResults();
        renderTrapDetail();
        showStatus(t("status.openedTrap", { id }));
      } else {
        showStatus(t("status.trapNotInLibrary", { id }), true);
      }
    }

    function renderCandidateViewTabs(pendingCount, reviewedCount) {
      document.querySelectorAll("[data-candidate-view]").forEach((button) => {
        const view = button.dataset.candidateView;
        const count = view === "inbox" ? pendingCount : reviewedCount;
        button.classList.toggle("active", view === state.candidateView);
        button.textContent = t(view === "inbox" ? "tab.inbox" : "tab.reviewed", { count });
      });
    }

    function sortedVisibleCandidates() {
      return state.candidates
        .filter(candidateVisible)
        .sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.quality_score - a.quality_score);
    }

    function candidateVisible(candidate) {
      return state.candidateView === "inbox" ? candidate.status === "proposed" : candidate.status !== "proposed";
    }

    function selectVisibleCandidate(candidates = sortedVisibleCandidates()) {
      if (!candidates.some((candidate) => candidate.id === state.candidateId)) {
        state.candidateId = candidates[0]?.id || null;
      }
    }

    function renderTrapDetail() {
      if (state.mainView !== "library") return;
      const trap = currentTrap();
      el("detail-title").textContent = t("title.trapDetail");
      el("detail-meta").textContent = trap ? "#" + trap.id + " / " + valueLabel(trap.scope) : t("meta.selectTrap");
      if (!trap) {
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("empty.noTrapSelected")) + '</div>';
        return;
      }

      const key = trapKey(trap);
      const details = state.trapDetails[key];
      if (!details) {
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("empty.loadingTrapDetails")) + '</div>';
        ensureTrapDetail(trap);
        return;
      }

      const detailTrap = details.trap;
      el("detail").innerHTML = \`
        <div class="scroll">
          <div class="section">
            <div class="meta">
              <span class="pill scope">\${escapeHtml(valueLabel(details.scope))}</span>
              <span class="pill \${escapeAttr(detailTrap.severity)}">\${escapeHtml(valueLabel(detailTrap.severity))}</span>
              <span class="pill">\${escapeHtml(valueLabel(detailTrap.category))}</span>
              <span class="pill \${escapeAttr(detailTrap.status)}">\${escapeHtml(valueLabel(detailTrap.status))}</span>
              <span class="pill">\${escapeHtml(t("pill.hits", { count: Number(detailTrap.hit_count || 0) }))}</span>
            </div>
            <div class="title" style="font-size:16px">\${escapeHtml(detailTrap.title)}</div>
          </div>
          <div class="section">
            \${textBlock(t("label.context"), detailTrap.context)}
            \${textBlock(t("label.mistake"), detailTrap.mistake)}
            \${textBlock(t("label.fix"), detailTrap.fix)}
          </div>
          <div class="section">
            <div class="detail-kv">
              \${kv(t("label.tags"), (detailTrap.tags || []).join(", ") || "-")}
              \${kv(t("label.pathGlobs"), (detailTrap.path_globs || []).join(", ") || "-")}
              \${kv(t("label.module"), detailTrap.module || "-")}
              \${kv(t("label.owner"), detailTrap.owner || "-")}
              \${kv(t("label.created"), detailTrap.created_at || "-")}
              \${kv(t("label.updated"), detailTrap.updated_at || "-")}
              \${kv(t("label.stateKey"), detailTrap.state_key || "-")}
              \${kv(t("label.supersedes"), detailTrap.supersedes_id ?? "-")}
              \${kv(t("label.validFrom"), detailTrap.valid_from || "-")}
              \${kv(t("label.validUntil"), detailTrap.valid_until || "-")}
            </div>
          </div>
          \${renderTrapCode(t("title.before"), detailTrap.before_code)}
          \${renderTrapCode(t("title.after"), detailTrap.after_code)}
          <div class="section">
            <div class="title">\${escapeHtml(t("title.evidence"))}</div>
            \${details.evidence.length ? details.evidence.map(renderEvidence).join("") : '<div class="empty">' + escapeHtml(t("empty.noEvidence")) + '</div>'}
          </div>
        </div>
      \`;
    }

    async function ensureTrapDetail(trap) {
      const key = trapKey(trap);
      if (state.trapDetails[key] || state.trapLoadingKey === key) return;
      state.trapLoadingKey = key;
      try {
        const params = new URLSearchParams({
          project: state.projectRoot,
          id: String(trap.id),
          scope: trap.scope,
        });
        state.trapDetails[key] = await api("/api/trap?" + params.toString());
        if (state.mainView === "library" && state.trapKey === key) renderTrapDetail();
      } catch (error) {
        showStatus(error.message, true);
      } finally {
        if (state.trapLoadingKey === key) state.trapLoadingKey = null;
      }
    }

    function textBlock(label, value) {
      return \`<div class="text-block"><label>\${escapeHtml(label)}</label><div class="content">\${escapeHtml(value || "-")}</div></div>\`;
    }

    function kv(label, value) {
      return \`<div class="kv"><div class="kv-label">\${escapeHtml(label)}</div><div class="kv-value">\${escapeHtml(value)}</div></div>\`;
    }

    function renderTrapCode(label, value) {
      if (!value) return "";
      return \`<div class="section"><div class="title">\${escapeHtml(label)}</div><pre class="code-block"><code>\${escapeHtml(value)}</code></pre></div>\`;
    }

    function renderDetail() {
      if (state.mainView !== "review") return;
      const candidate = state.candidates.find((item) => item.id === state.candidateId);
      el("detail-meta").textContent = candidate ? candidate.id + " / " + valueLabel(candidate.status) : t("meta.selectCandidate");
      if (!candidate) {
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("empty.noCandidateSelected")) + '</div>';
        return;
      }
      const disabled = candidate.status !== "proposed" ? "disabled" : "";
      el("detail").innerHTML = \`
        <div class="scroll">
          \${renderReviewNotice(candidate)}
          <form class="section" id="candidate-form">
            <div class="form-grid">
              \${field("title", t("label.title"), candidate.trap.title, disabled)}
              \${selectField("category", t("label.category"), candidate.trap.category, state.options.categories, disabled)}
              \${selectField("scope", t("label.scope"), candidate.trap.scope, state.options.scopes, disabled)}
              \${selectField("severity", t("label.severity"), candidate.trap.severity || "warning", state.options.severities, disabled)}
              \${field("tags", t("label.tags"), (candidate.trap.tags || []).join(", "), disabled)}
              \${field("path_globs", t("label.pathGlobs"), (candidate.trap.path_globs || []).join(", "), disabled)}
              \${field("module", t("label.module"), candidate.trap.module || "", disabled)}
              \${field("owner", t("label.owner"), candidate.trap.owner || "", disabled)}
              \${textarea("context", t("label.context"), candidate.trap.context, disabled)}
              \${textarea("mistake", t("label.mistake"), candidate.trap.mistake, disabled)}
              \${textarea("fix", t("label.fix"), candidate.trap.fix, disabled)}
            </div>
          </form>
          <div class="section">
            <div class="meta">
              <span class="pill">\${escapeHtml(t("pill.quality", { score: Number(candidate.quality_score).toFixed(2) }))}</span>
              <span class="pill">\${escapeHtml(t("pill.conflict", { status: valueLabel(candidate.quality.conflict_status) }))}</span>
              <span class="pill">\${escapeHtml(t("pill.action", { action: valueLabel(candidate.quality.suggested_action) }))}</span>
            </div>
            \${candidate.quality.warnings.map((warning) => '<div class="warning">' + escapeHtml(warning) + '</div>').join("")}
          </div>
          <div class="section">
            <div class="title">\${escapeHtml(t("title.evidence"))}</div>
            \${candidate.evidence.length ? candidate.evidence.map(renderEvidence).join("") : '<div class="empty">' + escapeHtml(t("empty.noEvidence")) + '</div>'}
          </div>
          \${renderConflicts()}
        </div>
        \${renderDetailActions(candidate, disabled)}
      \`;
      bindDetailActions(candidate);
      bindTrapJumpButtons();
    }

    function renderReviewNotice(candidate) {
      const review = candidate.review;
      if (!review || review.status === "pending") return "";
      if (review.status === "accepted_missing") {
        return \`<div class="section"><div class="warning">
          <div class="meta">
            <span class="pill accepted-missing">\${escapeHtml(reviewLabel(candidate))}</span>
            <button type="button" class="ghost" data-clean-deleted-candidates>\${escapeHtml(t("action.cleanDeletedCandidates"))}</button>
          </div>
        </div></div>\`;
      }
      if (review.status === "accepted") {
        return \`<div class="section"><div class="evidence review-note">
          <div class="meta">
            <span class="pill accepted">\${escapeHtml(reviewLabel(candidate))}</span>
            <span class="pill">\${escapeHtml(valueLabel(review.trap_status))}</span>
            <button type="button" class="ghost" data-view-trap-scope="\${escapeAttr(review.scope)}" data-view-trap-id="\${escapeAttr(review.trap_id)}">\${escapeHtml(t("action.viewTrap"))}</button>
          </div>
          <div class="subtle">\${escapeHtml(review.trap_title)}</div>
        </div></div>\`;
      }
      if (review.status === "rejected") {
        return \`<div class="section"><div class="evidence">
          <div class="meta"><span class="pill rejected">\${escapeHtml(reviewLabel(candidate))}</span></div>
          \${review.rejection_reason ? '<div class="subtle">' + escapeHtml(review.rejection_reason) + '</div>' : ''}
        </div></div>\`;
      }
      return "";
    }

    function renderDetailActions(candidate, disabled) {
      if (candidate.status !== "proposed") {
        const review = candidate.review;
        const viewTrap = review?.status === "accepted"
          ? \`<button type="button" data-view-trap-scope="\${escapeAttr(review.scope)}" data-view-trap-id="\${escapeAttr(review.trap_id)}">\${escapeHtml(t("action.viewTrap"))}</button>\`
          : "";
        const cleanDeleted = review?.status === "accepted_missing"
          ? \`<button type="button" data-clean-deleted-candidates>\${escapeHtml(t("action.cleanDeletedCandidates"))}</button>\`
          : "";
        return \`<div class="actions"><span class="pill \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>\${viewTrap}\${cleanDeleted}</div>\`;
      }
      return \`<div class="actions">
        <button id="save" class="primary" \${disabled}>\${escapeHtml(t("action.save"))}</button>
        <button id="accept" \${disabled}>\${escapeHtml(t("action.accept"))}</button>
        <button id="reject" class="danger" \${disabled}>\${escapeHtml(t("action.reject"))}</button>
        <button id="accept-anyway" \${disabled}>\${escapeHtml(t("action.acceptAnyway"))}</button>
        <input id="supersedes" placeholder="\${escapeAttr(t("placeholder.supersedesId"))}" style="width:150px" \${disabled}>
        <button id="supersede" \${disabled}>\${escapeHtml(t("action.supersede"))}</button>
      </div>\`;
    }

    function bindDetailActions(candidate) {
      document.querySelectorAll("[data-clean-deleted-candidates]").forEach((button) => {
        button.addEventListener("click", cleanupDeletedCandidates);
      });
      const save = el("save");
      if (!save) return;
      save.addEventListener("click", async () => {
        try {
          const data = await api("/api/candidate/save", {
            method: "POST",
            body: JSON.stringify(candidatePayload(candidate.id))
          });
          await syncAfterMutation(data.candidate.id);
          showStatus(t("status.candidateSaved"));
        } catch (error) {
          showStatus(error.message, true);
        }
      });
      el("accept").addEventListener("click", () => acceptCandidate({}));
      el("accept-anyway").addEventListener("click", () => acceptCandidate({ acceptAnyway: true }));
      el("supersede").addEventListener("click", () => {
        const value = Number.parseInt(el("supersedes").value, 10);
        if (Number.isNaN(value)) return showStatus(t("status.supersedesRequired"), true);
        acceptCandidate({ supersedesId: value });
      });
      el("reject").addEventListener("click", async () => {
        const reason = prompt(t("prompt.rejectReason")) || "";
        try {
          const data = await api("/api/candidate/reject", {
            method: "POST",
            body: JSON.stringify({ projectRoot: state.projectRoot, sessionId: state.sessionId, candidateId: candidate.id, reason })
          });
          await syncAfterMutation(data.candidate.id);
          showStatus(t("status.candidateRejected"));
        } catch (error) {
          showStatus(error.message, true);
        }
      });
    }

    async function acceptCandidate(extra) {
      try {
        const data = await api("/api/candidate/accept", {
          method: "POST",
          body: JSON.stringify({ projectRoot: state.projectRoot, sessionId: state.sessionId, candidateId: state.candidateId, ...extra })
        });
        await syncAfterMutation(data.candidate.id);
        state.conflicts = [];
        showStatus(t("status.candidateAccepted"));
      } catch (error) {
        if (error.payload?.possible_conflicts) {
          state.conflicts = error.payload.possible_conflicts;
          showStatus(t("status.possibleConflict"), true);
          await loadCandidates();
          state.conflicts = error.payload.possible_conflicts;
          renderDetail();
        } else {
          showStatus(error.message, true);
        }
      }
    }

    function candidatePayload(candidateId) {
      const form = new FormData(el("candidate-form"));
      return {
        projectRoot: state.projectRoot,
        sessionId: state.sessionId,
        candidateId,
        trap: {
          title: String(form.get("title") || ""),
          category: String(form.get("category") || ""),
          scope: String(form.get("scope") || ""),
          severity: String(form.get("severity") || ""),
          tags: splitList(form.get("tags")),
          path_globs: splitList(form.get("path_globs")),
          module: blankToNull(form.get("module")),
          owner: blankToNull(form.get("owner")),
          context: String(form.get("context") || ""),
          mistake: String(form.get("mistake") || ""),
          fix: String(form.get("fix") || "")
        }
      };
    }

    function replaceCandidate(candidate) {
      state.candidates = state.candidates.map((item) => item.id === candidate.id ? candidate : item);
      renderCandidates();
      renderDetail();
    }

    async function syncAfterMutation(candidateId) {
      state.candidateId = candidateId;
      await loadSessions();
    }

    async function refreshAll() {
      try {
        await bootstrap();
        showStatus(t("status.refreshed"));
      } catch (error) {
        showStatus(error.message, true);
      }
    }

    el("refresh").addEventListener("click", refreshAll);
    document.querySelectorAll("[data-locale]").forEach((button) => {
      button.addEventListener("click", () => setLocale(button.dataset.locale));
    });
    document.querySelectorAll("[data-main-view]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.mainView = button.dataset.mainView;
        state.candidateId = null;
        state.trapKey = null;
        renderActiveView();
        if (state.mainView === "library") {
          await loadTraps();
        } else if (state.mainView === "insights") {
          await loadInsightTraps();
        } else {
          await loadCandidates();
        }
      });
    });
    document.querySelectorAll("[data-candidate-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.candidateView = button.dataset.candidateView;
        state.candidateId = null;
        state.conflicts = [];
        renderCandidates();
        renderDetail();
      });
    });
    el("project-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const path = el("project-path").value.trim();
        if (!path) return;
        const data = await api("/api/projects", { method: "POST", body: JSON.stringify({ path }) });
        state.projects = data.projects;
        state.projectRoot = data.project.root;
        state.sessionId = null;
        state.candidateId = null;
        state.trapKey = null;
        state.trapDetails = {};
        state.insightTraps = [];
        el("project-path").value = "";
        renderProjects();
        await loadSessions();
      } catch (error) {
        showStatus(error.message, true);
      }
    });

    function field(name, label, value, disabled) {
      return \`<div class="field"><label for="\${name}">\${label}</label><input id="\${name}" name="\${name}" value="\${escapeAttr(value || "")}" \${disabled}></div>\`;
    }

    function textarea(name, label, value, disabled) {
      return \`<div class="field full"><label for="\${name}">\${label}</label><textarea id="\${name}" name="\${name}" \${disabled}>\${escapeHtml(value || "")}</textarea></div>\`;
    }

    function selectField(name, label, value, options, disabled) {
      return \`<div class="field"><label for="\${name}">\${label}</label><select id="\${name}" name="\${name}" \${disabled}>\${options.map((option) => \`<option value="\${escapeAttr(option)}" \${option === value ? "selected" : ""}>\${escapeHtml(valueLabel(option))}</option>\`).join("")}</select></div>\`;
    }

    function renderEvidence(evidence) {
      return \`<div class="evidence">
        <div class="meta">
          <span class="pill">\${escapeHtml(valueLabel(evidence.source_type))}</span>
          \${evidence.source_ref ? '<span class="pill">' + escapeHtml(evidence.source_ref) + '</span>' : ''}
        </div>
        <div class="subtle">\${escapeHtml((evidence.related_files || []).join(", "))}</div>
        <div>\${escapeHtml(evidence.note || "")}</div>
      </div>\`;
    }

    function renderConflicts() {
      if (!state.conflicts.length) return "";
      return \`<div class="section"><div class="title">\${escapeHtml(t("title.possibleConflicts"))}</div>\${state.conflicts.map((conflict) => \`
        <div class="conflict">
          <div class="meta"><span class="pill danger">#\${conflict.trap_id}</span><span class="pill">\${escapeHtml(valueLabel(conflict.scope))}</span><span class="pill warn">\${escapeHtml(conflict.reason)}</span></div>
          <strong>\${escapeHtml(conflict.title)}</strong>
          <div class="subtle">\${escapeHtml(conflict.context)}</div>
          <div>\${escapeHtml(conflict.fix)}</div>
        </div>\`).join("")}</div>\`;
    }

    function statusRank(status) {
      return status === "proposed" ? 0 : status === "accepted" ? 1 : 2;
    }

    function reviewLabel(candidate) {
      const review = candidate.review;
      if (!review || review.status === "pending") return t("review.pending");
      if (review.status === "accepted") return t("review.accepted", { id: review.trap_id });
      if (review.status === "accepted_missing") {
        return review.trap_id === undefined ? t("review.acceptedLinkMissing") : t("review.acceptedDeleted", { id: review.trap_id });
      }
      if (review.status === "rejected") return t("review.rejected");
      return valueLabel(candidate.status);
    }

    function reviewCssClass(candidate) {
      return String(candidate.review?.status || candidate.status).replace(/_/g, "-");
    }

    function splitList(value) {
      return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
    }

    function blankToNull(value) {
      const text = String(value || "").trim();
      return text ? text : null;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }

    refreshAll();`;
}
