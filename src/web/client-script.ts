import { WEB_TEXT_JSON } from "./client-text";
import { WEB_REVIEW_CLIENT_SCRIPT } from "./client-review";
import { WEB_SHELL_CLIENT_SCRIPT } from "./client-shell";

export function webClientScript(textJson = WEB_TEXT_JSON): string {
  return `    const qs = new URLSearchParams(location.search);
    const token = qs.get("token") || sessionStorage.getItem("codetrap-token") || "";
    if (token) sessionStorage.setItem("codetrap-token", token);
    if (qs.has("token")) {
      qs.delete("token");
      const cleanQuery = qs.toString();
      history.replaceState(null, "", location.pathname + (cleanQuery ? "?" + cleanQuery : "") + location.hash);
    }
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
      trapHealthFilter: "all",
      learningInsights: [],
      insightId: null,
      insightConsulting: false,
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
      sessionsSignature: "",
      candidatesSignature: "",
      externalRefreshInFlight: false,
      externalDeferredSignature: "",
      sidebarCollapsed: savedSidebarCollapsed,
      queueCollapsed: savedQueueCollapsed,
      options: { categories: [], severities: [], scopes: [], stale_after_days: 180 },
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

    function sessionStatusLabel(status) {
      const key = "session.status." + status;
      const label = t(key);
      return label === key ? valueLabel(status) : label;
    }

    function qualityWarningLabel(warning) {
      const keys = {
        "context does not clearly describe when the trap applies": "qualityWarning.clearTrigger",
        "mistake is not specific enough": "qualityWarning.specificMistake",
        "fix is not actionable enough": "qualityWarning.actionableFix",
        "future reuse is unclear": "qualityWarning.futureReuse",
        "scope is too loose for a project trap": "qualityWarning.projectScope",
        "candidate reads like a broad reminder rather than a durable trap": "qualityWarning.durableTrap",
        "candidate has no evidence": "qualityWarning.evidence"
      };
      return keys[warning] ? t(keys[warning]) : warning;
    }

    function isInsightCandidate(candidate) {
      return candidate?.candidate_kind === "insight";
    }

    function candidateKindLabel(candidate) {
      return valueLabel(candidate?.candidate_kind || "pitfall_trap");
    }

    function candidateTitle(candidate) {
      return String(candidate?.destination_payload?.title || candidate?.trap?.title || "");
    }

    function candidateSummary(candidate) {
      return isInsightCandidate(candidate) ? String(candidate.destination_payload?.summary || "") : "";
    }

    function formatDisplayDate(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat(state.locale === "zh" ? "zh-CN" : "en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    }

    function safeExternalHref(value) {
      try {
        const url = new URL(String(value));
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
      } catch {
        return null;
      }
    }

    function renderSourceReferences(sourceRefs) {
      const refs = Array.isArray(sourceRefs) ? sourceRefs : [];
      if (!refs.length) return '<span class="subtle">' + escapeHtml(t("value.noSource")) + '</span>';
      return refs.map((ref) => {
        const href = safeExternalHref(ref);
        return href
          ? \`<a class="source-link" href="\${escapeAttr(href)}" target="_blank" rel="noreferrer noopener">\${escapeHtml(ref)}</a>\`
          : \`<span class="source-ref">\${escapeHtml(ref)}</span>\`;
      }).join("");
    }

    function renderLearningMarkup(value) {
      const fence = String.fromCharCode(96).repeat(3);
      const lines = String(value || "").replace(/\\r\\n?/g, "\\n").split("\\n");
      const blocks = [];
      let prose = [];
      let code = [];
      let inCode = false;

      const flushProse = () => {
        if (!prose.length) return;
        const text = prose.join("\\n").replace(/^\\n+|\\n+$/g, "");
        if (text) blocks.push('<div class="learning-prose">' + escapeHtml(text) + '</div>');
        prose = [];
      };
      const flushCode = () => {
        blocks.push('<pre class="code-block learning-code"><code>' + escapeHtml(code.join("\\n")) + '</code></pre>');
        code = [];
      };

      for (const line of lines) {
        if (line.trimStart().startsWith(fence)) {
          if (inCode) flushCode(); else flushProse();
          inCode = !inCode;
          continue;
        }
        (inCode ? code : prose).push(line);
      }
      if (inCode) flushCode(); else flushProse();
      return blocks.join("");
    }

    function isCompactShell() {
      return window.matchMedia("(max-width: 1060px)").matches;
    }

    function renderCompactWorkspaceToggle() {
      const rail = el("workspace-rail");
      const button = el("compact-workspace-toggle");
      if (!rail || !button) return;
      const expanded = rail.classList.contains("compact-open");
      button.textContent = t(expanded ? "action.hideWorkspace" : "action.showWorkspace");
      button.setAttribute("aria-expanded", String(expanded));
    }

    function setCompactWorkspaceOpen(expanded) {
      const rail = el("workspace-rail");
      if (!rail) return;
      rail.classList.toggle("compact-open", expanded);
      renderCompactWorkspaceToggle();
    }

    function revealCompactDetail() {
      if (!isCompactShell()) return;
      setCompactWorkspaceOpen(false);
      requestAnimationFrame(() => document.querySelector(".detail")?.scrollIntoView({ block: "start" }));
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
      el("rename-session").textContent = t("action.renameSession");
      el("delete-session").textContent = t("action.deleteSession");
      document.querySelector("[data-main-view='review']").textContent = t("nav.review");
      document.querySelector("[data-main-view='library']").textContent = t("nav.library");
      document.querySelector("[data-main-view='learning']").textContent = t("nav.learning");
      document.querySelector("[data-main-view='embeddings']").textContent = t("nav.embeddings");
      document.querySelectorAll("[data-locale]").forEach((button) => {
        button.classList.toggle("active", button.dataset.locale === state.locale);
      });
      renderSidebarToggle();
      renderCompactWorkspaceToggle();
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
        const err = new Error(res.status === 401 ? t("error.sessionExpired") : (data?.error || res.statusText));
        err.status = res.status;
        err.payload = data;
        throw err;
      }
      return data;
    }

    /**
     * §4.3: after every durable write, show the receipt. "Users should never
     * have to wonder whether something was silently written; the product tells
     * them, every time." The receipt states the declared executor rather than
     * implying codetrap verified who acted.
     */
    function showReceipt(receipt, options = {}) {
      if (!receipt) return;
      const box = el("receipt");
      if (!box) return;
      const target = receipt.trap_id === null || receipt.trap_id === undefined
        ? receipt.destination
        : receipt.destination + " #" + receipt.trap_id + " (" + receipt.trap_scope + ")";
      box.innerHTML = \`<div class="receipt-line"><strong>\${escapeHtml(t("receipt.title"))}</strong></div>\`
        + \`<div class="receipt-line">\${escapeHtml(receipt.action)} → \${escapeHtml(target)}</div>\`
        + \`<div class="receipt-line">\${escapeHtml(t("receipt.executor", { executor: receipt.executor }))}</div>\`
        + \`<div class="receipt-line">\${escapeHtml(t("receipt.scope", { scope: receipt.authorized_scope }))}</div>\`
        + \`<div class="receipt-line subtle">\${escapeHtml(receipt.recorded_at)}</div>\`;
      box.className = "receipt show";
      if (options.undoSuppression) {
        const actions = document.createElement("div");
        actions.className = "receipt-actions";
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "ghost";
        undo.textContent = t("action.undoSuppression");
        undo.addEventListener("click", () => undoSuppression(options.undoSuppression));
        actions.append(undo);
        box.append(actions);
      }
    }

    function hideReceipt() {
      const box = el("receipt");
      if (box) box.className = "receipt";
    }

    async function undoSuppression(fingerprint) {
      try {
        const data = await api("/api/suppression/undo", {
          method: "POST",
          body: JSON.stringify({ projectRoot: state.projectRoot, fingerprint })
        });
        showReceipt(data.receipt);
        showStatus(t("status.suppressionUndone"));
      } catch (error) {
        showStatus(error.message, true);
      }
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

    function sessionsSignature(data) {
      return JSON.stringify({
        candidateReview: data.candidate_review || null,
        sessions: data.sessions || []
      });
    }

    function candidatesSignature(candidates) {
      return JSON.stringify(candidates || []);
    }

    async function loadSessions() {
      if (!state.projectRoot) {
        state.sessions = [];
        state.candidateReview = null;
        state.candidates = [];
        state.traps = [];
        state.learningInsights = [];
        state.insightId = null;
        state.embeddingStatus = null;
        state.embeddingSettings = null;
        state.sessionsSignature = "";
        state.candidatesSignature = "";
        renderSessions();
        renderActiveView();
        return;
      }
      const data = await api("/api/sessions?project=" + encodeURIComponent(state.projectRoot));
      state.sessions = data.sessions;
      state.candidateReview = data.candidate_review || null;
      state.sessionsSignature = sessionsSignature(data);
      state.sessionId = selectedReviewSessionId(state.sessions, state.sessionId);
      renderSessions();
      if (state.mainView === "library") {
        await loadTraps();
      } else if (state.mainView === "learning") {
        await loadLearningInsights();
      } else if (state.mainView === "embeddings") {
        await loadEmbeddings();
      } else {
        await loadCandidates();
      }
    }

    async function loadCandidates() {
      if (!state.projectRoot || !state.sessionId) {
        state.candidates = [];
        state.candidatesSignature = "[]";
        if (state.mainView === "review") {
          renderCandidates();
          renderDetail();
        }
        return;
      }
      const data = await api("/api/candidates?project=" + encodeURIComponent(state.projectRoot) + "&session=" + encodeURIComponent(state.sessionId));
      state.candidates = data.candidates;
      state.candidatesSignature = candidatesSignature(data.candidates);
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

    async function loadLearningInsights() {
      if (!state.projectRoot) {
        state.learningInsights = [];
        state.insightId = null;
        if (state.mainView === "learning") {
          renderLearningShelf();
          renderLearningDetail();
        }
        return;
      }
      const data = await api("/api/insights?project=" + encodeURIComponent(state.projectRoot));
      state.learningInsights = data.insights;
      if (!state.learningInsights.some((insight) => insight.id === state.insightId)) {
        state.insightId = state.learningInsights[0]?.id || null;
      }
      if (state.mainView === "learning") {
        renderLearningShelf();
        renderLearningDetail();
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
      } else if (state.mainView === "learning") {
        el("queue-title").textContent = t("title.learningInsights");
        el("detail-title").textContent = t("title.learningDetail");
        el("candidate-tabs").classList.add("hidden");
        hideReviewSummary();
        renderLearningShelf();
        renderLearningDetail();
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
          state.learningInsights = [];
          state.insightId = null;
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
              <span class="pill">\${escapeHtml(sessionStatusLabel(session.status))}</span>
              <span class="pill \${session.pending_count ? "warn" : ""}">\${escapeHtml(t("pill.pending", { count: session.pending_count || 0 }))}</span>
              <span class="pill">\${escapeHtml(t("pill.candidates", { count: session.candidate_count || 0 }))}</span>
              <span class="pill accepted">\${escapeHtml(t("pill.accepted", { count: session.accepted_count || 0 }))}</span>
            </span>
          </button>
        </div>
      \`).join("") : '<div class="empty">' + escapeHtml(t("empty.noSessions")) + '</div>';
      const selectedSession = state.sessions.find((session) => session.id === state.sessionId);
      const renameButton = el("rename-session");
      const deleteButton = el("delete-session");
      renameButton.textContent = t("action.renameSession");
      renameButton.classList.toggle("hidden", !selectedSession);
      renameButton.dataset.sessionId = selectedSession?.id || "";
      deleteButton.textContent = t("action.deleteSession");
      deleteButton.classList.toggle("hidden", !selectedSession);
      deleteButton.dataset.sessionId = selectedSession?.id || "";
      document.querySelectorAll("[data-session]").forEach((button) => {
        button.addEventListener("click", async () => {
          state.sessionId = button.dataset.session;
          state.candidateId = null;
          renderSessions();
          await loadCandidates();
          revealCompactDetail();
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

    async function renameSession(sessionId) {
      const session = state.sessions.find((item) => item.id === sessionId);
      if (!session) return;
      const goal = prompt(t("prompt.renameSession"), session.goal);
      if (goal === null || !goal.trim() || goal.trim() === session.goal) return;
      try {
        await api("/api/session/rename", {
          method: "POST",
          body: JSON.stringify({ projectRoot: state.projectRoot, sessionId, goal: goal.trim() })
        });
        await loadSessions();
        showStatus(t("status.sessionRenamed"));
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
            <span class="row-title">\${escapeHtml(candidateTitle(candidate))}</span>
            \${candidateSummary(candidate) ? '<span class="subtle">' + escapeHtml(candidateSummary(candidate)) + '</span>' : ''}
            <span class="meta">
              <span class="pill \${candidate.status} \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>
              <span class="pill scope">\${escapeHtml(candidateKindLabel(candidate))}</span>
              \${isInsightCandidate(candidate) ? "" : '<span class="pill">' + escapeHtml(t("pill.quality", { score: Number(candidate.quality_score).toFixed(2) })) + '</span>'}
              \${!isInsightCandidate(candidate) && candidate.quality.warnings.length ? '<span class="pill warn">' + escapeHtml(t("pill.warnings", { count: candidate.quality.warnings.length })) + '</span>' : ''}
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
          revealCompactDetail();
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
          state.trapHealthFilter = "all";
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
      insights.innerHTML = renderLibraryHealth(state.traps);
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
          revealCompactDetail();
        });
      });
      document.querySelectorAll("[data-trap-health]").forEach((button) => {
        button.addEventListener("click", () => {
          state.trapHealthFilter = button.dataset.trapHealth;
          state.trapKey = null;
          renderTrapResults();
          renderTrapDetail();
        });
      });
    }

    function renderLibraryHealth(traps) {
      const needsValidation = traps.filter(trapNeedsValidation).length;
      const neverUseful = traps.filter((trap) => Number(trap.useful_count || 0) === 0).length;
      return \`<div class="summary-grid health-grid">
        \${healthMetric("all", t("metric.visibleTraps"), traps.length, t("metric.healthAll"))}
        \${healthMetric("needs-validation", t("metric.needsValidation"), needsValidation, t("metric.validationWindow", { days: state.options.stale_after_days }))}
        \${healthMetric("never-useful", t("metric.neverUseful"), neverUseful, t("metric.neverUsefulDetail"))}
      </div>\`;
    }

    function healthMetric(filter, label, value, detail) {
      return \`<button type="button" class="metric health-metric \${state.trapHealthFilter === filter ? "active" : ""}" data-trap-health="\${escapeAttr(filter)}">
        <span class="metric-label">\${escapeHtml(label)}</span>
        <span class="metric-value">\${escapeHtml(value)}</span>
        <span class="subtle">\${escapeHtml(detail)}</span>
      </button>\`;
    }

    function trapNeedsValidation(trap) {
      if (!trap.last_validated) return true;
      const validatedAt = Date.parse(trap.last_validated);
      return !Number.isFinite(validatedAt) || Date.now() - validatedAt > Number(state.options.stale_after_days || 180) * 24 * 60 * 60 * 1000;
    }

    function renderLearningShelf() {
      if (state.mainView !== "learning") return;
      const insights = state.learningInsights;
      const consulted = insights.filter((insight) => Number(insight.consulted_count || 0) > 0).length;
      el("queue-title").textContent = t("title.learningInsights");
      el("candidate-tabs").classList.add("hidden");
      el("queue-meta").textContent = state.projectRoot
        ? t("meta.learningCounts", { count: insights.length, consulted })
        : t("meta.noProject");
      if (!state.projectRoot) {
        el("candidates").innerHTML = '<div class="empty">' + escapeHtml(t("meta.selectProject")) + '</div>';
        return;
      }
      el("candidates").innerHTML = insights.length ? insights.map((insight) => \`
        <button type="button" class="row \${insight.id === state.insightId ? "active" : ""}" data-learning-insight="\${escapeAttr(insight.id)}">
          <span class="row-title">\${escapeHtml(insight.title)}</span>
          <span class="subtle">\${escapeHtml(insight.summary)}</span>
          <span class="meta">
            \${(insight.tags || []).map((tag) => '<span class="pill">' + escapeHtml(tag) + '</span>').join("")}
            <span class="pill \${Number(insight.consulted_count || 0) > 0 ? "accepted" : ""}">\${escapeHtml(t(Number(insight.consulted_count || 0) > 0 ? "pill.learned" : "pill.notLearned"))}</span>
          </span>
          <span class="subtle">\${escapeHtml(formatDisplayDate(insight.shelved_at))}</span>
        </button>
      \`).join("") : '<div class="empty learning-empty"><strong>' + escapeHtml(t("empty.noLearningInsightsTitle")) + '</strong><span>' + escapeHtml(t("empty.noLearningInsights")) + '</span></div>';
      document.querySelectorAll("[data-learning-insight]").forEach((button) => {
        button.addEventListener("click", () => {
          state.insightId = button.dataset.learningInsight;
          renderLearningShelf();
          renderLearningDetail();
          revealCompactDetail();
        });
      });
    }

    function currentLearningInsight() {
      return state.learningInsights.find((insight) => insight.id === state.insightId) || null;
    }

    function renderLearningDetail() {
      if (state.mainView !== "learning") return;
      const insight = currentLearningInsight();
      el("detail-title").textContent = t("title.learningDetail");
      el("detail-meta").textContent = insight ? insight.title : (state.projectRoot ? t("meta.selectInsight") : t("meta.selectProject"));
      if (!state.projectRoot) {
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("meta.selectProject")) + '</div>';
        return;
      }
      if (!insight) {
        el("detail").innerHTML = '<div class="empty learning-empty"><strong>' + escapeHtml(t("empty.noLearningInsightsTitle")) + '</strong><span>' + escapeHtml(t("empty.noLearningInsights")) + '</span><div class="learning-prompt-card"><span>' + escapeHtml(t("label.learningGenerationPrompt")) + '</span><code>' + escapeHtml(t("prompt.learningGeneration")) + '</code></div></div>';
        return;
      }
      const learned = Number(insight.consulted_count || 0) > 0;
      el("detail").innerHTML = \`
        <div class="scroll">
          <div class="section learning-intro">
            <div class="title learning-title">\${escapeHtml(insight.title)}</div>
            <div class="learning-summary">\${escapeHtml(insight.summary)}</div>
            <div class="meta">\${(insight.tags || []).map((tag) => '<span class="pill">' + escapeHtml(tag) + '</span>').join("")}</div>
          </div>
          <div class="section">
            <div class="title">\${escapeHtml(t("label.body"))}</div>
            <div class="learning-body">\${renderLearningMarkup(insight.body)}</div>
          </div>
          <div class="section">
            <div class="title">\${escapeHtml(t("label.sourceRefs"))}</div>
            <div class="source-list">\${renderSourceReferences(insight.source_refs)}</div>
          </div>
          <div class="section">
            <div class="detail-kv">
              \${kv(t("label.shelvedAt"), formatDisplayDate(insight.shelved_at))}
              \${kv(t("label.learningStatus"), t(learned ? "value.learned" : "value.notLearned"))}
              \${kv(t("label.lastConsultedAt"), learned ? formatDisplayDate(insight.last_consulted_at) : t("value.never"))}
            </div>
          </div>
        </div>
        <div class="actions">
          <button type="button" id="consult-insight" class="primary" \${state.insightConsulting || learned ? "disabled" : ""}>\${escapeHtml(t(learned ? "action.learned" : "action.markLearned"))}</button>
          <span class="action-hint">\${escapeHtml(t(learned ? "hint.learnedRecorded" : "hint.markLearnedExplicit"))}</span>
        </div>
      \`;
      if (!learned) el("consult-insight").addEventListener("click", consultLearningInsight);
    }

    async function consultLearningInsight() {
      const insight = currentLearningInsight();
      if (!insight || state.insightConsulting || Number(insight.consulted_count || 0) > 0) return;
      state.insightConsulting = true;
      renderLearningDetail();
      try {
        const data = await api("/api/insight/consult", {
          method: "POST",
          body: JSON.stringify({ projectRoot: state.projectRoot, id: insight.id })
        });
        state.learningInsights = state.learningInsights.map((item) => item.id === data.insight.id ? data.insight : item);
        renderLearningShelf();
        showStatus(t("status.insightConsulted"));
      } catch (error) {
        showStatus(error.message, true);
      } finally {
        state.insightConsulting = false;
        renderLearningDetail();
      }
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

    function visibleTraps() {
      const query = state.trapSearch.trim().toLowerCase();
      let traps = query ? state.traps.filter((trap) => trapSearchText(trap).includes(query)) : state.traps;
      if (state.trapHealthFilter === "needs-validation") traps = traps.filter(trapNeedsValidation);
      if (state.trapHealthFilter === "never-useful") traps = traps.filter((trap) => Number(trap.useful_count || 0) === 0);
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
        revealCompactDetail();
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
      // A receipt describes one action on one candidate; leaving it pinned
      // while the user navigates makes it describe something else.
      hideReceipt();
      if (state.mainView !== "review") return;
      const candidate = state.candidates.find((item) => item.id === state.candidateId);
      el("detail-meta").textContent = candidate ? candidate.id + " / " + valueLabel(candidate.status) : t("meta.selectCandidate");
      if (!candidate) {
        state.candidateDirty = false;
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("empty.noCandidateSelected")) + '</div>';
        return;
      }
      if (isInsightCandidate(candidate)) {
        renderInsightCandidateDetail(candidate);
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
            \${candidate.quality.warnings.map((warning) => '<div class="warning">' + escapeHtml(qualityWarningLabel(warning)) + '</div>').join("")}
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

    function renderInsightCandidateDetail(candidate) {
      state.candidateDirty = false;
      const payload = candidate.destination_payload || {};
      const disabled = candidate.status !== "proposed" ? "disabled" : "";
      const committed = candidate.delivery_state === "committed";
      el("detail").innerHTML = \`
        <div class="scroll insight-candidate-detail">
          <div class="section insight-review-header">
            <div class="meta">
              <span class="pill scope">\${escapeHtml(t("value.insight"))}</span>
              <span class="pill \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>
            </div>
            <div class="title learning-title">\${escapeHtml(String(payload.title || candidate.trap.title || ""))}</div>
            <div class="learning-summary">\${escapeHtml(String(payload.summary || ""))}</div>
            \${candidate.rationale ? '<div class="insight-rationale">' + escapeHtml(candidate.rationale) + '</div>' : ''}
          </div>
          \${committed ? \`
            <div class="section">
              <div class="title">\${escapeHtml(t("label.body"))}</div>
              <div class="learning-body">\${renderLearningMarkup(payload.body)}</div>
            </div>
            <div class="section">
              <div class="title">\${escapeHtml(t("label.sourceRefs"))}</div>
              <div class="source-list">\${renderSourceReferences(payload.source_refs)}</div>
            </div>
          \` : \`
            <form class="section" id="candidate-form">
              <div class="form-grid insight-form-grid">
                \${field("insight_title", t("label.title"), payload.title || candidate.trap.title, disabled)}
                \${field("insight_tags", t("label.tags"), (payload.tags || []).join(", "), disabled)}
                \${textarea("insight_summary", t("label.summary"), payload.summary || "", disabled)}
                \${textarea("insight_body", t("label.body"), payload.body || "", disabled, "learning-editor")}
                \${textarea("insight_source_refs", t("label.sourceRefs"), (payload.source_refs || []).join("\\n"), disabled)}
              </div>
            </form>
          \`}
          <div class="section">
            <div class="title">\${escapeHtml(t("title.evidence"))}</div>
            \${candidate.evidence.length ? candidate.evidence.map(renderEvidence).join("") : '<div class="empty">' + escapeHtml(t("empty.noEvidence")) + '</div>'}
          </div>
        </div>
        \${renderDetailActions(candidate, disabled)}
      \`;
      bindDetailActions(candidate);
      bindCandidateFormDirty(candidate);
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
      if (isInsightCandidate(candidate)) {
        if (candidate.status !== "proposed") {
          const rollback = candidate.delivery_state === "committed"
            ? \`<button id="rollback" class="danger">\${escapeHtml(t("action.removeFromLearning"))}</button>\`
            : "";
          return \`<div class="actions"><span class="pill \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>\${rollback}</div>\`;
        }
        const approved = candidate.review?.status === "approved";
        return \`<div class="actions insight-actions">
          <button id="save" \${disabled}>\${escapeHtml(t("action.saveDraft"))}</button>
          <button id="approve" \${disabled}>\${escapeHtml(t(approved ? "action.reapprove" : "action.approveForAgent"))}</button>
          <button id="apply-insight" class="primary" \${disabled}>\${escapeHtml(t(approved ? "action.addToLearning" : "action.approveAndAddLearning"))}</button>
          <button id="reject" class="danger" \${disabled}>\${escapeHtml(t("action.reject"))}</button>
          <span id="candidate-draft-state" class="action-hint">\${escapeHtml(t("hint.insightReviewActions"))}</span>
        </div>\`;
      }
      if (candidate.status !== "proposed") {
        const review = candidate.review;
        const viewTrap = review?.status === "accepted"
          ? \`<button type="button" data-view-trap-scope="\${escapeAttr(review.scope)}" data-view-trap-id="\${escapeAttr(review.trap_id)}">\${escapeHtml(t("action.viewTrap"))}</button>\`
          : "";
        const cleanDeleted = review?.status === "accepted_missing"
          ? \`<button type="button" data-clean-deleted-candidates>\${escapeHtml(t("action.cleanDeletedCandidates"))}</button>\`
          : "";
        // A committed lesson needs a visible way back (§3.2: every durable
        // write has a rollback path).
        const rollback = review?.status === "accepted"
          ? \`<button id="rollback" class="danger">\${escapeHtml(t("action.rollback"))}</button>\`
          : "";
        return \`<div class="actions"><span class="pill \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>\${viewTrap}\${cleanDeleted}\${rollback}</div>\`;
      }
      const approved = candidate.review?.status === "approved";
      return \`<div class="actions">
        <button id="save" class="primary" \${disabled}>\${escapeHtml(t("action.save"))}</button>
        <button id="approve" \${disabled}>\${escapeHtml(t(approved ? "action.reapprove" : "action.approve"))}</button>
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
      ["save", "approve", "apply-insight", "accept", "reject", "accept-anyway", "supersede", "supersedes", "rollback"].forEach((id) => {
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

    function openRejectDialog(candidate) {
      const dialog = el("reject-dialog");
      dialog.dataset.candidateId = candidate.id;
      dialog.dataset.sessionId = state.sessionId || "";
      el("reject-dialog-title").textContent = t("dialog.rejectTitle");
      el("reject-dialog-candidate").textContent = t("dialog.rejectCandidate", { title: candidateTitle(candidate) });
      el("reject-dialog-scope").textContent = t("dialog.rejectScope");
      el("reject-dialog-undo").textContent = t("dialog.rejectUndo");
      el("reject-reason-label").textContent = t("label.rejectReason");
      el("reject-cancel").textContent = t("action.cancel");
      el("reject-confirm").textContent = t("action.confirmReject");
      el("reject-reason").value = "";
      dialog.showModal();
      requestAnimationFrame(() => el("reject-reason").focus());
    }

    function bindDetailActions(candidate) {
      document.querySelectorAll("[data-clean-deleted-candidates]").forEach((button) => {
        button.addEventListener("click", cleanupDeletedCandidates);
      });
      // Bound before the save-button guard: rollback renders on reviewed
      // candidates, which have no save button, so binding it after the early
      // return meant the control existed and did nothing.
      const rollbackButton = el("rollback");
      if (rollbackButton) {
        rollbackButton.addEventListener("click", () => runDetailAction(async () => {
          if (!confirm(t(isInsightCandidate(candidate) ? "confirm.removeFromLearning" : "confirm.rollback"))) return;
          try {
            const data = await api("/api/candidate/rollback", {
              method: "POST",
              body: JSON.stringify({
                projectRoot: state.projectRoot,
                sessionId: state.sessionId,
                candidateId: candidate.id
              })
            });
            await syncAfterMutation(data.candidate.id);
            showReceipt(data.receipt);
            showStatus(t(isInsightCandidate(candidate) ? "status.insightRemoved" : "status.candidateRolledBack"));
          } catch (error) {
            showStatus(error.message, true);
          }
        }));
      }

      const save = el("save");
      if (save) {
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
      }
      const approveButton = el("approve");
      if (approveButton) {
        approveButton.addEventListener("click", () => runDetailAction(async () => {
          try {
            // Send the current draft, exactly as Save and Accept do. Posting
            // only the id would authorize the *stored* revision while the
            // user's unsaved edit sat on screen, and the re-render would then
            // discard that edit silently.
            const data = await api("/api/candidate/approve", {
              method: "POST",
              body: JSON.stringify(candidatePayload(candidate.id))
            });
            await syncAfterMutation(data.candidate.id);
            showReceipt(data.receipt);
            showStatus(t("status.candidateApproved"));
          } catch (error) {
            showStatus(error.message, true);
          }
        }));
      }

      const applyInsightButton = el("apply-insight");
      if (applyInsightButton) {
        applyInsightButton.addEventListener("click", () => runDetailAction(async () => {
          try {
            const data = await api("/api/candidate/apply-insight", {
              method: "POST",
              body: JSON.stringify(candidatePayload(candidate.id))
            });
            state.candidateDirty = false;
            await syncAfterMutation(data.candidate.id);
            showReceipt(data.receipt);
            showStatus(t("status.insightAdded"));
          } catch (error) {
            showStatus(error.message, true);
          }
        }));
      }

      const accept = el("accept");
      if (accept) accept.addEventListener("click", () => acceptCandidate({}));
      const acceptAnyway = el("accept-anyway");
      if (acceptAnyway) acceptAnyway.addEventListener("click", () => acceptCandidate({ acceptAnyway: true }));
      const supersede = el("supersede");
      if (supersede) supersede.addEventListener("click", () => {
        const value = Number.parseInt(el("supersedes").value, 10);
        if (Number.isNaN(value)) return showStatus(t("status.supersedesRequired"), true);
        acceptCandidate({ supersedesId: value });
      });
      const reject = el("reject");
      if (reject) reject.addEventListener("click", () => openRejectDialog(candidate));
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
        showReceipt(data.receipt);
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
      const candidate = state.candidates.find((item) => item.id === candidateId);
      if (isInsightCandidate(candidate)) {
        return {
          projectRoot: state.projectRoot,
          sessionId: state.sessionId,
          candidateId,
          destinationPayload: insightCandidateFormPayload(candidate),
          ...extra
        };
      }
      return reviewCandidateMutationPayload({
        projectRoot: state.projectRoot,
        sessionId: state.sessionId,
        candidateId,
        trap: reviewCandidateTrapDraft(candidateFormFields()),
        extra
      });
    }

    function insightCandidateFormPayload(candidate) {
      const formElement = el("candidate-form");
      if (!formElement) return candidate?.destination_payload || {};
      const form = new FormData(formElement);
      return {
        title: String(form.get("insight_title") || "").trim(),
        summary: String(form.get("insight_summary") || "").trim(),
        body: String(form.get("insight_body") || "").trim(),
        tags: splitReviewInput(form.get("insight_tags")),
        source_refs: splitReviewInput(form.get("insight_source_refs"))
      };
    }

    function splitReviewInput(value) {
      return [...new Set(String(value || "").split(/[,\\n]/).map((item) => item.trim()).filter(Boolean))];
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

    async function refreshExternalChanges() {
      if (!state.projectRoot || document.visibilityState !== "visible" || state.externalRefreshInFlight || state.detailActionInFlight) return;
      state.externalRefreshInFlight = true;
      try {
        const sessionData = await api("/api/sessions?project=" + encodeURIComponent(state.projectRoot));
        const nextSessionsSignature = sessionsSignature(sessionData);
        const nextSessionId = selectedReviewSessionId(sessionData.sessions, state.sessionId);
        let candidateData = null;
        let nextCandidatesSignature = "[]";
        if (state.mainView === "review" && nextSessionId) {
          candidateData = await api("/api/candidates?project=" + encodeURIComponent(state.projectRoot) + "&session=" + encodeURIComponent(nextSessionId));
          nextCandidatesSignature = candidatesSignature(candidateData.candidates);
        }

        const combinedSignature = nextSessionsSignature + "\\n" + nextSessionId + "\\n" + nextCandidatesSignature;
        const changed = nextSessionsSignature !== state.sessionsSignature
          || nextSessionId !== state.sessionId
          || (state.mainView === "review" && nextCandidatesSignature !== state.candidatesSignature);
        if (!changed) {
          state.externalDeferredSignature = "";
          return;
        }
        if (state.candidateDirty) {
          if (state.externalDeferredSignature !== combinedSignature) {
            state.externalDeferredSignature = combinedSignature;
            showStatus(t("status.externalChangesDeferred"));
          }
          return;
        }

        state.sessions = sessionData.sessions;
        state.candidateReview = sessionData.candidate_review || null;
        state.sessionId = nextSessionId;
        state.sessionsSignature = nextSessionsSignature;
        if (state.mainView === "review") {
          state.candidates = candidateData?.candidates || [];
          state.candidatesSignature = nextCandidatesSignature;
          state.candidateId = reviewQueueModel({
            candidates: state.candidates,
            candidateView: state.candidateView,
            candidateId: state.candidateId,
            candidateReview: state.candidateReview
          }).selectedCandidateId;
        }
        state.externalDeferredSignature = "";
        renderSessions();
        if (state.mainView === "review") {
          renderCandidates();
          renderDetail();
        }
        showStatus(t("status.externalChanges"));
      } catch {
        // Background freshness is best-effort; explicit Refresh still reports errors.
      } finally {
        state.externalRefreshInFlight = false;
      }
    }

    async function refreshAll() {
      if (state.candidateDirty) {
        showStatus(t("status.refreshDeferred"));
        return;
      }
      try {
        await bootstrap();
        showStatus(t("status.refreshed"));
      } catch (error) {
        showStatus(error.message, true);
      }
    }

    el("refresh").addEventListener("click", refreshAll);
    el("reject-cancel").addEventListener("click", () => el("reject-dialog").close());
    el("reject-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const dialog = el("reject-dialog");
      const candidateId = dialog.dataset.candidateId;
      const sessionId = dialog.dataset.sessionId;
      const reason = el("reject-reason").value.trim();
      dialog.close();
      runDetailAction(async () => {
        try {
          const data = await api("/api/candidate/reject", {
            method: "POST",
            body: JSON.stringify({ projectRoot: state.projectRoot, sessionId, candidateId, reason })
          });
          await syncAfterMutation(data.candidate.id);
          showReceipt(data.receipt, { undoSuppression: data.suppression.fingerprint });
          showStatus(t("status.candidateRejected"));
        } catch (error) {
          showStatus(error.message, true);
        }
      });
    });
    el("compact-workspace-toggle").addEventListener("click", () => {
      setCompactWorkspaceOpen(!el("workspace-rail").classList.contains("compact-open"));
    });
    el("delete-session").addEventListener("click", async () => {
      await deleteSession(el("delete-session").dataset.sessionId);
    });
    el("rename-session").addEventListener("click", async () => {
      await renameSession(el("rename-session").dataset.sessionId);
    });
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
        revealCompactDetail();
        if (state.mainView === "library") {
          await loadTraps();
        } else if (state.mainView === "learning") {
          await loadLearningInsights();
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
        state.learningInsights = [];
        state.insightId = null;
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

    function textarea(name, label, value, disabled, className = "") {
      return \`<div class="field full"><label for="\${name}">\${label}</label><textarea id="\${name}" name="\${name}" class="\${escapeAttr(className)}" \${disabled}>\${escapeHtml(value || "")}</textarea></div>\`;
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
      if (review.status === "destination_committed") return t("review.destinationCommitted", { destination: valueLabel(review.destination) });
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
    setInterval(refreshExternalChanges, 5000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshExternalChanges();
    });
    refreshAll();`;
}
