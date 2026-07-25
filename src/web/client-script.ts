import { WEB_TEXT_JSON } from "./client-text";
import { WEB_REVIEW_CLIENT_SCRIPT } from "./client-review";
import { WEB_SHELL_CLIENT_SCRIPT } from "./client-shell";

export function webClientScript(textJson = WEB_TEXT_JSON): string {
  return `    const qs = new URLSearchParams(location.search);
    const token = qs.get("token") || sessionStorage.getItem("codetrap-token") || "";
    if (token) sessionStorage.setItem("codetrap-token", token);
    const savedLocale = localStorage.getItem("codetrap-locale");
    const initialLocale = savedLocale === "zh" ? "zh" : "en";
    const savedSidebarCollapsed = localStorage.getItem("codetrap-sidebar-collapsed") === "true";
    const savedQueueCollapsed = localStorage.getItem("codetrap-queue-collapsed") === "true";
    const EMBEDDING_DEFAULTS = {
      endpoint: "http://127.0.0.1:11434",
      model: "qwen3-embedding:0.6b",
      dimensions: "1024"
    };

    const TEXT = ${textJson};

    const state = {
      locale: initialLocale,
      mainView: "review",
      projects: [],
      sessions: [],
      candidateReview: null,
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
      embeddingStatus: null,
      embeddingSettings: null,
      embeddingProviderDraft: "ollama",
      embeddingOllama: { ...EMBEDDING_DEFAULTS },
      embeddingReindexing: null,
      projectRoot: null,
      sessionId: null,
      candidateId: null,
      candidateView: "inbox",
      candidateDirty: false,
      detailActionInFlight: false,
      sidebarCollapsed: savedSidebarCollapsed,
      queueCollapsed: savedQueueCollapsed,
      options: { categories: [], severities: [], scopes: [] },
      conflicts: []
    };

    const el = (id) => document.getElementById(id);
${WEB_SHELL_CLIENT_SCRIPT}
${WEB_REVIEW_CLIENT_SCRIPT}
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
      document.querySelector("[data-main-view='embeddings']").textContent = t("nav.embeddings");
      document.querySelectorAll("[data-locale]").forEach((button) => {
        button.classList.toggle("active", button.dataset.locale === state.locale);
      });
      renderSidebarToggle();
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
        state.candidateReview = null;
        state.candidates = [];
        state.traps = [];
        state.insightTraps = [];
        state.embeddingStatus = null;
        state.embeddingSettings = null;
        renderSessions();
        renderActiveView();
        return;
      }
      const data = await api("/api/sessions?project=" + encodeURIComponent(state.projectRoot));
      state.sessions = data.sessions;
      state.candidateReview = data.candidate_review || null;
      state.sessionId = selectedReviewSessionId(state.sessions, state.sessionId);
      renderSessions();
      if (state.mainView === "library") {
        await loadTraps();
      } else if (state.mainView === "insights") {
        await loadInsightTraps();
      } else if (state.mainView === "embeddings") {
        await loadEmbeddings();
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
      state.candidateId = reviewQueueModel({
        candidates: state.candidates,
        candidateView: state.candidateView,
        candidateId: state.candidateId,
        candidateReview: state.candidateReview
      }).selectedCandidateId;
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

    async function loadEmbeddings() {
      if (!state.projectRoot) {
        state.embeddingStatus = null;
        state.embeddingSettings = null;
        if (state.mainView === "embeddings") {
          renderEmbeddingsView();
          renderEmbeddingsDetail();
        }
        return;
      }
      const data = await api("/api/embeddings?project=" + encodeURIComponent(state.projectRoot));
      state.embeddingStatus = data;
      state.embeddingSettings = data.settings || null;
      syncEmbeddingDraftFromStatus(data);
      if (state.mainView === "embeddings") {
        renderEmbeddingsView();
        renderEmbeddingsDetail();
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
        hideReviewSummary();
        renderLibrary();
        renderTrapDetail();
      } else if (state.mainView === "insights") {
        el("queue-title").textContent = t("title.growthInsights");
        el("detail-title").textContent = t("title.insightDetail");
        el("candidate-tabs").classList.add("hidden");
        hideReviewSummary();
        renderInsightsView();
        renderInsightDetail();
      } else if (state.mainView === "embeddings") {
        el("queue-title").textContent = t("title.embeddings");
        el("detail-title").textContent = t("title.embeddingDetail");
        el("candidate-tabs").classList.add("hidden");
        hideReviewSummary();
        renderEmbeddingsView();
        renderEmbeddingsDetail();
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
          state.embeddingStatus = null;
          state.embeddingSettings = null;
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
              <span class="pill \${session.pending_count ? "warn" : ""}">\${escapeHtml(t("pill.pending", { count: session.pending_count || 0 }))}</span>
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
      const model = reviewQueueModel({
        candidates: state.candidates,
        candidateView: state.candidateView,
        candidateId: state.candidateId,
        candidateReview: state.candidateReview
      });
      const pendingCount = model.pendingCount;
      const reviewedCount = model.reviewedCount;
      const sorted = model.visibleCandidates;
      state.candidateId = model.selectedCandidateId;
      const session = state.sessions.find((item) => item.id === state.sessionId);
      el("queue-meta").textContent = session
        ? t("meta.sessionCounts", { goal: session.goal, pending: pendingCount, reviewed: reviewedCount })
        : t("meta.noSession");
      renderReviewSummary(model.summary);
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

    function syncEmbeddingDraftFromStatus(status) {
      const settings = status?.settings || null;
      const runtime = status?.runtime || null;
      const provider = settings?.provider || runtime?.provider || "ollama";
      state.embeddingProviderDraft = provider === "jina" ? "jina" : "ollama";
      if (state.embeddingProviderDraft === "ollama") {
        state.embeddingOllama = {
          endpoint: settings?.endpoint || EMBEDDING_DEFAULTS.endpoint,
          model: settings?.model || runtime?.model || EMBEDDING_DEFAULTS.model,
          dimensions: String(settings?.dimensions || runtime?.dimensions || EMBEDDING_DEFAULTS.dimensions)
        };
      }
    }

    function renderEmbeddingsView() {
      if (state.mainView !== "embeddings") return;
      const status = state.embeddingStatus;
      const runtime = status?.runtime || null;
      const project = status?.project || null;
      const global = status?.global || null;
      const provider = runtime?.provider || state.embeddingProviderDraft || "";
      const providerLabel = provider ? valueLabel(provider) : t("embedding.notConfigured");
      el("queue-title").textContent = t("title.embeddings");
      el("candidate-tabs").classList.add("hidden");
      el("queue-meta").textContent = state.projectRoot && status
        ? t("meta.embeddingCounts", {
            provider: providerLabel,
            projectFresh: project?.fresh ?? 0,
            projectTotal: project?.total ?? 0,
            globalFresh: global?.fresh ?? 0,
            globalTotal: global?.total ?? 0
          })
        : t(state.projectRoot ? "embedding.notConfigured" : "meta.noProject");

      if (!state.projectRoot) {
        el("candidates").innerHTML = '<div class="empty">' + escapeHtml(t("meta.selectProject")) + '</div>';
        return;
      }

      el("candidates").innerHTML = \`
        <div class="summary-grid">
          \${metric(t("metric.activeProvider"), providerLabel, runtimeStateLabel(runtime))}
          \${metric(t("metric.activeProfile"), shortProfileId(runtime?.profile_id), runtime?.profile_id || t("embedding.noProfile"))}
          \${metric(t("metric.projectFresh"), embeddingFreshValue(project), embeddingNeedsReindex(project))}
          \${metric(t("metric.globalFresh"), embeddingFreshValue(global), embeddingNeedsReindex(global))}
        </div>
        <form class="settings-form" id="embedding-form">
          <div class="status-line">
            <span class="status-dot \${runtime?.available ? "available" : "unavailable"}" aria-hidden="true"></span>
            <span class="pill \${runtime?.available ? "accepted" : "warn"}">\${escapeHtml(runtimeStateLabel(runtime))}</span>
            \${runtime?.profile_id ? '<span class="pill scope">' + escapeHtml(t("embedding.activeProfile")) + '</span>' : ''}
          </div>
          <div class="segmented" id="embedding-provider-tabs" aria-label="\${escapeAttr(t("label.provider"))}">
            <button type="button" data-embedding-provider="ollama" class="\${state.embeddingProviderDraft === "ollama" ? "active" : ""}">\${escapeHtml(valueLabel("ollama"))}</button>
            <button type="button" data-embedding-provider="jina" class="\${state.embeddingProviderDraft === "jina" ? "active" : ""}">\${escapeHtml(valueLabel("jina"))}</button>
          </div>
          <div class="provider-fields \${state.embeddingProviderDraft === "ollama" ? "" : "hidden"}">
            <div class="field"><label for="embedding-endpoint">\${escapeHtml(t("label.endpoint"))}</label><input id="embedding-endpoint" value="\${escapeAttr(state.embeddingOllama.endpoint)}" placeholder="\${escapeAttr(t("placeholder.endpoint"))}"></div>
            <div class="field"><label for="embedding-model">\${escapeHtml(t("label.model"))}</label><input id="embedding-model" value="\${escapeAttr(state.embeddingOllama.model)}" placeholder="\${escapeAttr(t("placeholder.model"))}"></div>
            <div class="field"><label for="embedding-dimensions">\${escapeHtml(t("label.dimensions"))}</label><input id="embedding-dimensions" type="number" min="1" step="1" value="\${escapeAttr(state.embeddingOllama.dimensions)}"></div>
          </div>
          <div class="warning \${state.embeddingProviderDraft === "jina" ? "" : "hidden"}">\${escapeHtml(t("hint.jinaEnv"))}</div>
          <button type="submit" class="primary">\${escapeHtml(t("action.useProvider"))}</button>
        </form>
        <div class="section">
          <div class="title">\${escapeHtml(t("title.reindex"))}</div>
          <div class="subtle">\${escapeHtml(t("hint.reindexAfterSwitch"))}</div>
          <div class="actions" style="padding:0;border-top:0;background:transparent">
            <button type="button" id="embedding-reindex-project" \${state.embeddingReindexing ? "disabled" : ""}>\${escapeHtml(t("action.reindexProject"))}</button>
            <button type="button" id="embedding-reindex-global" \${state.embeddingReindexing ? "disabled" : ""}>\${escapeHtml(t("action.reindexGlobal"))}</button>
          </div>
        </div>
      \`;
      bindEmbeddingsControls();
    }

    function renderEmbeddingsDetail() {
      if (state.mainView !== "embeddings") return;
      const status = state.embeddingStatus;
      const runtime = status?.runtime || null;
      el("detail-title").textContent = t("title.embeddingDetail");
      el("detail-meta").textContent = state.projectRoot
        ? t("meta.embeddingDetail", {
            profile: runtime?.profile_id || t("embedding.noProfile"),
            state: runtimeStateLabel(runtime)
          })
        : t("meta.selectProject");

      if (!state.projectRoot) {
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("meta.selectProject")) + '</div>';
        return;
      }
      if (!status) {
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("empty.noData")) + '</div>';
        return;
      }

      el("detail").innerHTML = \`
        <div class="scroll">
          <div class="section">
            <div class="title">\${escapeHtml(t("title.currentProfile"))}</div>
            <div class="detail-kv">
              \${kv(t("label.provider"), runtime?.provider ? valueLabel(runtime.provider) : t("embedding.notConfigured"))}
              \${kv(t("label.model"), runtime?.model || "-")}
              \${kv(t("label.dimensions"), runtime?.dimensions ?? "-")}
              \${kv(t("label.profileId"), runtime?.profile_id || t("embedding.noProfile"))}
              \${kv(t("label.available"), runtimeStateLabel(runtime))}
              \${kv(t("label.setupAction"), runtime?.setup_action?.command || "-")}
            </div>
            \${runtime?.setup_action ? '<div class="warning">' + escapeHtml(runtime.setup_action.reason) + '</div>' : ''}
          </div>
          \${renderEmbeddingScopeDetail("project", status.project)}
          \${renderEmbeddingScopeDetail("global", status.global)}
        </div>
      \`;
    }

    function bindEmbeddingsControls() {
      document.querySelectorAll("[data-embedding-provider]").forEach((button) => {
        button.addEventListener("click", () => {
          state.embeddingProviderDraft = button.dataset.embeddingProvider === "jina" ? "jina" : "ollama";
          renderEmbeddingsView();
        });
      });
      const endpoint = el("embedding-endpoint");
      if (endpoint) endpoint.addEventListener("input", () => state.embeddingOllama.endpoint = endpoint.value);
      const model = el("embedding-model");
      if (model) model.addEventListener("input", () => state.embeddingOllama.model = model.value);
      const dimensions = el("embedding-dimensions");
      if (dimensions) dimensions.addEventListener("input", () => state.embeddingOllama.dimensions = dimensions.value);
      const form = el("embedding-form");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          await useEmbeddingProvider();
        });
      }
      const project = el("embedding-reindex-project");
      if (project) project.addEventListener("click", () => reindexEmbeddings("project"));
      const global = el("embedding-reindex-global");
      if (global) global.addEventListener("click", () => reindexEmbeddings("global"));
    }

    async function useEmbeddingProvider() {
      if (!state.projectRoot) return;
      const body = {
        projectRoot: state.projectRoot,
        provider: state.embeddingProviderDraft
      };
      if (state.embeddingProviderDraft === "ollama") {
        const dimensions = Number.parseInt(state.embeddingOllama.dimensions, 10);
        if (!Number.isInteger(dimensions) || dimensions <= 0) {
          showStatus(t("status.invalidDimensions"), true);
          return;
        }
        body.endpoint = state.embeddingOllama.endpoint || EMBEDDING_DEFAULTS.endpoint;
        body.model = state.embeddingOllama.model || EMBEDDING_DEFAULTS.model;
        body.dimensions = dimensions;
      }
      try {
        const data = await api("/api/embeddings/use", {
          method: "POST",
          body: JSON.stringify(body)
        });
        state.embeddingSettings = data.settings || data.embeddings || null;
        state.embeddingStatus = {
          project_root: data.project_root,
          settings: state.embeddingSettings,
          ...data.status
        };
        syncEmbeddingDraftFromStatus(state.embeddingStatus);
        renderEmbeddingsView();
        renderEmbeddingsDetail();
        showStatus(t("status.embeddingProviderSaved"));
      } catch (error) {
        showStatus(error.message, true);
      }
    }

    async function reindexEmbeddings(scope) {
      if (!state.projectRoot || state.embeddingReindexing) return;
      state.embeddingReindexing = scope;
      renderEmbeddingsView();
      try {
        const data = await api("/api/embeddings/reindex", {
          method: "POST",
          body: JSON.stringify({ projectRoot: state.projectRoot, scope })
        });
        state.embeddingStatus = {
          project_root: data.project_root,
          settings: state.embeddingSettings,
          ...data.status
        };
        renderEmbeddingsView();
        renderEmbeddingsDetail();
        showStatus(t("status.embeddingsReindexed", {
          generated: data.result?.generated ?? 0,
          skipped: data.result?.skipped ?? 0
        }));
      } catch (error) {
        showStatus(error.message, true);
      } finally {
        state.embeddingReindexing = null;
        renderEmbeddingsView();
      }
    }

    function renderEmbeddingScopeDetail(scope, status) {
      const title = scope === "project" ? t("title.projectEmbeddings") : t("title.globalEmbeddings");
      if (!status) {
        return \`<div class="section"><div class="title">\${escapeHtml(title)}</div><div class="empty">\${escapeHtml(t("empty.noData"))}</div></div>\`;
      }
      return \`<div class="section">
        <div class="title">\${escapeHtml(title)}</div>
        <div class="detail-kv">
          \${kv(t("label.total"), status.total)}
          \${kv(t("label.fresh"), status.fresh)}
          \${kv(t("label.stale"), status.stale)}
          \${kv(t("label.missing"), status.missing)}
        </div>
        <div class="title">\${escapeHtml(t("title.storedProfiles"))}</div>
        <div class="profile-list">\${renderEmbeddingProfiles(status.profiles || [])}</div>
      </div>\`;
    }

    function renderEmbeddingProfiles(profiles) {
      return profiles.length ? profiles.map((profile) => \`
        <div class="profile-row">
          <div class="row-title">\${escapeHtml(profile.id)}</div>
          <div class="meta">
            <span class="pill">\${escapeHtml(valueLabel(profile.provider))}</span>
            <span class="pill">\${escapeHtml(profile.model)}</span>
            <span class="pill">\${escapeHtml(String(profile.dimensions))}d</span>
            <span class="pill">\${escapeHtml(t("label.count"))}: \${escapeHtml(profile.embedding_count)}</span>
          </div>
          <div class="subtle">\${escapeHtml(profile.updated_at || "-")}</div>
        </div>
      \`).join("") : '<div class="empty">' + escapeHtml(t("empty.noProfiles")) + '</div>';
    }

    function runtimeStateLabel(runtime) {
      if (!runtime?.provider) return t("embedding.notConfigured");
      return runtime.available ? t("embedding.available") : t("embedding.unavailable");
    }

    function embeddingFreshValue(status) {
      if (!status) return "-";
      return String(status.fresh || 0) + "/" + String(status.total || 0);
    }

    function embeddingNeedsReindex(status) {
      if (!status || status.total === 0) return t("embedding.noProfile");
      return status.fresh === status.total ? t("embedding.activeProfile") : t("embedding.profileNeedsReindex");
    }

    function shortProfileId(profileId) {
      if (!profileId) return "-";
      const parts = profileId.split(":");
      return parts.length >= 4 ? parts[0] + " / " + parts[1] : profileId;
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

    function renderReviewSummary(summary = visibleReviewSummary(state.candidateReview)) {
      const target = el("review-summary");
      if (!target) return;
      if (!summary) {
        target.classList.add("hidden");
        target.innerHTML = "";
        return;
      }
      target.classList.remove("hidden");
      target.innerHTML = \`
        <div class="review-banner">
          <strong>\${escapeHtml(t("reviewSummary.pending", { count: summary.pending_count }))}</strong>
          <span>\${escapeHtml(t("reviewSummary.sessions", { count: summary.pending_session_count }))}</span>
          <span>\${escapeHtml(t("reviewSummary.quality", { high: summary.high_quality_pending_count, edit: summary.needs_edit_count }))}</span>
        </div>
      \`;
    }

    function hideReviewSummary() {
      const target = el("review-summary");
      if (!target) return;
      target.classList.add("hidden");
      target.innerHTML = "";
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
        state.candidateDirty = false;
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("empty.noCandidateSelected")) + '</div>';
        return;
      }
      state.candidateDirty = false;
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
      bindCandidateFormDirty(candidate);
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
        <span id="candidate-draft-state" class="action-hint">\${escapeHtml(t("hint.acceptUsesCurrentDraft"))}</span>
      </div>\`;
    }

    function bindCandidateFormDirty(candidate) {
      const form = el("candidate-form");
      if (!form || candidate.status !== "proposed") return;
      const markDirty = () => {
        state.candidateDirty = true;
        renderCandidateDraftState();
      };
      form.addEventListener("input", markDirty);
      form.addEventListener("change", markDirty);
      renderCandidateDraftState();
    }

    function renderCandidateDraftState() {
      const draft = el("candidate-draft-state");
      if (!draft) return;
      draft.textContent = state.candidateDirty ? t("hint.unsavedDraftAccepted") : t("hint.acceptUsesCurrentDraft");
      draft.classList.toggle("dirty", state.candidateDirty);
    }

    function setDetailActionsDisabled(disabled) {
      ["save", "accept", "reject", "accept-anyway", "supersede", "supersedes"].forEach((id) => {
        const control = el(id);
        if (control) control.disabled = disabled;
      });
    }

    async function runDetailAction(action) {
      if (state.detailActionInFlight) return;
      state.detailActionInFlight = true;
      setDetailActionsDisabled(true);
      try {
        await action();
      } finally {
        state.detailActionInFlight = false;
        setDetailActionsDisabled(false);
      }
    }

    function bindDetailActions(candidate) {
      document.querySelectorAll("[data-clean-deleted-candidates]").forEach((button) => {
        button.addEventListener("click", cleanupDeletedCandidates);
      });
      const save = el("save");
      if (!save) return;
      save.addEventListener("click", () => runDetailAction(async () => {
        try {
          const data = await api("/api/candidate/save", {
            method: "POST",
            body: JSON.stringify(candidatePayload(candidate.id))
          });
          state.candidateDirty = false;
          await syncAfterMutation(data.candidate.id);
          showStatus(t("status.candidateSaved"));
        } catch (error) {
          showStatus(error.message, true);
        }
      }));
      el("accept").addEventListener("click", () => acceptCandidate({}));
      el("accept-anyway").addEventListener("click", () => acceptCandidate({ acceptAnyway: true }));
      el("supersede").addEventListener("click", () => {
        const value = Number.parseInt(el("supersedes").value, 10);
        if (Number.isNaN(value)) return showStatus(t("status.supersedesRequired"), true);
        acceptCandidate({ supersedesId: value });
      });
      el("reject").addEventListener("click", () => runDetailAction(async () => {
        const reason = prompt(t("prompt.rejectReason"));
        if (reason === null) return;
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
      }));
    }

    function acceptCandidate(extra) {
      return runDetailAction(() => submitAcceptCandidate(extra));
    }

    async function submitAcceptCandidate(extra) {
      try {
        const payload = el("candidate-form")
          ? candidatePayload(state.candidateId, extra)
          : {
              projectRoot: state.projectRoot,
              sessionId: state.sessionId,
              candidateId: state.candidateId,
              ...extra
            };
        const data = await api("/api/candidate/accept", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        await syncAfterMutation(data.candidate.id);
        state.conflicts = [];
        state.candidateDirty = false;
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

    function candidatePayload(candidateId, extra = {}) {
      return reviewCandidateMutationPayload({
        projectRoot: state.projectRoot,
        sessionId: state.sessionId,
        candidateId,
        trap: reviewCandidateTrapDraft(candidateFormFields()),
        extra
      });
    }

    function candidateFormFields() {
      const form = new FormData(el("candidate-form"));
      return {
        title: form.get("title"),
        category: form.get("category"),
        scope: form.get("scope"),
        severity: form.get("severity"),
        tags: form.get("tags"),
        path_globs: form.get("path_globs"),
        module: form.get("module"),
        owner: form.get("owner"),
        context: form.get("context"),
        mistake: form.get("mistake"),
        fix: form.get("fix")
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
    el("sidebar-toggle").addEventListener("click", () => {
      setSidebarCollapsed(!state.sidebarCollapsed);
    });
    el("queue-toggle").addEventListener("click", () => {
      setQueueCollapsed(!state.queueCollapsed);
    });
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
        } else if (state.mainView === "embeddings") {
          await loadEmbeddings();
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
        state.embeddingStatus = null;
        state.embeddingSettings = null;
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

    function reviewLabel(candidate) {
      const review = candidate.review;
      if (!review || review.status === "pending") return t("review.pending");
      if (review.status === "accepted") return t("review.accepted", { id: review.trap_id });
      if (review.status === "accepted_missing") {
        return review.trap_id === undefined ? t("review.acceptedLinkMissing") : t("review.acceptedDeleted", { id: review.trap_id });
      }
      if (review.status === "rejected") return t("review.rejected");
      if (review.status === "approved") return t("review.approved");
      return valueLabel(candidate.status);
    }

    function reviewCssClass(candidate) {
      return String(candidate.review?.status || candidate.status).replace(/_/g, "-");
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }

    initShellResizers();
    refreshAll();`;
}
