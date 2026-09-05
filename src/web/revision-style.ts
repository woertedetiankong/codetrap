export const REVISION_STYLE = `
.revision-dialog { width:min(900px,calc(100vw - 48px)); max-height:calc(100dvh - 48px); box-sizing:border-box; margin:auto; padding:30px; overflow-y:auto; border:1px solid var(--line); border-radius:14px; background:var(--panel); color:var(--text); box-shadow:0 24px 80px var(--shadow); }
.revision-dialog::backdrop { background:color-mix(in srgb, var(--ink) 52%, transparent); }
.revision-dialog header { display:flex; align-items:start; justify-content:space-between; gap:18px; }
.revision-dialog h2 { font-size:27px; margin:5px 0 0; letter-spacing:-.6px; }
.revision-kicker { font-size:10px; letter-spacing:1.8px; color:var(--muted); }
.revision-dialog section { border-top:1px solid var(--line); padding:20px 0 6px; margin-top:20px; }
.revision-dialog h3 { font-size:15px; margin:0 0 12px; }
.revision-dialog p { line-height:1.65; overflow-wrap:anywhere; }
.revision-dialog fieldset { border:0; padding:0; margin:0; min-width:0; }
.revision-dialog label { display:flex; flex-direction:column; gap:7px; margin:16px 0; font-size:12px; font-weight:600; }
.revision-dialog textarea { width:100%; min-width:0; resize:vertical; box-sizing:border-box; padding:11px 12px; border:1px solid var(--line); border-radius:6px; background:var(--surface); color:var(--text); font-family:inherit; font-size:14px; font-weight:400; line-height:1.6; }
.revision-dialog textarea[rows="1"] { min-height:46px; }
.revision-dialog textarea:focus { outline:2px solid var(--accent); outline-offset:2px; }
.revision-dialog textarea[readonly] { background:var(--surface-2); }
.revision-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; }
.revision-actions { display:flex; flex-wrap:wrap; gap:8px; }
.revision-dialog button { min-height:36px; white-space:normal; }
.revision-dialog footer { padding:20px 0 0; border-top:1px solid var(--line); }
.revision-dialog footer p { font-size:12px; }
.revision-source { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:10px 0; }
.revision-source small { width:100%; color:var(--muted); overflow-wrap:anywhere; }
.revision-notice { padding:12px 14px; background:var(--warn-soft); border-radius:6px; font-size:13px; }
.revision-before { padding:12px 14px; background:var(--surface-2); border-radius:6px; }
.revision-before summary { cursor:pointer; font-size:13px; }
.revision-before p { white-space:pre-wrap; font-size:13px; }
.revision-before h4 { margin-bottom:0; font-size:12px; }
.revision-status { font-size:13px; color:var(--ok); min-height:20px; }
.revision-status[role=alert],.revision-fail { color:var(--danger); }
.revision-pass { color:var(--ok); }
.revision-results table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px; }
.revision-results th,.revision-results td { padding:10px 6px; border-bottom:1px solid var(--line); text-align:left; overflow-wrap:anywhere; }
.revision-results th:first-child { width:55%; }
.revision-results small { display:block; color:var(--muted); margin-top:4px; }
.suite-dialog .eval-trap-option { flex-direction:row; align-items:start; text-transform:none; letter-spacing:normal; }
.suite-dialog .eval-trap-option input { width:auto; margin-top:3px; }
.suite-dialog .eval-trap-option small { display:block; font-weight:400; color:var(--muted); }
.suite-dialog ul { padding-left:20px; line-height:1.8; overflow-wrap:anywhere; }
.suite-dialog [data-case-preview] { margin:20px 0; }
.revision-history-item { display:flex; width:100%; justify-content:space-between; gap:12px; text-align:left; background:transparent; color:var(--text); border:0; border-bottom:1px solid var(--line); padding:14px 0; }
.revision-history-item span:first-child { min-width:0; overflow-wrap:anywhere; }
.revision-history-item .pill { flex-shrink:0; align-self:center; }
@media(max-width:600px) { .revision-dialog { width:calc(100vw - 16px); max-height:calc(100dvh - 16px); padding:20px 16px; border-radius:10px; } .revision-grid { grid-template-columns:1fr; gap:0; } .revision-dialog h2 { font-size:23px; } .revision-dialog button { min-height:44px; } }
`;
