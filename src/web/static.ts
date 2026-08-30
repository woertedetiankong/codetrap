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
      flex: 0 0 auto;
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

    .rail > .bar {
      align-items: flex-start;
      flex-direction: column;
      padding-left: 58px;
    }
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
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      min-width: 0;
      width: 100%;
    }

    .main-nav {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-column: 1 / -1;
      width: 100%;
    }

    .main-nav button {
      width: 100%;
    }

    .locale-switcher {
      grid-column: 2;
      justify-self: end;
    }

    .rail-actions > #refresh {
      grid-column: 3;
    }

    .rail.wide-header .main-nav {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .compact-workspace-toggle { display: none; }

    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .session-heading-actions { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }

    .session-action {
      min-height: 28px;
      padding: 4px 8px;
      color: var(--muted);
      border-color: transparent;
      box-shadow: none;
      font-size: 12px;
    }

    .session-action:hover { color: var(--text); border-color: var(--line); }

    .session-delete-action:hover {
      color: var(--danger);
      border-color: color-mix(in srgb, var(--danger), var(--line) 62%);
      background: color-mix(in srgb, var(--danger), transparent 94%);
    }

    .title {
      font-weight: 650;
      text-transform: none;
      font-size: 13px;
      color: var(--text);
    }

    .subtle { color: var(--muted); font-size: 12px; min-width: 0; overflow-wrap: anywhere; }
    .scroll { flex: 1 1 auto; overflow: auto; min-height: 0; }
    .stack { display: grid; gap: 10px; padding: 12px; }

    .project-form {
      display: grid;
      flex: 0 0 auto;
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
    .row.destination-committed { border-color: color-mix(in srgb, var(--ok), var(--line) 48%); }
    .row.rejected { border-color: color-mix(in srgb, var(--danger), var(--line) 55%); opacity: 0.72; }
    .row.approved { border-color: color-mix(in srgb, var(--ok), var(--line) 55%); }
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
    .pill.destination-committed { color: var(--ok); background: color-mix(in srgb, var(--ok), transparent 94%); border-color: color-mix(in srgb, var(--ok), var(--line) 55%); }
    .pill.rejected { color: var(--danger); border-color: color-mix(in srgb, var(--danger), var(--line) 55%); }
    .receipt { position: fixed; right: 16px; bottom: 64px; max-width: 380px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); box-shadow: 0 6px 24px rgba(0,0,0,0.18); opacity: 0; pointer-events: none; transition: opacity 160ms; z-index: 40; }
    .receipt.show { opacity: 1; pointer-events: auto; }
    .receipt-line { font-size: 12px; line-height: 1.5; }
    .receipt-line.subtle { color: var(--muted); }
    .receipt-actions { display: flex; gap: 8px; margin-top: 10px; }
    .receipt-actions button { min-height: 30px; font-size: 12px; }

    .decision-dialog {
      width: min(520px, calc(100vw - 32px));
      padding: 0;
      color: var(--text);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 20px 64px rgba(0, 0, 0, 0.28);
    }
    .decision-dialog::backdrop { background: rgba(12, 18, 17, 0.52); backdrop-filter: blur(2px); }
    .decision-dialog form { display: grid; gap: 14px; padding: 20px; }
    .dialog-heading { display: grid; gap: 6px; }
    .dialog-heading h2 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 22px; font-weight: 600; }
    .dialog-copy { margin: 0; color: var(--muted); line-height: 1.55; }
    .dialog-candidate { padding: 10px 12px; border-left: 3px solid var(--accent); background: var(--accent-soft); overflow-wrap: anywhere; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .pill.approved { color: var(--ok); border-color: color-mix(in srgb, var(--ok), var(--line) 55%); }
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

    .settings-form {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-bottom: 1px solid var(--line-soft);
      background: rgba(255, 255, 255, 0.54);
    }

    .settings-form .segmented {
      justify-self: start;
    }

    .provider-fields {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .status-line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--faint);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--faint), transparent 78%);
    }

    .status-dot.available {
      background: var(--ok);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok), transparent 80%);
    }

    .status-dot.unavailable {
      background: var(--warn);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn), transparent 80%);
    }

    .profile-list {
      display: grid;
      gap: 8px;
    }

    .profile-row {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px;
      background: rgba(255, 255, 255, 0.68);
      display: grid;
      gap: 6px;
      overflow-wrap: anywhere;
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

    .health-metric {
      width: 100%;
      text-align: left;
      color: inherit;
      box-shadow: none;
    }

    .health-metric:hover,
    .health-metric.active {
      border-color: color-mix(in srgb, var(--accent), var(--line) 38%);
      background: #fff;
    }

    .health-metric.active { box-shadow: inset 3px 0 0 var(--accent); }

    .learning-empty {
      display: grid;
      gap: 8px;
    }

    .learning-prompt-card {
      width: min(680px, 100%);
      margin-top: 8px;
      padding: 12px 14px;
      display: grid;
      gap: 7px;
      text-align: left;
      border: 1px solid color-mix(in srgb, var(--accent), var(--line) 68%);
      border-left: 3px solid var(--accent);
      border-radius: 8px;
      background: var(--accent-soft);
    }

    .learning-prompt-card span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .learning-prompt-card code {
      color: var(--text);
      font-family: "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace;
      font-size: 13px;
      line-height: 1.65;
      white-space: normal;
    }

    .learning-title { font-size: 18px; }
    .learning-summary { font-size: 14px; line-height: 1.55; }
    .learning-controls {
      position: sticky;
      top: -12px;
      z-index: 4;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(132px, 0.62fr);
      gap: 7px;
      margin: -12px -12px 2px;
      padding: 12px;
      border-bottom: 1px solid var(--line-soft);
      background: color-mix(in srgb, var(--panel), transparent 3%);
      backdrop-filter: blur(16px);
    }

    .learning-controls .learning-scope,
    .learning-controls #learning-search { grid-column: 1 / -1; }
    .learning-controls select { min-width: 0; font-size: 12px; }
    .learning-controls #clear-learning-filters { font-size: 12px; color: var(--muted); }
    .learning-catalog { display: grid; gap: 12px; }

    .learning-collection {
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--accent), var(--line) 83%);
      border-radius: 14px;
      background: #fffefb;
      box-shadow: 0 7px 22px rgba(31, 43, 36, 0.045);
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .learning-collection:hover {
      border-color: color-mix(in srgb, var(--accent), var(--line) 62%);
      box-shadow: 0 10px 28px rgba(31, 43, 36, 0.065);
    }

    .collection-header {
      position: relative;
      border-bottom: 1px solid var(--line-soft);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--accent-soft), #fff 34%), #fffefb 92%);
    }

    .learning-collection.collapsed {
      box-shadow: 0 4px 15px rgba(31, 43, 36, 0.035);
    }

    .learning-collection.collapsed .collection-header { border-bottom-color: transparent; }

    .collection-toggle {
      min-width: 0;
      min-height: 0;
      display: grid;
      gap: 7px;
      width: 100%;
      padding: 14px 15px 13px;
      border: 0;
      border-radius: 13px;
      background: transparent;
      box-shadow: none;
      color: inherit;
      text-align: left;
    }

    .collection-toggle:hover { background: color-mix(in srgb, var(--accent-soft), transparent 68%); }
    .collection-toggle:hover strong { color: var(--accent-strong); }
    .collection-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }

    .collection-kicker,
    .learning-section-label {
      color: var(--accent-strong);
      font-size: 10px;
      font-weight: 760;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .collection-kicker {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
      padding-right: 66px;
    }

    .collection-audit-status {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--muted);
      letter-spacing: 0.035em;
    }

    .collection-audit-status::before {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: currentColor;
      content: "";
    }

    .collection-audit-status.coverage-complete,
    .collection-audit-status.coverage-sampled { color: var(--ok); }
    .collection-audit-status.coverage-incomplete { color: var(--warn); }

    .coverage-chip {
      width: fit-content;
      padding: 3px 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel), transparent 8%);
      color: var(--muted);
      font-size: 10px;
      font-weight: 720;
      line-height: 1.25;
      letter-spacing: 0.025em;
    }

    .coverage-chip.coverage-complete,
    .coverage-chip.coverage-sampled {
      border-color: color-mix(in srgb, var(--ok), var(--line) 64%);
      color: var(--ok);
    }

    .coverage-chip.coverage-incomplete {
      border-color: color-mix(in srgb, var(--warn), var(--line) 60%);
      background: color-mix(in srgb, var(--warn), transparent 96%);
      color: var(--warn);
    }

    .coverage-chip.coverage-curated-subset {
      border-color: color-mix(in srgb, var(--accent), var(--line) 60%);
      color: var(--accent-strong);
    }

    .collection-title-line {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    .collection-title-line strong {
      min-width: 0;
      font-family: Georgia, "Noto Serif SC", "Songti SC", serif;
      font-size: 16px;
      line-height: 1.3;
    }

    .collection-chevron {
      flex: 0 0 auto;
      display: grid;
      width: 24px;
      height: 24px;
      place-items: center;
      color: var(--accent-strong);
      font-size: 15px;
      transition: transform 160ms ease, color 160ms ease;
    }

    .collection-toggle:hover .collection-chevron { color: var(--text); }
    .collection-toggle[aria-expanded="false"] .collection-chevron { transform: rotate(-90deg); }

    .collection-rename {
      position: absolute;
      top: 8px;
      right: 9px;
      min-height: 24px;
      padding: 2px 6px;
      border-color: transparent;
      box-shadow: none;
      color: var(--muted);
      font-size: 11px;
      opacity: 0.68;
    }

    .collection-rename:hover { opacity: 1; }

    .collection-progress-row {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .collection-progress {
      flex: 1 1 auto;
      min-width: 48px;
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--line), transparent 32%);
    }

    .collection-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), var(--ok));
      transition: width 180ms ease;
    }

    .collection-progress-copy {
      flex: 0 0 auto;
      font-size: 11px;
      white-space: nowrap;
    }

    .collection-chapters { display: grid; }
    .collection-chapters[hidden] { display: none; }

    .collection-context {
      border-bottom: 1px solid var(--line-soft);
      background: color-mix(in srgb, var(--accent-soft), #fffefb 58%);
    }

    .collection-context > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 13px;
      color: var(--accent-strong);
      cursor: pointer;
      font-size: 11px;
      font-weight: 720;
      letter-spacing: 0.025em;
      list-style: none;
    }

    .collection-context > summary::-webkit-details-marker { display: none; }

    .collection-context-count {
      display: grid;
      width: 20px;
      height: 20px;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--accent), var(--line) 70%);
      border-radius: 50%;
      color: var(--muted);
      font-size: 10px;
    }

    .collection-context-sections {
      display: grid;
      gap: 8px;
      padding: 0 13px 12px;
    }

    .collection-context-section {
      padding: 10px 11px;
      border: 1px solid color-mix(in srgb, var(--accent), var(--line) 82%);
      border-radius: 10px;
      background: color-mix(in srgb, #fffefb, transparent 4%);
    }

    .collection-context-section > strong {
      display: block;
      margin-bottom: 5px;
      font-family: Georgia, "Noto Serif SC", "Songti SC", serif;
      font-size: 13px;
      line-height: 1.35;
    }

    .collection-context-copy {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.55;
    }

    .collection-context-copy p { margin: 0 0 7px; }
    .collection-context-copy p:last-child { margin-bottom: 0; }

    .learning-chapter {
      width: 100%;
      min-height: 0;
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr) 12px;
      gap: 8px;
      align-items: start;
      padding: 10px 12px;
      border: 0;
      border-bottom: 1px solid var(--line-soft);
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      text-align: left;
    }

    .learning-chapter:last-child { border-bottom: 0; }
    .learning-chapter:hover { background: color-mix(in srgb, var(--accent-soft), transparent 58%); }
    .learning-chapter.active { background: #fff; box-shadow: inset 3px 0 0 var(--accent); }
    .chapter-number { color: var(--faint); font-family: "Cascadia Mono", Consolas, monospace; font-size: 11px; line-height: 1.55; }
    .chapter-copy { min-width: 0; display: grid; gap: 3px; }

    .chapter-state {
      width: 9px;
      height: 9px;
      margin-top: 4px;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--surface);
    }

    .chapter-state.learned { border-color: var(--ok); background: var(--ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok), transparent 88%); }
    .learning-standalone { display: grid; gap: 8px; }
    .learning-standalone-row { box-shadow: none; }

    .learning-breadcrumb {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: var(--accent-strong);
      font-size: 12px;
    }

    .learning-breadcrumb span { min-width: 0; overflow-wrap: anywhere; }
    .learning-breadcrumb strong { flex: 0 0 auto; font-family: "Cascadia Mono", Consolas, monospace; font-size: 11px; }
    .collection-edit-actions { display: flex; gap: 7px; margin-top: 12px; }
    .collection-edit-actions button { min-height: 28px; font-size: 12px; }
    .learning-actions { align-items: center; }
    .learning-navigation { display: flex; gap: 7px; margin-right: auto; }
    .learning-navigation button { min-height: 30px; font-size: 12px; }
    .learning-body {
      display: grid;
      gap: 12px;
      line-height: 1.65;
      overflow-wrap: anywhere;
      font-size: 14px;
    }

    .learning-prose {
      white-space: pre-wrap;
      font-family: Georgia, "Noto Serif SC", "Songti SC", "Microsoft YaHei UI", serif;
    }

    .learning-code {
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.65;
      tab-size: 2;
    }

    .source-list {
      display: grid;
      gap: 7px;
      align-items: start;
    }

    .source-link,
    .source-ref {
      width: fit-content;
      max-width: 100%;
      overflow-wrap: anywhere;
      color: var(--accent-strong);
      font-size: 13px;
    }

    .source-link:hover { text-decoration-thickness: 2px; }

    .source-coverage-panel {
      display: grid;
      gap: 10px;
      padding: 14px 12px;
      border-top: 1px solid var(--line-soft);
      border-left: 3px solid color-mix(in srgb, var(--muted), var(--line) 55%);
      background: linear-gradient(90deg, color-mix(in srgb, var(--line-soft), transparent 45%), transparent 82%);
    }

    .source-coverage-panel.coverage-complete,
    .source-coverage-panel.coverage-sampled { border-left-color: var(--ok); }
    .source-coverage-panel.coverage-incomplete { border-left-color: var(--warn); }
    .source-coverage-panel.coverage-curated-subset { border-left-color: var(--accent); }

    .source-coverage-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .source-coverage-heading > div { display: grid; gap: 3px; }
    .source-coverage-heading strong { font-family: Georgia, "Noto Serif SC", "Songti SC", serif; font-size: 15px; }
    .coverage-eyebrow { color: var(--muted); font-size: 10px; font-weight: 760; letter-spacing: 0.09em; text-transform: uppercase; }
    .source-coverage-panel > p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }

    .coverage-meter {
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--line-soft);
    }

    .coverage-meter span { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
    .coverage-incomplete .coverage-meter span { background: var(--warn); }
    .coverage-complete .coverage-meter span,
    .coverage-sampled .coverage-meter span { background: var(--ok); }

    .coverage-details { border-top: 1px solid var(--line-soft); padding-top: 8px; }
    .coverage-details summary { cursor: pointer; color: var(--accent-strong); font-size: 12px; font-weight: 680; }
    .coverage-details ul { display: grid; gap: 0; margin: 8px 0 0; padding: 0; list-style: none; }

    .coverage-unit {
      display: grid;
      grid-template-columns: 9px minmax(0, 1fr) auto;
      gap: 9px;
      align-items: start;
      padding: 8px 0;
      border-top: 1px solid color-mix(in srgb, var(--line-soft), transparent 28%);
    }

    .coverage-unit:first-child { border-top: 0; }
    .coverage-unit-mark { width: 7px; height: 7px; margin-top: 5px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); }
    .coverage-unit.covered .coverage-unit-mark { border-color: var(--ok); background: var(--ok); }
    .coverage-unit.skipped .coverage-unit-mark { border-color: var(--accent); background: var(--accent-soft); }
    .coverage-unit.unresolved .coverage-unit-mark { border-color: var(--warn); background: color-mix(in srgb, var(--warn), transparent 78%); }
    .coverage-unit-copy { min-width: 0; display: grid; gap: 2px; }
    .coverage-unit-copy strong { overflow-wrap: anywhere; font-size: 12px; font-weight: 680; }
    .coverage-unit-copy span { overflow-wrap: anywhere; color: var(--muted); font-size: 10px; }
    .coverage-unit-state { color: var(--muted); font-size: 10px; white-space: nowrap; }

    .coverage-fingerprint { min-width: 0; display: grid; gap: 3px; color: var(--muted); font-size: 10px; }
    .coverage-fingerprint code { overflow-wrap: anywhere; color: inherit; font-size: 9px; }

    .insight-review-header {
      border-top: 0;
      border-left: 3px solid var(--accent);
      background: linear-gradient(90deg, var(--accent-soft), transparent 72%);
    }

    .insight-rationale {
      color: var(--muted);
      line-height: 1.55;
    }

    .insight-form-grid { grid-template-columns: minmax(0, 1fr) minmax(220px, 0.55fr); }

    .learning-editor {
      min-height: 360px;
      font-family: "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace;
      line-height: 1.6;
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

    .review-summary {
      padding: 10px 12px 0;
    }

    .review-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      border: 1px solid color-mix(in srgb, var(--warn), var(--line) 55%);
      border-radius: 8px;
      padding: 9px 10px;
      background: color-mix(in srgb, #fff7d6, var(--surface) 35%);
      color: #5f4200;
      font-size: 12px;
    }

    .actions {
      padding: 12px;
      border-top: 1px solid var(--line-soft);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      background: rgba(255, 255, 255, 0.018);
    }

    .action-hint {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.3;
      min-width: 180px;
    }

    .action-hint.dirty {
      color: #8a5b00;
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
      .rail > .bar {
        min-height: auto;
        padding: 10px 12px;
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
      }
      .rail-actions {
        display: flex;
        width: auto;
        flex: 1 1 520px;
        flex-wrap: nowrap;
      }
      .main-nav {
        grid-template-columns: repeat(4, minmax(68px, 1fr));
        width: auto;
        flex: 1;
      }
      .compact-workspace-toggle { display: inline-flex; }
      .rail .project-form,
      .rail > .scroll { display: none; }
      .rail.compact-open .project-form { display: grid; }
      .rail.compact-open > .scroll {
        display: block;
        max-height: min(48vh, 430px);
        border-bottom: 1px solid var(--line-soft);
      }
      .queue, .detail { min-height: 520px; border-right: 0; border-bottom: 1px solid var(--line); }
    }

    @media (max-width: 700px) {
      .rail > .bar > :first-child { width: 100%; }
      .rail-actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        flex-basis: 100%;
        width: 100%;
      }
      .main-nav {
        grid-column: 1 / -1;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        width: 100%;
      }
      .locale-switcher,
      .rail-actions > #refresh {
        grid-column: auto;
        justify-self: stretch;
      }
    }

    @media (max-width: 520px) {
      .bar { align-items: flex-start; flex-direction: column; }
      .rail > .bar { align-items: stretch; }
      .rail-actions { justify-content: stretch; }
      .filter-grid, .summary-grid, .detail-kv, .provider-fields, .form-grid, .insight-form-grid { grid-template-columns: 1fr; }
      .learning-controls { grid-template-columns: 1fr; }
      .learning-controls .learning-scope,
      .learning-controls #learning-search { grid-column: 1; }
      .learning-actions { align-items: stretch; }
      .learning-navigation { width: 100%; }
      .learning-navigation button { flex: 1; }
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
    <aside class="rail" id="workspace-rail">
      <div class="bar">
        <div>
          <div class="title">codetrap</div>
          <div class="subtle" id="app-subtitle">review console</div>
        </div>
        <div class="rail-actions">
          <div class="segmented main-nav" aria-label="Main view">
            <button type="button" class="active" data-main-view="review">Review</button>
            <button type="button" data-main-view="library">Library</button>
            <button type="button" data-main-view="learning">Learning</button>
            <button type="button" data-main-view="embeddings">Embeddings</button>
          </div>
          <div class="segmented locale-switcher" aria-label="Language">
            <button type="button" data-locale="en">EN</button>
            <button type="button" data-locale="zh">中文</button>
          </div>
          <button class="ghost" id="refresh" title="Refresh">Refresh</button>
          <button type="button" class="ghost compact-workspace-toggle" id="compact-workspace-toggle" aria-expanded="false" aria-controls="project-form workspace-list">Projects &amp; sessions</button>
        </div>
      </div>
      <form class="project-form" id="project-form">
        <input id="project-path" placeholder="/path/to/project">
        <button type="submit" id="project-add">Add</button>
      </form>
      <div class="scroll" id="workspace-list">
        <div class="stack" id="projects"></div>
        <div class="section">
          <div class="section-heading">
            <div class="title" id="sessions-title">sessions</div>
            <div class="session-heading-actions">
              <button type="button" class="ghost session-action hidden" id="rename-session">Rename selected</button>
              <button type="button" class="ghost session-action session-delete-action hidden" id="delete-session">Delete selected</button>
            </div>
          </div>
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
      <div class="review-summary hidden" id="review-summary"></div>
      <div class="scroll">
        <div class="stack" id="candidates"></div>
      </div>
    </section>
  </main>
  <div class="status" id="status"></div>
  <div class="receipt" id="receipt"></div>
  <dialog class="decision-dialog" id="reject-dialog" aria-labelledby="reject-dialog-title">
    <form id="reject-form">
      <div class="dialog-heading">
        <h2 id="reject-dialog-title">Reject this candidate?</h2>
        <div class="dialog-candidate" id="reject-dialog-candidate"></div>
      </div>
      <p class="dialog-copy" id="reject-dialog-scope"></p>
      <p class="dialog-copy" id="reject-dialog-undo"></p>
      <div class="field">
        <label for="reject-reason" id="reject-reason-label">Reason (optional)</label>
        <textarea id="reject-reason" rows="3"></textarea>
      </div>
      <div class="dialog-actions">
        <button type="button" class="ghost" id="reject-cancel">Cancel</button>
        <button type="submit" class="danger" id="reject-confirm">Reject and suppress</button>
      </div>
    </form>
  </dialog>

  <script>${webClientScript()}</script>
</body>
</html>`;
