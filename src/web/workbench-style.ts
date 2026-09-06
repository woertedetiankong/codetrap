/** Shared desktop chrome and the reading-first Library / Review surfaces. */
export const WORKBENCH_STYLE = `
  button { transition: background-color 120ms ease, border-color 120ms ease; }
  button:hover { border-color: var(--accent-line); }
  button:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  button:disabled { cursor: default; }
  .app-brand .title { font-size: 20px; font-weight: 700; letter-spacing: -.035em; }
  .app-topbar .main-nav button { display: flex; align-items: center; gap: 10px; }
  .nav-icon { width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; }
  .nav-icon svg { width: 100%; height: 100%; fill: currentColor; }
  .app-topbar .main-nav button.active { background: var(--accent); color: var(--surface); }
  .rail, .detail { min-width: 0; backdrop-filter: none; }
  .rail { background: var(--list-bg); }
  .detail { background: var(--surface); }
  .bar .title { font-weight: 650; }
  .subtle { line-height: 1.5; }
  .shell[data-view="library"] .rail .row,
  .shell[data-view="review"] .rail .row { border: 0; border-bottom: 1px solid var(--line-soft); border-radius: 6px; box-shadow: none; padding: 16px 14px; background: transparent; gap: 8px; }
  .shell[data-view="library"] .rail .row.active,
  .shell[data-view="review"] .rail .row.active { background: var(--selection-bg); box-shadow: inset 3px 0 var(--accent); }
  .shell[data-view="library"] .rail .row:hover,
  .shell[data-view="review"] .rail .row:hover { background: var(--list-hover); }
  .row-title { font-size: 14px; line-height: 1.5; font-weight: 600; }
  .shell[data-view="library"] .row .meta .pill,
  .shell[data-view="review"] .row .meta .pill { border: 0; background: transparent; padding: 0; border-radius: 0; font-size: 12px; }
  .shell[data-view="library"] .row .meta,
  .shell[data-view="review"] .row .meta { gap: 8px; }
  .library-tools { padding: 6px 0 0; background: transparent; }
  #trap-search { min-height: 40px; font-size: 14px; }
  .library-filters > summary { display: list-item; font-size: 13px; padding: 12px 2px; }
  .library-filters .filter-grid { padding: 8px 0 16px; gap: 12px; }
  .library-filters label { text-transform: none; font-size: 12px; }
  .library-filters select, .library-filters input { font-size: 13px; }
  .shell .health-grid { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0 0 12px; border-bottom: 1px solid var(--line-soft); }
  .shell .health-metric { display: flex; width: auto; flex: 0 1 auto; align-items: center; gap: 5px; padding: 5px 8px; min-height: 30px; border: 0; border-radius: 6px; box-shadow: none; background: transparent; }
  .shell .health-metric.active { background: var(--accent-soft); color: var(--accent-strong); box-shadow: none; }
  .shell .health-metric .metric-label { font-size: 11px; line-height: 1.3; min-height: 0; text-transform: none; }
  .shell .health-metric .metric-value { font-size: 12px; line-height: 1.3; font-weight: 650; }
  .shell .health-metric .subtle { display: none; }
  .shell[data-view="library"] .detail-body,
  .shell[data-view="review"] .detail-body { display: flex; flex-direction: column; overflow: hidden; }
  .lesson-reader, .review-reader { flex: 1; min-height: 0; overflow: auto; padding: 24px clamp(20px, 3vw, 44px) 40px; }
  .lesson-reader > .section, .review-reader > .section, .review-reader > form.section { padding: 20px 0; }
  .lesson-reader .lesson-heading { border-top: 0; padding-top: 0; }
  .lesson-heading h1 { font-size: clamp(23px, 2vw, 29px); font-weight: 650; letter-spacing: -.035em; line-height: 1.3; margin: 0 0 14px; overflow-wrap: anywhere; }
  .lesson-heading .meta, .reader-metadata { display: flex; flex-wrap: wrap; gap: 10px; color: var(--muted); font-size: 13px; }
  .lesson-heading .pill { border: 0; border-radius: 0; background: transparent; padding: 0; }
  .lesson-copy { display: grid; gap: 26px; padding: 26px 0; }
  .lesson-copy .text-block { margin: 0; display: grid; gap: 10px; }
  .lesson-copy h2, .lesson-copy label { font-size: 15px; line-height: 1.4; font-weight: 650; color: var(--text); text-transform: none; margin: 0; }
  .lesson-copy .content { font-size: 15px; line-height: 1.75; max-width: 72ch; white-space: pre-wrap; overflow-wrap: anywhere; }
  .lesson-solution { border-left: 3px solid var(--accent); padding-left: 18px; }
  .lesson-copy h2 { display: flex; align-items: center; gap: 12px; min-height: 24px; }
  .reader-section-icon { display: inline-flex; flex: 0 0 24px; width: 24px; height: 24px; color: var(--text); }
  .reader-section-icon svg { display: block; width: 100%; height: 100%; fill: currentColor; }
  .reader-section-icon-fix { color: var(--accent); }
  .lesson-copy .text-block > .content { margin-left: 36px; }
  .lesson-code-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .lesson-code-pair:empty { display: none; }
  .lesson-code-pair > .section { padding: 0 0 22px; border: 0; min-width: 0; }
  .lesson-code-pair .code-block { margin: 0; font-size: 12px; line-height: 1.6; color: var(--text); background: var(--code-bg); border: 1px solid var(--line-soft); border-radius: 8px; }
  details.reader-disclosure, details.library-metadata { display: block; }
  .reader-disclosure > summary, .library-metadata > summary { cursor: pointer; padding: 4px 0; font-size: 13px; font-weight: 600; }
  .reader-disclosure[open] > summary, .library-metadata[open] > summary { margin-bottom: 16px; }
  .reader-disclosure > .section { padding: 16px 0; }
  .review-reader-toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
  .review-reader-toolbar button { font-size: 13px; }
  .review-reader .lesson-heading { border-bottom: 1px solid var(--line-soft); padding-bottom: 22px; }
  .review-reader #candidate-form > .form-grid { grid-template-columns: 1fr; gap: 20px; }
  .review-reader #candidate-form label { text-transform: none; }
  .review-reader #candidate-form textarea { min-height: 110px; font-size: 14px; line-height: 1.6; }
  .review-applicability { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--line-soft); }
  #candidate-form[hidden], #review-preview[hidden] { display: none; }
  .review-reader > .form-draft-recovery { margin: 0 0 16px; }
  .review-reader > .section .meta { font-size: 12px; }
  .candidate-actions { flex-shrink: 0; padding: 14px 22px; background: var(--action-bg); align-items: center; }
  .candidate-primary-actions { width: 100%; }
  .candidate-primary-actions #reject { order: -1; margin-right: auto; }
  .candidate-primary-actions button { min-height: 36px; font-size: 13px; }
  .candidate-more-actions summary { padding: 0; border: 0; box-shadow: none; background: transparent; font-size: 12px; }
  .candidate-actions .action-hint { font-size: 12px; min-width: 0; margin-left: auto; }
  .candidate-more-panel { position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 5; width: min(430px, 70vw); box-shadow: 0 8px 30px var(--shadow); }
  .shell[data-view="review"] ~ .receipt,
  .shell[data-view="review"] ~ .status { bottom: 140px; max-height: calc(100dvh - 280px); overflow: auto; }
  .shell[data-view="review"] .review-banner { border: 0; border-radius: 0; background: transparent; padding: 0 0 12px; border-bottom: 1px solid var(--line-soft); }
  /* Learning, observation and settings share the same reading density. */
  a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .empty { overflow-wrap: anywhere; line-height: 1.7; }
  .empty > strong { display: block; color: var(--text); font-size: 16px; }
  .empty > p { margin: 10px 0 16px; }
  .empty > button { width: auto; }
  .status, .receipt { max-width: min(520px, calc(100vw - 28px)); overflow-wrap: anywhere; }
  .shell[data-view="learning"] ~ .status, .shell[data-view="learning"] ~ .receipt { bottom: 90px; max-height: calc(100dvh - 220px); overflow: auto; }
  .shell[data-view="learning"] .detail-body, .shell[data-view="embeddings"] .detail-body { display: flex; flex-direction: column; overflow: hidden; }
  .shell[data-view="learning"] #detail > .scroll, .embedding-reader { flex: 1; min-height: 0; overflow: auto; padding: 24px clamp(20px, 3vw, 44px) 32px; }
  .shell[data-view="learning"] #detail > .scroll > .section { padding: 22px 0; }
  .shell[data-view="learning"] #detail > .scroll > .learning-intro { padding-top: 0; border-top: 0; }
  .learning-title, .settings-heading h1 { margin: 12px 0; font-family: inherit; font-size: clamp(23px, 2vw, 29px); font-weight: 650; line-height: 1.3; letter-spacing: -.035em; overflow-wrap: anywhere; }
  .learning-summary { font-size: 15px; line-height: 1.7; color: var(--muted); max-width: 72ch; }
  .learning-body, .learning-prose { font-family: inherit; font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
  .learning-prose { max-width: 76ch; }
  .learning-code { max-width: 100%; color: var(--text); background: var(--code-bg); font-size: 13px; border: 1px solid var(--line-soft); border-radius: 8px; overflow: auto; }
  .learning-controls { position: static; backdrop-filter: none; background: transparent; padding-bottom: 0; }
  .learning-scope { width: fit-content; max-width: 100%; }
  .learning-filters > summary { padding-block: 12px; }
  .learning-collection { border-radius: 8px; box-shadow: none; background: var(--surface); }
  .learning-collection:hover, .learning-collection.collapsed { box-shadow: none; }
  .collection-header { background: var(--list-bg); }
  .collection-progress-row { flex-wrap: wrap; gap: 8px; }
  .collection-progress { flex: 0 0 48px; }
  .collection-progress-copy { min-width: 0; flex: 1 1 140px; white-space: normal; overflow-wrap: anywhere; line-height: 1.5; }
  .collection-title-line strong, .chapter-copy { overflow-wrap: anywhere; }
  .collection-rename { opacity: 1; }
  .source-coverage-heading strong, .collection-context-copy { font-family: inherit; }
  .source-coverage-panel { background: var(--list-bg); }
  .learning-impact-group .field-label, .learning-practice h3 label { text-transform: none; letter-spacing: 0; }
  .collection-toggle { padding: 14px; }
  .collection-title-line strong { font-family: inherit; font-size: 15px; font-weight: 650; }
  .learning-chapter { padding: 14px 12px; }
  .learning-chapter.active { background: var(--selection-bg); }
  .learning-standalone-row { background: transparent; border: 0; border-bottom: 1px solid var(--line-soft); border-radius: 6px; padding: 14px; }
  .learning-standalone-row.active { background: var(--selection-bg); box-shadow: inset 3px 0 var(--accent); }
  .learning-prompt-card { background: var(--list-bg); max-width: 640px; margin: 18px auto 0; padding: 18px; gap: 12px; }
  .learning-prompt-card code { font-family: inherit; font-size: 14px; line-height: 1.75; }
  .learning-prompt-card button { width: fit-content; }
  .detail-body > .learning-empty { max-width: 720px; margin: 24px auto; text-align: left; padding: 24px; }
  .learning-impact-card, .learning-agent-card, .learning-practice { background: transparent; border-radius: 0; box-shadow: none; }
  .learning-actions { background: var(--action-bg); padding: 12px 20px; }
  .learning-actions button { min-height: 38px; }
  .embedding-summary { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .embedding-summary .metric { min-height: 0; gap: 6px; padding: 16px 4px; border: 0; border-bottom: 1px solid var(--line-soft); border-radius: 0; background: transparent; box-shadow: none; }
  .embedding-summary .metric-value { font-size: 16px; line-height: 1.5; letter-spacing: 0; overflow-wrap: anywhere; }
  .embedding-summary .metric-label { font-size: 12px; text-transform: none; }
  .embedding-summary .subtle { font-size: 12px; }
  .settings-heading { margin-bottom: 24px; }
  .settings-heading h1 { margin-top: 0; }
  .settings-heading p { color: var(--muted); font-size: 14px; line-height: 1.7; margin: 0; max-width: 70ch; }
  .embedding-reader .section { padding: 22px 0; }
  .embedding-reader .settings-form { padding: 0 0 24px; border: 0; border-radius: 0; box-shadow: none; background: transparent; }
  .embedding-settings-fields { min-width: 0; margin: 0; padding: 0; border: 0; display: grid; gap: 16px; }
  .embedding-settings-fields legend { margin-bottom: 12px; }
  .embedding-settings-fields > button { width: fit-content; min-height: 38px; }
  #embedding-provider-tabs { width: fit-content; max-width: 100%; }
  #embedding-provider-tabs button { min-height: 38px; }
  .embedding-reader .local-model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .embedding-reader .local-model-card { padding: 16px; border-radius: 8px; box-shadow: none; background: var(--surface); gap: 12px; }
  .embedding-reader .local-model-card.active { background: var(--selection-bg); border-color: var(--accent); box-shadow: inset 3px 0 var(--accent); }
  .embedding-reader .local-model-card-head { flex-wrap: wrap; gap: 8px; }
  .embedding-reader .local-model-card code { overflow-wrap: anywhere; }
  .embedding-reader .local-model-panel > .subtle { margin-top: 12px; font-size: 12px; line-height: 1.7; }
  .embedding-reader .detail-kv { gap: 0 24px; }
  .embedding-reader .kv { border: 0; border-radius: 0; padding: 12px 0; border-bottom: 1px solid var(--line-soft); background: transparent; }
  .embedding-reader .profile-row { border: 0; border-bottom: 1px solid var(--line-soft); border-radius: 0; padding: 12px 0; }
  .impact-shell { background: var(--surface); padding: 24px; }
  .impact-overview-workspace { padding: 24px clamp(20px, 3vw, 36px); }
  .impact-tabs { margin: 0 0 16px; background: var(--list-bg); }
  .impact-hero h2, .evals-hero h2, .overview-welcome h2 { font-family: inherit; font-size: clamp(23px, 2vw, 29px); line-height: 1.3; }
  .impact-kicker { font-family: inherit; letter-spacing: .06em; margin-bottom: 10px; }
  .observation-connection { margin: 0 0 20px; padding: 12px 16px; gap: 8px 18px; background: var(--list-bg); }
  .observation-connection strong { margin-top: 4px; font-size: 13px; }
  .overview-hero { padding: 0 0 20px; }
  .overview-local { margin-top: 10px; }
  .overview-metrics { padding: 18px 0; }
  .overview-metrics strong { font-size: 29px; }
  .overview-metrics article { gap: 7px; }
  .overview-columns { gap: 24px; margin-top: 24px; }
  .overview-attention { padding: 18px; background: var(--list-bg); border-radius: 8px; }
  .overview-welcome { padding: 24px 0; gap: 28px; }
  .impact-hero, .evals-hero { background: var(--list-bg); border-radius: 8px; box-shadow: none; padding: 20px; }
  .overview-hero { background: transparent; padding: 0 0 20px; }
  .evals-shell { display: block; }
  .evals-hero { margin-bottom: 20px; }
  .evals-section { margin-top: 20px; padding: 20px; border-radius: 8px; background: var(--surface); box-shadow: none; }
  .evals-lanes { margin-top: 20px; }
  .impact-card, .impact-notice, .eval-review-workbench { border-radius: 8px; box-shadow: none; }
  .impact-card, .eval-review-workbench, .impact-event, .impact-hero, .evals-section { min-width: 0; overflow-wrap: anywhere; }
  .impact-hero-grid { gap: 20px; }
  .impact-run-head h2 { color: var(--text); font-family: inherit; font-size: clamp(22px, 2vw, 29px); line-height: 1.3; }
  .impact-run-row { padding: 16px 14px; border: 0; border-bottom: 1px solid var(--line-soft); border-radius: 6px; background: transparent; box-shadow: none; }
  .impact-run-row.active { background: var(--selection-bg); box-shadow: inset 3px 0 var(--accent); }
  .impact-run-row .pill { border: 0; background: transparent; padding: 0; font-size: 12px; }
  .eval-score { min-height: 100px; border: 1px solid var(--line-soft); border-radius: 6px; background: var(--list-bg); gap: 10px; }
  .eval-score > strong { font-family: inherit; font-size: 29px; line-height: 1.1; }
  .impact-timeline { min-width: 0; }
  .impact-mobile-run { display: none; }
  .impact-event pre, .evals-section pre { max-width: 100%; overflow: auto; }
  @media (min-width: 1061px) { .rail .learning-empty > span { display: none; } }
  @media (max-width: 1060px) {
    .shell:is([data-view="embeddings"], [data-view="impact"]) { display: flex; flex-direction: column; height: 100dvh; overflow: hidden; }
    .shell:is([data-view="embeddings"], [data-view="impact"]) .rail { display: none; }
    .shell:is([data-view="embeddings"], [data-view="impact"]) .app-topbar { flex-shrink: 0; width: 100%; }
    .shell:is([data-view="embeddings"], [data-view="impact"]) .detail { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .shell:is([data-view="embeddings"], [data-view="impact"]) .detail > .bar { flex-shrink: 0; }
    .shell:is([data-view="embeddings"], [data-view="impact"]) .detail-body { flex: 1; min-height: 0; }
    .shell:is([data-view="embeddings"], [data-view="impact"]) .queue { display: none; }
    .shell:is([data-view="embeddings"], [data-view="impact"]) .queue.compact-open { display: flex !important; position: fixed; inset: auto 0 0; max-height: 60dvh; z-index: 50; background: var(--panel); }
    .shell[data-view="impact"] .impact-shell { flex: 1; min-height: 0; height: auto; overflow: auto; }
    .shell[data-view="impact"] .detail > .bar .subtle { overflow-wrap: anywhere; }
    .impact-mobile-run { display: grid; gap: 6px; margin: 0 0 16px; font-size: 12px; color: var(--muted); }
    .impact-mobile-run select { width: 100%; min-width: 0; }
    .shell[data-view="learning"] #detail > .scroll, .embedding-reader { padding: 20px; }
  }
  @media (max-width: 760px) {
    .embedding-reader .local-model-grid { grid-template-columns: minmax(0, 1fr); }
    .impact-shell { padding: 16px; }
    .impact-hero-grid { grid-template-columns: minmax(0, 1fr); }
    .observation-connection { grid-template-columns: minmax(0, 1fr); }
    .connection-clients { flex-wrap: wrap; }
    .impact-hero, .evals-hero, .evals-section { padding: 16px; }
    .overview-hero { padding: 0 0 20px; }
    .impact-tabs button, .eval-review-actions button { min-height: 38px; }
  }
  @media (max-width: 520px) {
    .shell[data-view="learning"] #detail > .scroll, .embedding-reader { padding: 16px; }
    .learning-title, .settings-heading h1 { font-size: 23px; }
    .learning-body, .learning-prose { font-size: 14px; }
    .detail-body > .learning-empty { padding: 18px; margin: 0; }
    .embedding-reader .provider-fields { grid-template-columns: minmax(0, 1fr); }
    .embedding-reader .detail-kv { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .embedding-technical .detail-kv { grid-template-columns: minmax(0, 1fr); }
    .learning-prompt-card { padding: 14px; }
    .overview-metrics strong { font-size: 26px; }
    .overview-section-head { gap: 10px; flex-wrap: wrap; }
    .revision-dialog { width: calc(100vw - 24px); padding: 18px; }
  }
  @media (min-width: 1280px) {
    :root { --topbar-height: 0px; --navigation-width: 188px; }
    .shell { margin-left: var(--navigation-width); width: calc(100% - var(--navigation-width)); grid-template-rows: minmax(0, 1fr); }
    .app-topbar { position: fixed; inset: 0 auto 0 0; width: var(--navigation-width); height: 100dvh; padding: 26px 12px 18px; display: flex; flex-direction: column; align-items: stretch; flex-wrap: nowrap; gap: 28px; background: var(--navigation-bg); border-right: 1px solid var(--line); border-bottom: 0; z-index: 12; }
    .app-brand { padding: 0 10px; }
    .app-brand .subtle { margin-top: 7px; font-size: 12px; line-height: 1.5; }
    .app-topbar .main-nav { flex-direction: column; margin: 0; border: 0; box-shadow: none; background: transparent; padding: 0; gap: 5px; }
    .app-topbar .main-nav button { width: 100%; min-height: 42px; padding: 0 12px; border-radius: 8px; font-size: 14px; text-align: left; }
    .app-topbar .main-nav [data-main-view="embeddings"] { order: 5; margin-top: 26px; border-top: 1px solid var(--line); border-radius: 0; padding-top: 16px; padding-bottom: 16px; }
    .app-topbar .main-nav [data-main-view="embeddings"].active { border-radius: 8px; }
    .topbar-tools { margin-top: auto; flex-direction: column; align-items: stretch; gap: 12px; }
    .locale-switcher { justify-content: center; }
    .topbar-tools #refresh { font-size: 12px; }
    .rail, .queue, .detail, .splitter { grid-row: 1; }
    .shell > .rail > .bar, .shell > .detail > .bar { min-height: 74px; }
    .rail > .bar .title { font-size: 17px; }
    .detail > .bar .title { font-size: 13px; color: var(--muted); font-weight: 500; }
    .shell .shell-toggle { top: 18px; }
    .shell .edge-reveal { top: 0; }
  }
  @media (max-width: 1279px) { .nav-icon { display: none; } }
  @media (max-width: 1060px) {
    .lesson-reader, .review-reader { padding: 20px 20px 32px; }
    .lesson-heading h1 { font-size: 24px; }
    .lesson-code-pair { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 520px) {
    .lesson-reader, .review-reader { padding: 16px 16px 28px; }
    .lesson-heading h1 { font-size: 22px; }
    .lesson-copy .content { font-size: 14px; line-height: 1.7; }
    .candidate-actions { padding: 10px 12px; gap: 4px 8px; }
    .candidate-primary-actions { gap: 6px; }
    .candidate-primary-actions button { padding: 0 10px; min-height: 40px; }
    .candidate-actions .action-hint { margin-left: 0; }
    .review-applicability .form-grid { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) { button, .rail, .detail { transition: none; } }
`;
