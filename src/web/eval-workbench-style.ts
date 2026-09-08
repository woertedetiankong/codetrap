/** Evaluation-specific layout; existing review and draft recovery keep their contracts. */
export const EVAL_WORKBENCH_STYLE = `
  .shell.impact-evals-mode, .shell.impact-evals-mode.queue-collapsed { grid-template-columns: minmax(0, 1fr) !important; }
  .shell.impact-evals-mode .rail, .shell.impact-evals-mode .splitter,
  .shell.impact-evals-mode #sidebar-toggle, .shell.impact-evals-mode .edge-reveal-left { display: none; }
  .shell.impact-evals-mode .detail { min-width: 0; }
  .evals-shell { max-width: 1240px; margin: 0 auto; padding: 16px clamp(16px, 3vw, 40px) 40px; background: var(--surface); }
  .evals-shell .impact-tabs { margin-bottom: 0; }
  .bench-main .form-draft-recovery > p { margin: 0 0 6px; font-size: 11px; }
  .bench-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 0 10px; }
  .bench-heading h2 { margin: 0 0 8px; font-size: clamp(23px, 2.4vw, 30px); line-height: 1.25; letter-spacing: -.035em; }
  .bench-heading p, .bench-engine, .bench-method { color: var(--muted); font-size: 13px; line-height: 1.6; margin: 0; }
  .bench-heading-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .bench-heading button { flex-shrink: 0; font-size: 13px; }
  .bench-coverage { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 10px 16px; background: var(--surface-2); border-radius: 8px; font-size: 13px; }
  .bench-warning { color: var(--warn); background: var(--warn-soft); padding: 10px 12px; border-radius: 6px; font-size: 13px; line-height: 1.6; }
  .bench-coverage .bench-warning { flex-basis: 100%; padding: 0; margin: 0; background: transparent; }
  .bench-engine { display: grid; gap: 2px; padding: 8px 0 10px; }
  .bench-engine strong { font-size: 12px; font-weight: 500; color: var(--text); }
  .bench-engine span { font-size: 12px; }
  .evals-shell .controlled-eval-bench { display: block; border: 0; background: transparent; box-shadow: none; border-radius: 0; overflow: visible; }
  .evals-shell .controlled-run-form { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; padding: 12px 0; background: transparent; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .evals-shell .controlled-run-form > .eval-field { flex: 1; min-width: 210px; max-width: 540px; }
  .evals-shell .controlled-run-form select, .evals-shell .controlled-run-form input { width: 100%; min-height: 40px; font-size: 13px; }
  .evals-shell .controlled-run-button { min-height: 40px; min-width: 170px; margin: 0; align-self: auto; }
  .bench-settings { flex: 0 0 auto; margin-bottom: 10px; font-size: 12px; color: var(--muted); }
  .bench-settings[open] { flex-basis: 100%; margin-bottom: 0; }
  .bench-settings > summary { cursor: pointer; padding: 3px 0; }
  .bench-settings > div { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 16px; margin: 14px 0; max-width: 540px; }
  .bench-settings > p { margin: 8px 0 0; }
  .evals-shell .controlled-history-row { padding: 12px 0 8px; background: transparent; border: 0; }
  .evals-shell .controlled-history { max-width: 600px; width: 100%; }
  .evals-shell .controlled-history select { min-height: 36px; font-size: 12px; }
  .bench-empty { padding: 28px 0; }
  .bench-empty h3 { margin: 0 0 8px; font-size: 19px; }
  .bench-empty p { color: var(--muted); line-height: 1.7; font-size: 14px; }
  .bench-result-head { display: flex; justify-content: space-between; align-items: start; gap: 16px; padding: 4px 0 12px; }
  .bench-result-head h3 { font-size: 22px; margin: 8px 0 0; line-height: 1.35; letter-spacing: -.02em; }
  .bench-result-head > div:last-child { display: grid; gap: 6px; text-align: right; font-size: 12px; line-height: 1.5; }
  .bench-result-head small { color: var(--muted); }
  .bench-score-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .bench-score-pair > section { padding: 12px 20px; display: grid; gap: 10px; min-width: 0; }
  .bench-score-pair > section + section { border-left: 1px solid var(--line); background: var(--accent-soft); }
  .bench-score-pair section > span { font-size: 12px; color: var(--muted); line-height: 1.5; }
  .bench-score-pair strong { font-size: 28px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -.035em; }
  .bench-score-pair strong small { margin-left: 12px; font-size: 12px; font-weight: 400; letter-spacing: 0; }
  .bench-score-pair p { margin: 0; color: var(--muted); font-size: 12px; }
  .bench-result-counts { display: flex; flex-wrap: wrap; gap: 18px; padding: 14px 0 8px; font-size: 13px; }
  .bench-result-counts .pass, .bench-status.pass { color: var(--ok); }
  .bench-result-counts .fail, .bench-status.fail { color: var(--danger); }
  .bench-method { margin-bottom: 12px; font-size: 12px; }
  .evals-shell .controlled-cases-head { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding: 14px 0; background: transparent; border: 0; }
  .controlled-cases-head h4 { font-size: 14px; margin: 0; }
  .evals-shell .controlled-case-filters { margin: 0; display: flex; flex-wrap: wrap; gap: 4px; }
  .evals-shell .controlled-case-filters button { font-size: 12px; padding: 7px 10px; min-height: 34px; }
  .bench-table-scroll { overflow: auto; border: 1px solid var(--line); border-radius: 8px; max-height: 620px; }
  .bench-table-scroll:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .bench-case-table { width: 100%; min-width: 620px; border-collapse: collapse; table-layout: fixed; text-align: left; font-size: 13px; }
  .bench-case-table thead th { position: sticky; top: 0; z-index: 1; padding: 12px; background: var(--surface-2); font-size: 12px; font-weight: 600; }
  .bench-case-table th:first-child { width: 38%; }
  .bench-case-table th:last-child { width: 14%; }
  .bench-case-table tbody th, .bench-case-table td { padding: 14px 12px; vertical-align: top; border-top: 1px solid var(--line-soft); line-height: 1.5; font-weight: 400; overflow-wrap: anywhere; }
  .bench-case-table tbody tr:hover { background: var(--surface-hover); }
  .bench-case-table tr.regressed th { box-shadow: inset 3px 0 var(--danger); }
  .bench-case-table button { text-align: left; display: block; padding: 0; min-height: 24px; background: transparent; border: 0; color: var(--accent-strong); font: inherit; font-weight: 600; line-height: 1.5; box-shadow: none; }
  .bench-case-table button:hover { text-decoration: underline; }
  .bench-case-table small { display: block; font-size: 11px; line-height: 1.6; color: var(--muted); margin-top: 5px; }
  .bench-top-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--muted); font-size: 11px; margin-top: 6px; }
  .bench-outcome { display: inline-block; font-size: 11px; border-radius: 4px; padding: 3px 6px; background: var(--surface-2); }
  .bench-outcome.regressed { background: var(--danger-soft); color: var(--danger); }
  .bench-outcome.improved { background: var(--ok-soft); color: var(--ok); }
  .bench-disclosure { display: block; border-top: 1px solid var(--line); padding: 16px 0; margin-top: 14px; font-size: 13px; line-height: 1.6; }
  .bench-disclosure > summary { cursor: pointer; font-weight: 600; color: var(--text); }
  .bench-disclosure[open] > summary { margin-bottom: 16px; }
  .bench-disclosure code, .bench-disclosure p { overflow-wrap: anywhere; }
  .bench-audit { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 3fr); gap: 8px 16px; font-size: 12px; color: var(--muted); }
  .bench-audit dd { margin: 0; overflow-wrap: anywhere; }
  .bench-case-dialog { box-sizing: border-box; width: min(1000px, calc(100vw - 32px)); max-width: none; max-height: calc(100dvh - 40px); overflow: auto; padding: 28px; border: 1px solid var(--line); border-radius: 12px; color: var(--text); background: var(--surface); box-shadow: 0 20px 80px #0003; }
  .bench-case-dialog::backdrop { background: #172b3c70; }
  .bench-dialog-head { display: flex; align-items: start; justify-content: space-between; gap: 20px; }
  .bench-dialog-head h2 { font-size: 22px; line-height: 1.45; margin: 0; overflow-wrap: anywhere; }
  .bench-dialog-head button { flex-shrink: 0; min-height: 40px; }
  .bench-snapshot { font-size: 12px; color: var(--muted); line-height: 1.6; }
  .bench-expected { font-size: 14px; line-height: 1.6; padding: 14px; background: var(--accent-soft); border-radius: 6px; overflow-wrap: anywhere; }
  .bench-detail-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
  .bench-detail-pair h3 { font-size: 16px; display: flex; gap: 16px; align-items: center; }
  .bench-detail-pair h4 { font-size: 13px; }
  .bench-detail-pair p, .bench-detail-pair li { font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
  .bench-detail-pair p { color: var(--muted); }
  .bench-detail-pair ol { padding-left: 24px; }
  .bench-detail-pair li { padding: 10px 0; border-top: 1px solid var(--line-soft); }
  .bench-detail-pair li small { display: block; color: var(--muted); font-size: 11px; }
  .bench-detail-pair li b { color: var(--ok); margin-left: 6px; font-weight: 500; }
  .bench-case-nav { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12px; padding-top: 16px; }
  .bench-case-nav button { min-height: 40px; }
  @media (max-width: 650px) {
    .evals-shell { padding: 16px 14px 32px; }
    .bench-heading { flex-wrap: wrap; gap: 12px; }
    .bench-result-head { display: grid; }
    .bench-result-head > div:last-child { text-align: left; }
    .bench-score-pair > section { padding: 12px; }
    .bench-score-pair strong { font-size: 24px; }
    .bench-score-pair strong small { display: block; margin: 5px 0 0; }
    .bench-settings > div { grid-template-columns: minmax(0, 1fr); }
    .evals-shell .controlled-run-form > .eval-field { min-width: 0; flex-basis: 100%; }
    .evals-shell .controlled-run-button { width: 100%; }
    .bench-case-dialog { padding: 18px; width: calc(100vw - 20px); max-height: calc(100dvh - 20px); }
    .bench-dialog-head { flex-direction: column-reverse; gap: 12px; }
    .bench-dialog-head button { align-self: flex-end; }
    .bench-detail-pair { grid-template-columns: minmax(0, 1fr); gap: 12px; }
    .bench-audit { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    .bench-audit dd { margin-bottom: 10px; }
  }
`;
