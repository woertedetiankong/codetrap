export const WEB_INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>codetrap review console</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f3ea;
      --panel: #fbfaf6;
      --panel-2: #fffdf8;
      --surface: #ffffff;
      --surface-hover: #f1eee6;
      --line: #ded8cc;
      --line-soft: #e9e4da;
      --text: #20201d;
      --muted: #716b62;
      --faint: #9c9488;
      --accent: #0f766e;
      --accent-soft: #d9f1eb;
      --accent-strong: #064e46;
      --danger: #b42318;
      --warn: #9a6700;
      --ok: #18794e;
      --shadow: rgba(36, 31, 24, 0.08);
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 18% 0%, rgba(13, 148, 136, 0.08), transparent 32%),
        linear-gradient(180deg, #fbf8f1 0%, var(--bg) 44%, #f3eee4 100%);
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
    button.primary { background: #20201d; color: #fffdf8; border-color: #20201d; }
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
      .rail, .queue, .detail { min-height: 520px; border-right: 0; border-bottom: 1px solid var(--line); }
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
        <button class="ghost" id="refresh" title="Refresh">Refresh</button>
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
          <div class="title">candidate inbox</div>
          <div class="subtle" id="queue-meta">no project selected</div>
        </div>
        <div class="segmented" aria-label="Candidate view">
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
          <div class="title">candidate detail</div>
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
      projects: [],
      sessions: [],
      candidates: [],
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
    }

    async function loadSessions() {
      if (!state.projectRoot) {
        state.sessions = [];
        state.candidates = [];
        renderSessions();
        renderCandidates();
        renderDetail();
        return;
      }
      const data = await api("/api/sessions?project=" + encodeURIComponent(state.projectRoot));
      state.sessions = data.sessions;
      if (!state.sessionId || !state.sessions.some((s) => s.id === state.sessionId)) {
        state.sessionId = state.sessions[0]?.id || null;
      }
      renderSessions();
      await loadCandidates();
    }

    async function loadCandidates() {
      if (!state.projectRoot || !state.sessionId) {
        state.candidates = [];
        renderCandidates();
        renderDetail();
        return;
      }
      const data = await api("/api/candidates?project=" + encodeURIComponent(state.projectRoot) + "&session=" + encodeURIComponent(state.sessionId));
      state.candidates = data.candidates;
      selectVisibleCandidate();
      renderCandidates();
      renderDetail();
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
      const pendingCount = state.candidates.filter((candidate) => candidate.status === "proposed").length;
      const reviewedCount = state.candidates.length - pendingCount;
      const sorted = sortedVisibleCandidates();
      selectVisibleCandidate(sorted);
      const session = state.sessions.find((item) => item.id === state.sessionId);
      el("queue-meta").textContent = session ? session.goal + " / " + pendingCount + " pending, " + reviewedCount + " reviewed" : "no session selected";
      renderCandidateViewTabs(pendingCount, reviewedCount);
      el("candidates").innerHTML = sorted.length ? sorted.map((candidate) => \`
        <button class="row \${candidate.id === state.candidateId ? "active" : ""} \${candidate.status} \${reviewCssClass(candidate)}" data-candidate="\${escapeAttr(candidate.id)}">
          <span class="row-title">\${escapeHtml(candidate.trap.title)}</span>
          <span class="meta">
            <span class="pill \${candidate.status} \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>
            <span class="pill">q \${Number(candidate.quality_score).toFixed(2)}</span>
            \${candidate.quality.warnings.length ? '<span class="pill warn">' + candidate.quality.warnings.length + ' warnings</span>' : ''}
          </span>
        </button>
      \`).join("") : '<div class="empty">' + (state.candidateView === "inbox" ? "No pending candidates" : "No reviewed candidates") + '</div>';
      document.querySelectorAll("[data-candidate]").forEach((button) => {
        button.addEventListener("click", () => {
          state.candidateId = button.dataset.candidate;
          state.conflicts = [];
          renderCandidates();
          renderDetail();
        });
      });
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

    function renderDetail() {
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
        return \`<div class="actions"><span class="pill \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span></div>\`;
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
