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

    .bootstrap-failure {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 28px;
      background:
        linear-gradient(rgba(35, 102, 220, 0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(35, 102, 220, 0.055) 1px, transparent 1px),
        radial-gradient(circle at 72% 18%, rgba(52, 125, 255, 0.2), transparent 30%),
        #f5f8ff;
      background-size: 28px 28px, 28px 28px, auto, auto;
    }

    .bootstrap-failure-card {
      width: min(620px, 100%);
      border: 1px solid #b9d0f6;
      border-radius: 6px 26px 6px 6px;
      padding: clamp(26px, 5vw, 48px);
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 18px 22px 0 rgba(32, 101, 220, 0.09), 0 30px 80px rgba(17, 61, 130, 0.13);
    }

    .bootstrap-failure-kicker {
      color: #0d5ce5;
      font: 700 12px/1.2 "Cascadia Code", Consolas, monospace;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .bootstrap-failure-card h1 { margin: 14px 0 12px; color: #061a36; font-size: clamp(27px, 5vw, 42px); line-height: 1.08; }
    .bootstrap-failure-card p { color: #5a6f8a; line-height: 1.7; }
    .bootstrap-command { margin: 18px 0; padding: 14px 16px; border-left: 4px solid #0d5ce5; background: #eef4ff; color: #0a346d; overflow-wrap: anywhere; }
    .bootstrap-command code { display: block; margin-top: 7px; color: #061a36; font-weight: 700; }
    .bootstrap-failure-actions { display: flex; align-items: center; gap: 12px; margin-top: 22px; }
    .bootstrap-failure-actions button { background: #0d5ce5; border-color: #0d5ce5; color: white; }
    .bootstrap-privacy { font-size: 12px; }

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
      grid-template-columns: repeat(4, minmax(0, 1fr));
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
      grid-template-columns: repeat(5, minmax(0, 1fr));
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
    .chapter-state.in_progress { border-color: var(--accent); background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent), transparent 88%); }
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

    .learning-impact-card,
    .learning-agent-card {
      display: grid;
      gap: 13px;
      border-left: 3px solid var(--accent);
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent-soft), #fff 42%), #fff 74%);
    }

    .learning-agent-card {
      border: 1px solid color-mix(in srgb, var(--accent), var(--line) 72%);
      border-left: 4px solid var(--accent);
      border-radius: 13px;
      box-shadow: 0 10px 24px color-mix(in srgb, var(--accent), transparent 91%);
    }

    .learning-impact-heading,
    .learning-agent-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .learning-impact-heading > div,
    .learning-agent-heading > div { display: grid; gap: 4px; }
    .learning-impact-copy,
    .learning-agent-card > p { margin: 0; line-height: 1.55; }
    .learning-impact-group { display: grid; gap: 7px; }
    .field-label { color: var(--muted); font-size: 11px; font-weight: 720; letter-spacing: 0.035em; text-transform: uppercase; }
    .learning-status-control { width: fit-content; max-width: 100%; }
    .learning-status-control button { min-width: 0; padding-inline: 12px; }
    .feedback-choice { display: flex; flex-wrap: wrap; gap: 7px; }
    .feedback-choice button.active { border-color: var(--accent); color: var(--accent-strong); background: var(--accent-soft); }

    .learning-run-link {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
    }

    .learning-run-link select { width: 100%; color: var(--ink); font-weight: 500; }
    .learning-agent-card > button { width: fit-content; }

    .learning-agent-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 11px;
    }

    .learning-agent-form label { min-width: 0; display: grid; gap: 6px; color: var(--muted); font-size: 11px; font-weight: 680; }
    .learning-agent-form label.full { grid-column: 1 / -1; }
    .learning-agent-form input,
    .learning-agent-form select,
    .learning-agent-form textarea { width: 100%; color: var(--ink); font-weight: 500; }
    .learning-agent-form textarea { min-height: 88px; resize: vertical; line-height: 1.5; }
    .learning-agent-form textarea.tall { min-height: 150px; }
    .learning-agent-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .inline-error { padding: 10px 11px; border: 1px solid color-mix(in srgb, var(--danger), transparent 58%); border-radius: 9px; color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 94%); font-size: 12px; line-height: 1.45; }

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

    .candidate-actions { align-items: flex-start; }
    .candidate-primary-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .candidate-more-actions { position: relative; }
    .candidate-more-actions summary {
      min-height: 32px;
      display: inline-flex;
      align-items: center;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      color: var(--muted);
      cursor: pointer;
      list-style: none;
      box-shadow: 0 1px 2px var(--shadow);
    }
    .candidate-more-actions summary::-webkit-details-marker { display: none; }
    .candidate-more-actions summary::after { content: "⌄"; margin-left: 8px; }
    .candidate-more-actions[open] summary::after { content: "⌃"; }
    .candidate-more-panel { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; padding: 10px; border: 1px solid var(--line-soft); border-radius: 10px; background: var(--panel-2); }
    .candidate-conflict-actions { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; padding-top: 8px; border-top: 1px solid var(--line-soft); }

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

    /* Impact: a local flight recorder, expressed as a precise blue blueprint. */
    [data-main-view="impact"].active {
      background: #0b4fc5;
      color: #f7fbff;
    }

    .impact-shell {
      --impact-ink: #061a36;
      --impact-blue: #0d5ce5;
      --impact-electric: #4b8dff;
      --impact-pale: #eaf2ff;
      --impact-line: #c9daf6;
      height: 100%;
      overflow: auto;
      padding: clamp(14px, 2.2vw, 26px);
      background:
        linear-gradient(rgba(20, 94, 210, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20, 94, 210, 0.035) 1px, transparent 1px),
        #f7faff;
      background-size: 24px 24px;
    }

    .impact-tabs {
      display: inline-flex;
      gap: 4px;
      margin-bottom: 12px;
      padding: 3px;
      border: 1px solid var(--impact-line);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.82);
    }

    .impact-tabs button {
      min-height: 28px;
      border: 0;
      background: transparent;
      color: #55708f;
      box-shadow: none;
      font-size: 12px;
    }

    .impact-tabs button.active {
      background: var(--impact-ink);
      color: white;
    }

    .impact-hero {
      position: relative;
      overflow: hidden;
      min-height: 0;
      padding: clamp(18px, 2.6vw, 30px) clamp(20px, 3vw, 34px);
      border: 1px solid #0c3268;
      border-radius: 14px;
      background:
        radial-gradient(circle at 88% 20%, rgba(75, 141, 255, 0.42), transparent 25%),
        linear-gradient(128deg, #06162d 0%, #092c62 62%, #0b5de2 135%);
      color: #f3f8ff;
      box-shadow: 0 18px 44px rgba(5, 39, 88, 0.16);
    }

    .impact-hero::after {
      content: "";
      position: absolute;
      width: 310px;
      height: 310px;
      right: -155px;
      bottom: -215px;
      border: 1px solid rgba(149, 193, 255, 0.42);
      border-radius: 50%;
      box-shadow: 0 0 0 38px rgba(102, 164, 255, 0.07), 0 0 0 78px rgba(102, 164, 255, 0.035);
    }

    .impact-hero-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 28px;
      align-items: start;
    }

    .impact-hero-side { display: grid; gap: 8px; justify-items: end; }

    .impact-kicker {
      margin-bottom: 13px;
      color: #7fb0ff;
      font: 700 10px/1 "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      letter-spacing: 0.15em;
    }

    .impact-hero h2 {
      max-width: 720px;
      margin: 0;
      font-family: "Aptos Display", "Segoe UI Variable Display", "Microsoft YaHei UI", sans-serif;
      font-size: clamp(22px, 2.6vw, 32px);
      font-weight: 650;
      letter-spacing: -0.035em;
      line-height: 1.08;
    }

    .impact-hero p {
      max-width: 680px;
      margin: 10px 0 0;
      color: #c0d4f2;
      font-size: 12px;
      line-height: 1.65;
    }

    .impact-stats-strip {
      display: flex;
      flex-wrap: wrap;
      margin-top: 14px;
      color: #d9e8ff;
      font-size: 11.5px;
      font-weight: 600;
      line-height: 1.5;
    }

    .impact-stats-strip span { padding: 0 13px; border-left: 1px solid rgba(141, 187, 255, 0.35); }
    .impact-stats-strip span:first-child { padding-left: 0; border-left: 0; }

    .impact-local-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid rgba(156, 196, 255, 0.34);
      border-radius: 999px;
      background: rgba(5, 25, 53, 0.52);
      color: #dbeaff;
      font: 700 10px/1 "Cascadia Code", Consolas, monospace;
      white-space: nowrap;
    }

    .impact-local-badge::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #60e6af;
      box-shadow: 0 0 0 5px rgba(96, 230, 175, 0.12);
    }

    .impact-metrics {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 9px;
      margin-top: 12px;
    }

    .impact-metric {
      min-height: 112px;
      display: grid;
      align-content: space-between;
      padding: 16px;
      border: 1px solid var(--impact-line);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 10px 28px rgba(22, 76, 154, 0.06);
      animation: impact-rise 420ms ease both;
    }

    .impact-metric:nth-child(2) { animation-delay: 45ms; }
    .impact-metric:nth-child(3) { animation-delay: 90ms; }
    .impact-metric:nth-child(4) { animation-delay: 135ms; }
    .impact-metric:nth-child(5) { animation-delay: 180ms; }

    .impact-metric strong {
      color: var(--impact-ink);
      font: 660 clamp(25px, 3vw, 38px)/1 "Aptos Display", "Segoe UI Variable Display", sans-serif;
      letter-spacing: -0.04em;
    }

    .impact-metric span {
      color: #60758e;
      font: 700 9px/1.35 "Cascadia Code", Consolas, monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .impact-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(250px, 0.65fr);
      gap: 12px;
      margin-top: 12px;
    }

    .impact-card,
    .impact-notice {
      border: 1px solid var(--impact-line);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 10px 28px rgba(22, 76, 154, 0.05);
    }

    .impact-card { padding: 18px; }
    .impact-card h3, .impact-notice h3 { margin: 0; color: var(--impact-ink); font-size: 14px; }

    .impact-mix-bar {
      display: flex;
      gap: 2px;
      height: 10px;
      margin-top: 15px;
      border-radius: 999px;
      overflow: hidden;
      background: #e7effb;
    }

    .impact-mix-seg { min-width: 6px; height: 100%; }
    .impact-mix-seg.observed { background: var(--impact-blue); }
    .impact-mix-seg.human { background: #d88713; }
    .impact-mix-seg.inference { background: #6f63d9; }
    .impact-mix-seg.eval { background: #16855a; }

    .impact-mix-legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; }

    .impact-mix-item { display: inline-flex; align-items: center; gap: 7px; color: #526b88; font-size: 11px; }
    .impact-mix-item i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
    .impact-mix-item.observed i { background: var(--impact-blue); }
    .impact-mix-item.human i { background: #d88713; }
    .impact-mix-item.inference i { background: #6f63d9; }
    .impact-mix-item.eval i { background: #16855a; }
    .impact-mix-item b { color: var(--impact-ink); font-size: 13px; }

    .impact-notice {
      padding: 18px;
      border-color: #bcd0f1;
      background: linear-gradient(145deg, #edf4ff, #fbfdff);
    }

    .impact-notice p { margin: 9px 0 0; color: #526b88; font-size: 12px; line-height: 1.62; }
    .impact-notice.warn { border-color: #e8c98f; background: linear-gradient(145deg, #fff8ea, #fffdf8); }
    .impact-notice.warn h3 { color: #77500b; }
    .impact-notice.warn p { color: #765e35; }
    .impact-notice.error { border-color: #e7b2ae; background: #fff7f6; }
    .impact-hook-health {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 14px;
      align-items: start;
      margin-bottom: 12px;
    }
    .impact-hook-health.blocked { border-color: #e5a5a0; background: linear-gradient(145deg, #fff3f1, #fffaf8); }
    .impact-hook-health.unavailable { border-color: #e6b86c; background: linear-gradient(145deg, #fff8e8, #fffdf7); }
    .impact-hook-health-mark {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 14px 5px 14px 5px;
      background: #0b4fc5;
      color: white;
      font: 800 13px/1 "Cascadia Code", Consolas, monospace;
      box-shadow: 5px 5px 0 #d9e7fb;
    }
    .impact-hook-health code { display: block; margin-top: 10px; overflow-wrap: anywhere; color: #083b86; font-size: 11px; }
    .impact-hook-health small { display: block; margin-top: 7px; color: #6d6049; font-size: 10px; line-height: 1.5; }

    .impact-empty {
      min-height: 360px;
      display: grid;
      place-items: center;
      padding: 32px;
      border: 1px dashed #a9c4ed;
      border-radius: 16px;
      background: rgba(244, 248, 255, 0.8);
      text-align: center;
    }

    .impact-empty-mark {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      margin: 0 auto 18px;
      border: 1px solid #9ebce8;
      border-radius: 18px 7px 18px 7px;
      background: #0b4fc5;
      color: white;
      font: 700 17px/1 "Cascadia Code", Consolas, monospace;
      box-shadow: 7px 7px 0 #d9e7fb;
    }

    .impact-empty h2 { margin: 0; color: var(--impact-ink); font-size: 22px; }
    .impact-empty p { max-width: 560px; margin: 11px auto 0; color: #637890; line-height: 1.65; }
    .impact-empty-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    .impact-empty-actions button.primary { background: var(--impact-blue); border-color: var(--impact-blue); }
    .impact-empty-hint { display: block; margin-top: 12px; color: #6b7f98; font-size: 12px; }
    .impact-queue-empty strong { display: block; margin-bottom: 8px; color: #173a67; }
    .impact-queue-empty span { display: block; line-height: 1.55; }

    .impact-onboarding-flow {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }

    .impact-onboarding-flow article {
      position: relative;
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 12px;
      min-height: 94px;
      padding: 16px;
      overflow: hidden;
      border: 1px solid #c8d9f3;
      border-radius: 12px 4px 12px 4px;
      background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(239,246,255,.92));
      box-shadow: 0 10px 28px rgba(27, 76, 145, .06);
    }

    .impact-onboarding-flow article::after {
      content: "";
      position: absolute;
      right: -18px;
      bottom: -24px;
      width: 70px;
      height: 70px;
      border: 1px solid rgba(13, 92, 229, .12);
      border-radius: 50%;
    }

    .impact-onboarding-flow article > span {
      color: #0d5ce5;
      font: 700 12px/1.2 "Cascadia Code", Consolas, monospace;
      letter-spacing: .08em;
    }

    .impact-onboarding-flow strong { color: #102f57; font-size: 13px; }
    .impact-onboarding-flow p { margin: 7px 0 0; color: #627791; font-size: 11px; line-height: 1.55; }

    .impact-connection-guide {
      display: grid;
      gap: 14px;
      margin-top: 12px;
      padding: 22px;
      border: 1px solid #9fbce8;
      border-radius: 5px 18px 5px 5px;
      background:
        linear-gradient(rgba(13, 92, 229, .045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(13, 92, 229, .045) 1px, transparent 1px),
        #f8fbff;
      background-size: 24px 24px;
    }

    .impact-connection-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
    }

    .impact-connection-head span:first-child { color: #0d5ce5; font: 700 10px/1.2 "Cascadia Code", Consolas, monospace; letter-spacing: .12em; }
    .impact-connection-head h3 { margin: 5px 0 0; color: #0b2e5a; font-size: 18px; }
    .impact-connection-guide > p { max-width: 720px; margin: 0; color: #526b88; font-size: 12px; line-height: 1.65; }

    .impact-auto-setup {
      display: grid;
      gap: 13px;
      padding: 16px;
      border: 1px solid #8db4ee;
      border-radius: 4px 14px 4px 4px;
      background: linear-gradient(145deg, rgba(232,242,255,.96), rgba(255,255,255,.96));
      box-shadow: inset 3px 0 #0d5ce5;
    }

    .impact-auto-setup h4 { margin: 0; color: #0b2e5a; font-size: 14px; }
    .impact-auto-setup p { margin: 5px 0 0; color: #526b88; font-size: 11px; line-height: 1.6; }
    .impact-auto-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .impact-auto-grid article {
      display: grid;
      gap: 7px;
      min-width: 0;
      padding: 12px;
      border: 1px solid #c5d8f4;
      border-radius: 7px;
      background: rgba(255,255,255,.88);
    }
    .impact-auto-grid strong { color: #123b6c; font-size: 12px; }
    .impact-auto-grid span { color: #6b7f97; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
    .impact-auto-grid code {
      display: block;
      overflow-wrap: anywhere;
      padding: 8px 9px;
      border: 1px solid #d8e5f7;
      border-radius: 4px;
      background: #f7fbff;
      color: #0b4ca3;
      font-size: 10px;
      line-height: 1.45;
    }
    .impact-auto-foot { margin: 0 !important; padding-top: 2px; border-top: 1px dashed #b8ceee; }
    .impact-manual-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #526b88; font-size: 11px; }

    .impact-agent-prompt {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 9px 12px;
      align-items: center;
      padding: 14px;
      border: 1px solid #bed2f1;
      border-left: 3px solid #0d5ce5;
      border-radius: 8px;
      background: rgba(255,255,255,.94);
    }

    .impact-agent-prompt > span { grid-column: 1 / -1; color: #5c7089; font-size: 10px; text-transform: uppercase; letter-spacing: .07em; }
    .impact-agent-prompt code { color: #123b6c; white-space: normal; line-height: 1.6; }
    .impact-agent-prompt small { grid-column: 1 / -1; min-height: 1.2em; color: #176443; }

    .impact-demo-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 16px;
      padding: 15px 16px;
      border: 1px solid #e3bf74;
      border-radius: 5px 14px 5px 5px;
      background: linear-gradient(135deg, #fff7df, #fffdf7);
    }

    .impact-demo-banner span { display: block; color: #9a6710; font: 700 10px/1.2 "Cascadia Code", Consolas, monospace; text-transform: uppercase; letter-spacing: .08em; }
    .impact-demo-banner strong { display: block; margin-top: 4px; color: #654208; }
    .impact-demo-banner p { margin: 4px 0 0; color: #795f31; font-size: 11px; line-height: 1.5; }
    .impact-demo-row { border-style: dashed; background: linear-gradient(145deg, #fffaf0, #f9fbff); }

    .impact-run-row { border-color: #d2e0f5; background: #f9fbff; }
    .impact-run-row.active { border-color: #75a5eb; box-shadow: inset 3px 0 #0d5ce5, 0 8px 28px rgba(26, 84, 170, 0.1); }
    .impact-run-id { color: #0c2a50; font-family: "Cascadia Code", Consolas, monospace; font-size: 12px; }

    .impact-run-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: start;
      margin-bottom: 13px;
    }

    .impact-run-head h2 {
      margin: 4px 0 0;
      color: var(--impact-ink);
      font: 650 clamp(22px, 3vw, 34px)/1.1 "Aptos Display", "Segoe UI Variable Display", sans-serif;
      letter-spacing: -0.035em;
      overflow-wrap: anywhere;
    }

    .impact-run-meta {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 18px;
    }

    .impact-run-meta .metric { min-height: 68px; border-color: var(--impact-line); background: white; }
    .impact-run-meta .metric-value {
      font-size: clamp(16px, 1.45vw, 21px);
      line-height: 1.12;
      overflow-wrap: anywhere;
    }

    .impact-timeline {
      position: relative;
      display: grid;
      gap: 6px;
      margin-top: 12px;
      padding-left: 26px;
    }

    .impact-timeline::before {
      content: "";
      position: absolute;
      top: 9px;
      bottom: 9px;
      left: 8px;
      width: 1px;
      background: linear-gradient(#0d5ce5, #bfd3f2);
    }

    .impact-event {
      position: relative;
      border: 1px solid var(--impact-line);
      border-left: 3px solid var(--impact-blue);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.92);
    }

    .impact-event.human_label, .impact-event.human_label::before { border-color: #d88713; }
    .impact-event.derived_inference, .impact-event.derived_inference::before { border-color: #6f63d9; }
    .impact-event.controlled_eval, .impact-event.controlled_eval::before { border-color: #16855a; }

    .impact-event::before {
      content: "";
      position: absolute;
      left: -23px;
      top: 13px;
      width: 9px;
      height: 9px;
      border: 2px solid #f7faff;
      border-radius: 50%;
      background: var(--impact-blue);
      box-shadow: 0 0 0 1px #6f9ee6;
    }

    .impact-event.human_label::before { background: #d88713; }
    .impact-event.derived_inference::before { background: #6f63d9; }
    .impact-event.controlled_eval::before { background: #16855a; }

    .impact-event summary {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      cursor: pointer;
      list-style: none;
      user-select: none;
    }

    .impact-event summary::-webkit-details-marker { display: none; }

    .impact-event summary::after {
      content: "";
      flex: none;
      width: 7px;
      height: 7px;
      border-right: 1.5px solid #8fa6c4;
      border-bottom: 1.5px solid #8fa6c4;
      transform: rotate(-45deg);
      transition: transform 0.15s ease;
    }

    .impact-event[open] summary::after { transform: rotate(45deg); }
    .impact-event[open] summary { border-bottom: 1px dashed var(--impact-line); }

    .impact-event-marker {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 21px;
      height: 21px;
      border-radius: 6px;
      background: #e9f1ff;
      color: #0d5ce5;
    }

    .impact-event.cat-search .impact-event-marker { color: #0d5ce5; background: #e9f1ff; }
    .impact-event.cat-expose .impact-event-marker { color: #2f6ad0; background: #eef4ff; }
    .impact-event.cat-validate .impact-event-marker { color: #16855a; background: #e9f8f1; }
    .impact-event.cat-feedback .impact-event-marker { color: #b06f0a; background: #fdf3e2; }
    .impact-event.cat-run .impact-event-marker { color: #061a36; background: #e8eef7; }
    .impact-event.cat-learning .impact-event-marker,
    .impact-event.cat-candidate .impact-event-marker { color: #6f63d9; background: #f1efff; }
    .impact-event.cat-share .impact-event-marker,
    .impact-event.cat-eval .impact-event-marker,
    .impact-event.cat-other .impact-event-marker { color: #526b88; background: #eef2f8; }

    .impact-event-title { flex: none; color: var(--impact-ink); font-weight: 650; font-size: 12.5px; white-space: nowrap; }

    .impact-event-key {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #526b88;
      font: 10.5px/1.4 "Cascadia Code", Consolas, monospace;
    }

    .impact-event summary time { flex: none; margin-left: auto; color: #72849b; font: 10px/1.4 "Cascadia Code", Consolas, monospace; white-space: nowrap; }
    .impact-event summary .pill { flex: none; }

    .impact-event-body { padding: 10px 14px 12px 43px; }

    .impact-event-sensitivity { display: block; margin-top: 8px; }

    .impact-facts { display: flex; flex-wrap: wrap; gap: 6px; }
    .impact-fact { padding: 6px 8px; border: 1px solid #d7e3f5; border-radius: 6px; background: #f5f8fd; color: #4d6380; font-size: 11px; }
    .impact-fact strong { color: #12355f; font-weight: 700; }

    .impact-trap-link {
      display: inline;
      padding: 0 2px;
      border: 0;
      border-radius: 4px;
      background: none;
      color: #0d5ce5;
      font: inherit;
      font-weight: 700;
      text-decoration: underline dotted;
      box-shadow: none;
    }

    .impact-trap-link:hover { background: #e9f1ff; color: #0b3fa8; border: 0; }

    .impact-gantt { margin: 12px 0 4px; }

    .impact-gantt-track {
      position: relative;
      display: block;
      height: 24px;
      border: 1px solid var(--impact-line);
      border-radius: 7px;
      background: linear-gradient(90deg, rgba(13, 92, 229, 0.06), rgba(13, 92, 229, 0.02));
      overflow: hidden;
    }

    .impact-gantt-hit {
      position: absolute;
      top: 4px;
      bottom: 4px;
      min-width: 7px;
      padding: 0;
      border: 0;
      border-radius: 3px;
      background: var(--impact-blue);
      opacity: 0.82;
      box-shadow: none;
    }

    .impact-gantt-hit:hover { opacity: 1; border: 0; }
    .impact-gantt-hit.cat-expose { background: #3f7ae0; }
    .impact-gantt-hit.cat-validate { background: #16855a; }
    .impact-gantt-hit.cat-feedback { background: #d88713; }
    .impact-gantt-hit.cat-run { background: #061a36; }
    .impact-gantt-hit.cat-learning,
    .impact-gantt-hit.cat-candidate { background: #6f63d9; }
    .impact-gantt-hit.cat-share,
    .impact-gantt-hit.cat-eval,
    .impact-gantt-hit.cat-other { background: #526b88; }

    .impact-event-filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 4px; }
    .impact-event-filters button {
      min-height: 24px;
      padding: 3px 11px;
      border: 1px solid var(--impact-line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.85);
      color: #45688f;
      box-shadow: none;
      font-size: 11px;
    }
    .impact-event-filters button:hover { background: #eef4ff; border-color: #9dbdea; }
    .impact-event-filters button.active { background: var(--impact-ink); border-color: var(--impact-ink); color: #fff; }

    .impact-state { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #4d6380; }
    .impact-state i { position: relative; width: 12px; height: 12px; border-radius: 50%; flex: none; }
    .impact-state i::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: currentColor; opacity: 0.14; }
    .impact-state i::after { content: ""; position: absolute; inset: 22%; border-radius: 50%; background: currentColor; }
    .impact-state.done { color: #16855a; }
    .impact-state.error { color: #b42318; }
    .impact-state.idle { color: #8b968e; }
    .impact-state.ongoing { color: #0d5ce5; }
    .impact-state.ongoing i::after { animation: impact-dot-pulse 1.2s ease-in-out infinite; }

    @keyframes impact-dot-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.7); }
    }

    .impact-flash { animation: impact-flash 1.6s ease both; }

    @keyframes impact-flash {
      0%, 55% { box-shadow: 0 0 0 2px rgba(13, 92, 229, 0.4); }
      100% { box-shadow: 0 0 0 2px rgba(13, 92, 229, 0); }
    }

    .evals-shell {
      background:
        radial-gradient(circle at 85% 8%, rgba(38, 113, 232, 0.11), transparent 24%),
        linear-gradient(rgba(20, 94, 210, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20, 94, 210, 0.035) 1px, transparent 1px),
        #f6f9ff;
      background-size: auto, 24px 24px, 24px 24px, auto;
    }

    .evals-hero {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(110px, 150px);
      gap: clamp(16px, 2vw, 28px);
      align-items: center;
      min-height: 228px;
      padding: clamp(24px, 3vw, 40px);
      border: 1px solid #082757;
      border-radius: 5px 24px 5px 5px;
      background:
        linear-gradient(90deg, rgba(91, 154, 255, 0.08) 1px, transparent 1px),
        linear-gradient(rgba(91, 154, 255, 0.08) 1px, transparent 1px),
        linear-gradient(132deg, #041226 0%, #082b5d 67%, #0c62e9 145%);
      background-size: 34px 34px, 34px 34px, auto;
      color: #eef6ff;
      box-shadow: 0 24px 62px rgba(4, 34, 79, 0.2);
    }

    .evals-hero::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 64%;
      width: 1px;
      background: linear-gradient(transparent, rgba(123, 176, 255, 0.5), transparent);
      transform: rotate(18deg);
    }

    .evals-hero h2 {
      max-width: 720px;
      margin: 0;
      font-family: "Aptos Display", "Segoe UI Variable Display", "Microsoft YaHei UI", sans-serif;
      font-size: clamp(28px, 3.2vw, 46px);
      font-weight: 650;
      letter-spacing: -0.035em;
      line-height: 1.02;
    }

    .evals-hero p {
      max-width: 710px;
      margin: 18px 0 0;
      color: #bcd3f1;
      font-size: 13px;
      line-height: 1.7;
    }

    .evals-verdict {
      position: relative;
      z-index: 1;
      display: grid;
      justify-items: end;
      padding: 18px 0 18px 18px;
      border-left: 1px solid rgba(141, 187, 255, 0.35);
      text-align: right;
    }

    .evals-verdict span,
    .evals-verdict small {
      color: #99bce9;
      font: 700 9px/1.3 "Cascadia Code", Consolas, monospace;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .evals-verdict strong {
      margin: 7px 0 3px;
      color: white;
      font: 650 68px/0.85 "Aptos Display", "Segoe UI Variable Display", sans-serif;
      letter-spacing: -0.06em;
    }

    .evals-lanes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1px;
      margin: 12px 0;
      border: 1px solid #bed1ef;
      background: #bed1ef;
    }

    .eval-lane {
      position: relative;
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 8px;
      gap: 10px;
      min-height: 98px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.94);
    }

    .eval-lane > span {
      color: #7c96b6;
      font: 700 11px/1 "Cascadia Code", Consolas, monospace;
    }

    .eval-lane strong { color: #082753; font-size: 13px; }
    .eval-lane p { margin: 7px 0 0; color: #627893; font-size: 10px; line-height: 1.5; }
    .eval-lane i { align-self: start; width: 7px; height: 7px; border-radius: 50%; background: #95abc7; box-shadow: 0 0 0 4px rgba(111, 139, 176, 0.12); }
    .eval-lane.ready i { background: #1768e6; box-shadow: 0 0 0 4px rgba(23, 104, 230, 0.13); }
    .eval-lane.review i { background: #da8b13; box-shadow: 0 0 0 4px rgba(218, 139, 19, 0.14); }
    .eval-lane.clear i { background: #16855a; box-shadow: 0 0 0 4px rgba(22, 133, 90, 0.13); }

    .evals-section {
      margin-top: 12px;
      padding: clamp(16px, 2vw, 24px);
      border: 1px solid #c5d7f2;
      border-radius: 4px 15px 4px 4px;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 12px 32px rgba(15, 64, 137, 0.055);
    }

    .evals-section-head {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .evals-section-head > div > span,
    .eval-source {
      color: #758ca9;
      font: 700 9px/1.35 "Cascadia Code", Consolas, monospace;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .evals-section-head h3 { margin: 5px 0 0; color: #071f41; font-size: 17px; letter-spacing: -0.02em; }
    .eval-source { margin: 13px 0 0; text-transform: none; letter-spacing: 0; }
    .evals-section code { display: inline-block; margin-top: 12px; padding: 7px 9px; border: 1px solid #c9d8ed; background: #f3f7fd; color: #184778; }

    .controlled-eval-bench {
      overflow: hidden;
      border: 1px solid #8eb7ef;
      border-radius: 3px 18px 3px 3px;
      background:
        linear-gradient(90deg, rgba(23, 104, 230, .045) 1px, transparent 1px),
        linear-gradient(rgba(23, 104, 230, .045) 1px, transparent 1px),
        #fbfdff;
      background-size: 20px 20px;
      box-shadow: 0 18px 44px rgba(10, 61, 131, .1);
    }
    .controlled-blueprint {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 86px minmax(0, 1fr);
      align-items: center;
      min-height: 34px;
      padding: 0 18px;
      background: #061d40;
      color: #9fc6ff;
      font: 700 9px/1 "Cascadia Code", Consolas, monospace;
      letter-spacing: .14em;
    }
    .controlled-blueprint span:last-child { text-align: right; }
    .controlled-blueprint i { position: relative; height: 1px; background: #4a8cf0; }
    .controlled-blueprint i::after { content: "→"; position: absolute; top: 50%; left: 50%; padding: 0 7px; background: #061d40; color: #fff; transform: translate(-50%, -53%); font-style: normal; }
    .controlled-run-form {
      display: grid;
      grid-template-columns: minmax(190px, 1.4fr) 110px minmax(150px, 1fr);
      gap: 10px;
      align-items: end;
      padding: 18px;
      border-bottom: 1px solid #d2e0f4;
      background: rgba(246, 250, 255, .92);
    }
    .controlled-run-copy { grid-column: 1 / -1; align-self: center; min-width: 0; }
    .controlled-run-copy > span { color: #1768e6; font: 700 9px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .1em; }
    .controlled-run-copy strong { display: block; margin-top: 6px; color: #082753; font-size: 14px; }
    .controlled-run-copy p { margin: 5px 0 0; color: #637b98; font-size: 10px; line-height: 1.5; }
    .controlled-run-form .eval-field { gap: 5px; }
    .controlled-run-form .eval-field input,
    .controlled-run-form .eval-field select,
    .controlled-history select { width: 100%; min-width: 0; border-color: #aec8eb; background: #fff; color: #082753; font: 11px/1.4 "Cascadia Code", Consolas, monospace; }
    .controlled-run-button { grid-column: 1 / -1; justify-self: start; min-height: 42px; white-space: nowrap; }
    .controlled-guardrails { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; }
    .controlled-guardrails span { padding: 5px 8px; border: 1px solid #bcd2f1; background: #fff; color: #3d638f; font: 700 9px/1.2 "Cascadia Code", Consolas, monospace; }
    .controlled-history-row { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 12px 18px; border-bottom: 1px solid #dce6f5; background: rgba(255,255,255,.9); }
    .controlled-history { display: flex; align-items: center; gap: 9px; color: #4d6888; font-size: 10px; }
    .controlled-history select { max-width: 280px; }
    .controlled-history-row small, .controlled-no-history { color: #7186a0; font-size: 9px; line-height: 1.45; }
    .controlled-eval-error { margin: 14px 18px 0; }
    .controlled-empty { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 18px; align-items: center; padding: 28px 22px 32px; }
    .controlled-empty > span { width: 54px; height: 54px; display: grid; place-items: center; border: 1px solid #78a8eb; border-radius: 50%; background: #eef5ff; color: #0d5ce5; font: 650 26px/1 "Aptos Display", "Segoe UI Variable Display", sans-serif; }
    .controlled-empty strong { color: #0b2c56; font-size: 15px; }
    .controlled-empty p { margin: 7px 0 0; color: #6c829b; font-size: 11px; line-height: 1.6; }
    .controlled-result { background: rgba(255,255,255,.94); }
    .controlled-result-head { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 17px 18px; border-bottom: 1px solid #d7e3f3; }
    .controlled-result.clear .controlled-result-head { background: linear-gradient(90deg, #effbf6, #f8fcff 56%); }
    .controlled-result.has-regression .controlled-result-head { background: linear-gradient(90deg, #fff0f0, #fffaf8 56%); }
    .controlled-verdict-mark { display: flex; gap: 11px; align-items: center; }
    .controlled-verdict-mark > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #16855a; color: #fff; font-weight: 800; }
    .has-regression .controlled-verdict-mark > span { background: #be4141; }
    .controlled-verdict-mark small { display: block; color: #66809e; font: 700 8px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .11em; }
    .controlled-verdict-mark strong { display: block; margin-top: 4px; color: #092b52; font-size: 14px; }
    .controlled-result-facts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
    .controlled-result-facts span { padding: 6px 8px; border: 1px solid #cdddf1; background: rgba(255,255,255,.8); color: #526e8f; font-size: 9px; }
    .controlled-sides { display: grid; grid-template-columns: minmax(0, 1fr) 90px minmax(0, 1fr); gap: 0; align-items: stretch; padding: 18px; }
    .controlled-side { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 16px; border: 1px solid #cadaf0; background: linear-gradient(145deg, #f7faff, #fff); }
    .controlled-side.candidate { border-color: #71a6ef; box-shadow: inset 4px 0 #1768e6; }
    .controlled-side > span, .controlled-side h4, .controlled-side footer { grid-column: 1 / -1; }
    .controlled-side > span { color: #6f89a8; font: 700 8px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .12em; text-transform: uppercase; }
    .controlled-side h4 { margin: 0 0 5px; color: #092b52; font-size: 13px; }
    .controlled-side > div { min-width: 0; padding: 8px; border-top: 1px solid #d8e5f6; }
    .controlled-side b { display: block; color: #082753; font: 700 18px/1 "Cascadia Code", Consolas, monospace; }
    .controlled-side small { display: block; margin-top: 6px; color: #7188a4; font-size: 8px; }
    .controlled-side footer { color: #597493; font-size: 9px; }
    .controlled-delta { align-self: center; display: grid; justify-items: center; gap: 5px; color: #5c7695; text-align: center; }
    .controlled-delta span { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid #9dbce8; border-radius: 50%; color: #1768e6; }
    .controlled-delta strong { color: #123c6b; font: 700 10px/1.2 "Cascadia Code", Consolas, monospace; }
    .controlled-delta small { font-size: 8px; }
    .controlled-summary-strip, .controlled-audit { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 18px 10px; }
    .controlled-summary-strip span { padding: 7px 9px; border: 1px solid #d2e0f2; background: #f6f9fd; color: #57708e; font-size: 9px; }
    .controlled-summary-strip .regressed { border-color: #efb5b5; background: #fff4f4; color: #a13d3d; }
    .controlled-summary-strip .improved { border-color: #a9d8c4; background: #f0faf5; color: #176c4e; }
    .controlled-audit { padding: 9px 0 13px; border-bottom: 1px dashed #cddced; color: #7085a0; font: 9px/1.4 "Cascadia Code", Consolas, monospace; }
    .controlled-audit code { margin: 0; padding: 4px 6px; font-size: 8px; }
    .controlled-cases-head { display: flex; justify-content: space-between; gap: 14px; align-items: end; padding: 10px 18px 12px; }
    .controlled-cases-head > div:first-child span { display: block; color: #1768e6; font: 700 8px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .1em; }
    .controlled-cases-head > div:first-child strong { display: block; margin-top: 5px; color: #153a66; font-size: 12px; }
    .controlled-case-filters { margin: 0; }
    .controlled-case-list { display: grid; gap: 8px; max-height: 620px; overflow: auto; padding: 0 18px 20px; scrollbar-gutter: stable; }
    .controlled-case-list:focus { outline: 2px solid rgba(23, 104, 230, .28); outline-offset: -2px; }
    .controlled-case { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 12px; padding: 13px; border: 1px solid #d0deef; border-left: 4px solid #8ba5c4; background: #fff; }
    .controlled-case.regressed { border-left-color: #c44040; background: linear-gradient(90deg, #fff6f6, #fff 42%); }
    .controlled-case.improved { border-left-color: #16855a; background: linear-gradient(90deg, #f3fbf7, #fff 42%); }
    .controlled-case.changed { border-left-color: #d98b16; }
    .controlled-case-index { display: grid; align-content: start; gap: 8px; }
    .controlled-case-index span { color: #486887; font: 700 8px/1.3 "Cascadia Code", Consolas, monospace; }
    .controlled-case-index b { color: #8aa0bb; font: 700 11px/1 "Cascadia Code", Consolas, monospace; }
    .controlled-case-main { min-width: 0; }
    .controlled-case-main h4 { margin: 0; overflow-wrap: anywhere; color: #092d57; font: 700 11px/1.45 "Cascadia Code", Consolas, "Microsoft YaHei UI", monospace; }
    .controlled-case-main > p { margin: 5px 0 9px; color: #7388a1; font-size: 9px; }
    .controlled-case-compare { display: grid; grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1fr); gap: 7px; align-items: center; }
    .controlled-case-compare > span { min-width: 0; padding: 8px; border: 1px solid #d8e4f3; background: #f8faff; }
    .controlled-case-compare i { color: #6c86a5; font: 700 8px/1.2 "Cascadia Code", Consolas, monospace; font-style: normal; }
    .controlled-case-compare b { display: block; margin-top: 4px; color: #123d6d; font: 700 10px/1 "Cascadia Code", Consolas, monospace; }
    .controlled-case-compare small { display: block; margin-top: 5px; overflow: hidden; color: #71849b; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
    .controlled-case-compare em { color: #3b7edc; font-style: normal; text-align: center; }
    .controlled-case > footer { grid-column: 2; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: #778ba3; font-size: 8px; }
    .controlled-case > footer code { margin: 0; padding: 4px 6px; font-size: 8px; }

    .eval-metric-grid,
    .eval-rate-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .eval-score {
      min-height: 116px;
      display: grid;
      align-content: space-between;
      padding: 14px;
      border: 1px solid #d2e0f4;
      border-top: 2px solid #1768e6;
      background: linear-gradient(155deg, #fbfdff, #f1f6fe);
    }

    .eval-score > span { color: #4f6d91; font: 700 10px/1 "Cascadia Code", Consolas, monospace; }
    .eval-score > strong { color: #071f41; font: 650 clamp(28px, 3.4vw, 42px)/1 "Aptos Display", "Segoe UI Variable Display", sans-serif; letter-spacing: -0.055em; }
    .eval-score > small { color: #758ba5; font-size: 10px; }

    .eval-rate {
      min-height: 118px;
      display: grid;
      grid-template-columns: 62px minmax(0, 1fr);
      gap: 13px;
      align-items: center;
      padding: 13px;
      border: 1px solid #d2e0f4;
      background: #fbfdff;
    }

    .eval-rate-dial {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: radial-gradient(circle at center, #fbfdff 58%, transparent 60%), conic-gradient(#1768e6 calc(var(--rate) * 1turn), #dbe7f7 0);
    }

    .eval-rate-dial strong { color: #082753; font: 700 14px/1 "Cascadia Code", Consolas, monospace; }
    .eval-rate > div:last-child { min-width: 0; }
    .eval-rate span { display: block; color: #153e6f; font-size: 11px; font-weight: 700; }
    .eval-rate small { display: block; margin-top: 7px; color: #7388a2; font-size: 9px; line-height: 1.35; }

    .eval-observed-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }

    .eval-observed-strip span {
      padding: 7px 9px;
      border: 1px solid #d3e0f2;
      background: #f5f8fd;
      color: #536b89;
      font-size: 10px;
    }

    .eval-observed-strip span.warn { border-color: #ebce97; background: #fff9ed; color: #765716; }

    .eval-filters { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
    .eval-filters button { min-height: 29px; border-color: #bfd2ef; background: #f7faff; color: #45688f; box-shadow: none; font-size: 10px; }
    .eval-filters button.active { border-color: #0d5ce5; background: #0d5ce5; color: white; }

    .eval-candidate-list { display: grid; gap: 7px; }
    .eval-candidate {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 13px;
      border: 1px solid #d0dff3;
      background: linear-gradient(90deg, #f7faff, white 44%);
    }

    .eval-candidate-index { color: #7390b3; font: 700 10px/1 "Cascadia Code", Consolas, monospace; }
    .eval-candidate h4 { margin: 7px 0 0; color: #0b2a50; font: 700 12px/1.3 "Cascadia Code", Consolas, monospace; overflow-wrap: anywhere; }
    .eval-candidate p { margin: 6px 0 0; color: #677d96; font-size: 10px; }
    .eval-candidate button { min-height: 30px; font-size: 10px; }
    .evals-inline-empty { padding: 24px; border: 1px dashed #b9cdeb; background: #f7faff; color: #617a98; text-align: center; font-size: 11px; line-height: 1.6; }

    .eval-queue-row { border-left: 3px solid #d88b14; background: #fbfdff; }
    .eval-queue-row > strong { color: #12365f; font: 700 11px/1.4 "Cascadia Code", Consolas, monospace; overflow-wrap: anywhere; }
    .eval-reason-code { color: #96610e; font: 700 9px/1.4 "Cascadia Code", Consolas, monospace; text-transform: uppercase; }

    .eval-candidate.selected {
      border-color: #4c8ff4;
      box-shadow: 0 0 0 2px rgba(13, 92, 229, 0.09);
      background: linear-gradient(100deg, #f2f7ff, #ffffff 72%);
    }
    .eval-candidate-actions { display: grid; gap: 5px; justify-items: stretch; }
    .eval-candidate-actions button { white-space: nowrap; }
    .eval-review-intro { margin-top: 12px; }
    .eval-review-workbench {
      margin-top: 14px;
      overflow: hidden;
      border: 1px solid #8eb8f5;
      border-radius: 4px 18px 4px 4px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 18px 45px rgba(19, 69, 137, 0.12);
    }
    .eval-review-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: start;
      padding: 18px 20px;
      border-bottom: 1px solid #c8daf4;
      background: linear-gradient(115deg, #082a59, #0d5ce5 62%, #438cff);
      color: white;
    }
    .eval-review-head h3 { margin: 5px 0 6px; font-size: 18px; letter-spacing: -0.02em; }
    .eval-review-head p { max-width: 720px; margin: 0; color: #dceaff; font-size: 11px; line-height: 1.55; }
    .eval-review-head button { border-color: rgba(255,255,255,.32); background: rgba(255,255,255,.08); color: white; font-size: 19px; }
    .eval-review-step { color: #a9cbff; font: 700 9px/1.2 "Cascadia Code", Consolas, monospace; letter-spacing: .1em; overflow-wrap: anywhere; }
    .eval-external-update { margin: 14px 20px 0; padding: 12px 14px; }
    .eval-external-update[hidden] { display: none; }
    .eval-external-update strong { color: #77500b; font-size: 12px; }
    .eval-external-update p { margin-top: 4px; }
    .eval-review-flow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-bottom: 1px solid #dce7f7;
      background: #f4f8ff;
      color: #7590b0;
      font: 700 9px/1.3 "Cascadia Code", Consolas, monospace;
      text-align: center;
      text-transform: uppercase;
    }
    .eval-review-flow span { padding: 7px; border: 1px solid #cbdaf0; background: #fff; }
    .eval-review-flow span.done { border-color: #8db8f6; color: #145bbb; }
    .eval-review-flow span.active { border-color: #df9c2c; background: #fff8e9; color: #81510a; box-shadow: inset 3px 0 #df9c2c; }
    .eval-review-flow i { color: #8ba8cb; font-style: normal; }
    .eval-review-form { display: grid; gap: 14px; padding: 18px 20px 20px; }
    .eval-field { display: grid; gap: 6px; min-width: 0; color: #153d6d; font-size: 11px; font-weight: 700; }
    .eval-field small { color: #7186a0; font-size: 10px; font-weight: 400; line-height: 1.5; }
    .eval-field textarea, .eval-field input, .eval-field select {
      width: 100%;
      min-width: 0;
      border-color: #aec8eb;
      background: #fbfdff;
      color: #082753;
      font: 12px/1.55 "Cascadia Code", Consolas, "Microsoft YaHei UI", monospace;
    }
    .eval-field textarea:focus, .eval-field input:focus, .eval-field select:focus { border-color: #1768e6; box-shadow: 0 0 0 3px rgba(23, 104, 230, .1); outline: 0; }
    .eval-review-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .eval-trap-picker { min-width: 0; margin: 0; padding: 13px; border: 1px solid #c6d8f1; background: #f8fbff; }
    .eval-trap-picker legend { padding: 0 6px; color: #153d6d; font-size: 11px; font-weight: 700; }
    .eval-trap-picker > p { margin: 0 0 10px; color: #7186a0; font-size: 10px; line-height: 1.5; }
    .eval-trap-picker > div { display: grid; gap: 6px; }
    .eval-trap-option { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 9px; align-items: start; padding: 9px; border: 1px solid #d4e1f3; background: #fff; color: #294d77; cursor: pointer; font-size: 11px; }
    .eval-trap-option:has(input:checked) { border-color: #3380ec; background: #eef5ff; box-shadow: inset 3px 0 #1768e6; }
    .eval-trap-option input { margin-top: 2px; accent-color: #0d5ce5; }
    .eval-trap-option span { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; line-height: 1.4; }
    .eval-trap-option b { color: #0d5ce5; font-family: "Cascadia Code", Consolas, monospace; }
    .eval-reject-field { padding-top: 12px; border-top: 1px dashed #d3dfef; }
    .eval-preview { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 5px 12px; padding: 13px; border: 1px solid #87b2ef; background: #edf5ff; color: #103e78; }
    .eval-preview > span { color: #1768e6; font: 700 9px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .09em; }
    .eval-preview strong { font-size: 13px; }
    .eval-preview code, .eval-preview small { grid-column: 1 / -1; color: #5e7898; font-size: 10px; }
    .eval-review-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding-top: 2px; }
    .eval-review-actions > span { flex: 1 1 220px; color: #7186a0; font-size: 10px; line-height: 1.4; }
    .eval-review-actions .danger-text { color: #a43b3b; }
    .eval-review-error { margin: 14px 20px 0; }
    .eval-review-decision { display: grid; gap: 7px; margin: 18px 20px; padding: 16px; border-left: 4px solid #16855a; background: #f1fbf7; }
    .eval-review-decision.rejected { border-left-color: #bd4d4d; background: #fff7f7; }
    .eval-review-decision > span { color: #16855a; font: 700 9px/1.2 "Cascadia Code", Consolas, monospace; letter-spacing: .09em; }
    .eval-review-decision.rejected > span { color: #a43b3b; }
    .eval-review-decision > strong { color: #0c355f; font-size: 15px; }
    .eval-review-decision > p { margin: 0; color: #617b96; font-size: 11px; line-height: 1.55; }
    .eval-review-workbench > .eval-review-actions { padding: 0 20px 20px; }
    .eval-case-summary { display: grid; gap: 8px; margin: 8px 0 0; }
    .eval-case-summary > div { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; padding-top: 8px; border-top: 1px solid rgba(22, 133, 90, .17); }
    .eval-case-summary dt { color: #648098; font-size: 10px; }
    .eval-case-summary dd { margin: 0; overflow-wrap: anywhere; color: #123c66; font: 11px/1.5 "Cascadia Code", Consolas, monospace; }

    @keyframes impact-rise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .impact-metric { animation: none; }
      .impact-state.ongoing i::after { animation: none; }
      .impact-flash { animation: none; }
      .impact-event summary::after { transition: none; }
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
        grid-template-columns: repeat(5, minmax(68px, 1fr));
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
      .impact-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .impact-grid { grid-template-columns: 1fr; }
      .eval-metric-grid, .eval-rate-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .evals-lanes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .controlled-run-form { grid-template-columns: minmax(220px, 1.4fr) minmax(160px, 1fr) 110px; }
      .controlled-seed { grid-column: 1 / 3; }
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
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: 100%;
      }
      .controlled-run-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .controlled-run-copy, .controlled-guardrails { grid-column: 1 / -1; }
      .controlled-seed { grid-column: auto; }
      .controlled-sides { grid-template-columns: 1fr; gap: 8px; }
      .controlled-delta { grid-template-columns: auto auto auto; justify-content: center; }
      .controlled-result-head, .controlled-history-row, .controlled-cases-head { align-items: stretch; flex-direction: column; }
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
      .filter-grid, .summary-grid, .detail-kv, .provider-fields, .form-grid, .insight-form-grid, .learning-agent-form { grid-template-columns: 1fr; }
      .learning-agent-form label.full { grid-column: 1; }
      .learning-controls { grid-template-columns: 1fr; }
      .learning-controls .learning-scope,
      .learning-controls #learning-search { grid-column: 1; }
      .learning-actions { align-items: stretch; }
      .learning-navigation { width: 100%; }
      .learning-navigation button { flex: 1; }
      .project-form { grid-template-columns: 1fr auto; }
      .impact-shell { padding: 10px; }
      .impact-hero { min-height: auto; padding: 22px; border-radius: 12px; }
      .impact-hero-grid { grid-template-columns: 1fr; gap: 20px; }
      .impact-local-badge { justify-self: start; }
      .impact-hero-side { justify-items: start; }
      .impact-stats-strip { font-size: 11px; }
      .impact-stats-strip span { padding: 0 9px; }
      .impact-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .impact-run-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .impact-event-key { white-space: normal; }
      .impact-event summary { flex-wrap: wrap; row-gap: 4px; }
      .impact-event summary .pill { order: 5; }
      .impact-gantt-hit { min-width: 9px; }
      .impact-onboarding-flow { grid-template-columns: 1fr; }
      .impact-connection-head, .impact-demo-banner { align-items: stretch; flex-direction: column; }
      .impact-auto-grid { grid-template-columns: 1fr; }
      .impact-manual-label { align-items: flex-start; flex-direction: column; }
      .impact-agent-prompt { grid-template-columns: 1fr; }
      .impact-agent-prompt button { justify-self: start; }
      .evals-hero { grid-template-columns: 1fr; gap: 20px; border-radius: 5px 16px 5px 5px; }
      .evals-verdict { justify-items: start; border-left: 0; border-top: 1px solid rgba(141, 187, 255, 0.35); padding: 16px 0 0; text-align: left; }
      .evals-verdict strong { font-size: 50px; }
      .evals-lanes { grid-template-columns: 1fr; }
      .controlled-run-form { grid-template-columns: 1fr; }
      .controlled-run-copy, .controlled-seed, .controlled-guardrails { grid-column: 1; }
      .controlled-history { align-items: stretch; flex-direction: column; }
      .controlled-history select { max-width: none; }
      .controlled-side { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .controlled-case { grid-template-columns: 1fr; }
      .controlled-case-index { grid-template-columns: auto 1fr; }
      .controlled-case > footer { grid-column: 1; }
      .eval-candidate { grid-template-columns: 34px minmax(0, 1fr); }
      .eval-candidate-actions { grid-column: 2; grid-template-columns: repeat(2, auto); justify-self: start; }
      .eval-review-grid { grid-template-columns: 1fr; }
      .eval-review-flow { grid-template-columns: 1fr; }
      .eval-review-flow i { transform: rotate(90deg); }
    }

    @media (max-width: 480px) {
      .eval-metric-grid, .eval-rate-grid { grid-template-columns: 1fr; }
      .evals-section-head { display: grid; }
      .eval-rate { grid-template-columns: 56px minmax(0, 1fr); }
      .eval-review-head, .eval-review-form { padding-left: 14px; padding-right: 14px; }
      .eval-case-summary > div { grid-template-columns: 1fr; gap: 4px; }
      .controlled-case-compare { grid-template-columns: 1fr; }
      .controlled-case-compare em { transform: rotate(90deg); }
      .controlled-side { grid-template-columns: 1fr; }
      .controlled-side > span, .controlled-side h4, .controlled-side footer { grid-column: 1; }
    }
  </style>
</head>
<body>
  <section class="bootstrap-failure hidden" id="bootstrap-failure" role="alert" aria-live="assertive" hidden>
    <div class="bootstrap-failure-card">
      <div class="bootstrap-failure-kicker" id="bootstrap-failure-kicker"></div>
      <h1 id="bootstrap-failure-title"></h1>
      <p id="bootstrap-failure-copy"></p>
      <div class="bootstrap-command"><span id="bootstrap-command-label"></span><code id="bootstrap-command"></code></div>
      <p class="bootstrap-privacy" id="bootstrap-privacy"></p>
      <div class="bootstrap-failure-actions"><button type="button" id="bootstrap-retry"></button></div>
    </div>
  </section>
  <main class="shell" id="app-shell">
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
            <button type="button" data-main-view="impact">Impact</button>
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
