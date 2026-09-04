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

      /* Ground — warm paper. A lab notebook, not a dashboard. */
      --bg: #f6f5f1;
      --panel: #fbfaf7;
      --panel-2: #fdfcfa;
      --surface: #ffffff;
      --surface-hover: #f2f0ea;
      --surface-2: #f2f0ea;
      --line: #e2ded4;
      --line-soft: #edeae2;

      /* Ink — three weights, warm near-black */
      --text: #1c1b18;
      --muted: #6d6960;
      --faint: #79746b;   /* 4.6:1 on --surface, so ordinals and hints stay legible */

      /* Accent — deep petrol. Carries interaction, nothing else. */
      --accent: #0e5a6b;
      --accent-strong: #084350;
      --accent-soft: #dcecef;
      --accent-line: #a8cdd5;
      --on-accent: #ffffff;

      /* Semantic — independent of the accent, so "needs attention" reads
         without having to parse the number next to it. Amber is reserved for
         the human review gate, which is this product's central idea. */
      --ok: #3a6b47;
      --ok-soft: #e3efe5;
      --ok-line: #a9c9b1;
      --warn: #8f5f16;
      --warn-soft: #f6ecd9;
      --warn-line: #ddc188;
      --danger: #9e3729;
      --danger-soft: #f7e6e2;
      --danger-line: #dfb0a6;
      --info: #3a5a78;
      --info-soft: #e6edf4;
      --info-line: #b3c6d8;

      /* Evidence classes reuse the same hues, so one colour language covers
         both "what kind of evidence" and "what needs doing". */
      --evidence-observed: #0e5a6b;
      --evidence-human: #8f5f16;
      --evidence-inference: #6a5a8c;
      --evidence-inference-soft: #ece8f3;
      --evidence-eval: #3a6b47;

      --ink: #1c1b18;
      --violet: #6a5a8c;
      --violet-soft: #ece8f3;
      --ok-legacy: #3a6b47;
      --shadow: rgba(28, 26, 20, 0.07);
      --topbar-height: 52px;
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--bg);
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
        var(--panel-2);
      background-size: 28px 28px, 28px 28px, auto, auto;
    }

    .bootstrap-failure-card {
      width: min(620px, 100%);
      border: 1px solid var(--line);
      border-radius: 6px 26px 6px 6px;
      padding: clamp(26px, 5vw, 48px);
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 18px 22px 0 rgba(32, 101, 220, 0.09), 0 30px 80px rgba(17, 61, 130, 0.13);
    }

    .bootstrap-failure-kicker {
      color: var(--muted);
      font: 700 13px/1.2 "Cascadia Code", Consolas, monospace;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .bootstrap-failure-card h1 { margin: 14px 0 12px; color: var(--text); font-size: clamp(27px, 5vw, 42px); line-height: 1.08; }
    .bootstrap-failure-card p { color: var(--muted); line-height: 1.7; }
    .bootstrap-command { margin: 18px 0; padding: 14px 16px; border-left: 4px solid var(--muted); background: var(--panel-2); color: var(--text); overflow-wrap: anywhere; }
    .bootstrap-command code { display: block; margin-top: 7px; color: var(--text); font-weight: 700; }
    .bootstrap-failure-actions { display: flex; align-items: center; gap: 12px; margin-top: 22px; }
    .bootstrap-failure-actions button { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
    .bootstrap-privacy { font-size: 13px; }

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

    button:hover { background: var(--surface-hover); border-color: var(--warn-line); }
    button.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
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
      min-height: 32px;
      padding: 0 9px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      box-shadow: none;
      font-size: 13px;
    }

    .segmented button.active {
      background: var(--text);
      color: var(--on-accent);
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      background: var(--surface);
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
      /* Left column is the active view's list, right is the workspace, so the
         detail pane takes the largest share by default. */
      grid-template-columns: minmax(320px, 0.62fr) 8px minmax(460px, 1.7fr) 8px minmax(250px, 0.68fr);
      /* Only the columns are ever set inline by the splitter, so the header row
         declared here survives every collapse and drag. */
      grid-template-rows: auto minmax(0, 1fr);
      gap: 0;
      overflow: hidden;
      position: relative;
    }

    .app-topbar {
      grid-column: 1 / -1;
      grid-row: 1;
      display: flex;
      align-items: center;
      gap: 14px;
      /* Deterministic on desktop so the floating pane toggles can clear it. */
      height: var(--topbar-height);
      padding: 8px 14px;
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--panel), transparent 8%);
      backdrop-filter: blur(12px);
      flex-wrap: wrap;
    }

    .app-brand { flex: 0 0 auto; min-width: 0; }
    .app-brand .title { line-height: 1.2; }
    .app-brand .subtle { font-size: 13px; }

    .app-topbar .main-nav {
      display: flex;
      gap: 2px;
      padding: 3px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.58);
      box-shadow: 0 1px 2px var(--shadow);
      margin-left: auto;
      flex-wrap: nowrap;
    }

    .app-topbar .main-nav button {
      min-height: 32px;
      padding: 0 12px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      box-shadow: none;
      font-size: 13px;
      /* The label decides the width, so no view name is ever clipped. */
      white-space: nowrap;
      width: auto;
    }

    .app-topbar .main-nav button.active { background: var(--text); color: var(--on-accent); }
    .topbar-tools { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }

    .rail, .queue, .detail, .splitter { grid-row: 2; }

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

    /* Collapsed defaults, used whenever the user has not dragged a splitter:
       track 1 is the list, track 3 the detail, track 5 the workspace. */
    .shell.rail-collapsed {
      grid-template-columns: minmax(460px, 1.7fr) 8px minmax(250px, 0.68fr);
    }

    .shell.queue-collapsed {
      grid-template-columns: minmax(320px, 0.36fr) 8px minmax(460px, 1fr);
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
      top: calc(var(--topbar-height) + 10px);
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
      background: var(--surface);
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
      background: var(--surface);
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

    .compact-workspace-toggle { display: none; }

    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .session-heading-actions { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }

    .session-action {
      min-height: 32px;
      padding: 4px 8px;
      color: var(--muted);
      border-color: transparent;
      box-shadow: none;
      font-size: 13px;
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
      font-size: 14px;
      color: var(--text);
    }

    .subtle { color: var(--muted); font-size: 13px; min-width: 0; overflow-wrap: anywhere; }
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

    .row:hover { background: var(--surface); border-color: var(--warn-line); }
    .row.active { border-color: color-mix(in srgb, var(--accent), var(--line) 28%); background: var(--surface); box-shadow: inset 3px 0 0 var(--accent), 0 8px 28px var(--shadow); }
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
      min-height: 32px;
      font-size: 13px;
      box-shadow: none;
    }
    .row-title { overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .pill.proposed { color: var(--accent-strong); background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent), var(--line) 55%); }
    .pill.accepted { color: var(--ok); border-color: color-mix(in srgb, var(--ok), var(--line) 55%); }
    .pill.accepted-missing { color: var(--warn); border-color: color-mix(in srgb, var(--warn), var(--line) 55%); }
    .pill.destination-committed { color: var(--ok); background: color-mix(in srgb, var(--ok), transparent 94%); border-color: color-mix(in srgb, var(--ok), var(--line) 55%); }
    .pill.rejected { color: var(--danger); border-color: color-mix(in srgb, var(--danger), var(--line) 55%); }
    .receipt { position: fixed; right: 16px; bottom: 64px; max-width: 380px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); box-shadow: 0 6px 24px rgba(0,0,0,0.18); opacity: 0; pointer-events: none; transition: opacity 160ms; z-index: 40; }
    .receipt.show { opacity: 1; pointer-events: auto; }
    .receipt-line { font-size: 13px; line-height: 1.5; }
    .receipt-line.subtle { color: var(--muted); }
    .receipt-actions { display: flex; gap: 8px; margin-top: 10px; }
    .receipt-actions button { min-height: 32px; font-size: 13px; }

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
    label { color: var(--muted); font-size: 13px; text-transform: uppercase; }

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

    .local-model-panel {
      display: grid;
      gap: 8px;
    }

    .local-model-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .local-model-card {
      min-width: 0;
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.72);
      color: var(--ink);
      box-shadow: none;
      text-align: left;
    }

    .local-model-card:hover {
      border-color: color-mix(in srgb, var(--accent), var(--line) 45%);
      background: rgba(255, 255, 255, 0.94);
    }

    .local-model-card.active {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent), white 94%);
      box-shadow: inset 3px 0 var(--accent);
    }

    .local-model-card-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }

    .local-model-card-head strong { font-size: 14px; }
    .local-model-description { color: var(--muted); font-size: 13px; line-height: 1.45; }
    .local-model-card code { overflow-wrap: anywhere; color: var(--muted); font-size: 11px; }
    .local-model-spec { color: var(--accent); font: 700 12px/1.35 "Cascadia Code", Consolas, monospace; }

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
      font-size: 13px;
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
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .learning-prompt-card code {
      color: var(--text);
      font-family: "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace;
      font-size: 14px;
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
    .learning-controls select { min-width: 0; font-size: 13px; }
    .learning-controls #clear-learning-filters { font-size: 13px; color: var(--muted); }
    .learning-catalog { display: grid; gap: 12px; }

    .learning-collection {
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--accent), var(--line) 83%);
      border-radius: 14px;
      background: var(--surface);
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
        linear-gradient(135deg, color-mix(in srgb, var(--accent-soft), #fff 34%), var(--warn-soft) 92%);
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
      font-size: 12px;
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
      font-size: 12px;
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
      min-height: 32px;
      padding: 2px 6px;
      border-color: transparent;
      box-shadow: none;
      color: var(--muted);
      font-size: 13px;
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
      font-size: 13px;
      white-space: nowrap;
    }

    .collection-chapters { display: grid; }
    .collection-chapters[hidden] { display: none; }

    .collection-context {
      border-bottom: 1px solid var(--line-soft);
      background: color-mix(in srgb, var(--accent-soft), var(--surface-2) 58%);
    }

    .collection-context > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 13px;
      color: var(--accent-strong);
      cursor: pointer;
      font-size: 13px;
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
      font-size: 12px;
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
      background: color-mix(in srgb, var(--surface), transparent 4%);
    }

    .collection-context-section > strong {
      display: block;
      margin-bottom: 5px;
      font-family: Georgia, "Noto Serif SC", "Songti SC", serif;
      font-size: 14px;
      line-height: 1.35;
    }

    .collection-context-copy {
      color: var(--muted);
      font-size: 13px;
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
    .chapter-number { color: var(--muted); font-family: "Cascadia Mono", Consolas, monospace; font-size: 13px; line-height: 1.55; }
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
      font-size: 13px;
    }

    .learning-breadcrumb span { min-width: 0; overflow-wrap: anywhere; }
    .learning-breadcrumb strong { flex: 0 0 auto; font-family: "Cascadia Mono", Consolas, monospace; font-size: 13px; }
    .collection-edit-actions { display: flex; gap: 7px; margin-top: 12px; }
    .collection-edit-actions button { min-height: 32px; font-size: 13px; }
    .learning-actions { align-items: center; }
    .learning-navigation { display: flex; gap: 7px; margin-right: auto; }
    .learning-navigation button { min-height: 32px; font-size: 13px; }
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
    .field-label { color: var(--muted); font-size: 13px; font-weight: 720; letter-spacing: 0.035em; text-transform: uppercase; }
    .learning-status-control { width: fit-content; max-width: 100%; }
    .learning-status-control button { min-width: 0; padding-inline: 12px; }
    .feedback-choice { display: flex; flex-wrap: wrap; gap: 7px; }
    .feedback-choice button.active { border-color: var(--accent); color: var(--accent-strong); background: var(--accent-soft); }

    .learning-run-link {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 650;
    }

    .learning-run-link select { width: 100%; color: var(--ink); font-weight: 500; }
    .learning-agent-card > button { width: fit-content; }

    .learning-agent-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 11px;
    }

    .learning-agent-form label { min-width: 0; display: grid; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 680; }
    .learning-agent-form label.full { grid-column: 1 / -1; }
    .learning-agent-form input,
    .learning-agent-form select,
    .learning-agent-form textarea { width: 100%; color: var(--ink); font-weight: 500; }
    .learning-agent-form textarea { min-height: 88px; resize: vertical; line-height: 1.5; }
    .learning-agent-form textarea.tall { min-height: 150px; }
    .learning-agent-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .inline-error { padding: 10px 11px; border: 1px solid color-mix(in srgb, var(--danger), transparent 58%); border-radius: 9px; color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 94%); font-size: 13px; line-height: 1.45; }

    .learning-prose {
      white-space: pre-wrap;
      font-family: Georgia, "Noto Serif SC", "Songti SC", "Microsoft YaHei UI", serif;
    }

    .learning-code {
      padding: 14px 16px;
      font-size: 14px;
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
      font-size: 14px;
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
    .coverage-eyebrow { color: var(--muted); font-size: 12px; font-weight: 760; letter-spacing: 0.09em; text-transform: uppercase; }
    .source-coverage-panel > p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; }

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
    .coverage-details summary { cursor: pointer; color: var(--accent-strong); font-size: 13px; font-weight: 680; }
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
    .coverage-unit-copy strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 680; }
    .coverage-unit-copy span { overflow-wrap: anywhere; color: var(--muted); font-size: 12px; }
    .coverage-unit-state { color: var(--muted); font-size: 12px; white-space: nowrap; }

    .coverage-fingerprint { min-width: 0; display: grid; gap: 3px; color: var(--muted); font-size: 12px; }
    .coverage-fingerprint code { overflow-wrap: anywhere; color: inherit; font-size: 11px; }

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
      font-size: 14px;
    }

    .rank-label { overflow-wrap: anywhere; }
    .rank-count { color: var(--muted); font-size: 13px; }

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
      background: var(--ok);
      color: var(--ok-soft);
      overflow: auto;
      line-height: 1.45;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 13px;
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
      font-size: 13px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .kv-value { font-size: 14px; }

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
      background: color-mix(in srgb, var(--warn-soft), var(--surface) 35%);
      color: var(--warn);
      font-size: 13px;
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
      font-size: 13px;
      line-height: 1.3;
      min-width: 180px;
    }

    .action-hint.dirty {
      color: var(--warn);
    }

    .empty {
      padding: 28px 18px;
      color: var(--muted);
      text-align: center;
    }

    /* Impact: a local flight recorder, expressed as a precise blue blueprint. */
    [data-main-view="impact"].active {
      background: var(--accent);
      color: var(--panel-2);
    }

    .impact-shell {
      --impact-ink: var(--accent);
      --impact-blue: var(--accent);
      --impact-electric: var(--accent-line);
      --impact-pale: var(--surface-2);
      --impact-line: var(--line-soft);
      height: 100%;
      overflow: auto;
      padding: clamp(14px, 2.2vw, 26px);
      background:
        linear-gradient(rgba(20, 94, 210, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20, 94, 210, 0.035) 1px, transparent 1px),
        var(--panel-2);
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
      min-height: 32px;
      border: 0;
      background: transparent;
      color: var(--muted);
      box-shadow: none;
      font-size: 13px;
    }

    .impact-tabs button.active {
      background: var(--impact-ink);
      color: var(--on-accent);
    }

    .impact-hero {
      position: relative;
      overflow: hidden;
      min-height: 0;
      padding: clamp(14px, 1.8vw, 20px) clamp(16px, 2.2vw, 24px);
      border: 1px solid var(--line);
      border-left: 3px solid var(--accent);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 1px 2px var(--shadow);
    }

    .impact-hero::after { content: none; }

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
      color: var(--accent);
      font: 700 12px/1 "Cascadia Code", "SFMono-Regular", Consolas, monospace;
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
      color: var(--muted);
      font-size: 13px;
      line-height: 1.65;
    }

    .impact-stats-strip {
      display: flex;
      flex-wrap: wrap;
      margin-top: 14px;
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.5;
    }

    .impact-stats-strip span { padding: 0 13px; border-left: 1px solid var(--line); }
    .impact-stats-strip span:first-child { padding-left: 0; border-left: 0; }

    .impact-local-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid rgba(156, 196, 255, 0.34);
      border-radius: 999px;
      background: rgba(5, 25, 53, 0.52);
      color: var(--surface-2);
      font: 700 12px/1 "Cascadia Code", Consolas, monospace;
      white-space: nowrap;
    }

    .impact-local-badge::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ok);
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

    /* A zero still reads, just quieter than a number that carries weight. */
    .impact-metric.zero { background: rgba(255, 255, 255, 0.55); box-shadow: none; }
    .impact-metric.zero strong { color: var(--faint); }
    .impact-metric.zero span { color: var(--faint); }

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
      color: var(--muted);
      font: 700 11px/1.35 "Cascadia Code", Consolas, monospace;
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

    .impact-mix-single { margin: 0; color: var(--text); font-size: 14px; }
    .impact-mix-single b { font-size: 20px; font-variant-numeric: tabular-nums; }
    .impact-mix-single small { display: block; margin-top: 6px; color: var(--muted); font-size: 13px; }

    .impact-mix-bar {
      display: flex;
      gap: 2px;
      height: 10px;
      margin-top: 15px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--surface-2);
    }

    .impact-mix-seg { min-width: 6px; height: 100%; }
    .impact-mix-seg.observed { background: var(--impact-blue); }
    .impact-mix-seg.human { background: var(--warn); }
    .impact-mix-seg.inference { background: var(--evidence-inference); }
    .impact-mix-seg.eval { background: var(--ok); }

    .impact-mix-legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; }

    .impact-mix-item { display: inline-flex; align-items: center; gap: 7px; color: var(--accent); font-size: 13px; }
    .impact-mix-item i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
    .impact-mix-item.observed i { background: var(--impact-blue); }
    .impact-mix-item.human i { background: var(--warn); }
    .impact-mix-item.inference i { background: var(--evidence-inference); }
    .impact-mix-item.eval i { background: var(--ok); }
    .impact-mix-item b { color: var(--impact-ink); font-size: 14px; }

    .impact-notice {
      padding: 18px;
      border-color: var(--line);
      background: linear-gradient(145deg, var(--panel-2), var(--panel-2));
    }

    .impact-notice p { margin: 9px 0 0; color: var(--accent); font-size: 13px; line-height: 1.62; }
    .impact-notice.warn { border-color: var(--warn-line); background: linear-gradient(145deg, var(--surface), var(--surface)); }
    .impact-notice.warn h3 { color: var(--warn); }
    .impact-notice.warn p { color: var(--warn); }
    .impact-notice.error { border-color: var(--danger-line); background: var(--danger-soft); }
    .impact-hook-health {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 14px;
      align-items: start;
      margin-bottom: 12px;
    }
    .impact-hook-health.blocked { border-color: var(--danger-line); background: linear-gradient(145deg, var(--surface), var(--surface)); }
    .impact-hook-health.unavailable { border-color: var(--warn); background: linear-gradient(145deg, var(--surface), var(--surface)); }
    .impact-hook-health-mark {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 14px 5px 14px 5px;
      background: var(--accent);
      color: var(--on-accent);
      font: 800 14px/1 "Cascadia Code", Consolas, monospace;
      box-shadow: 5px 5px 0 var(--line-soft);
    }
    .impact-hook-health code { display: block; margin-top: 10px; overflow-wrap: anywhere; color: var(--accent); font-size: 13px; }
    .impact-hook-health small { display: block; margin-top: 7px; color: var(--warn); font-size: 12px; line-height: 1.5; }

    .impact-empty {
      min-height: 360px;
      display: grid;
      place-items: center;
      padding: 32px;
      border: 1px dashed var(--line);
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
      border: 1px solid var(--line);
      border-radius: 18px 7px 18px 7px;
      background: var(--accent);
      color: var(--on-accent);
      font: 700 17px/1 "Cascadia Code", Consolas, monospace;
      box-shadow: 7px 7px 0 var(--line-soft);
    }

    .impact-empty h2 { margin: 0; color: var(--impact-ink); font-size: 22px; }
    .impact-empty p { max-width: 560px; margin: 11px auto 0; color: var(--muted); line-height: 1.65; }
    .impact-empty-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    .impact-empty-actions button.primary { background: var(--impact-blue); border-color: var(--impact-blue); }
    .impact-empty-hint { display: block; margin-top: 12px; color: var(--muted); font-size: 13px; }
    .impact-queue-empty strong { display: block; margin-bottom: 8px; color: var(--text); }
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
      border: 1px solid var(--line-soft);
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
      color: var(--muted);
      font: 700 13px/1.2 "Cascadia Code", Consolas, monospace;
      letter-spacing: .08em;
    }

    .impact-onboarding-flow strong { color: var(--text); font-size: 14px; }
    .impact-onboarding-flow p { margin: 7px 0 0; color: var(--muted); font-size: 13px; line-height: 1.55; }

    .impact-connection-guide {
      display: grid;
      gap: 14px;
      margin-top: 12px;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 5px 18px 5px 5px;
      background:
        linear-gradient(rgba(13, 92, 229, .045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(13, 92, 229, .045) 1px, transparent 1px),
        var(--panel-2);
      background-size: 24px 24px;
    }

    .impact-connection-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
    }

    .impact-connection-head span:first-child { color: var(--muted); font: 700 12px/1.2 "Cascadia Code", Consolas, monospace; letter-spacing: .12em; }
    .impact-connection-head h3 { margin: 5px 0 0; color: var(--text); font-size: 18px; }
    .impact-connection-guide > p { max-width: 720px; margin: 0; color: var(--accent); font-size: 13px; line-height: 1.65; }

    .impact-auto-setup {
      display: grid;
      gap: 13px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 4px 14px 4px 4px;
      background: linear-gradient(145deg, rgba(232,242,255,.96), rgba(255,255,255,.96));
      box-shadow: inset 3px 0 var(--muted);
    }

    .impact-auto-setup h4 { margin: 0; color: var(--text); font-size: 14px; }
    .impact-auto-setup p { margin: 5px 0 0; color: var(--accent); font-size: 13px; line-height: 1.6; }
    .impact-auto-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .impact-auto-grid article {
      display: grid;
      gap: 7px;
      min-width: 0;
      padding: 12px;
      border: 1px solid var(--line-soft);
      border-radius: 7px;
      background: rgba(255,255,255,.88);
    }
    .impact-auto-grid strong { color: var(--text); font-size: 13px; }
    .impact-auto-grid span { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .impact-auto-grid code {
      display: block;
      overflow-wrap: anywhere;
      padding: 8px 9px;
      border: 1px solid var(--line-soft);
      border-radius: 4px;
      background: var(--panel-2);
      color: var(--accent);
      font-size: 12px;
      line-height: 1.45;
    }
    .impact-auto-foot { margin: 0 !important; padding-top: 2px; border-top: 1px dashed var(--line); }
    .impact-manual-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--accent); font-size: 13px; }

    .impact-agent-prompt {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 9px 12px;
      align-items: center;
      padding: 14px;
      border: 1px solid var(--line);
      border-left: 3px solid var(--muted);
      border-radius: 8px;
      background: rgba(255,255,255,.94);
    }

    .impact-agent-prompt > span { grid-column: 1 / -1; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .07em; }
    .impact-agent-prompt code { color: var(--text); white-space: normal; line-height: 1.6; }
    .impact-agent-prompt small { grid-column: 1 / -1; min-height: 1.2em; color: var(--ok); }

    .impact-demo-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 16px;
      padding: 15px 16px;
      border: 1px solid var(--warn);
      border-radius: 5px 14px 5px 5px;
      background: linear-gradient(135deg, var(--warn-soft), var(--warn-soft));
    }

    .impact-demo-banner span { display: block; color: var(--warn); font: 700 12px/1.2 "Cascadia Code", Consolas, monospace; text-transform: uppercase; letter-spacing: .08em; }
    .impact-demo-banner strong { display: block; margin-top: 4px; color: var(--warn); }
    .impact-demo-banner p { margin: 4px 0 0; color: var(--warn); font-size: 13px; line-height: 1.5; }
    .impact-demo-row { border-style: dashed; background: linear-gradient(145deg, var(--warn-soft), var(--panel-2)); }

    .impact-run-row { border-color: var(--line-soft); background: var(--panel-2); }
    .impact-run-row.active { border-color: var(--faint); box-shadow: inset 3px 0 var(--muted), 0 8px 28px rgba(26, 84, 170, 0.1); }
    .impact-run-id { color: var(--text); font-family: "Cascadia Code", Consolas, monospace; font-size: 13px; }

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

    /* The Run id stays available as identity, below the readable headline. */
    .impact-run-identity {
      display: inline-block;
      margin-top: 7px;
      color: var(--muted);
      font: 500 13px/1.4 "Cascadia Code", Consolas, monospace;
      overflow-wrap: anywhere;
    }

    .impact-run-meta {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 18px;
    }

    .impact-run-meta .metric { min-height: 68px; border-color: var(--impact-line); background: var(--surface); }
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
      background: linear-gradient(var(--muted), var(--line));
    }

    .impact-event {
      position: relative;
      border: 1px solid var(--impact-line);
      border-left: 3px solid var(--impact-blue);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.92);
    }

    .impact-event.human_label, .impact-event.human_label::before { border-color: var(--warn); }
    .impact-event.derived_inference, .impact-event.derived_inference::before { border-color: var(--faint); }
    .impact-event.controlled_eval, .impact-event.controlled_eval::before { border-color: var(--ok); }

    .impact-event::before {
      content: "";
      position: absolute;
      left: -23px;
      top: 13px;
      width: 9px;
      height: 9px;
      border: 2px solid var(--panel-2);
      border-radius: 50%;
      background: var(--impact-blue);
      box-shadow: 0 0 0 1px var(--faint);
    }

    .impact-event.human_label::before { background: var(--warn); }
    .impact-event.derived_inference::before { background: var(--faint); }
    .impact-event.controlled_eval::before { background: var(--ok); }

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
      border-right: 1.5px solid var(--faint);
      border-bottom: 1.5px solid var(--faint);
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
      background: var(--surface-2);
      color: var(--muted);
    }

    .impact-event.cat-search .impact-event-marker { color: var(--muted); background: var(--surface-2); }
    .impact-event.cat-expose .impact-event-marker { color: var(--muted); background: var(--panel-2); }
    .impact-event.cat-validate .impact-event-marker { color: var(--ok); background: var(--ok-soft); }
    .impact-event.cat-feedback .impact-event-marker { color: var(--warn); background: var(--warn-soft); }
    .impact-event.cat-run .impact-event-marker { color: var(--text); background: var(--surface-2); }
    .impact-event.cat-learning .impact-event-marker,
    .impact-event.cat-candidate .impact-event-marker { color: var(--faint); background: var(--panel-2); }
    .impact-event.cat-share .impact-event-marker,
    .impact-event.cat-eval .impact-event-marker,
    .impact-event.cat-other .impact-event-marker { color: var(--accent); background: var(--surface-2); }

    .impact-event-title { flex: none; color: var(--impact-ink); font-weight: 650; font-size: 12.5px; white-space: nowrap; }

    .impact-event-key {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--accent);
      font: 10.5px/1.4 "Cascadia Code", Consolas, monospace;
    }

    .impact-event summary time { flex: none; margin-left: auto; color: var(--muted); font: 12px/1.4 "Cascadia Code", Consolas, monospace; white-space: nowrap; }
    .impact-event summary .pill { flex: none; }

    .impact-event-body { padding: 10px 14px 12px 43px; }

    .impact-event-sensitivity { display: block; margin-top: 8px; }

    .impact-facts { display: flex; flex-wrap: wrap; gap: 6px; }
    .impact-fact { padding: 6px 8px; border: 1px solid var(--line-soft); border-radius: 6px; background: var(--panel-2); color: var(--accent); font-size: 13px; }
    .impact-fact strong { color: var(--text); font-weight: 700; }

    .impact-trap-link {
      display: inline;
      padding: 0 2px;
      border: 0;
      border-radius: 4px;
      background: none;
      color: var(--muted);
      font: inherit;
      font-weight: 700;
      text-decoration: underline dotted;
      box-shadow: none;
    }

    .impact-trap-link:hover { background: var(--surface-2); color: var(--accent); border: 0; }

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
    .impact-gantt-hit.cat-expose { background: var(--muted); }
    .impact-gantt-hit.cat-validate { background: var(--ok); }
    .impact-gantt-hit.cat-feedback { background: var(--warn); }
    .impact-gantt-hit.cat-run { background: var(--text); }
    .impact-gantt-hit.cat-learning,
    .impact-gantt-hit.cat-candidate { background: var(--faint); }
    .impact-gantt-hit.cat-share,
    .impact-gantt-hit.cat-eval,
    .impact-gantt-hit.cat-other { background: var(--accent); }

    .impact-event-filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 4px; }
    .impact-event-filters button {
      min-height: 32px;
      padding: 3px 11px;
      border: 1px solid var(--impact-line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.85);
      color: var(--accent);
      box-shadow: none;
      font-size: 13px;
    }
    .impact-event-filters button:hover { background: var(--panel-2); border-color: var(--line); }
    .impact-event-filters button.active { background: var(--impact-ink); border-color: var(--impact-ink); color: var(--on-accent); }

    .impact-state { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--accent); }
    .impact-state i { position: relative; width: 12px; height: 12px; border-radius: 50%; flex: none; }
    .impact-state i::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: currentColor; opacity: 0.14; }
    .impact-state i::after { content: ""; position: absolute; inset: 22%; border-radius: 50%; background: currentColor; }
    .impact-state.done { color: var(--ok); }
    .impact-state.error { color: var(--danger); }
    .impact-state.idle { color: var(--faint); }
    .impact-state.ongoing { color: var(--muted); }
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
        var(--panel-2);
      background-size: auto, 24px 24px, 24px 24px, auto;
    }

    .evals-hero {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(110px, 150px);
      gap: clamp(16px, 2vw, 28px);
      align-items: center;
      min-height: 132px;
      padding: clamp(16px, 1.8vw, 24px);
      border: 1px solid var(--line);
      border-left: 3px solid var(--accent);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 1px 2px var(--shadow);
    }

    .evals-hero::before { content: none; }

    .evals-hero h2 {
      max-width: 720px;
      margin: 0;
      font-family: "Aptos Display", "Segoe UI Variable Display", "Microsoft YaHei UI", sans-serif;
      font-size: clamp(22px, 2.4vw, 30px);
      font-weight: 650;
      letter-spacing: -0.035em;
      line-height: 1.02;
    }

    .evals-hero p {
      max-width: 710px;
      margin: 18px 0 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.7;
    }

    .evals-verdict {
      position: relative;
      z-index: 1;
      display: grid;
      justify-items: end;
      padding: 18px 0 18px 18px;
      border-left: 1px solid var(--line);
      text-align: right;
    }

    .evals-verdict span,
    .evals-verdict small {
      color: var(--muted);
      font: 700 11px/1.3 "Cascadia Code", Consolas, monospace;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .evals-verdict strong {
      margin: 7px 0 3px;
      color: var(--accent);
      font: 650 68px/0.85 "Aptos Display", "Segoe UI Variable Display", sans-serif;
      letter-spacing: -0.06em;
    }

    .evals-lanes {
      display: grid;
      /* Four lanes in three columns left two cells showing the divider colour as
         a solid block, which read as missing content. 2x2 fills exactly. */
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      margin: 12px 0;
      border: 1px solid var(--line);
      background: var(--line);
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
      color: var(--faint);
      font: 700 13px/1 "Cascadia Code", Consolas, monospace;
    }

    .eval-lane strong { color: var(--text); font-size: 14px; }
    .eval-lane p { margin: 7px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .eval-lane i { align-self: start; width: 7px; height: 7px; border-radius: 50%; background: var(--faint); box-shadow: 0 0 0 4px rgba(111, 139, 176, 0.12); }
    .eval-lane.ready i { background: var(--muted); box-shadow: 0 0 0 4px rgba(23, 104, 230, 0.13); }
    .eval-lane.review i { background: var(--warn); box-shadow: 0 0 0 4px rgba(218, 139, 19, 0.14); }
    .eval-lane.clear i { background: var(--ok); box-shadow: 0 0 0 4px rgba(22, 133, 90, 0.13); }

    .evals-section {
      margin-top: 12px;
      padding: clamp(16px, 2vw, 24px);
      border: 1px solid var(--line-soft);
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
      color: var(--muted);
      font: 700 11px/1.35 "Cascadia Code", Consolas, monospace;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .evals-section-head h3 { margin: 5px 0 0; color: var(--text); font-size: 17px; letter-spacing: -0.02em; }
    .eval-source { margin: 13px 0 0; text-transform: none; letter-spacing: 0; }
    .evals-section code { display: inline-block; margin-top: 12px; padding: 7px 9px; border: 1px solid var(--line); background: var(--panel-2); color: var(--accent); }

    .controlled-eval-bench {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 3px 18px 3px 3px;
      background:
        linear-gradient(90deg, rgba(23, 104, 230, .045) 1px, transparent 1px),
        linear-gradient(rgba(23, 104, 230, .045) 1px, transparent 1px),
        var(--panel-2);
      background-size: 20px 20px;
      box-shadow: 0 18px 44px rgba(10, 61, 131, .1);
    }
    .controlled-blueprint {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 86px minmax(0, 1fr);
      align-items: center;
      min-height: 34px;
      padding: 0 18px;
      background: var(--text);
      color: var(--line);
      font: 700 11px/1 "Cascadia Code", Consolas, monospace;
      letter-spacing: .14em;
    }
    .controlled-blueprint span:last-child { text-align: right; }
    .controlled-blueprint i { position: relative; height: 1px; background: var(--faint); }
    .controlled-blueprint i::after { content: "→"; position: absolute; top: 50%; left: 50%; padding: 0 7px; background: var(--text); color: var(--on-accent); transform: translate(-50%, -53%); font-style: normal; }
    .controlled-run-form {
      display: grid;
      grid-template-columns: minmax(190px, 1.4fr) 110px minmax(150px, 1fr);
      gap: 10px;
      align-items: end;
      padding: 18px;
      border-bottom: 1px solid var(--line-soft);
      background: rgba(246, 250, 255, .92);
    }
    .controlled-run-copy { grid-column: 1 / -1; align-self: center; min-width: 0; }
    .controlled-run-copy > span { color: var(--muted); font: 700 11px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .1em; }
    .controlled-run-copy strong { display: block; margin-top: 6px; color: var(--text); font-size: 14px; }
    .controlled-run-copy p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .controlled-run-form .eval-field { gap: 5px; }
    .controlled-run-form .eval-field input,
    .controlled-run-form .eval-field select,
    .controlled-history select { width: 100%; min-width: 0; border-color: var(--line); background: #fff; color: var(--text); font: 13px/1.4 "Cascadia Code", Consolas, monospace; }
    .controlled-run-button { grid-column: 1 / -1; justify-self: start; min-height: 42px; white-space: nowrap; }
    .controlled-guardrails { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; }
    .controlled-guardrails span { padding: 5px 8px; border: 1px solid var(--line); background: #fff; color: var(--accent); font: 700 11px/1.2 "Cascadia Code", Consolas, monospace; }
    .controlled-history-row { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 12px 18px; border-bottom: 1px solid var(--line-soft); background: rgba(255,255,255,.9); }
    .controlled-history { display: flex; align-items: center; gap: 9px; color: var(--accent); font-size: 12px; }
    .controlled-history select { max-width: 280px; }
    .controlled-history-row small, .controlled-no-history { color: var(--muted); font-size: 11px; line-height: 1.45; }
    .controlled-eval-error { margin: 14px 18px 0; }
    .controlled-empty { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 18px; align-items: center; padding: 28px 22px 32px; }
    .controlled-empty > span { width: 54px; height: 54px; display: grid; place-items: center; border: 1px solid var(--faint); border-radius: 50%; background: var(--panel-2); color: var(--muted); font: 650 26px/1 "Aptos Display", "Segoe UI Variable Display", sans-serif; }
    .controlled-empty strong { color: var(--text); font-size: 15px; }
    .controlled-empty p { margin: 7px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
    .controlled-result { background: rgba(255,255,255,.94); }
    .controlled-result-head { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 17px 18px; border-bottom: 1px solid var(--line-soft); }
    .controlled-result.clear .controlled-result-head { background: linear-gradient(90deg, var(--ok-soft), var(--panel-2) 56%); }
    .controlled-result.has-regression .controlled-result-head { background: linear-gradient(90deg, var(--surface), var(--surface) 56%); }
    .controlled-verdict-mark { display: flex; gap: 11px; align-items: center; }
    .controlled-verdict-mark > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--ok); color: var(--on-accent); font-weight: 800; }
    .has-regression .controlled-verdict-mark > span { background: var(--danger); }
    .controlled-verdict-mark small { display: block; color: var(--muted); font: 700 11px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .11em; }
    .controlled-verdict-mark strong { display: block; margin-top: 4px; color: var(--text); font-size: 14px; }
    .controlled-result-facts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
    .controlled-result-facts span { padding: 6px 8px; border: 1px solid var(--line-soft); background: rgba(255,255,255,.8); color: var(--muted); font-size: 11px; }
    .controlled-sides { display: grid; grid-template-columns: minmax(0, 1fr) 90px minmax(0, 1fr); gap: 0; align-items: stretch; padding: 18px; }
    .controlled-side { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 16px; border: 1px solid var(--line-soft); background: linear-gradient(145deg, var(--panel-2), #fff); }
    .controlled-side.candidate { border-color: var(--faint); box-shadow: inset 4px 0 var(--muted); }
    .controlled-side > span, .controlled-side h4, .controlled-side footer { grid-column: 1 / -1; }
    .controlled-side > span { color: var(--muted); font: 700 11px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .12em; text-transform: uppercase; }
    .controlled-side h4 { margin: 0 0 5px; color: var(--text); font-size: 14px; }
    .controlled-side > div { min-width: 0; padding: 8px; border-top: 1px solid var(--line-soft); }
    .controlled-side b { display: block; color: var(--text); font: 700 18px/1 "Cascadia Code", Consolas, monospace; }
    .controlled-side small { display: block; margin-top: 6px; color: var(--muted); font-size: 11px; }
    .controlled-side footer { color: var(--muted); font-size: 11px; }
    .controlled-delta { align-self: center; display: grid; justify-items: center; gap: 5px; color: var(--muted); text-align: center; }
    .controlled-delta span { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); }
    .controlled-delta strong { color: var(--text); font: 700 12px/1.2 "Cascadia Code", Consolas, monospace; }
    .controlled-delta small { font-size: 11px; }
    .controlled-summary-strip, .controlled-audit { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 18px 10px; }
    .controlled-summary-strip span { padding: 7px 9px; border: 1px solid var(--line-soft); background: var(--panel-2); color: var(--muted); font-size: 11px; }
    .controlled-summary-strip .regressed { border-color: var(--danger-line); background: var(--danger-soft); color: var(--danger); }
    .controlled-summary-strip .improved { border-color: var(--ok-line); background: var(--ok-soft); color: var(--ok); }
    .controlled-audit { padding: 9px 0 13px; border-bottom: 1px dashed var(--line-soft); color: var(--muted); font: 11px/1.4 "Cascadia Code", Consolas, monospace; }
    .controlled-audit code { margin: 0; padding: 4px 6px; font-size: 11px; }
    .controlled-cases-head { display: flex; justify-content: space-between; gap: 14px; align-items: end; padding: 10px 18px 12px; }
    .controlled-cases-head > div:first-child span { display: block; color: var(--muted); font: 700 11px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .1em; }
    .controlled-cases-head > div:first-child strong { display: block; margin-top: 5px; color: var(--text); font-size: 13px; }
    .controlled-case-filters { margin: 0; }
    .controlled-case-list { display: grid; gap: 8px; max-height: 620px; overflow: auto; padding: 0 18px 20px; scrollbar-gutter: stable; }
    .controlled-case-list:focus { outline: 2px solid rgba(23, 104, 230, .28); outline-offset: -2px; }
    .controlled-case { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 12px; padding: 13px; border: 1px solid var(--line-soft); border-left: 4px solid var(--faint); background: #fff; }
    .controlled-case.regressed { border-left-color: var(--danger); background: linear-gradient(90deg, var(--danger-soft), #fff 42%); }
    .controlled-case.improved { border-left-color: var(--ok); background: linear-gradient(90deg, var(--ok-soft), #fff 42%); }
    .controlled-case.changed { border-left-color: var(--warn); }
    .controlled-case-index { display: grid; align-content: start; gap: 8px; }
    .controlled-case-index span { color: var(--accent); font: 700 11px/1.3 "Cascadia Code", Consolas, monospace; }
    .controlled-case-index b { color: var(--faint); font: 700 13px/1 "Cascadia Code", Consolas, monospace; }
    .controlled-case-main { min-width: 0; }
    .controlled-case-main h4 { margin: 0; overflow-wrap: anywhere; color: var(--text); font: 700 13px/1.45 "Cascadia Code", Consolas, "Microsoft YaHei UI", monospace; }
    .controlled-case-main > p { margin: 5px 0 9px; color: var(--muted); font-size: 11px; }
    .controlled-case-compare { display: grid; grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1fr); gap: 7px; align-items: center; }
    .controlled-case-compare > span { min-width: 0; padding: 8px; border: 1px solid var(--line-soft); background: var(--panel-2); }
    .controlled-case-compare i { color: var(--muted); font: 700 11px/1.2 "Cascadia Code", Consolas, monospace; font-style: normal; }
    .controlled-case-compare b { display: block; margin-top: 4px; color: var(--text); font: 700 12px/1 "Cascadia Code", Consolas, monospace; }
    .controlled-case-compare small { display: block; margin-top: 5px; overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .controlled-case-compare em { color: var(--muted); font-style: normal; text-align: center; }
    .controlled-case > footer { grid-column: 2; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: var(--muted); font-size: 11px; }
    .controlled-case > footer code { margin: 0; padding: 4px 6px; font-size: 11px; }

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
      border: 1px solid var(--line-soft);
      border-top: 2px solid var(--muted);
      background: linear-gradient(155deg, var(--panel-2), var(--panel-2));
    }

    .eval-score > span { color: var(--accent); font: 700 12px/1 "Cascadia Code", Consolas, monospace; }
    .eval-score > strong { color: var(--text); font: 650 clamp(28px, 3.4vw, 42px)/1 "Aptos Display", "Segoe UI Variable Display", sans-serif; letter-spacing: -0.055em; }
    .eval-score > small { color: var(--muted); font-size: 12px; }

    .eval-rate {
      min-height: 118px;
      display: grid;
      grid-template-columns: 62px minmax(0, 1fr);
      gap: 13px;
      align-items: center;
      padding: 13px;
      border: 1px solid var(--line-soft);
      background: var(--panel-2);
    }

    .eval-rate-dial {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: radial-gradient(circle at center, var(--panel-2) 58%, transparent 60%), conic-gradient(var(--accent) calc(var(--rate) * 1turn), var(--line-soft) 0);
    }

    .eval-rate-dial strong { color: var(--text); font: 700 14px/1 "Cascadia Code", Consolas, monospace; }
    .eval-rate > div:last-child { min-width: 0; }
    .eval-rate span { display: block; color: var(--text); font-size: 13px; font-weight: 700; }
    .eval-rate small { display: block; margin-top: 7px; color: var(--muted); font-size: 11px; line-height: 1.35; }

    .eval-observed-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }

    .eval-observed-strip span {
      padding: 7px 9px;
      border: 1px solid var(--line-soft);
      background: var(--panel-2);
      color: var(--accent);
      font-size: 12px;
    }

    .eval-observed-strip span.warn { border-color: var(--warn-line); background: var(--warn-soft); color: var(--warn); }

    .eval-filters { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
    .eval-filters button { min-height: 32px; border-color: var(--line); background: var(--panel-2); color: var(--accent); box-shadow: none; font-size: 12px; }
    .eval-filters button.active { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }

    .eval-candidate-list { display: grid; gap: 7px; }
    .eval-candidate {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 13px;
      border: 1px solid var(--line-soft);
      background: linear-gradient(90deg, var(--panel-2), white 44%);
    }

    .pill.occurrences { background: var(--warn-soft); border-color: var(--warn); color: var(--warn); font-variant-numeric: tabular-nums; }
    .eval-candidate-span { display: block; margin-top: 6px; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .eval-candidate-index { color: var(--muted); font: 700 12px/1 "Cascadia Code", Consolas, monospace; }
    .eval-candidate h4 { margin: 7px 0 0; color: var(--text); font: 700 13px/1.3 "Cascadia Code", Consolas, monospace; overflow-wrap: anywhere; }
    .eval-candidate p { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
    .eval-candidate button { min-height: 32px; font-size: 12px; }
    .evals-inline-empty { padding: 24px; border: 1px dashed var(--line); background: var(--panel-2); color: var(--muted); text-align: center; font-size: 13px; line-height: 1.6; }

    .eval-queue-row { border-left: 3px solid var(--warn); background: var(--panel-2); }
    .eval-queue-row > strong { color: var(--text); font: 700 13px/1.4 "Cascadia Code", Consolas, monospace; overflow-wrap: anywhere; }
    .eval-reason-code { color: var(--warn); font: 700 11px/1.4 "Cascadia Code", Consolas, monospace; text-transform: uppercase; }

    .eval-candidate.selected {
      border-color: var(--faint);
      box-shadow: 0 0 0 2px rgba(13, 92, 229, 0.09);
      background: linear-gradient(100deg, var(--panel-2), var(--surface) 72%);
    }
    .eval-candidate-actions { display: grid; gap: 5px; justify-items: stretch; }
    .eval-candidate-actions button { white-space: nowrap; }
    .eval-review-intro { margin-top: 12px; }
    .eval-review-workbench {
      margin-top: 14px;
      overflow: hidden;
      border: 1px solid var(--line);
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
      border-bottom: 1px solid var(--line-soft);
      background: linear-gradient(115deg, var(--text), var(--muted) 62%, var(--faint));
      color: var(--on-accent);
    }
    .eval-review-head h3 { margin: 5px 0 6px; font-size: 18px; letter-spacing: -0.02em; }
    .eval-review-head p { max-width: 720px; margin: 0; color: var(--surface-2); font-size: 13px; line-height: 1.55; }
    .eval-review-head button { border-color: rgba(255,255,255,.32); background: rgba(255,255,255,.08); color: var(--on-accent); font-size: 19px; }
    .eval-review-step { color: var(--line); font: 700 11px/1.2 "Cascadia Code", Consolas, monospace; letter-spacing: .1em; overflow-wrap: anywhere; }
    .eval-external-update { margin: 14px 20px 0; padding: 12px 14px; }
    .eval-external-update[hidden] { display: none; }
    .eval-external-update strong { color: var(--warn); font-size: 13px; }
    .eval-external-update p { margin-top: 4px; }
    .eval-review-flow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-bottom: 1px solid var(--line-soft);
      background: var(--panel-2);
      color: var(--muted);
      font: 700 11px/1.3 "Cascadia Code", Consolas, monospace;
      text-align: center;
      text-transform: uppercase;
    }
    .eval-review-flow span { padding: 7px; border: 1px solid var(--line-soft); background: #fff; }
    .eval-review-flow span.done { border-color: var(--line); color: var(--accent); }
    .eval-review-flow span.active { border-color: var(--warn); background: var(--warn-soft); color: var(--warn); box-shadow: inset 3px 0 var(--warn); }
    .eval-review-flow i { color: var(--faint); font-style: normal; }
    .eval-review-form { display: grid; gap: 14px; padding: 18px 20px 20px; }
    .eval-field { display: grid; gap: 6px; min-width: 0; color: var(--text); font-size: 13px; font-weight: 700; }
    .eval-field small { color: var(--muted); font-size: 12px; font-weight: 400; line-height: 1.5; }
    .eval-field textarea, .eval-field input, .eval-field select {
      width: 100%;
      min-width: 0;
      border-color: var(--line);
      background: var(--panel-2);
      color: var(--text);
      font: 13px/1.55 "Cascadia Code", Consolas, "Microsoft YaHei UI", monospace;
    }
    .eval-field textarea:focus, .eval-field input:focus, .eval-field select:focus { border-color: var(--muted); box-shadow: 0 0 0 3px rgba(23, 104, 230, .1); outline: 0; }
    .eval-review-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .eval-trap-picker { min-width: 0; margin: 0; padding: 13px; border: 1px solid var(--line-soft); background: var(--panel-2); }
    .eval-trap-picker legend { padding: 0 6px; color: var(--text); font-size: 13px; font-weight: 700; }
    .eval-trap-picker > p { margin: 0 0 10px; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .eval-trap-picker > div { display: grid; gap: 6px; }
    .eval-trap-option { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 9px; align-items: start; padding: 9px; border: 1px solid var(--line-soft); background: #fff; color: var(--accent); cursor: pointer; font-size: 13px; }
    .eval-trap-option:has(input:checked) { border-color: var(--muted); background: var(--panel-2); box-shadow: inset 3px 0 var(--muted); }
    .eval-trap-option input { margin-top: 2px; accent-color: var(--muted); }
    .eval-trap-option span { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; line-height: 1.4; }
    .eval-trap-option b { color: var(--muted); font-family: "Cascadia Code", Consolas, monospace; }
    .eval-reject-field { padding-top: 12px; border-top: 1px dashed var(--line-soft); }
    .eval-preview { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 5px 12px; padding: 13px; border: 1px solid var(--faint); background: var(--panel-2); color: var(--accent); }
    .eval-preview > span { color: var(--muted); font: 700 11px/1.3 "Cascadia Code", Consolas, monospace; letter-spacing: .09em; }
    .eval-preview strong { font-size: 14px; }
    .eval-preview code, .eval-preview small { grid-column: 1 / -1; color: var(--muted); font-size: 12px; }
    .eval-review-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding-top: 2px; }
    .eval-review-actions > span { flex: 1 1 220px; color: var(--muted); font-size: 12px; line-height: 1.4; }
    .eval-review-actions .danger-text { color: var(--danger); }
    .eval-review-error { margin: 14px 20px 0; }
    .eval-review-decision { display: grid; gap: 7px; margin: 18px 20px; padding: 16px; border-left: 4px solid var(--ok); background: var(--ok-soft); }
    .eval-review-decision.rejected { border-left-color: var(--danger); background: var(--danger-soft); }
    .eval-review-decision > span { color: var(--ok); font: 700 11px/1.2 "Cascadia Code", Consolas, monospace; letter-spacing: .09em; }
    .eval-review-decision.rejected > span { color: var(--danger); }
    .eval-review-decision > strong { color: var(--text); font-size: 15px; }
    .eval-review-decision > p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; }
    .eval-review-workbench > .eval-review-actions { padding: 0 20px 20px; }
    .eval-case-summary { display: grid; gap: 8px; margin: 8px 0 0; }
    .eval-case-summary > div { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; padding-top: 8px; border-top: 1px solid rgba(22, 133, 90, .17); }
    .eval-case-summary dt { color: var(--muted); font-size: 12px; }
    .eval-case-summary dd { margin: 0; overflow-wrap: anywhere; color: var(--text); font: 13px/1.5 "Cascadia Code", Consolas, monospace; }

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
      background: var(--warn-soft);
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
      .shell { grid-template-columns: 1fr; grid-template-rows: none; overflow: auto; }
      .app-topbar, .rail, .queue, .detail, .splitter { grid-row: auto; }
      .splitter { display: none; }
      .sidebar-toggle { display: none; }
      .rail { min-height: 520px; border-right: 0; border-bottom: 1px solid var(--line); }
      .queue { min-height: auto; }
      .rail > .bar {
        min-height: auto;
        padding: 10px 12px;
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
      }
      .app-topbar { height: auto; min-height: 52px; }
      .app-topbar .main-nav { margin-left: 0; order: 3; flex-basis: 100%; }
      .topbar-tools { margin-left: auto; }
      .compact-workspace-toggle { display: inline-flex; }
      .queue .project-form,
      .queue > .scroll { display: none; }
      .queue.compact-open .project-form { display: grid; }
      .queue.compact-open > .scroll {
        display: block;
        max-height: min(48vh, 430px);
        border-bottom: 1px solid var(--line-soft);
      }
      .detail { min-height: 520px; border-right: 0; border-bottom: 1px solid var(--line); }
      .queue { border-right: 0; border-bottom: 1px solid var(--line); }
      .impact-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .impact-grid { grid-template-columns: 1fr; }
      .eval-metric-grid, .eval-rate-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .evals-lanes { grid-template-columns: minmax(0, 1fr); }
      .controlled-run-form { grid-template-columns: minmax(220px, 1.4fr) minmax(160px, 1fr) 110px; }
      .controlled-seed { grid-column: 1 / 3; }
    }

    @media (max-width: 700px) {
      .app-topbar { gap: 10px; }
      .app-topbar .main-nav { overflow-x: auto; }
      .controlled-run-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .controlled-run-copy, .controlled-guardrails { grid-column: 1 / -1; }
      .controlled-seed { grid-column: auto; }
      .controlled-sides { grid-template-columns: 1fr; gap: 8px; }
      .controlled-delta { grid-template-columns: auto auto auto; justify-content: center; }
      .controlled-result-head, .controlled-history-row, .controlled-cases-head { align-items: stretch; flex-direction: column; }
    }

    @media (max-width: 520px) {
      .bar { align-items: flex-start; flex-direction: column; }
      .rail > .bar { align-items: stretch; }
      .app-topbar { align-items: stretch; flex-direction: column; }
      .app-topbar .main-nav { order: 0; }
      .filter-grid, .summary-grid, .detail-kv, .provider-fields, .local-model-grid, .form-grid, .insight-form-grid, .learning-agent-form { grid-template-columns: 1fr; }
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
      .impact-stats-strip { font-size: 13px; }
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
    <div class="app-topbar">
      <div class="app-brand">
        <div class="title">codetrap</div>
        <div class="subtle" id="app-subtitle">review console</div>
      </div>
      <nav class="main-nav" aria-label="Main view">
        <button type="button" class="active" data-main-view="review">Review</button>
        <button type="button" data-main-view="library">Library</button>
        <button type="button" data-main-view="learning">Learning</button>
        <button type="button" data-main-view="embeddings">Embeddings</button>
        <button type="button" data-main-view="impact">Impact</button>
      </nav>
      <div class="topbar-tools">
        <div class="segmented locale-switcher" aria-label="Language">
          <button type="button" data-locale="en">EN</button>
          <button type="button" data-locale="zh">中文</button>
        </div>
        <button class="ghost" id="refresh" title="Refresh">Refresh</button>
        <button type="button" class="ghost compact-workspace-toggle" id="compact-workspace-toggle" aria-expanded="false" aria-controls="project-form workspace-list">Projects &amp; sessions</button>
      </div>
    </div>
    <aside class="rail">
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
    </aside>

    <div class="splitter" data-splitter="left" role="separator" aria-orientation="vertical" aria-label="Resize list and detail panes" tabindex="0"></div>

    <section class="detail">
      <div class="bar">
        <div>
          <div class="title" id="detail-title">candidate detail</div>
          <div class="subtle" id="detail-meta">select a candidate</div>
        </div>
      </div>
      <div class="detail-body" id="detail"></div>
    </section>

    <div class="splitter" data-splitter="right" role="separator" aria-orientation="vertical" aria-label="Resize detail and workspace panes" tabindex="0"></div>

    <section class="queue" id="workspace-pane">
      <div class="bar">
        <div class="title" id="workspace-pane-title">Projects &amp; sessions</div>
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
