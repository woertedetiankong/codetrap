import { webClientScript } from "./client-script";

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
      grid-template-columns: minmax(250px, 0.82fr) 8px minmax(460px, 1.48fr) 8px minmax(320px, 1fr);
      gap: 0;
      overflow: hidden;
      position: relative;
    }

    .rail, .queue, .detail {
      min-height: 0;
      border-right: 1px solid var(--line-soft);
      background: color-mix(in srgb, var(--panel), transparent 8%);
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(12px);
      transition: box-shadow 140ms ease, transform 140ms ease, opacity 140ms ease;
    }

    .detail { background: var(--panel-2); }
    .queue { border-right: 0; }

    .shell.rail-collapsed .rail,
    .shell.rail-collapsed [data-splitter="left"] {
      display: none;
    }

    .shell.queue-collapsed .queue,
    .shell.queue-collapsed [data-splitter="right"] {
      display: none;
    }

    .shell.rail-collapsed {
      grid-template-columns: minmax(460px, 1.48fr) 8px minmax(320px, 1fr);
    }

    .shell.queue-collapsed {
      grid-template-columns: minmax(250px, 0.82fr) 8px minmax(460px, 1fr);
    }

    .shell.rail-collapsed.queue-collapsed {
      grid-template-columns: minmax(460px, 1fr);
    }

    .shell.rail-collapsed.rail-peeking .rail,
    .shell.queue-collapsed.queue-peeking .queue {
      display: flex;
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 11;
      border: 1px solid var(--line-soft);
      background: color-mix(in srgb, var(--panel), transparent 4%);
      box-shadow: 0 18px 54px rgba(31, 43, 36, 0.18);
    }

    .shell.rail-collapsed.rail-peeking .rail {
      left: 0;
      width: min(330px, calc(100% - 72px));
      animation: rail-peek-in 140ms ease-out;
    }

    .shell.queue-collapsed.queue-peeking .queue {
      right: 0;
      width: min(390px, calc(100% - 72px));
      animation: queue-peek-in 140ms ease-out;
    }

    @keyframes rail-peek-in {
      from { opacity: 0.72; transform: translateX(-18px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes queue-peek-in {
      from { opacity: 0.72; transform: translateX(18px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .edge-reveal {
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 9;
      width: 18px;
      display: none;
      pointer-events: none;
    }

    .edge-reveal-left { left: 0; }
    .edge-reveal-right { right: 0; }

    .shell.rail-collapsed .edge-reveal-left,
    .shell.queue-collapsed .edge-reveal-right {
      display: block;
    }

    .edge-reveal::after {
      content: "";
      position: absolute;
      top: 14px;
      bottom: 14px;
      width: 2px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent), transparent 45%);
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .edge-reveal-left::after { left: 3px; }
    .edge-reveal-right::after { right: 3px; }
    .shell.rail-peeking .edge-reveal-left::after,
    .shell.queue-peeking .edge-reveal-right::after,
    .shell.rail-collapse-target [data-splitter="left"]::before,
    .shell.queue-collapse-target [data-splitter="right"]::before {
      opacity: 1;
      background: color-mix(in srgb, var(--accent), transparent 70%);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent), transparent 40%);
    }

    .splitter {
      min-height: 0;
      position: relative;
      background:
        linear-gradient(90deg, transparent 0, transparent 3px, var(--line-soft) 3px, var(--line-soft) 4px, transparent 4px);
      cursor: col-resize;
      touch-action: none;
    }

    .splitter::before {
      content: "";
      position: absolute;
      inset: 0 2px;
      border-radius: 999px;
      background: transparent;
      transition: background 120ms ease, box-shadow 120ms ease;
    }

    .splitter:hover::before,
    .splitter:focus-visible::before,
    .splitter.dragging::before {
      background: color-mix(in srgb, var(--accent), transparent 82%);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent), transparent 54%);
    }

    .splitter:focus-visible { outline: none; }
    body.resizing-panes { cursor: col-resize; user-select: none; }

    .bar {
      min-height: 56px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line-soft);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .bar-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .icon-button {
      width: 34px;
      min-width: 34px;
      height: 34px;
      min-height: 34px;
      display: inline-grid;
      place-items: center;
      padding: 0;
      border-radius: 8px;
      color: var(--muted);
    }

    .shell-toggle {
      position: absolute;
      top: 12px;
      z-index: 12;
      width: 36px;
      min-width: 36px;
      height: 36px;
      min-height: 36px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.82);
      border-color: color-mix(in srgb, var(--line), var(--accent) 16%);
      box-shadow: 0 1px 2px var(--shadow), 0 10px 28px rgba(31, 43, 36, 0.08);
      backdrop-filter: blur(14px);
    }

    .shell-toggle-left { left: 12px; }
    .shell-toggle-right { right: 12px; }

    .shell-toggle:hover,
    .shell-toggle.active {
      background: #fffdf8;
      border-color: color-mix(in srgb, var(--accent), var(--line) 34%);
      box-shadow: 0 1px 2px var(--shadow), 0 12px 30px rgba(15, 118, 110, 0.12);
    }

    .rail > .bar { padding-left: 58px; }
    .queue > .bar { padding-right: 58px; }
    .shell.rail-collapsed .detail > .bar { padding-left: 58px; }
    .shell.queue-collapsed .detail > .bar { padding-right: 58px; }

    .icon-button:hover,
    .icon-button.active {
      color: var(--text);
      border-color: color-mix(in srgb, var(--accent), var(--line) 45%);
      background: #fffdf8;
    }

    .sidebar-toggle-icon {
      width: 18px;
      height: 16px;
      position: relative;
      border: 2px solid currentColor;
      border-radius: 5px;
    }

    .sidebar-toggle-icon::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 6px;
      width: 2px;
      background: currentColor;
      opacity: 0.72;
    }

    .sidebar-toggle.active .sidebar-toggle-icon::before {
      opacity: 0.18;
    }

    .queue-toggle .sidebar-toggle-icon::before {
      left: auto;
      right: 6px;
    }

    .queue-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
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
      .splitter { display: none; }
      .sidebar-toggle { display: none; }
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
    <button type="button" class="icon-button sidebar-toggle shell-toggle shell-toggle-left" id="sidebar-toggle" aria-pressed="false" aria-label="Hide sidebar" title="Hide sidebar">
      <span class="sidebar-toggle-icon" aria-hidden="true"></span>
    </button>
    <button type="button" class="icon-button sidebar-toggle queue-toggle shell-toggle shell-toggle-right" id="queue-toggle" aria-pressed="false" aria-label="Hide queue pane" title="Hide queue pane">
      <span class="sidebar-toggle-icon" aria-hidden="true"></span>
    </button>
    <div class="edge-reveal edge-reveal-left" aria-hidden="true"></div>
    <div class="edge-reveal edge-reveal-right" aria-hidden="true"></div>
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

    <div class="splitter" data-splitter="left" role="separator" aria-orientation="vertical" aria-label="Resize project and detail panes" tabindex="0"></div>

    <section class="detail">
      <div class="bar">
        <div>
          <div class="title" id="detail-title">candidate detail</div>
          <div class="subtle" id="detail-meta">select a candidate</div>
        </div>
      </div>
      <div class="detail-body" id="detail"></div>
    </section>

    <div class="splitter" data-splitter="right" role="separator" aria-orientation="vertical" aria-label="Resize detail and queue panes" tabindex="0"></div>

    <section class="queue">
      <div class="bar">
        <div class="bar-title-group">
          <div>
            <div class="title" id="queue-title">candidate inbox</div>
            <div class="subtle" id="queue-meta">no project selected</div>
          </div>
        </div>
        <div class="queue-actions">
          <div class="segmented" id="candidate-tabs" aria-label="Candidate view">
            <button type="button" class="active" data-candidate-view="inbox">Inbox</button>
            <button type="button" data-candidate-view="reviewed">Reviewed</button>
          </div>
        </div>
      </div>
      <div class="scroll">
        <div class="stack" id="candidates"></div>
      </div>
    </section>
  </main>
  <div class="status" id="status"></div>

  <script>${webClientScript()}</script>
</body>
</html>`;
