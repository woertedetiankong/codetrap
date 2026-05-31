export const WEB_INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>codetrap review console</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f6f2;
      --panel: #f8faf7;
      --panel-2: #fcfdfb;
      --surface: #ffffff;
      --surface-hover: #edf3ef;
      --line: #d6dfd9;
      --line-soft: #e5ebe6;
      --text: #20231f;
      --muted: #657069;
      --faint: #8b968e;
      --accent: #0f766e;
      --accent-soft: #d9f1eb;
      --accent-strong: #064e46;
      --ink: #1f2937;
      --violet: #4f46e5;
      --violet-soft: #e6e8ff;
      --danger: #b42318;
      --warn: #9a6700;
      --ok: #18794e;
      --shadow: rgba(28, 39, 32, 0.08);
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background:
        linear-gradient(120deg, rgba(15, 118, 110, 0.08), transparent 34%),
        linear-gradient(180deg, #fbfcf8 0%, var(--bg) 48%, #eef3ef 100%);
      color: var(--text);
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      letter-spacing: 0;
      -webkit-font-smoothing: antialiased;
    }

    button, input, select, textarea {
      font: inherit;
      letter-spacing: 0;
    }

    button {
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--text);
      min-height: 32px;
      padding: 0 12px;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 1px 2px var(--shadow);
    }

    button:hover { background: var(--surface-hover); border-color: #c9c1b4; }
    button.primary { background: var(--ink); color: #fffdf8; border-color: var(--ink); }
    button.danger { border-color: color-mix(in srgb, var(--danger), var(--line) 35%); color: var(--danger); }
    button.ghost { background: transparent; }
    button:disabled { color: var(--faint); border-color: var(--line); cursor: not-allowed; opacity: 0.62; }

    .segmented {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.58);
      box-shadow: 0 1px 2px var(--shadow);
    }

    .segmented button {
      min-height: 26px;
      padding: 0 9px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      box-shadow: none;
      font-size: 12px;
    }

    .segmented button.active {
      background: var(--text);
      color: #fffdf8;
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      background: #fffdf8;
      color: var(--text);
      border-radius: 8px;
      padding: 8px 9px;
      outline: none;
    }

    textarea {
      min-height: 104px;
      resize: vertical;
      line-height: 1.45;
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
    }

    .shell {
      height: 100%;
      display: grid;
      grid-template-columns: minmax(250px, 0.82fr) minmax(320px, 1fr) minmax(460px, 1.48fr);
      gap: 0;
      overflow: hidden;
    }

    .rail, .queue, .detail {
      min-height: 0;
      border-right: 1px solid var(--line-soft);
      background: color-mix(in srgb, var(--panel), transparent 8%);
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(12px);
    }

    .detail { border-right: 0; background: var(--panel-2); }

    .bar {
      min-height: 56px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line-soft);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .rail-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }

    .title {
      font-weight: 650;
      text-transform: none;
      font-size: 13px;
      color: var(--text);
    }

    .subtle { color: var(--muted); font-size: 12px; min-width: 0; overflow-wrap: anywhere; }
    .scroll { overflow: auto; min-height: 0; }
    .stack { display: grid; gap: 10px; padding: 12px; }

    .project-form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--line-soft);
    }

    .row {
      width: 100%;
      text-align: left;
      display: grid;
      gap: 5px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.72);
      overflow: hidden;
      box-shadow: 0 1px 2px var(--shadow);
    }

    .row:hover { background: #fffdf8; border-color: #cfc7ba; }
    .row.active { border-color: color-mix(in srgb, var(--accent), var(--line) 28%); background: #ffffff; box-shadow: inset 3px 0 0 var(--accent), 0 8px 28px var(--shadow); }
    .row.accepted { border-color: color-mix(in srgb, var(--ok), var(--line) 55%); }
    .row.accepted-missing { border-color: color-mix(in srgb, var(--warn), var(--line) 40%); }
    .row.rejected { border-color: color-mix(in srgb, var(--danger), var(--line) 55%); opacity: 0.72; }
    .row-main {
      width: 100%;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      text-align: left;
      display: grid;
      gap: 5px;
      color: inherit;
    }
    .row-main:hover { background: transparent; border-color: transparent; }
    .row-action {
      justify-self: start;
      min-height: 28px;
      font-size: 12px;
      box-shadow: none;
    }
    .row-title { overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .pill.proposed { color: var(--accent-strong); background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent), var(--line) 55%); }
    .pill.accepted { color: var(--ok); border-color: color-mix(in srgb, var(--ok), var(--line) 55%); }
    .pill.accepted-missing { color: var(--warn); border-color: color-mix(in srgb, var(--warn), var(--line) 55%); }
    .pill.rejected { color: var(--danger); border-color: color-mix(in srgb, var(--danger), var(--line) 55%); }
    .pill.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn), var(--line) 55%); }
    .pill.scope { color: var(--violet); background: var(--violet-soft); border-color: color-mix(in srgb, var(--violet), var(--line) 55%); }
    .pill.critical { color: var(--danger); border-color: color-mix(in srgb, var(--danger), var(--line) 42%); }
    .pill.error { color: var(--warn); border-color: color-mix(in srgb, var(--warn), var(--line) 42%); }

    .detail-body {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: 0;
      height: 100%;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .field { display: grid; gap: 5px; }
    .field.full { grid-column: 1 / -1; }
    label { color: var(--muted); font-size: 11px; text-transform: uppercase; }

    .library-tools {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-bottom: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.54);
    }

    .filter-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .filter-grid .wide { grid-column: 1 / -1; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--line-soft);
    }

    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.72);
      min-height: 74px;
      display: grid;
      align-content: space-between;
      gap: 6px;
    }

    .metric-value {
      font-size: 21px;
      line-height: 1;
      font-weight: 720;
      color: var(--text);
      overflow-wrap: anywhere;
    }

    .metric-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
    }

    .insight-grid {
      display: grid;
      gap: 10px;
      padding: 12px;
    }

    .insight-block {
      border-top: 1px solid var(--line-soft);
      padding-top: 10px;
      display: grid;
      gap: 8px;
    }

    .rank-list {
      display: grid;
      gap: 7px;
    }

    .rank-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      font-size: 13px;
    }

    .rank-label { overflow-wrap: anywhere; }
    .rank-count { color: var(--muted); font-size: 12px; }

    .bar-track {
      grid-column: 1 / -1;
      height: 5px;
      border-radius: 999px;
      background: var(--line-soft);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }

    .trap-rows {
      display: grid;
      gap: 10px;
      padding: 12px;
    }

    .text-block {
      display: grid;
      gap: 6px;
    }

    .text-block .content {
      white-space: pre-wrap;
      line-height: 1.48;
      overflow-wrap: anywhere;
    }

    .code-block {
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #17201d;
      color: #eef6f0;
      overflow: auto;
      line-height: 1.45;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 12px;
    }

    .detail-kv {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .kv {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px;
      background: rgba(255, 255, 255, 0.62);
      overflow-wrap: anywhere;
    }

    .kv-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .kv-value { font-size: 13px; }

    .hidden { display: none !important; }

    .section {
      border-top: 1px solid var(--line-soft);
      padding: 12px;
      display: grid;
      gap: 10px;
    }

    .evidence, .warning, .conflict {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.68);
      overflow-wrap: anywhere;
    }

    .warning { border-color: color-mix(in srgb, var(--warn), var(--line) 50%); color: var(--warn); }
    .conflict { border-color: color-mix(in srgb, var(--danger), var(--line) 45%); }
    .review-note { border-color: color-mix(in srgb, var(--accent), var(--line) 55%); }
    .actions {
      padding: 12px;
      border-top: 1px solid var(--line-soft);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      background: rgba(255, 255, 255, 0.018);
    }

    .empty {
      padding: 28px 18px;
      color: var(--muted);
      text-align: center;
    }

    .status {
      position: fixed;
      right: 14px;
      bottom: 14px;
      max-width: 520px;
      border: 1px solid var(--line);
      background: #fffdf8;
      color: var(--text);
      border-radius: 8px;
      padding: 10px 12px;
      box-shadow: 0 12px 40px var(--shadow);
      display: none;
      z-index: 20;
    }

    .status.show { display: block; }
    .status.error { border-color: var(--danger); color: var(--danger); }

    @media (max-width: 1060px) {
      .shell { grid-template-columns: 1fr; overflow: auto; }
      .rail { min-height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
      .queue, .detail { min-height: 520px; border-right: 0; border-bottom: 1px solid var(--line); }
    }

    @media (max-width: 520px) {
      .bar { align-items: flex-start; flex-direction: column; }
      .rail-actions { justify-content: flex-start; }
      .filter-grid, .summary-grid, .detail-kv { grid-template-columns: 1fr; }
      .project-form { grid-template-columns: 1fr auto; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <aside class="rail">
      <div class="bar">
        <div>
          <div class="title">codetrap</div>
          <div class="subtle">review console</div>
        </div>
        <div class="rail-actions">
          <div class="segmented" aria-label="Main view">
            <button type="button" class="active" data-main-view="review">Review</button>
            <button type="button" data-main-view="library">Library</button>
            <button type="button" data-main-view="insights">Insights</button>
          </div>
          <button class="ghost" id="refresh" title="Refresh">Refresh</button>
        </div>
      </div>
      <form class="project-form" id="project-form">
        <input id="project-path" placeholder="/path/to/project">
        <button type="submit">Add</button>
      </form>
      <div class="scroll">
        <div class="stack" id="projects"></div>
        <div class="section">
          <div class="title">sessions</div>
          <div id="sessions" class="stack" style="padding:0"></div>
        </div>
      </div>
    </aside>

    <section class="queue">
      <div class="bar">
        <div>
          <div class="title" id="queue-title">candidate inbox</div>
          <div class="subtle" id="queue-meta">no project selected</div>
        </div>
        <div class="segmented" id="candidate-tabs" aria-label="Candidate view">
          <button type="button" class="active" data-candidate-view="inbox">Inbox</button>
          <button type="button" data-candidate-view="reviewed">Reviewed</button>
        </div>
      </div>
      <div class="scroll">
        <div class="stack" id="candidates"></div>
      </div>
    </section>

    <section class="detail">
      <div class="bar">
        <div>
          <div class="title" id="detail-title">candidate detail</div>
          <div class="subtle" id="detail-meta">select a candidate</div>
        </div>
      </div>
      <div class="detail-body" id="detail"></div>
    </section>
  </main>
  <div class="status" id="status"></div>

  <script>
    const qs = new URLSearchParams(location.search);
    const token = qs.get("token") || sessionStorage.getItem("codetrap-token") || "";
    if (token) sessionStorage.setItem("codetrap-token", token);

    const state = {
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
        el("queue-title").textContent = "trap library";
        el("detail-title").textContent = "trap detail";
        el("candidate-tabs").classList.add("hidden");
        renderLibrary();
        renderTrapDetail();
      } else if (state.mainView === "insights") {
        el("queue-title").textContent = "growth insights";
        el("detail-title").textContent = "insight detail";
        el("candidate-tabs").classList.add("hidden");
        renderInsightsView();
        renderInsightDetail();
      } else {
        el("queue-title").textContent = "candidate inbox";
        el("detail-title").textContent = "candidate detail";
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
      \`).join("") : '<div class="empty">No projects</div>';
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
        <button class="row \${session.id === state.sessionId ? "active" : ""}" data-session="\${escapeAttr(session.id)}">
          <span class="row-title">\${escapeHtml(session.goal)}</span>
          <span class="meta">
            <span class="pill">\${escapeHtml(session.status)}</span>
            <span class="pill">\${session.candidate_count || 0} candidates</span>
            <span class="pill accepted">\${session.accepted_count || 0} accepted</span>
          </span>
        </button>
      \`).join("") : '<div class="empty">No sessions</div>';
      document.querySelectorAll("[data-session]").forEach((button) => {
        button.addEventListener("click", async () => {
          state.sessionId = button.dataset.session;
          state.candidateId = null;
          renderSessions();
          await loadCandidates();
        });
      });
    }

    function renderCandidates() {
      if (state.mainView !== "review") return;
      const pendingCount = state.candidates.filter((candidate) => candidate.status === "proposed").length;
      const reviewedCount = state.candidates.length - pendingCount;
      const sorted = sortedVisibleCandidates();
      selectVisibleCandidate(sorted);
      const session = state.sessions.find((item) => item.id === state.sessionId);
      el("queue-meta").textContent = session ? session.goal + " / " + pendingCount + " pending, " + reviewedCount + " reviewed" : "no session selected";
      renderCandidateViewTabs(pendingCount, reviewedCount);
      el("candidates").innerHTML = sorted.length ? sorted.map((candidate) => \`
        <div class="row \${candidate.id === state.candidateId ? "active" : ""} \${candidate.status} \${reviewCssClass(candidate)}">
          <button type="button" class="row-main" data-candidate="\${escapeAttr(candidate.id)}">
            <span class="row-title">\${escapeHtml(candidate.trap.title)}</span>
            <span class="meta">
              <span class="pill \${candidate.status} \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>
              <span class="pill">q \${Number(candidate.quality_score).toFixed(2)}</span>
              \${candidate.quality.warnings.length ? '<span class="pill warn">' + candidate.quality.warnings.length + ' warnings</span>' : ''}
            </span>
          </button>
          \${renderCandidateRowAction(candidate)}
        </div>
      \`).join("") : '<div class="empty">' + (state.candidateView === "inbox" ? "No pending candidates" : "No reviewed candidates") + '</div>';
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
      return \`<button type="button" class="row-action" data-view-trap-scope="\${escapeAttr(review.scope)}" data-view-trap-id="\${escapeAttr(review.trap_id)}">View trap</button>\`;
    }

    function renderLibrary() {
      if (state.mainView !== "library") return;
      el("queue-title").textContent = "trap library";
      el("candidate-tabs").classList.add("hidden");
      el("candidates").innerHTML = \`
        <div class="library-tools">
          <input id="trap-search" placeholder="Search title, context, mistake, fix, tags" value="\${escapeAttr(state.trapSearch)}">
          <div class="filter-grid">
            \${filterSelect("trap-filter-scope", "Scope", state.trapFilters.scope, [["", "project + global"], ...state.options.scopes.map((scope) => [scope, scope])])}
            \${filterSelect("trap-filter-status", "Status", state.trapFilters.status, [["", "active"], ["all", "all"], ["archived", "archived"], ["superseded", "superseded"]])}
            \${filterSelect("trap-filter-category", "Category", state.trapFilters.category, [["", "all categories"], ...state.options.categories.map((category) => [category, category])])}
            \${filterSelect("trap-sort", "Sort", state.trapSort, [["updated", "recently updated"], ["severity", "severity"], ["hits", "hit count"], ["category", "category"], ["title", "title"]])}
            <div class="field"><label for="trap-filter-module">Module</label><input id="trap-filter-module" value="\${escapeAttr(state.trapFilters.module)}" placeholder="any module"></div>
            <div class="field"><label for="trap-filter-owner">Owner</label><input id="trap-filter-owner" value="\${escapeAttr(state.trapFilters.owner)}" placeholder="any owner"></div>
            <button type="button" id="trap-filter-clear" class="ghost">Clear filters</button>
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
        ? visible.length + " shown / " + state.traps.length + " loaded / " + sortLabel(state.trapSort)
        : "no project selected";
      insights.innerHTML = renderInsights(visible);
      rows.innerHTML = visible.length ? visible.map((trap) => \`
        <button class="row \${trapKey(trap) === state.trapKey ? "active" : ""}" data-trap-key="\${escapeAttr(trapKey(trap))}">
          <span class="row-title">\${escapeHtml(trap.title)}</span>
          <span class="meta">
            <span class="pill \${escapeAttr(trap.severity)}">\${escapeHtml(trap.severity)}</span>
            <span class="pill">\${escapeHtml(trap.category)}</span>
            <span class="pill scope">\${escapeHtml(trap.scope)}</span>
            <span class="pill \${escapeAttr(trap.status)}">\${escapeHtml(trap.status)}</span>
            <span class="pill">\${Number(trap.hit_count || 0)} hits</span>
          </span>
          <span class="subtle">\${escapeHtml(trap.updated_at || trap.created_at || "")}</span>
        </button>
      \`).join("") : '<div class="empty">No traps match this view</div>';
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
        \${metric("Loaded traps", traps.length || "0", "current filters")}
        \${metric("High severity", serious || "0", "error + critical")}
        \${metric("Top category", topCategory || "-", "repeated pattern")}
        \${metric("Focus area", topModule || topTag || "-", topModule ? "module" : "tag")}
        \${metric("Most viewed", mostViewed ? "#" + mostViewed.id : "-", mostViewed ? mostViewed.title : "no hits yet")}
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
      el("queue-title").textContent = "growth insights";
      el("candidate-tabs").classList.add("hidden");
      el("queue-meta").textContent = state.projectRoot
        ? traps.length + " traps / " + (state.insightFilters.status || "all") + " status"
        : "no project selected";
      el("candidates").innerHTML = \`
        <div class="library-tools">
          <div class="filter-grid">
            \${filterSelect("insight-filter-scope", "Scope", state.insightFilters.scope, [["", "project + global"], ...state.options.scopes.map((scope) => [scope, scope])])}
            \${filterSelect("insight-filter-status", "Status", state.insightFilters.status, [["all", "all"], ["active", "active"], ["archived", "archived"], ["superseded", "superseded"]])}
          </div>
        </div>
        <div class="summary-grid">
          \${metric("Confirmed traps", traps.length || "0", "selected scope")}
          \${metric("High severity", serious || "0", "error + critical")}
          \${metric("Top category", topCategory || "-", "largest pattern")}
          \${metric("Focus area", topModule || topTag || "-", topModule ? "module" : "tag")}
          \${metric("Most viewed", mostViewed ? "#" + mostViewed.id : "-", mostViewed ? mostViewed.title : "no hits yet")}
        </div>
        <div class="insight-grid">
          \${renderInsightRankBlock("categories", topValues(traps.map((trap) => trap.category), 6), traps.length)}
          \${renderInsightRankBlock("modules", topValues(traps.map((trap) => trap.module).filter(Boolean), 6), traps.length)}
          \${renderInsightRankBlock("tags", topValues(traps.flatMap((trap) => trap.tags || []), 8), traps.length)}
          \${renderInsightRankBlock("severity mix", topValues(traps.map((trap) => trap.severity), 5), traps.length)}
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
      el("detail-title").textContent = "insight detail";
      el("detail-meta").textContent = state.projectRoot ? state.insightFilters.scope || "project + global" : "select a project";
      el("detail").innerHTML = \`
        <div class="scroll">
          <div class="section">
            <div class="title">recent traps</div>
            \${renderInsightTrapRows(recent)}
          </div>
          <div class="section">
            <div class="title">most viewed</div>
            \${renderInsightTrapRows(mostViewed)}
          </div>
          <div class="section">
            <div class="title">recent high severity</div>
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
          \${items.length ? items.map((item) => renderRankRow(item, total)).join("") : '<div class="empty">No data</div>'}
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
            <span class="pill \${escapeAttr(trap.severity)}">\${escapeHtml(trap.severity)}</span>
            <span class="pill">\${escapeHtml(trap.category)}</span>
            <span class="pill scope">\${escapeHtml(trap.scope)}</span>
            <span class="pill \${escapeAttr(trap.status)}">\${escapeHtml(trap.status)}</span>
            <span class="pill">\${Number(trap.hit_count || 0)} hits</span>
          </span>
          <span class="subtle">\${escapeHtml(trap.updated_at || trap.created_at || "")}</span>
        </button>
      \`).join("") : '<div class="empty">No traps</div>';
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

    function topValues(values, limit) {
      const counts = new Map();
      values.forEach((value) => {
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, limit)
        .map(([label, count]) => ({ label, count }));
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
      return sortKey === "severity" ? "severity first"
        : sortKey === "hits" ? "hits first"
        : sortKey === "category" ? "category sort"
        : sortKey === "title" ? "title sort"
        : "recent first";
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
        showStatus("Opened trap #" + id);
      } else {
        showStatus("Trap #" + id + " is not in the current library", true);
      }
    }

    function renderCandidateViewTabs(pendingCount, reviewedCount) {
      document.querySelectorAll("[data-candidate-view]").forEach((button) => {
        const view = button.dataset.candidateView;
        const count = view === "inbox" ? pendingCount : reviewedCount;
        button.classList.toggle("active", view === state.candidateView);
        button.textContent = (view === "inbox" ? "Inbox" : "Reviewed") + " " + count;
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
      el("detail-title").textContent = "trap detail";
      el("detail-meta").textContent = trap ? "#" + trap.id + " / " + trap.scope : "select a trap";
      if (!trap) {
        el("detail").innerHTML = '<div class="empty">No trap selected</div>';
        return;
      }

      const key = trapKey(trap);
      const details = state.trapDetails[key];
      if (!details) {
        el("detail").innerHTML = '<div class="empty">Loading trap details</div>';
        ensureTrapDetail(trap);
        return;
      }

      const t = details.trap;
      el("detail").innerHTML = \`
        <div class="scroll">
          <div class="section">
            <div class="meta">
              <span class="pill scope">\${escapeHtml(details.scope)}</span>
              <span class="pill \${escapeAttr(t.severity)}">\${escapeHtml(t.severity)}</span>
              <span class="pill">\${escapeHtml(t.category)}</span>
              <span class="pill \${escapeAttr(t.status)}">\${escapeHtml(t.status)}</span>
              <span class="pill">\${Number(t.hit_count || 0)} hits</span>
            </div>
            <div class="title" style="font-size:16px">\${escapeHtml(t.title)}</div>
          </div>
          <div class="section">
            \${textBlock("Context", t.context)}
            \${textBlock("Mistake", t.mistake)}
            \${textBlock("Fix", t.fix)}
          </div>
          <div class="section">
            <div class="detail-kv">
              \${kv("Tags", (t.tags || []).join(", ") || "-")}
              \${kv("Path globs", (t.path_globs || []).join(", ") || "-")}
              \${kv("Module", t.module || "-")}
              \${kv("Owner", t.owner || "-")}
              \${kv("Created", t.created_at || "-")}
              \${kv("Updated", t.updated_at || "-")}
              \${kv("State key", t.state_key || "-")}
              \${kv("Supersedes", t.supersedes_id ?? "-")}
              \${kv("Valid from", t.valid_from || "-")}
              \${kv("Valid until", t.valid_until || "-")}
            </div>
          </div>
          \${renderTrapCode("Before", t.before_code)}
          \${renderTrapCode("After", t.after_code)}
          <div class="section">
            <div class="title">evidence</div>
            \${details.evidence.length ? details.evidence.map(renderEvidence).join("") : '<div class="empty">No evidence</div>'}
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
      el("detail-meta").textContent = candidate ? candidate.id + " / " + candidate.status : "select a candidate";
      if (!candidate) {
        el("detail").innerHTML = '<div class="empty">No candidate selected</div>';
        return;
      }
      const disabled = candidate.status !== "proposed" ? "disabled" : "";
      el("detail").innerHTML = \`
        <div class="scroll">
          \${renderReviewNotice(candidate)}
          <form class="section" id="candidate-form">
            <div class="form-grid">
              \${field("title", "Title", candidate.trap.title, disabled)}
              \${selectField("category", "Category", candidate.trap.category, state.options.categories, disabled)}
              \${selectField("scope", "Scope", candidate.trap.scope, state.options.scopes, disabled)}
              \${selectField("severity", "Severity", candidate.trap.severity || "warning", state.options.severities, disabled)}
              \${field("tags", "Tags", (candidate.trap.tags || []).join(", "), disabled)}
              \${field("path_globs", "Path globs", (candidate.trap.path_globs || []).join(", "), disabled)}
              \${field("module", "Module", candidate.trap.module || "", disabled)}
              \${field("owner", "Owner", candidate.trap.owner || "", disabled)}
              \${textarea("context", "Context", candidate.trap.context, disabled)}
              \${textarea("mistake", "Mistake", candidate.trap.mistake, disabled)}
              \${textarea("fix", "Fix", candidate.trap.fix, disabled)}
            </div>
          </form>
          <div class="section">
            <div class="meta">
              <span class="pill">quality \${Number(candidate.quality_score).toFixed(2)}</span>
              <span class="pill">conflict \${escapeHtml(candidate.quality.conflict_status)}</span>
              <span class="pill">action \${escapeHtml(candidate.quality.suggested_action)}</span>
            </div>
            \${candidate.quality.warnings.map((warning) => '<div class="warning">' + escapeHtml(warning) + '</div>').join("")}
          </div>
          <div class="section">
            <div class="title">evidence</div>
            \${candidate.evidence.length ? candidate.evidence.map(renderEvidence).join("") : '<div class="empty">No evidence</div>'}
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
        return \`<div class="section"><div class="warning">\${escapeHtml(review.label)}</div></div>\`;
      }
      if (review.status === "accepted") {
        return \`<div class="section"><div class="evidence review-note">
          <div class="meta">
            <span class="pill accepted">\${escapeHtml(review.label)}</span>
            <span class="pill">\${escapeHtml(review.trap_status)}</span>
            <button type="button" class="ghost" data-view-trap-scope="\${escapeAttr(review.scope)}" data-view-trap-id="\${escapeAttr(review.trap_id)}">View trap</button>
          </div>
          <div class="subtle">\${escapeHtml(review.trap_title)}</div>
        </div></div>\`;
      }
      if (review.status === "rejected") {
        return \`<div class="section"><div class="evidence">
          <div class="meta"><span class="pill rejected">\${escapeHtml(review.label)}</span></div>
          \${review.rejection_reason ? '<div class="subtle">' + escapeHtml(review.rejection_reason) + '</div>' : ''}
        </div></div>\`;
      }
      return "";
    }

    function renderDetailActions(candidate, disabled) {
      if (candidate.status !== "proposed") {
        const review = candidate.review;
        const viewTrap = review?.status === "accepted"
          ? \`<button type="button" data-view-trap-scope="\${escapeAttr(review.scope)}" data-view-trap-id="\${escapeAttr(review.trap_id)}">View trap</button>\`
          : "";
        return \`<div class="actions"><span class="pill \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>\${viewTrap}</div>\`;
      }
      return \`<div class="actions">
        <button id="save" class="primary" \${disabled}>Save</button>
        <button id="accept" \${disabled}>Accept</button>
        <button id="reject" class="danger" \${disabled}>Reject</button>
        <button id="accept-anyway" \${disabled}>Accept anyway</button>
        <input id="supersedes" placeholder="supersedes id" style="width:150px" \${disabled}>
        <button id="supersede" \${disabled}>Supersede</button>
      </div>\`;
    }

    function bindDetailActions(candidate) {
      const save = el("save");
      if (!save) return;
      save.addEventListener("click", async () => {
        try {
          const data = await api("/api/candidate/save", {
            method: "POST",
            body: JSON.stringify(candidatePayload(candidate.id))
          });
          await syncAfterMutation(data.candidate.id);
          showStatus("Candidate saved");
        } catch (error) {
          showStatus(error.message, true);
        }
      });
      el("accept").addEventListener("click", () => acceptCandidate({}));
      el("accept-anyway").addEventListener("click", () => acceptCandidate({ acceptAnyway: true }));
      el("supersede").addEventListener("click", () => {
        const value = Number.parseInt(el("supersedes").value, 10);
        if (Number.isNaN(value)) return showStatus("Supersedes id is required", true);
        acceptCandidate({ supersedesId: value });
      });
      el("reject").addEventListener("click", async () => {
        const reason = prompt("Reject reason") || "";
        try {
          const data = await api("/api/candidate/reject", {
            method: "POST",
            body: JSON.stringify({ projectRoot: state.projectRoot, sessionId: state.sessionId, candidateId: candidate.id, reason })
          });
          await syncAfterMutation(data.candidate.id);
          showStatus("Candidate rejected");
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
        showStatus("Candidate accepted");
      } catch (error) {
        if (error.payload?.possible_conflicts) {
          state.conflicts = error.payload.possible_conflicts;
          showStatus("Possible conflict found", true);
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
        showStatus("Refreshed");
      } catch (error) {
        showStatus(error.message, true);
      }
    }

    el("refresh").addEventListener("click", refreshAll);
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
      return \`<div class="field"><label for="\${name}">\${label}</label><select id="\${name}" name="\${name}" \${disabled}>\${options.map((option) => \`<option value="\${escapeAttr(option)}" \${option === value ? "selected" : ""}>\${escapeHtml(option)}</option>\`).join("")}</select></div>\`;
    }

    function renderEvidence(evidence) {
      return \`<div class="evidence">
        <div class="meta">
          <span class="pill">\${escapeHtml(evidence.source_type)}</span>
          \${evidence.source_ref ? '<span class="pill">' + escapeHtml(evidence.source_ref) + '</span>' : ''}
        </div>
        <div class="subtle">\${escapeHtml((evidence.related_files || []).join(", "))}</div>
        <div>\${escapeHtml(evidence.note || "")}</div>
      </div>\`;
    }

    function renderConflicts() {
      if (!state.conflicts.length) return "";
      return \`<div class="section"><div class="title">possible conflicts</div>\${state.conflicts.map((conflict) => \`
        <div class="conflict">
          <div class="meta"><span class="pill danger">#\${conflict.trap_id}</span><span class="pill">\${escapeHtml(conflict.scope)}</span><span class="pill warn">\${escapeHtml(conflict.reason)}</span></div>
          <strong>\${escapeHtml(conflict.title)}</strong>
          <div class="subtle">\${escapeHtml(conflict.context)}</div>
          <div>\${escapeHtml(conflict.fix)}</div>
        </div>\`).join("")}</div>\`;
    }

    function statusRank(status) {
      return status === "proposed" ? 0 : status === "accepted" ? 1 : 2;
    }

    function reviewLabel(candidate) {
      return candidate.review?.label || candidate.status;
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

    refreshAll();
  </script>
</body>
</html>`;
