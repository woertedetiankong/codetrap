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
          <div class="subtle" id="app-subtitle">review console</div>
        </div>
        <div class="rail-actions">
          <div class="segmented" aria-label="Main view">
            <button type="button" class="active" data-main-view="review">Review</button>
            <button type="button" data-main-view="library">Library</button>
            <button type="button" data-main-view="insights">Insights</button>
          </div>
          <div class="segmented" aria-label="Language">
            <button type="button" data-locale="en">EN</button>
            <button type="button" data-locale="zh">中文</button>
          </div>
          <button class="ghost" id="refresh" title="Refresh">Refresh</button>
        </div>
      </div>
      <form class="project-form" id="project-form">
        <input id="project-path" placeholder="/path/to/project">
        <button type="submit" id="project-add">Add</button>
      </form>
      <div class="scroll">
        <div class="stack" id="projects"></div>
        <div class="section">
          <div class="title" id="sessions-title">sessions</div>
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
    const savedLocale = localStorage.getItem("codetrap-locale");
    const initialLocale = savedLocale === "zh" ? "zh" : "en";

    const TEXT = {
      en: {
        "app.subtitle": "review console",
        "nav.review": "Review",
        "nav.library": "Library",
        "nav.insights": "Insights",
        "action.refresh": "Refresh",
        "action.add": "Add",
        "section.sessions": "sessions",
        "placeholder.projectPath": "/path/to/project",
        "title.candidateInbox": "candidate inbox",
        "title.candidateDetail": "candidate detail",
        "title.trapLibrary": "trap library",
        "title.trapDetail": "trap detail",
        "title.growthInsights": "growth insights",
        "title.insightDetail": "insight detail",
        "title.recentTraps": "recent traps",
        "title.mostViewed": "most viewed",
        "title.recentHighSeverity": "recent high severity",
        "title.evidence": "evidence",
        "title.possibleConflicts": "possible conflicts",
        "title.before": "Before",
        "title.after": "After",
        "tab.inbox": "Inbox {count}",
        "tab.reviewed": "Reviewed {count}",
        "meta.noProject": "no project selected",
        "meta.noSession": "no session selected",
        "meta.sessionCounts": "{goal} / {pending} pending, {reviewed} reviewed",
        "meta.libraryCounts": "{shown} shown / {loaded} loaded / {sort}",
        "meta.insightCounts": "{count} traps / {status} status",
        "meta.selectCandidate": "select a candidate",
        "meta.selectTrap": "select a trap",
        "meta.selectProject": "select a project",
        "empty.noProjects": "No projects",
        "empty.noSessions": "No sessions",
        "empty.noPending": "No pending candidates",
        "empty.noReviewed": "No reviewed candidates",
        "empty.noTrapMatches": "No traps match this view",
        "empty.noTrapSelected": "No trap selected",
        "empty.loadingTrapDetails": "Loading trap details",
        "empty.noCandidateSelected": "No candidate selected",
        "empty.noEvidence": "No evidence",
        "empty.noData": "No data",
        "empty.noTraps": "No traps",
        "action.viewTrap": "View trap",
        "action.clearFilters": "Clear filters",
        "action.save": "Save",
        "action.accept": "Accept",
        "action.reject": "Reject",
        "action.acceptAnyway": "Accept anyway",
        "action.supersede": "Supersede",
        "placeholder.searchTraps": "Search title, context, mistake, fix, tags",
        "placeholder.anyModule": "any module",
        "placeholder.anyOwner": "any owner",
        "placeholder.supersedesId": "supersedes id",
        "label.scope": "Scope",
        "label.status": "Status",
        "label.category": "Category",
        "label.sort": "Sort",
        "label.module": "Module",
        "label.owner": "Owner",
        "label.title": "Title",
        "label.severity": "Severity",
        "label.tags": "Tags",
        "label.pathGlobs": "Path globs",
        "label.context": "Context",
        "label.mistake": "Mistake",
        "label.fix": "Fix",
        "label.created": "Created",
        "label.updated": "Updated",
        "label.stateKey": "State key",
        "label.supersedes": "Supersedes",
        "label.validFrom": "Valid from",
        "label.validUntil": "Valid until",
        "metric.loadedTraps": "Loaded traps",
        "metric.confirmedTraps": "Confirmed traps",
        "metric.highSeverity": "High severity",
        "metric.topCategory": "Top category",
        "metric.focusArea": "Focus area",
        "metric.mostViewed": "Most viewed",
        "metric.currentFilters": "current filters",
        "metric.selectedScope": "selected scope",
        "metric.errorCritical": "error + critical",
        "metric.repeatedPattern": "repeated pattern",
        "metric.largestPattern": "largest pattern",
        "metric.module": "module",
        "metric.tag": "tag",
        "metric.noHits": "no hits yet",
        "insight.categories": "categories",
        "insight.modules": "modules",
        "insight.tags": "tags",
        "insight.severityMix": "severity mix",
        "option.projectGlobal": "project + global",
        "option.allCategories": "all categories",
        "sort.updated": "recently updated",
        "sort.severity": "severity",
        "sort.hits": "hit count",
        "sort.category": "category",
        "sort.title": "title",
        "sortLabel.updated": "recent first",
        "sortLabel.severity": "severity first",
        "sortLabel.hits": "hits first",
        "sortLabel.category": "category sort",
        "sortLabel.title": "title sort",
        "pill.hits": "{count} hits",
        "pill.candidates": "{count} candidates",
        "pill.accepted": "{count} accepted",
        "pill.warnings": "{count} warnings",
        "pill.quality": "quality {score}",
        "pill.conflict": "conflict {status}",
        "pill.action": "action {action}",
        "review.pending": "pending review",
        "review.rejected": "rejected",
        "review.accepted": "accepted -> trap #{id}",
        "review.acceptedDeleted": "accepted -> trap #{id} deleted",
        "review.acceptedLinkMissing": "accepted -> trap link missing",
        "status.refreshed": "Refreshed",
        "status.candidateSaved": "Candidate saved",
        "status.candidateRejected": "Candidate rejected",
        "status.candidateAccepted": "Candidate accepted",
        "status.possibleConflict": "Possible conflict found",
        "status.supersedesRequired": "Supersedes id is required",
        "status.openedTrap": "Opened trap #{id}",
        "status.trapNotInLibrary": "Trap #{id} is not in the current library",
        "prompt.rejectReason": "Reject reason",
        "value.project": "project",
        "value.global": "global",
        "value.active": "active",
        "value.all": "all",
        "value.archived": "archived",
        "value.superseded": "superseded",
        "value.proposed": "proposed",
        "value.accepted": "accepted",
        "value.rejected": "rejected",
        "value.accepted_missing": "accepted missing",
        "value.warning": "warning",
        "value.error": "error",
        "value.critical": "critical",
        "value.api": "api",
        "value.database": "database",
        "value.auth": "auth",
        "value.convention": "convention",
        "value.security": "security",
        "value.performance": "performance",
        "value.bug": "bug",
        "value.other": "other",
        "value.none": "none",
        "value.possible": "possible",
        "value.confirmed": "confirmed",
        "value.accept": "accept",
        "value.edit": "edit",
        "value.supersede": "supersede",
        "value.archive_old": "archive old",
        "value.manual": "manual",
        "value.conversation": "conversation",
        "value.commit": "commit",
        "value.issue": "issue",
        "value.test_failure": "test failure",
        "value.article": "article",
      },
      zh: {
        "app.subtitle": "复盘控制台",
        "nav.review": "审核",
        "nav.library": "库",
        "nav.insights": "洞察",
        "action.refresh": "刷新",
        "action.add": "添加",
        "section.sessions": "会话",
        "placeholder.projectPath": "/项目/路径",
        "title.candidateInbox": "候选收件箱",
        "title.candidateDetail": "候选详情",
        "title.trapLibrary": "陷阱库",
        "title.trapDetail": "陷阱详情",
        "title.growthInsights": "成长洞察",
        "title.insightDetail": "洞察详情",
        "title.recentTraps": "最近陷阱",
        "title.mostViewed": "查看最多",
        "title.recentHighSeverity": "最近高严重度",
        "title.evidence": "证据",
        "title.possibleConflicts": "可能冲突",
        "title.before": "修改前",
        "title.after": "修改后",
        "tab.inbox": "待审 {count}",
        "tab.reviewed": "已审 {count}",
        "meta.noProject": "未选择项目",
        "meta.noSession": "未选择会话",
        "meta.sessionCounts": "{goal} / {pending} 个待审，{reviewed} 个已审",
        "meta.libraryCounts": "显示 {shown} / 已加载 {loaded} / {sort}",
        "meta.insightCounts": "{count} 条陷阱 / 状态 {status}",
        "meta.selectCandidate": "选择一个候选",
        "meta.selectTrap": "选择一个陷阱",
        "meta.selectProject": "选择一个项目",
        "empty.noProjects": "没有项目",
        "empty.noSessions": "没有会话",
        "empty.noPending": "没有待审候选",
        "empty.noReviewed": "没有已审候选",
        "empty.noTrapMatches": "没有匹配的陷阱",
        "empty.noTrapSelected": "未选择陷阱",
        "empty.loadingTrapDetails": "正在加载陷阱详情",
        "empty.noCandidateSelected": "未选择候选",
        "empty.noEvidence": "没有证据",
        "empty.noData": "没有数据",
        "empty.noTraps": "没有陷阱",
        "action.viewTrap": "查看陷阱",
        "action.clearFilters": "清除筛选",
        "action.save": "保存",
        "action.accept": "接受",
        "action.reject": "拒绝",
        "action.acceptAnyway": "仍然接受",
        "action.supersede": "标记取代",
        "placeholder.searchTraps": "搜索标题、上下文、错误、修复、标签",
        "placeholder.anyModule": "任意模块",
        "placeholder.anyOwner": "任意负责人",
        "placeholder.supersedesId": "被取代的 id",
        "label.scope": "范围",
        "label.status": "状态",
        "label.category": "分类",
        "label.sort": "排序",
        "label.module": "模块",
        "label.owner": "负责人",
        "label.title": "标题",
        "label.severity": "严重度",
        "label.tags": "标签",
        "label.pathGlobs": "路径规则",
        "label.context": "上下文",
        "label.mistake": "错误",
        "label.fix": "修复",
        "label.created": "创建时间",
        "label.updated": "更新时间",
        "label.stateKey": "状态键",
        "label.supersedes": "取代",
        "label.validFrom": "生效开始",
        "label.validUntil": "生效结束",
        "metric.loadedTraps": "已加载陷阱",
        "metric.confirmedTraps": "确认陷阱",
        "metric.highSeverity": "高严重度",
        "metric.topCategory": "最高分类",
        "metric.focusArea": "关注区域",
        "metric.mostViewed": "查看最多",
        "metric.currentFilters": "当前筛选",
        "metric.selectedScope": "选中范围",
        "metric.errorCritical": "error + critical",
        "metric.repeatedPattern": "重复模式",
        "metric.largestPattern": "最大模式",
        "metric.module": "模块",
        "metric.tag": "标签",
        "metric.noHits": "还没有查看记录",
        "insight.categories": "分类",
        "insight.modules": "模块",
        "insight.tags": "标签",
        "insight.severityMix": "严重度分布",
        "option.projectGlobal": "项目 + 全局",
        "option.allCategories": "全部分类",
        "sort.updated": "最近更新",
        "sort.severity": "严重度",
        "sort.hits": "查看次数",
        "sort.category": "分类",
        "sort.title": "标题",
        "sortLabel.updated": "最近优先",
        "sortLabel.severity": "严重度优先",
        "sortLabel.hits": "查看次数优先",
        "sortLabel.category": "按分类排序",
        "sortLabel.title": "按标题排序",
        "pill.hits": "{count} 次查看",
        "pill.candidates": "{count} 个候选",
        "pill.accepted": "{count} 个已接受",
        "pill.warnings": "{count} 个警告",
        "pill.quality": "质量 {score}",
        "pill.conflict": "冲突 {status}",
        "pill.action": "建议 {action}",
        "review.pending": "待审核",
        "review.rejected": "已拒绝",
        "review.accepted": "已接受 -> 陷阱 #{id}",
        "review.acceptedDeleted": "已接受 -> 陷阱 #{id} 已删除",
        "review.acceptedLinkMissing": "已接受 -> 缺少陷阱链接",
        "status.refreshed": "已刷新",
        "status.candidateSaved": "候选已保存",
        "status.candidateRejected": "候选已拒绝",
        "status.candidateAccepted": "候选已接受",
        "status.possibleConflict": "发现可能冲突",
        "status.supersedesRequired": "需要填写被取代的 id",
        "status.openedTrap": "已打开陷阱 #{id}",
        "status.trapNotInLibrary": "当前陷阱库里没有陷阱 #{id}",
        "prompt.rejectReason": "拒绝原因",
        "value.project": "项目",
        "value.global": "全局",
        "value.active": "有效",
        "value.all": "全部",
        "value.archived": "已归档",
        "value.superseded": "已取代",
        "value.proposed": "待提议",
        "value.accepted": "已接受",
        "value.rejected": "已拒绝",
        "value.accepted_missing": "接受记录缺失",
        "value.warning": "警告",
        "value.error": "错误",
        "value.critical": "严重",
        "value.api": "API",
        "value.database": "数据库",
        "value.auth": "认证",
        "value.convention": "约定",
        "value.security": "安全",
        "value.performance": "性能",
        "value.bug": "缺陷",
        "value.other": "其他",
        "value.none": "无",
        "value.possible": "可能",
        "value.confirmed": "确认",
        "value.accept": "接受",
        "value.edit": "编辑",
        "value.supersede": "取代",
        "value.archive_old": "归档旧项",
        "value.manual": "手动",
        "value.conversation": "对话",
        "value.commit": "提交",
        "value.issue": "Issue",
        "value.test_failure": "测试失败",
        "value.article": "文章",
      }
    };

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
        <button class="row \${session.id === state.sessionId ? "active" : ""}" data-session="\${escapeAttr(session.id)}">
          <span class="row-title">\${escapeHtml(session.goal)}</span>
          <span class="meta">
            <span class="pill">\${escapeHtml(valueLabel(session.status))}</span>
            <span class="pill">\${escapeHtml(t("pill.candidates", { count: session.candidate_count || 0 }))}</span>
            <span class="pill accepted">\${escapeHtml(t("pill.accepted", { count: session.accepted_count || 0 }))}</span>
          </span>
        </button>
      \`).join("") : '<div class="empty">' + escapeHtml(t("empty.noSessions")) + '</div>';
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
        return \`<div class="section"><div class="warning">\${escapeHtml(reviewLabel(candidate))}</div></div>\`;
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
        return \`<div class="actions"><span class="pill \${reviewCssClass(candidate)}">\${escapeHtml(reviewLabel(candidate))}</span>\${viewTrap}</div>\`;
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

    refreshAll();
  </script>
</body>
</html>`;
