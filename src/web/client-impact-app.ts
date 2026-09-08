import type { ImpactState } from './client-impact-state';
import type { ObservationWebRun, ObservationWebTimelineEvent } from './observation-view';
import { impactIcon as icon } from './client-impact-icons';
import { createRevisionWorkspace } from './client-revision-workspace';
import { createImpactSheet } from './client-impact-sheet';
import { runDisplayStatus } from './client-run-evidence';

interface UI {
  state: ImpactState & { projectRoot: string; mainView: string; locale: string; projects: Array<{root:string;name:string}> };
  api<T>(path:string,options?:RequestInit):Promise<T>;
  t(key:string,params?:Record<string,unknown>):string; escape(value:unknown):string;
  date(value:unknown):string; value(value:unknown):string;
  route():void; refresh():Promise<void>; run(id:string):Promise<void>; selectProject(root:string):void; trap(scope:string,id:number):Promise<void>;
  snapshot():void; feedback(project:string,event:string,value:string):Promise<unknown>;
  retrieval():string; review():string; bindEvaluation():void; loadEvaluation():Promise<void>;
}
type Page = ImpactState['impactView'];
export function createImpactApp(ui:UI) {
  const {state:s,t,escape:e}=ui;
  const names:Record<Page,string>={overview:'overview',runs:'runs',improve:'improve',evals:'verify'};
  const icons:Record<Page,Parameters<typeof icon>[0]>={overview:'squares-four',runs:'clock-counter-clockwise',improve:'sliders-horizontal',evals:'flask'};
  let verifyTab='revision', verificationId='', completed=false, mobileDetail=false, reviewOpen=false, mountedKey='';
  let theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
  const feedbackBusy=new Set<string>();
  const feedbackErrors=new Map<string,string>();
  const dialog=document.createElement('dialog');dialog.className='ia-sheet';dialog.setAttribute('aria-labelledby','sheet-title');
  dialog.innerHTML=`<div class="ia-sheet-grab" data-sheet-drag><span></span></div><header class="ia-sheet-header"><h2 id="sheet-title"></h2><button data-sheet-close aria-label="${e(t('apple.detailsClose'))}">${icon('x')}</button></header><div class="sheet-content" id="sheet-content"></div>`;
  document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.querySelector('#sheet-content')!.replaceChildren());
  const sheet=createImpactSheet(dialog,()=>matchMedia('(prefers-reduced-motion:reduce)').matches);
  dialog.querySelector('[data-sheet-close]')!.addEventListener('click',sheet.close);
  const editor=createRevisionWorkspace({api:ui.api,t,escape:e,changed:(project,id,key)=>{if(s.projectRoot!==project)return;if(id&&s.impactView==='improve'&&s.improvementId===key){s.improvementId='revision:'+id;ui.route();}void ui.refresh();},openRun:id=>void openRun(id),verify:id=>{verificationId=id;verifyTab='revision';navigate('evals');},edit:id=>{navigate('improve','revision:'+id);}});
  const b=(label:string,action:string,attrs='',primary=false)=>`<button ${primary?'class="primary"':''} data-ia="${action}" ${attrs}>${e(label)}</button>`;
  const text=(label:string,action:string,attrs='')=>`<button class="ia-text-button" data-ia="${action}" ${attrs}>${e(label)}</button>`;
  const empty=(title:string,copy='')=>`<div class="ia-empty">${icon('stack')}<h2>${e(title)}</h2><p>${e(copy)}</p></div>`;
  const label=(page:Page)=>t('apple.'+names[page]);
  const runName=(r:ObservationWebRun)=>t('apple.runName',{client:r.source_client||'—',date:ui.date(r.started_at)});
  function badge(r:ObservationWebRun) {const status=runDisplayStatus(r);return `<span class="ia-badge ${status==='completed'?'good':status==='failed'?'warn':''}">${e(ui.value(status))}</span>`;}
  function navigate(page:Page,id?:string) {
    ui.snapshot();sheet.close();s.impactView=page;
    if(page==='improve'&&id)s.improvementId=id;
    reviewOpen=page==='improve'&&s.improvementId==='intake';mountedKey='';ui.route();render();document.getElementById("detail")!.scrollTop=0;void ui.refresh();
  }
  async function openRun(id:string){sheet.close();mobileDetail=true;mountedKey='';await ui.run(id);document.getElementById('detail')!.scrollTop=0;}
  function navigation() {
    return `<nav class="ia-nav" aria-label="${e(t('apple.mobileNav'))}">${(Object.keys(names) as Page[]).map(p=>`<button data-ia="nav" data-page="${p}" class="${s.impactView===p?'active':''}" ${s.impactView===p?'aria-current="page"':''}>${icon(icons[p])}<span>${e(label(p))}</span>${p==='improve'&&(s.impactWorkbench?.issues.length||0)>0?`<small>${s.impactWorkbench!.issues.length}</small>`:''}</button>`).join('')}</nav>`;
  }
  function sidebar() {
    return `<aside class="ia-sidebar"><button class="ia-brand" data-ia="nav" data-page="overview">${icon('stack')}<span>codetrap</span></button><label class="ia-project-picker"><span>${e((s.projects.find(p=>p.root===s.projectRoot)?.name||'C').slice(0,1).toUpperCase())}</span><select data-ia-project aria-label="${e(t('apple.projects'))}">${s.projects.map(p=>`<option value="${e(p.root)}" ${p.root===s.projectRoot?'selected':''}>${e(p.name)}</option>`).join('')}</select></label><div class="ia-nav-label">Impact</div>${navigation()}<footer><button class="ia-connection" data-ia="connections">${icon('plugs-connected')}${e(t('apple.connections'))}${icon('caret-right')}</button><button class="ia-connection" data-ia="workspace">${icon('arrow-left')}${e(t('action.showWorkspace'))}</button><p>${e(t('apple.dataLocal'))}</p></footer></aside>`;
  }
  function heading(page:Page) {return `<header class="ia-page-heading"><div><h1>${e(label(page))}</h1><p>${e(t('apple.'+names[page]+'Copy'))}</p></div>${page==='improve'?text(t('apple.reviewMiss'),'review'):''}</header>`;}
  function activity(r:ObservationWebRun) {return `<button class="ia-activity" data-ia="run" data-id="${e(r.id)}"><span class="ia-agent">${e((r.source_client||'?').slice(0,1).toUpperCase())}</span><span><strong>${e(runName(r))}</strong><small>${e(t('apple.runCopy',{searches:r.search_count,exposures:r.exposure_count,feedback:r.feedback_count}))}</small></span>${badge(r)}${icon('caret-right')}</button>`;}
  function overview() {
    const o=s.observationOverview,w=s.impactWorkbench;
    if(s.observationAvailability==='unavailable')return heading('overview')+empty(t('impact.readErrorTitle'),t('impact.readErrorCopy'))+b(t('impact.retry'),'retry');
    if(!o?.total_runs)return heading('overview')+empty(t('overview.evidenceTitle'),t('overview.evidenceCopy'))+b(t('apple.connections'),'connections');
    const issue=w?.issues[0], pending=w?.pending, follow=w?.revisions.items.find(r=>r.status==='accepted');
    return heading('overview')+`<div class="ia-stats">${[
      [t('apple.runs'),o.total_runs,t('apple.allTime')],
      [t('apple.helpful'),`${o.helpful_feedback} / ${o.rated_exposures}`,t('apple.rated')],
      [t('apple.pendingWork'),w?String(w.issues.length+w.revisions.items.filter(r=>r.status==='draft').length):'—',t('apple.improve')],
      [t('apple.done'),w?String(w.revisions.items.filter(r=>r.status==='accepted').length):'—',t('apple.waiting')]
    ].map(([l,v,foot])=>`<div><span>${e(l)}</span><strong>${e(v)}</strong><small>${e(foot)}</small></div>`).join('')}</div>
    <div class="ia-overview-grid"><section class="ia-attention"><div class="ia-attention-main"><span class="ia-eyebrow">${icon('warning-circle')} ${e(t('apple.attention'))}</span><h2>${e(issue?.title||t(issue?'apple.miss':pending?'apple.pendingTitle':'apple.noWork'))}</h2><p>${e(issue?t(issue.kind==='miss'?'apple.missCopy':'apple.issueCount',{count:issue.sources.length}):t(pending?'apple.pendingCopy':'apple.noWorkCopy'))}</p>${issue?b(t('apple.openImprove'),'issue',`data-id="${e(issue.id)}"`,true):pending?b(t('apple.openRun'),'run',`data-id="${e(pending.run_id)}"`,true):text(t('apple.viewAll'),'nav','data-page="runs"')}</div>${pending&&issue?`<button class="ia-attention-next" data-ia="run" data-id="${e(pending.run_id)}">${icon('clock-counter-clockwise')}<span>${e(t('apple.pendingTitle'))}</span>${icon('caret-right')}</button>`:''}</section>
    <section class="ia-follow"><span class="ia-eyebrow">${icon('check-circle')} ${e(t('apple.followTitle'))}</span><h2>${e(follow?.title||t('apple.waiting'))}</h2><p>${e(t('apple.followCopy'))}</p><div class="ia-follow-facts"><div><strong>${follow?.later_runs??'—'}</strong><small>${e(t('apple.later'))}</small></div><div><strong>${follow?.later_helpful??'—'}</strong><small>${e(t('apple.helpful'))}</small></div></div>${follow?text(t('apple.viewAll'),'job',`data-id="revision:${e(follow.id)}"`):''}<p class="ia-footnote">${e(t('apple.boundary'))}</p></section></div><div class="ia-section-head"><h2>${e(t('apple.recent'))}</h2>${text(t('apple.viewAll'),'nav','data-page="runs"')}</div><div class="ia-activity-list">${s.observationRuns.slice(0,5).map(activity).join('')}</div>`;
  }
  function taskList() {
    const pending=new Set(s.impactWorkbench?.pending_run_ids||[]), attention=new Set(s.impactWorkbench?.issues.map(i=>i.run_id)||[]);
    const query=s.impactRunQuery.toLocaleLowerCase();
    const runs=s.observationRuns.filter(r=>(s.impactRunFilter==='all'||s.impactRunFilter==='pending'&&pending.has(r.id)||s.impactRunFilter==='attention'&&(attention.has(r.id)||runDisplayStatus(r)==='failed'))&&`${r.id} ${r.source_client} ${ui.date(r.started_at)}`.toLocaleLowerCase().includes(query));
    return `<div class="ia-list-caption">${e(t('apple.loaded',{count:s.observationRuns.length}))}</div>${runs.map(r=>`<button class="ia-task-row ${r.id===s.observationRunId?'selected':''}" data-ia="run" data-id="${e(r.id)}"><span class="ia-row-top">${e(r.source_client||'—')}${badge(r)}</span><strong>${e(ui.date(r.started_at))}</strong><small>${e(t('apple.taskCounts',{searches:r.search_count,exposures:r.exposure_count}))}</small></button>`).join('')||empty(t('apple.noMatches'))}`;
  }
  function tasks() {
    return heading('runs')+`<div class="ia-filter-bar"><div class="ia-segments">${['all','pending','attention'].map(f=>`<button data-ia="filter" data-filter="${f}" aria-pressed="${s.impactRunFilter===f}">${e(t('apple.'+f))}</button>`).join('')}</div><small class="ia-muted">${e(t('apple.allTime'))}</small></div><div class="ia-task-layout ${mobileDetail?'has-selection':''}"><aside class="ia-task-list"><label class="ia-search">${icon('magnifying-glass')}<input type="search" data-ia-search placeholder="${e(t('apple.search'))}" aria-label="${e(t('apple.searchLabel'))}" value="${e(s.impactRunQuery)}"></label><div data-ia-tasks>${taskList()}</div></aside><section class="ia-task-detail">${taskDetail()}</section></div>`;
  }
  function lessons() {
    const items=new Map<string,ObservationWebTimelineEvent>();
    for(const event of s.observationRunDetail?.timeline||[])if(['trap/exposed','trap/feedback-recorded'].includes(event.type)&&event.event_id&&event.facts.trap_id)items.set(JSON.stringify([event.facts.trap_scope,event.facts.trap_id,event.facts.revision]),event);
    return [...items.values()];
  }
  function lessonRow(event:ObservationWebTimelineEvent) {
    const id=event.event_id!,f=event.facts,p=s.observationRunDetail?.lesson_previews?.[id],feedback=String(f.feedback||'');
    const key=JSON.stringify([s.projectRoot,id]);
    return `<article class="ia-lesson"><div class="ia-lesson-head"><span class="ia-symbol">${icon('book-open')}</span><div><button class="ia-lesson-title" data-ia="inspect" data-id="${e(id)}">${e(p?.title||s.observationRunDetail?.lesson_titles?.[id]||`${f.trap_scope||'—'} #${f.trap_id}`)}${icon('caret-right')}</button><small>${e(f.trap_scope||'—')} #${e(f.trap_id)}</small></div></div><p>${e(p?.context||t('apple.inspectMissing'))}</p><div class="ia-feedback">${['helpful','irrelevant','harmful'].map(v=>`<button data-ia="feedback" data-id="${e(id)}" data-feedback="${v}" aria-pressed="${feedback===v}" ${feedbackBusy.has(key)?'disabled':''}>${e(t('revision.'+v))}</button>`).join('')}${feedback==='irrelevant'||feedback==='harmful'?text(t('apple.openImprove'),'job',`data-id="event:${e(id)}"`):''}</div>${feedbackErrors.has(key)?`<p role="alert">${e(feedbackErrors.get(key))}</p>`:''}</article>`;
  }
  function taskDetail() {
    const payload=s.observationRunDetail,r=payload?.run;
    if(!r)return empty(t(s.observationLoading?'impact.loading':'impact.selectRun'));
    return `${text(t('apple.backList'),'back-list')}<div class="ia-eyebrow">${e(r.source_client||'—')} · ${badge(r)}</div><h2>${e(runName(r))}</h2><p class="ia-muted">${e(t('apple.runCopy',{searches:r.search_count,exposures:r.exposure_count,feedback:r.feedback_count}))}</p><section class="ia-query"><span>${e(t('apple.query'))}</span><p>${e(t(r.search_count?'apple.queryMissing':'apple.noQuery'))}</p></section><h3>${e(t('apple.lessons'))}</h3>${lessons().map(lessonRow).join('')||`<p class="ia-muted">${e(t('apple.noQuery'))}</p>`}
      <details class="ia-disclosure"><summary>${e(t('apple.details'))}</summary><code>${e(r.id)}</code>${payload!.timeline.map(ev=>`<div class="ia-event"><strong>${e(t('impact.event.'+ev.type))}</strong><small>${e(ui.date(ev.occurred_at))}</small><dl>${Object.entries(ev.facts).map(([key,value])=>`<div><dt>${e(key)}</dt><dd>${e(value??'—')}</dd></div>`).join('')}</dl></div>`).join('')}</details>`;
  }
  function jobList() {
    const w=s.impactWorkbench;
    const issues=completed?[]:w?.issues||[], revisions=w?.revisions.items.filter(r=>completed?r.status!=='draft':r.status==='draft')||[];
    return `<div class="ia-segments">${['pendingWork','completedWork'].map((key,i)=>`<button data-ia="job-filter" data-completed="${!!i}" aria-pressed="${completed===!!i}">${e(t('apple.'+key))}</button>`).join('')}</div>${issues.map(i=>`<button class="ia-job ${s.improvementId===i.id?'selected':''}" data-ia="issue" data-id="${e(i.id)}">${icon(i.kind==='miss'?'magnifying-glass':'warning-circle')}<span><strong>${e(i.title||t(i.kind==='miss'?'apple.miss':'apple.issue'))}</strong><small>${e(t('apple.issueCount',{count:i.sources.length}))}</small></span></button>`).join('')}${revisions.map(r=>`<button class="ia-job ${s.improvementId==='revision:'+r.id?'selected':''}" data-ia="job" data-id="revision:${e(r.id)}">${icon(r.status==='accepted'?'check-circle':'sliders-horizontal')}<span><strong>${e(r.title)}</strong><small>${e(t('revision.'+r.status))} · ${e(ui.date(r.created_at))}</small></span></button>`).join('')}${!issues.length&&!revisions.length?`<p class="ia-muted">${e(t('apple.noWork'))}</p>`:''}`;
  }
  function improve() {
    if(reviewOpen)return heading('improve')+text(t('apple.back'),'review-close')+`<div class="ia-review">${ui.review()}</div>`;
    if(!s.improvementId){const first=s.impactWorkbench?.revisions.items.find(r=>r.status==='draft');s.improvementId=first?'revision:'+first.id:s.impactWorkbench?.issues.find(i=>i.kind==='feedback')?.id||null;}
    return heading('improve')+`<div class="ia-job-layout"><aside class="ia-job-list">${jobList()}</aside><section class="ia-job-detail" data-ia-editor>${s.improvementId?'':empty(t('apple.noWork'),t('apple.noWorkCopy'))}</section></div>`;
  }
  function verification() {
    const records=s.impactWorkbench?.revisions.items.filter(r=>r.evaluation!=='untested')||[];
    if(!records.some(r=>r.id===verificationId))verificationId=records[0]?.id||'';
    return heading('evals')+`<div class="ia-validation-top"><div class="ia-segments">${['revision','retrieval'].map((v,i)=>`<button data-ia="verify-tab" data-tab="${v}" aria-pressed="${verifyTab===v}">${e(t(i?'apple.retrieval':'apple.change'))}</button>`).join('')}</div>${verifyTab==='revision'&&records.length?`<label class="ia-history">${e(t('evals.experimentHistory'))}<select data-ia-history>${records.map(r=>`<option value="${e(r.id)}" ${r.id===verificationId?'selected':''}>${e(r.title)} · ${e(ui.date(r.created_at))}</option>`).join('')}</select></label>`:''}</div>${verifyTab==='revision'?verificationId?'<section data-ia-editor></section>':empty(t('apple.noRevisions'),t('apple.noRevisionsCopy')):`<div class="ia-retrieval">${ui.retrieval()}</div>`}`;
  }
  function render() {
    if(s.mainView!=='impact'){editor.detach();return;}
    document.body.dataset.impactTheme=theme;
    const target=document.getElementById('detail')!;
    reviewOpen=s.impactView==='improve'&&s.improvementId==='intake';
    const key=JSON.stringify([s.projectRoot,s.locale,s.impactView,s.improvementId,reviewOpen,verifyTab,verificationId]);
    // Preserve the mounted revision editor and caret during observation polling.
    if(key===mountedKey&&s.impactView==='improve'&&!reviewOpen&&target.querySelector('[data-ia-editor]')) {
      const list=target.querySelector('.ia-job-list');if(list){list.innerHTML=jobList();bind(list);}
      const nav=target.querySelector('.ia-sidebar .ia-nav');if(nav){nav.outerHTML=navigation();bind(target.querySelector('.ia-sidebar .ia-nav')!);}
      return;
    }
    editor.detach();
    target.innerHTML=`<div class="ia-root">${sidebar()}<main class="ia-workspace"><div class="ia-toolbar"><div><button class="ia-mobile-menu" data-ia="menu" aria-label="${e(t('apple.mobileNav'))}">${icon('squares-four')}</button><span>Impact</span>${icon('caret-right')}<strong>${e(label(s.impactView))}</strong></div><div><span class="ia-period">${e(t('apple.allTime'))}</span><button data-ia="locale" aria-label="${s.locale==='zh'?'Switch to English':'切换为中文'}">${s.locale==='zh'?'EN':'中文'}</button><button data-ia="theme" aria-label="${e(t('apple.theme'))}">${icon('squares-four')}</button></div></div><div class="ia-page" tabindex="-1">${s.observationError?`<div class="ia-notice" role="alert">${e(s.observationError)}${b(t('impact.retry'),'retry')}</div>`:''}${s.impactWorkbench?.availability==='unavailable'||s.impactWorkbench?.revisions.unavailable?`<p class="ia-notice">${e(t('apple.notice'))}</p>`:''}${!s.projectRoot?empty(t('empty.noProjects')):s.impactView==='overview'?overview():s.impactView==='runs'?tasks():s.impactView==='improve'?improve():verification()}</div></main></div>`;
    mountedKey=JSON.stringify([s.projectRoot,s.locale,s.impactView,s.improvementId,reviewOpen,verifyTab,verificationId]);
    bind(target);
    const host=target.querySelector<HTMLElement>('[data-ia-editor]');
    if(host&&s.projectRoot){const id=s.impactView==='improve'?s.improvementId:'revision:'+verificationId;if(id)void editor.mount(host,s.projectRoot,id,s.impactView==='evals');}
    if(reviewOpen||s.impactView==='evals'&&verifyTab==='retrieval')ui.bindEvaluation();
  }
  function inspect(id:string) {
    const ev=lessons().find(ev=>ev.event_id===id);if(!ev)return;
    const p=s.observationRunDetail?.lesson_previews?.[id];
    sheet.show(t('apple.inspect'),`<p class="ia-eyebrow">${e(ev.facts.trap_scope)} #${e(ev.facts.trap_id)}</p><h2>${e(p?.title||t('apple.inspect'))}</h2>${p?['context','mistake','fix'].map(k=>`<section class="ia-read-section"><h3>${e(t('revision.field.'+k))}</h3><p>${e(p[k as keyof typeof p])}</p></section>`).join(''):`<p>${e(t('apple.inspectMissing'))}</p>`}<details class="ia-disclosure"><summary>${e(t('revision.version'))}</summary><code>${e(ev.facts.revision)}</code></details><footer class="ia-workflow-footer">${text(t('nav.library'),'trap',`data-scope="${e(ev.facts.trap_scope)}" data-id="${e(ev.facts.trap_id)}"`)}${b(t('apple.revise'),'job',`data-id="event:${e(id)}"`,true)}</footer>`);bind(dialog);
  }
  function connections() {
    const c=s.observationConnection;
    sheet.show(t('apple.connections'),`<div data-connection-state="${e(c?.state||'not_configured')}"><h2>${e(t('connection.'+(c?.state||'not_configured')+'.title'))}</h2><p class="ia-muted">${e(t('apple.connectionCopy'))}</p>${c?.clients.map(client=>`<div class="ia-source-row"><strong>${e(client.client)}</strong><span>${e(t('connection.client.'+client.status))}</span></div>`).join('')||''}<p>${e(t('connection.'+(c?.state||'not_configured')+'.copy'))}</p><p class="ia-muted">${e(t('impact.notConfiguredCopy'))}</p><code>codetrap observe enable codex\ncodetrap observe enable claude-code</code></div>`);
  }
  function bind(root:ParentNode) {
    root.querySelectorAll<HTMLElement>('.ia-nav').forEach(nav=>nav.addEventListener('keydown',ev=>{
      const keys=['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'];if(!keys.includes(ev.key))return;
      const buttons=[...nav.querySelectorAll<HTMLButtonElement>('button')], index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      if(index<0)return;ev.preventDefault();buttons[ev.key==='Home'?0:ev.key==='End'?buttons.length-1:(index+(['ArrowUp','ArrowLeft'].includes(ev.key)?-1:1)+buttons.length)%buttons.length]?.focus();
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-ia]').forEach(button=>button.addEventListener('click',()=>void action(button)));
    root.querySelector<HTMLSelectElement>('[data-ia-project]')?.addEventListener('change',ev=>{sheet.close();mountedKey='';ui.snapshot();ui.selectProject((ev.target as HTMLSelectElement).value);});
    root.querySelector<HTMLInputElement>('[data-ia-search]')?.addEventListener('input',ev=>{s.impactRunQuery=(ev.target as HTMLInputElement).value;const list=root.querySelector('[data-ia-tasks]');if(list){list.innerHTML=taskList();bind(list);}});
    root.querySelector<HTMLSelectElement>('[data-ia-history]')?.addEventListener('change',ev=>{verificationId=(ev.target as HTMLSelectElement).value;render();});
  }
  async function action(button:HTMLButtonElement) {
    const a=button.dataset.ia,id=button.dataset.id!;
    if(a==='trap'){sheet.close();await ui.trap(button.dataset.scope!,Number(id));}
    else if(a==='nav')navigate(button.dataset.page as Page);
    else if(a==='run')await openRun(id);
    else if(a==='job') {completed=s.impactWorkbench?.revisions.items.some(r=>'revision:'+r.id===id&&r.status!=='draft')||false;navigate('improve',id);}
    else if(a==='issue'){const issue=s.impactWorkbench?.issues.find(i=>i.id===id);if(issue?.kind==='miss'){reviewOpen=true;s.impactView='improve';s.improvementId='intake';ui.route();await ui.loadEvaluation();const candidate=s.observationEvals?.candidate_groups.find(g=>g.id===issue.candidate_id||!!issue.candidate_id&&g.member_ids.includes(issue.candidate_id));if(candidate)s.evalReviewCandidateId=candidate.id;render();}else navigate('improve',id);}
    else if(a==='filter'){s.impactRunFilter=button.dataset.filter as typeof s.impactRunFilter;render();}
    else if(a==='job-filter'){completed=button.dataset.completed==='true';mountedKey='';render();}
    else if(a==='back-list'){mobileDetail=false;render();}
    else if(a==='inspect')inspect(id);
    else if(a==='connections')connections();
    else if(a==='locale'){document.querySelector<HTMLButtonElement>('[data-locale="'+(s.locale==='zh'?'en':'zh')+'"]')?.click();}
    else if(a==='theme'){theme=theme==='light'?'dark':'light';document.body.dataset.impactTheme=theme;}
    else if(a==='menu'){sheet.show(t('apple.mobileNav'),sidebar());bind(dialog);}
    else if(a==='workspace'){sheet.close();document.querySelector<HTMLButtonElement>('.main-nav [data-main-view="library"]')?.click();}
    else if(a==='verify-tab'){verifyTab=button.dataset.tab!;render();if(verifyTab==='retrieval')await ui.loadEvaluation();}
    else if(a==='review'){s.impactView='improve';s.improvementId='intake';reviewOpen=true;mountedKey='';ui.route();render();await ui.loadEvaluation();render();}
    else if(a==='review-close'){ui.snapshot();reviewOpen=false;s.improvementId=null;ui.route();render();}
    else if(a==='retry')await ui.refresh();
    else if(a==='feedback'){
      const project=s.projectRoot,key=JSON.stringify([project,id]);if(feedbackBusy.has(key))return;
      feedbackBusy.add(key);feedbackErrors.delete(key);render();
      try{await ui.feedback(project,id,button.dataset.feedback!);}catch(error){feedbackErrors.set(key,error instanceof Error?error.message:String(error));}
      finally{feedbackBusy.delete(key);if(s.projectRoot===project&&s.impactView==='runs')render();}
    }
  }
  return {render,navigate};
}
