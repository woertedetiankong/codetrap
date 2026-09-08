/** The approved prototype's layout, sharing the main workspace's light neutral palette. */
export const IMPACT_APPLE_STYLE = `
.shell[data-view=impact].impact-apple-mode{display:block!important;margin:0!important;width:100%!important;height:100dvh!important;min-height:0!important;max-width:none!important;padding:0!important;overflow:hidden!important;background:var(--bg);border:0!important;border-radius:0!important}
.shell[data-view=impact]>.shell-toggle,.shell[data-view=impact]>.app-topbar,.shell[data-view=impact]>.rail,.shell[data-view=impact]>.queue,.shell[data-view=impact]>.splitter,.shell[data-view=impact]>.shell-resizer,.shell[data-view=impact]>.compact-workspace-bar,.shell[data-view=impact]>.compact-reader-bar,.shell[data-view=impact]>.detail>.bar{display:none!important}
.shell[data-view=impact]>.detail{display:block!important;width:100%!important;height:100dvh!important;border:0!important;padding:0!important;overflow:hidden!important;border-radius:0!important;grid-area:auto!important}
.shell[data-view=impact] #detail{display:block!important;padding:0!important;height:100%!important;overflow:auto!important;background:transparent!important}
/* Light neutrals inherit from :root in static.ts, including sheets mounted outside Impact. */
.ia-root,.ia-sheet{--side:var(--navigation-bg);--hover:var(--surface-hover);--control:var(--surface);--inset:var(--surface-2);--secondary:var(--muted);--blue:#006be6;--blue-hover:#005ecb;--blue-soft:#eaf2ff;--green:#287847;--green-soft:#edf6ee;--orange:#966017;--orange-soft:#fbf2e4;--red:#b84740;--red-soft:#fff0ef;--toolbar:color-mix(in srgb,var(--bg) 90%,transparent);--accent:var(--blue);--accent-soft:var(--blue-soft);--ok:var(--green);--ok-soft:var(--green-soft);--warn:var(--orange);--warn-soft:var(--orange-soft);--danger:var(--red);--danger-soft:var(--red-soft);color-scheme:light;font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",system-ui,sans-serif;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased}
body[data-impact-theme=dark] :is(.ia-root,.ia-sheet){--bg:#1c1c1e;--side:rgba(37,37,40,.95);--surface:#28282b;--hover:#343438;--control:var(--bg);--inset:var(--surface);--text:#f3f3f5;--secondary:#aeaeb5;--muted:var(--secondary);--faint:#96969f;--line:#3a3a3e;--blue:#75b5ff;--blue-hover:#92c6ff;--blue-soft:#253a55;--green:#8bd4a4;--green-soft:#243a2c;--orange:#e5b775;--orange-soft:#403322;--red:#ffaaa4;--red-soft:#402725;--toolbar:rgba(28,28,30,.9);color-scheme:dark}
:is(.ia-root,.ia-sheet) *{box-sizing:border-box}
:is(.ia-root,.ia-sheet) :is(h1,h2,h3,h4,p){margin:0;overflow-wrap:anywhere}
:is(.ia-root,.ia-sheet) h1{font-size:30px;line-height:1.24;font-weight:650;letter-spacing:-.035em}
:is(.ia-root,.ia-sheet) h2{font-size:20px;line-height:1.5;font-weight:630;letter-spacing:-.02em}
:is(.ia-root,.ia-sheet) h3{font-size:15px;line-height:1.6;font-weight:620}
:is(.ia-root,.ia-sheet) h4{font-size:12px;font-weight:550}
:is(.ia-root,.ia-sheet) :is(button,input,select,textarea){font:inherit;letter-spacing:normal;box-shadow:none;text-transform:none}
:is(.ia-root,.ia-sheet) button{color:var(--text);border:0;border-radius:9px;background:var(--surface);font-size:13px;font-weight:500;padding:9px 14px;min-height:39px;cursor:pointer;touch-action:manipulation;transition:background-color .14s,color .14s,transform .12s;line-height:1.5}
:is(.ia-root,.ia-sheet) button:hover{background:var(--hover)}
:is(.ia-root,.ia-sheet) button:active{transform:scale(.98)}
:is(.ia-root,.ia-sheet) button:disabled{opacity:.45;cursor:default;transform:none}
:is(.ia-root,.ia-sheet) button.primary{background:var(--blue);color:var(--bg)}
:is(.ia-root,.ia-sheet) button.primary:hover{background:var(--blue-hover)}
:is(.ia-root,.ia-sheet) :is(button,a,summary,input,select,textarea):focus-visible{outline:3px solid #007aff85;outline-offset:3px}
:is(.ia-root,.ia-sheet) :is(input,select,textarea){color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:10px;min-width:0;width:100%}
:is(.ia-root,.ia-sheet) textarea{resize:vertical;line-height:1.8}
:is(.ia-root,.ia-sheet) code{font-size:11px;overflow-wrap:anywhere;white-space:pre-wrap;color:var(--secondary);background:var(--surface)}
:is(.ia-root,.ia-sheet) label{text-transform:none;letter-spacing:normal;color:var(--text)}
:is(.ia-root,.ia-sheet) small{font-size:11px;line-height:1.7}
.ia-icon{width:20px;height:20px;display:inline-flex;flex:0 0 auto;vertical-align:middle;color:inherit}
.ia-icon svg{width:100%;height:100%;fill:currentColor}
.ia-root{min-height:100dvh;display:flex}
.ia-sidebar{position:fixed;inset:0 auto 0 0;width:226px;background:var(--side);backdrop-filter:blur(24px);padding:31px 18px 20px;display:flex;flex-direction:column;z-index:20;border-right:1px solid var(--line)}
.ia-root .ia-brand{display:flex;align-items:center;gap:10px;padding:0 12px;background:transparent;font-size:21px;font-weight:680;letter-spacing:-.04em}
.ia-brand>.ia-icon{width:30px;height:30px;color:var(--blue)}
.ia-project-picker{margin:31px 0 24px;display:flex;align-items:center;gap:9px;padding:10px 12px;background:var(--control);border-radius:10px}
.ia-project-picker>span{display:grid;place-items:center;background:var(--inset);border-radius:7px;width:25px;height:25px;flex-shrink:0;font-size:12px}
:is(.ia-root,.ia-sheet) .ia-project-picker select{border:0;background:transparent;padding:0;font-size:12px}
.ia-nav-label{font-size:11px;color:var(--secondary);padding:0 13px 9px}
.ia-nav{display:grid;gap:6px}
:is(.ia-root,.ia-sheet) .ia-nav>button{display:flex;align-items:center;gap:12px;padding:11px 13px;background:transparent;border-radius:10px;width:100%;min-height:45px;text-align:left;font-size:14px}
:is(.ia-root,.ia-sheet) .ia-nav>button:hover{background:var(--hover)}
:is(.ia-root,.ia-sheet) .ia-nav>button.active{background:var(--control);color:var(--blue);box-shadow:0 1px 3px #00000006}
.ia-nav small{margin-left:auto;background:var(--hover);border-radius:6px;padding:0 6px}
.ia-sidebar footer{margin-top:auto}
:is(.ia-root,.ia-sheet) .ia-connection{display:flex;align-items:center;gap:9px;background:transparent;font-size:12px;width:100%;text-align:left;padding:12px}
.ia-connection .ia-icon:last-child{margin-left:auto}
.ia-sidebar footer p{border-top:1px solid var(--line);font-size:10px;color:var(--secondary);padding:15px 12px 0;margin-top:6px}
.ia-workspace{width:calc(100% - 226px);margin-left:226px;min-width:0}
.ia-toolbar{position:sticky;top:0;z-index:15;height:65px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 38px;background:var(--toolbar);backdrop-filter:blur(20px) saturate(150%)}
.ia-toolbar>div{display:flex;align-items:center;gap:12px;font-size:12px;color:var(--secondary)}
.ia-toolbar strong{font-weight:500;color:var(--text)}
.ia-toolbar .ia-icon{width:15px;height:15px}
.ia-toolbar button{background:transparent;padding:7px;min-height:34px}
.ia-root .ia-mobile-menu{display:none}
.ia-page{max-width:1320px;margin:auto;padding:33px 48px 55px;outline:none}
.ia-page-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:32px}
.ia-page-heading p{margin-top:10px;color:var(--secondary);font-size:13px;line-height:1.8}
.ia-muted,.ia-eyebrow,.ia-footnote{color:var(--secondary)}
.ia-eyebrow{font-size:11px;display:flex;align-items:center;gap:9px;margin-bottom:14px}
.ia-footnote{font-size:11px;line-height:1.8}
:is(.ia-root,.ia-sheet) .ia-text-button{color:var(--blue);background:transparent;padding:5px 0;min-height:34px;font-size:12px}
.ia-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:4px 0 34px;padding-bottom:27px;border-bottom:1px solid var(--line)}
.ia-stats>div{padding:0 24px;border-left:1px solid var(--line)}
.ia-stats>div:first-child{padding-left:0;border:0}
.ia-stats span,.ia-stats small{display:block;color:var(--secondary);font-size:11px}
.ia-stats strong{display:block;font-size:32px;font-weight:620;letter-spacing:-.045em;line-height:1.5;margin:4px 0;font-variant-numeric:tabular-nums}
.ia-overview-grid{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(245px,1fr);gap:36px;margin-bottom:36px}
.ia-attention{background:var(--surface);border-radius:16px;overflow:hidden}
.ia-attention-main{padding:25px}
.ia-attention-main .ia-eyebrow>.ia-icon{color:var(--orange)}
.ia-attention-main h2{font-size:23px;line-height:1.5}
.ia-attention-main p,.ia-follow>p{color:var(--secondary);font-size:12px;line-height:1.8;margin:12px 0 18px}
.ia-root .ia-attention-next{display:flex;align-items:center;gap:12px;width:100%;border-top:1px solid var(--line);border-radius:0;padding:16px 24px;text-align:left;font-size:12px}
.ia-attention-next>.ia-icon:last-child{margin-left:auto}
.ia-follow .ia-eyebrow{color:var(--green)}
.ia-follow h2{font-size:19px}
.ia-follow-facts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:22px 0 14px}
.ia-follow-facts strong{display:block;font-size:23px;font-weight:550}
.ia-follow-facts small{color:var(--secondary);display:block}
.ia-follow .ia-footnote{border-top:1px solid var(--line);padding-top:14px;font-size:10px}
.ia-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ia-section-head h2{font-size:17px}
.ia-activity-list{border-top:1px solid var(--line)}
.ia-root .ia-activity{display:flex;align-items:center;gap:14px;padding:16px 0;border-radius:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;width:100%}
.ia-activity>span:nth-child(2){flex:1;min-width:0}
.ia-activity strong{font-size:13px;font-weight:550}
.ia-activity small{display:block;margin-top:5px;color:var(--secondary)}
.ia-agent{width:32px;height:32px;border-radius:10px;background:var(--surface);display:grid;place-items:center;color:var(--secondary);flex-shrink:0}
.ia-badge{display:inline-flex;align-items:center;font-size:10px!important;font-weight:500;color:var(--secondary);background:var(--surface);padding:3px 8px;border-radius:6px;white-space:nowrap}
.ia-badge.good,.ia-symbol.good{color:var(--green);background:var(--green-soft)}
.ia-badge.warn,.ia-symbol.warn{color:var(--orange);background:var(--orange-soft)}
.ia-filter-bar,.ia-validation-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap}
.ia-segments{display:inline-flex;gap:3px;padding:3px;background:var(--inset);border-radius:9px;max-width:100%}
:is(.ia-root,.ia-sheet) .ia-segments button{font-size:12px;color:var(--secondary);min-height:33px;padding:7px 12px;border-radius:7px;white-space:nowrap;background:transparent}
:is(.ia-root,.ia-sheet) .ia-segments button[aria-pressed=true]{color:var(--text);background:var(--control);box-shadow:0 1px 4px #00000009}
.ia-task-layout{display:grid;grid-template-columns:290px minmax(0,1fr);border-top:1px solid var(--line);min-height:calc(100dvh - 250px)}
.ia-task-list{border-right:1px solid var(--line);padding:20px 16px 24px 0;min-width:0}
.ia-search{display:flex;align-items:center;gap:8px;background:var(--surface);border-radius:9px;padding:8px 12px;margin-bottom:16px}
.ia-search>.ia-icon{width:17px;height:17px;color:var(--faint)}
.ia-root .ia-search input{border:0;outline:none;background:transparent;padding:0;font-size:12px}
.ia-search:focus-within{outline:3px solid #007aff85;outline-offset:3px}
.ia-list-caption{padding:0 11px 12px;font-size:10px;color:var(--secondary)}
.ia-root .ia-task-row{display:block;width:100%;background:transparent;text-align:left;padding:15px 13px;border-radius:11px;margin-bottom:5px}
.ia-root .ia-task-row.selected,.ia-root .ia-job.selected{background:var(--blue-soft)}
.ia-task-row.selected>strong{color:var(--blue)}
.ia-row-top{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--secondary);font-size:10px;margin-bottom:8px}
.ia-task-row>strong{font-weight:560;font-size:13px}
.ia-task-row>small{display:block;color:var(--secondary);margin-top:9px;font-size:10px}
.ia-task-detail{padding:25px 0 40px 31px;min-width:0}
.ia-task-detail>h2{font-size:24px;line-height:1.5;margin-bottom:9px}
.ia-task-detail>p{font-size:12px;line-height:1.8}
.ia-root [data-ia=back-list]{display:none}
.ia-query{background:var(--surface);padding:15px 18px;border-radius:11px;margin:25px 0}
.ia-query span{font-size:11px;color:var(--secondary)}
.ia-query p{font-size:12px;line-height:1.8;margin-top:6px}
.ia-lesson{padding:22px 0;border-bottom:1px solid var(--line)}
.ia-lesson-head{display:flex;align-items:start;gap:12px}
.ia-lesson-head>div{flex:1;min-width:0}
.ia-lesson-head small{display:block;color:var(--secondary);font-size:10px;margin:3px 0}
.ia-symbol{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;flex:0 0 auto;color:var(--blue);background:var(--blue-soft)}
.ia-root .ia-lesson-title{display:flex;gap:7px;align-items:center;text-align:left;padding:0;min-height:0;font-weight:580;background:transparent;font-size:14px;line-height:1.7}
.ia-lesson-title>.ia-icon{width:13px;height:13px;color:var(--faint)}
.ia-lesson>p{margin:8px 0 15px 48px;font-size:12px;color:var(--secondary);line-height:1.8}
.ia-feedback{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:14px 0}
.ia-lesson .ia-feedback{margin-left:48px}
.ia-feedback button{font-size:11px;min-height:34px;padding:7px 11px}
.ia-feedback button[aria-pressed=true]{background:var(--blue-soft);color:var(--blue)}
.ia-disclosure{margin-top:28px;border-top:1px solid var(--line);padding:17px 0;color:var(--secondary);font-size:12px}
.ia-disclosure summary{cursor:pointer;font-weight:500;color:var(--text);margin-bottom:12px}
.ia-event{padding:15px 0;border-bottom:1px solid var(--line)}
.ia-event>small{float:right}
.ia-event dl>div{display:flex;gap:12px;font-size:11px;overflow-wrap:anywhere}
.ia-event dt{min-width:100px}
.ia-event dd{margin:0;min-width:0}
.ia-job-layout{display:grid;grid-template-columns:265px minmax(0,1fr);gap:26px;align-items:start}
.ia-job-list{display:grid;gap:10px;min-width:0}
.ia-job-list>.ia-muted{font-size:12px;padding:20px 10px}
.ia-root .ia-job{display:flex;gap:12px;align-items:start;text-align:left;background:transparent;padding:17px 14px}
.ia-job>.ia-icon{margin-top:3px;color:var(--secondary)}
.ia-job strong{display:block;font-size:13px;line-height:1.7;font-weight:560}
.ia-job small{display:block;font-size:10px;color:var(--secondary);margin-top:7px}
.ia-job-detail{border-left:1px solid var(--line);padding-left:30px;min-width:0;min-height:500px}
.ia-revision>h2{font-size:24px;line-height:1.5}
.ia-live{min-height:18px;color:var(--blue);font-size:12px;margin-top:8px}
.ia-live[role=alert]{color:var(--red)}
.ia-steps{display:flex;align-items:center;margin:23px 0 30px;gap:6px}
.ia-root .ia-steps>button{display:flex;align-items:center;gap:8px;flex:1;background:transparent;color:var(--secondary);font-size:11px;padding:0;min-height:38px;text-align:left}
.ia-steps>button>span{width:23px;height:23px;border-radius:50%;background:var(--surface);display:grid;place-items:center;flex-shrink:0;font-size:11px}
.ia-root .ia-steps>button.active{color:var(--blue)}
.ia-steps>button.active>span{background:var(--blue);color:var(--bg)}
.ia-revision>h3{margin-top:24px;margin-bottom:10px}
.ia-revision>.ia-muted{font-size:12px;line-height:1.8;margin:9px 0 18px}
.ia-root .ia-source-row,.ia-sheet .ia-source-row{display:flex;align-items:center;gap:12px;width:100%;padding:14px 0;border-radius:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;font-size:12px}
.ia-source-row>span{flex:1;min-width:0;overflow-wrap:anywhere}
.ia-source-row small{display:block;color:var(--secondary);font-size:10px;margin-top:4px}
.ia-excerpt{background:var(--surface);border-radius:12px;padding:22px;margin:24px 0}
.ia-excerpt p{font-size:12px;color:var(--secondary);margin-top:10px;line-height:1.8;white-space:pre-wrap}
.ia-edit-grid{display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1fr);gap:25px}
.ia-before{padding:19px;background:var(--surface);border-radius:12px;align-self:start}
.ia-before h4{color:var(--secondary);margin:20px 0 8px}
.ia-before p{font-size:12px;line-height:1.8;white-space:pre-wrap}
.ia-field{display:flex;flex-direction:column;gap:8px;font-size:12px;font-weight:520;margin-bottom:18px;min-width:0}
.ia-root .ia-field textarea{font-size:13px;font-weight:400;background:var(--bg);border-color:var(--line)}
.ia-example-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:22px 0}
.ia-workflow-footer{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid var(--line);padding:20px 0;margin-top:26px;background:var(--toolbar);backdrop-filter:blur(15px);z-index:2}
.ia-workflow-footer>.ia-muted{font-size:10px;max-width:45%;line-height:1.8}
.ia-workflow-footer>div{display:flex;gap:10px}
.ia-result-summary{display:flex;gap:14px;align-items:center;margin:24px 0}
.ia-result-summary strong{font-size:17px;font-weight:580}
.ia-result-summary p{font-size:11px;color:var(--secondary);margin-top:7px}
.ia-table-wrap{overflow:auto}
.ia-table{border-collapse:collapse;width:100%;font-size:12px}
.ia-table :is(th,td){border-bottom:1px solid var(--line);padding:14px 10px;text-align:left;vertical-align:top}
.ia-table th{font-size:10px;font-weight:500;color:var(--secondary)}
.ia-table small{display:block;color:var(--secondary);font-size:10px;margin-top:5px}
.ia-pass{color:var(--green)}.ia-fail{color:var(--orange)}
.ia-history{font-size:11px;display:flex;align-items:center;gap:12px;color:var(--secondary);max-width:65%;min-width:0}
.ia-history select{font-size:11px;max-width:340px}
.ia-success{border-radius:15px;background:var(--green-soft);padding:30px;text-align:center;margin:24px 0}
.ia-success>.ia-icon{width:35px;height:35px;color:var(--green);margin-bottom:10px}
.ia-success h3{font-size:19px}
.ia-success p{font-size:11px;color:var(--secondary);margin:10px 0 20px}
.ia-diff p{padding:15px;border-radius:8px;margin:8px 0;font-size:12px;line-height:1.8;white-space:pre-wrap}
.ia-diff .removed{background:var(--red-soft);color:var(--red)}
.ia-diff .added{background:var(--green-soft);color:var(--green)}
.ia-notice{background:var(--orange-soft);color:var(--orange);border-radius:11px;padding:15px 18px;font-size:12px;line-height:1.8;margin-bottom:22px;overflow-wrap:anywhere}
.ia-empty{padding:65px 20px;text-align:center;color:var(--secondary)}
.ia-empty>.ia-icon{width:34px;height:34px;margin-bottom:20px;color:var(--faint)}
.ia-empty h2{font-size:21px;color:var(--text)}
.ia-empty p{font-size:13px;line-height:1.8;max-width:420px;margin:12px auto}
.ia-empty-note{font-size:12px;padding:30px 0;color:var(--secondary)}
.ia-sheet{position:fixed;inset:0 0 0 auto;width:540px;max-width:100%;height:100dvh;max-height:100dvh;padding:0;border:0;border-left:1px solid var(--line);border-radius:0;margin:0;box-shadow:0 16px 70px #15234025;overflow:hidden}
.ia-sheet[open]{display:flex;flex-direction:column}
.ia-sheet::backdrop{background:rgb(15 20 35 / var(--dim,.2));backdrop-filter:blur(2px)}
.ia-sheet-grab{display:grid;place-items:center;min-height:28px;flex:0 0 28px;touch-action:none;cursor:grab}
.ia-sheet-grab span{height:4px;width:36px;border-radius:4px;background:var(--line)}
.ia-sheet-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:8px 24px 20px;border-bottom:1px solid var(--line)}
.ia-sheet-header h2{font-size:14px}
.ia-sheet-header button{border-radius:50%;padding:8px;min-height:34px}
.sheet-content{padding:25px 30px 35px;overflow:auto;min-height:0;flex:1}
.sheet-content>h2{font-size:25px;margin:10px 0 23px}
.sheet-content>p{font-size:13px;line-height:1.8;margin:15px 0}
.ia-read-section{margin:25px 0}
.ia-read-section h3{font-size:12px;margin-bottom:10px}
.ia-read-section p{font-size:14px;line-height:1.85;color:var(--secondary);white-space:pre-wrap}
.ia-sheet .ia-sidebar{position:static;width:auto;padding:0;background:transparent;border:0;backdrop-filter:none;min-height:70dvh}
.ia-retrieval>.ia-muted{font-size:12px;margin-bottom:20px;line-height:1.8}
/* Existing evaluation behavior now lives inside the prototype's verification surface. */
.ia-root :is(.controlled-eval-bench,.bench-result,.eval-review-workbench){background:transparent;border:0;border-radius:0;box-shadow:none;padding:0}
.ia-root .controlled-run-form{background:var(--surface);border:0;border-radius:12px;padding:18px;margin:22px 0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:15px}
.ia-root .bench-settings{grid-column:1/-1;font-size:11px}
.ia-new-check{margin:20px 0;font-size:12px}.ia-new-check>summary{color:var(--blue);cursor:pointer;width:fit-content;padding:8px 0}.ia-root .controlled-history-row{margin:25px 0}
.ia-root .controlled-history{display:flex;align-items:center;gap:15px;font-size:12px}
.ia-root .controlled-history select{max-width:450px}
.ia-root .bench-result h2{font-size:22px}
.ia-root :is(.bench-result p,.bench-engine,.eval-field,.eval-review-workbench p){font-size:12px;line-height:1.8}
.ia-root .bench-score-pair{background:var(--surface);border-radius:14px;border:0}
.ia-root :is(.bench-score-pair>div,.bench-result-counts,.bench-case-table td,.bench-case-table th){border-color:var(--line)}
.ia-root :is(.bench-case-table,.bench-case-table button){font-size:12px;background:transparent;color:var(--text)}
.ia-root :is(.bench-coverage,.eval-filters,.controlled-case-filters){font-size:11px}
.ia-root :is(.bench-result-counts,.bench-coverage-summary){color:var(--secondary)}
.ia-root .eval-candidate-list{margin:22px 0}
.ia-root .eval-candidate{background:var(--surface);border:0;border-radius:12px}
.ia-root .eval-review-workbench{padding-top:25px;border-top:1px solid var(--line)}
.ia-sheet.bench-case-dialog .bench-detail-pair{grid-template-columns:1fr}.ia-sheet.bench-case-dialog .bench-detail-pair>section{background:var(--surface);border-color:var(--line)}.ia-sheet.suite-dialog[open]{display:block;overflow:auto;padding:24px}.ia-sheet.suite-dialog .revision-titlebar{background:var(--bg)}.ia-sheet.suite-dialog .suite-dialog-body{background:var(--bg);padding:0}.ia-root .eval-field{display:grid;gap:8px}
.ia-root .eval-review-flow{font-size:11px;margin:20px 0}
.ia-root :is(.eval-review-actions,.eval-review-grid){gap:14px}
.ia-root .bench-coverage{border-radius:12px;background:var(--surface);border:0;color:var(--text)}
.ia-root .bench-coverage small{color:var(--secondary)}
@media(max-width:1100px){.ia-page{padding:30px}.ia-stats>div{padding:0 18px}.ia-task-layout{grid-template-columns:230px minmax(0,1fr)}.ia-task-detail{padding-left:22px}.ia-overview-grid{grid-template-columns:1.4fr 1fr;gap:25px}.ia-job-layout{grid-template-columns:220px minmax(0,1fr);gap:20px}.ia-job-detail{padding-left:22px}.ia-edit-grid{grid-template-columns:1fr}.ia-before{max-height:240px;overflow:auto}}
@media(max-width:960px){.ia-overview-grid{grid-template-columns:1fr}.ia-follow{max-width:600px}.ia-job-layout{grid-template-columns:1fr}.ia-job-list{display:flex;overflow:auto;align-items:start;padding-bottom:10px;gap:8px}.ia-job-list>.ia-segments{flex-shrink:0;flex-direction:column}.ia-job{min-width:210px;max-width:260px;flex-shrink:0}.ia-job-detail{border-left:0;border-top:1px solid var(--line);padding:24px 0}.ia-stats strong{font-size:26px}}
@media(max-width:760px){.ia-root>.ia-sidebar{display:none}.ia-workspace{width:100%;margin:0}.ia-toolbar{height:59px;padding:0 18px}.ia-toolbar>div{gap:8px}.ia-toolbar>div:first-child>span,.ia-toolbar>div:first-child>.ia-icon{display:none}.ia-root .ia-mobile-menu{display:grid;place-items:center}.ia-page{padding:24px}.ia-page-heading{margin-bottom:26px}.ia-page-heading h1{font-size:27px}.ia-sheet{inset:auto 0 0 0;width:100%;height:92dvh;max-height:92dvh;border-radius:22px 22px 0 0;border-left:0}.ia-sheet-grab{min-height:32px;flex-basis:32px}.sheet-content{padding:20px 24px 30px}}
@media(max-width:580px){.ia-page{padding:23px 20px 36px}.ia-page-heading{align-items:start;gap:10px}.ia-page-heading p{font-size:12px}.ia-page-heading>.ia-text-button{font-size:11px;max-width:90px}.ia-stats{grid-template-columns:1fr 1fr;gap:24px 0}.ia-stats>div{padding:0 18px}.ia-stats>div:nth-child(3){padding-left:0;border:0}.ia-stats strong{font-size:32px}.ia-attention-main{padding:21px}.ia-attention-main h2{font-size:21px}.ia-follow h2{font-size:19px}.ia-activity .ia-badge,.ia-activity>.ia-icon{display:none}.ia-task-layout{display:block}.ia-task-list{border:0;padding:18px 0}.ia-task-detail{display:none;padding:23px 0 35px}.ia-task-layout.has-selection>.ia-task-list{display:none}.ia-task-layout.has-selection>.ia-task-detail{display:block}.ia-root [data-ia=back-list]{display:flex;margin-bottom:18px}.ia-task-detail>h2{font-size:22px}.ia-task-row>strong{font-size:14px}.ia-lesson>p,.ia-lesson .ia-feedback{margin-left:0}.ia-root .ia-segments button,.ia-root .ia-feedback button,.ia-root .ia-toolbar button,.ia-sheet button{min-height:44px}.ia-filter-bar{gap:8px}.ia-filter-bar>.ia-segments{width:100%;display:flex}.ia-filter-bar>.ia-segments button{flex:1;padding:7px 8px}.ia-filter-bar>small{display:none}.ia-revision>h2{font-size:22px}.ia-example-grid{grid-template-columns:1fr;gap:0}.ia-steps{gap:3px}.ia-root .ia-steps>button{font-size:10px;gap:5px;min-height:44px}.ia-edit-grid{gap:20px}.ia-workflow-footer{flex-wrap:wrap;padding:15px 0;gap:10px}.ia-workflow-footer>.ia-muted{max-width:100%;width:100%}.ia-workflow-footer>div{margin-left:auto}.ia-history{max-width:100%;width:100%}.ia-history select{max-width:100%;flex:1}.ia-table,.ia-table tbody{display:block}.ia-table thead{display:none}.ia-table tr{display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid var(--line);padding:15px 0}.ia-table td{border:0;padding:0}.ia-table td:first-child{grid-column:1/-1}.ia-table td[data-label]:before{display:block;content:attr(data-label);font-size:10px;color:var(--secondary);margin-bottom:5px}.ia-root .controlled-run-form{grid-template-columns:1fr}.ia-root .controlled-history{display:grid}.ia-root .controlled-run-button{width:100%}.ia-event dl>div{flex-wrap:wrap}.ia-table-wrap{overflow:visible}}
@media(prefers-reduced-motion:reduce){:is(.ia-root,.ia-sheet) *{transition:none!important;animation:none!important;scroll-behavior:auto!important}:is(.ia-root,.ia-sheet) button:active{transform:none}}
@media(prefers-reduced-transparency:reduce){.ia-toolbar,.ia-workflow-footer,.ia-sidebar{background:var(--surface);backdrop-filter:none}.ia-sheet::backdrop{backdrop-filter:none}}
@media(prefers-contrast:more){.ia-root,.ia-sheet{--secondary:#444;--faint:#555;--line:#999}body[data-impact-theme=dark] :is(.ia-root,.ia-sheet){--secondary:#ddd;--faint:#ddd;--line:#888}.ia-segments,.ia-badge{border:1px solid var(--secondary)}}
`;
