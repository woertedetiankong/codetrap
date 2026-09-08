import type { RevisionContext, RevisionView } from "./revision-view";
import type { RevisionFields, RevisionCase } from "../domain/experience-revision";
import { impactIcon as icon } from "./client-impact-icons";

type Editor = RevisionFields & { reason: string; positive: string; negative: string };
interface Session {
  project: string; key: string; id: string; eventId: string; context: RevisionContext | null; view: RevisionView | null;
  editor: Editor | null; step: number; dirty: boolean; busy: boolean; loaded: boolean; error: string; message: string;
  pendingFeedback?: { eventId: string; feedback: string; requestId: string };
}
interface UI {
  api<T>(path: string, options?: RequestInit): Promise<T>;
  t(key: string, params?: Record<string, unknown>): string;
  escape(value: unknown): string;
  changed(project: string, id?: string, key?: string): void;
  openRun(id: string): void;
  verify(id: string): void;
  edit(id: string): void;
}

/** Sessions own drafts, not DOM nodes. Reads/writes capture their project and source. */
export function createRevisionWorkspace(ui: UI) {
  const sessions = new Map<string, Session>();
  let host: HTMLElement | null = null, current: Session | null = null, readOnly = false;
  const { t, escape: e } = ui;
  const get = <T>(s: Session, suffix: string, params: Record<string,string>) => ui.api<T>("/api/experience-revisions/" + suffix + "?" + new URLSearchParams({project:s.project,...params}),{cache:"no-store"});
  const post = <T>(s: Session, action: string, value: Record<string,unknown>) => ui.api<T>("/api/experience-revisions/"+action,{method:"POST",body:JSON.stringify({projectRoot:s.project,executor:"user",...value})});
  function install(s: Session, view: RevisionView) {
    if (view.id !== s.id || !view.digest || !view.source?.event_id || !view.fields || !Array.isArray(view.cases)) throw new Error("Invalid revision response");
    s.view=view; s.eventId=view.source.event_id; sessions.set(JSON.stringify([s.project,"revision:"+view.id]),s);
    s.editor={...view.fields,tags:[...view.fields.tags],reason:view.reason,positive:view.cases.filter(c=>c.expectation==='include').map(c=>c.query).join('\n'),negative:view.cases.filter(c=>c.expectation==='exclude').map(c=>c.query).join('\n')};
    s.dirty=false;
  }
  async function mount(nextHost: HTMLElement, project: string, key: string, verification = false) {
    host=nextHost; readOnly=verification;
    const identity=JSON.stringify([project,key]);
    let s=sessions.get(identity);
    if(!s){s={project,key,id:key.startsWith('revision:')?key.slice(9):'rev-'+crypto.randomUUID(),eventId:key.startsWith('event:')?key.slice(6):'',context:null,view:null,editor:null,step:1,dirty:false,busy:false,loaded:false,error:'',message:''};sessions.set(identity,s);}
    current=s; paint(s);
    if(s.loaded||s.busy)return;
    s.busy=true;paint(s);
    try {
      if(key.startsWith('revision:')) install(s,await get<RevisionView>(s,'item',{id:s.id}));
      else {
        const context=await get<RevisionContext>(s,'context',{eventId:s.eventId});
        if(context.source?.event_id!==s.eventId)throw new Error('Revision source mismatch');
        s.context=context;
        if(context.current&&context.editable)s.editor={...context.current,tags:[...context.current.tags],reason:'',positive:'',negative:''};
      }
      s.loaded=true;
    } catch(error){s.error=error instanceof Error?error.message:String(error);}
    finally{s.busy=false;paint(s);}
  }
  const canEdit=(s:Session)=>s.view?s.view.status==='draft':Boolean(s.context?.editable);
  const feedbackReady=(s:Session)=>Boolean(s.view||s.context?.source_type==='trap/feedback-recorded');
  const ready=(s:Session)=>!s.busy&&!s.dirty&&s.view?.status==='draft'&&s.view.base_current&&s.view.evaluation?.passed&&s.view.evaluation.digest===s.view.digest;
  const source=(s:Session)=>s.view?.source||s.context?.source;
  function field(s:Session,key:keyof Editor, label:string, rows=3) {
    const value=key==='tags'?s.editor!.tags.join(', '):s.editor![key];
    return `<label class="ia-field">${e(label)}<textarea name="${key}" rows="${rows}" maxlength="${key==='title'?240:key==='fix'?12000:key==='reason'?2000:10020}" ${s.busy?'disabled':''}>${e(value)}</textarea></label>`;
  }
  function result(view:RevisionView, filter='all') {
    const evaluation=view.evaluation;
    if(!evaluation)return `<p class="ia-empty-note">${e(t('apple.emptyResult'))}</p>`;
    const rows=evaluation.cases.filter(c=>filter==='all'||filter==='changed'&&c.baseline!==c.candidate||filter==='failed'&&(!c.candidate||c.error));
    return `<div class="ia-result-summary"><span class="ia-symbol ${evaluation.passed?'good':'warn'}">${icon(evaluation.passed?'check-circle':'warning-circle')}</span><div><strong>${e(t('apple.testSummary',{passed:evaluation.cases.filter(c=>c.candidate&&!c.error).length,total:evaluation.cases.length}))}</strong><p>${evaluation.cases.filter(c=>c.expectation==='include').length} ${e(t('apple.positive'))} · ${evaluation.cases.filter(c=>c.expectation==='exclude').length} ${e(t('apple.negative'))} · ${e(t('revision.tested'))} ${view.corpus_count}</p></div></div>
      <div class="ia-table-wrap"><table class="ia-table"><thead><tr><th>${e(t('revision.query'))}</th><th>${e(t('revision.baseline'))}</th><th>${e(t('revision.candidate'))}</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${e(c.query)}<small>${e(t('revision.'+c.expectation))}</small></td><td data-label="${e(t('revision.baseline'))}" class="${c.baseline?'ia-pass':'ia-fail'}">${e(t('revision.'+(c.baseline?'pass':'fail')))}</td><td data-label="${e(t('revision.candidate'))}" class="${c.candidate&&!c.error?'ia-pass':'ia-fail'}">${e(t('revision.'+(c.candidate&&!c.error?'pass':'fail')))}${c.error?`<small>${e(c.error)}</small>`:''}</td></tr>`).join('')||`<tr><td colspan="3">${e(t('apple.noChanges'))}</td></tr>`}</tbody></table></div>`;
  }
  function paint(s:Session) {
    if(current!==s||!host?.isConnected)return;
    const focused=host.querySelector<HTMLTextAreaElement>('textarea:focus');
    // Background refresh must not rebuild the active editor or move its caret.
    if(focused&&!s.busy)return;
    const src=source(s), view=s.view, before=view?.base||s.context?.current;
    const editable=canEdit(s)&&!readOnly;
    const title=view?.fields.title||before?.title||t('revision.title');
    host.innerHTML=`<div class="ia-revision" data-revision-workspace="${e(s.key)}"><div class="ia-eyebrow">${e(readOnly?t('apple.savedReadOnly'):t('revision.'+(view?.status||'draft')))}${src?` · ${e(src.scope)} #${src.trap_id}`:''}</div><h2>${e(title)}</h2>
      <div class="ia-live" role="${s.error?'alert':'status'}">${e(s.busy?t('revision.busy'):s.error||s.message)}</div>
      ${s.error&&!s.loaded?`<button data-rw-action="retry">${e(t('impact.retry'))}</button>`:''}
      ${src?.scope==='global'?`<p class="ia-notice">${e(t('revision.global'))}</p>`:''}
      ${s.context&&!s.context.same_revision||view&&!view.base_current&&view.status==='draft'?`<p class="ia-notice">${e(t('revision.stale'))}</p>`:''}
      ${editable?`<nav class="ia-steps" aria-label="${e(t('apple.stepsLabel'))}">${['confirm','edit','test'].map((key,i)=>`<button data-rw-step="${i+1}" ${s.busy?'disabled':''} class="${s.step===i+1?'active':''}" ${s.step===i+1?'aria-current="step"':''}><span>${i+1}</span>${e(t('apple.'+key))}</button>`).join('')}</nav>`:''}
      ${readOnly&&view?`<p class="ia-muted">${e(t('revision.testHelp'))}</p><div class="ia-segments" data-result-filters>${['all','changed','failed'].map(f=>`<button data-rw-filter="${f}" aria-pressed="${f==='all'}">${e(t('apple.'+f))}</button>`).join('')}</div><div data-rw-results>${result(view)}</div><button class="ia-text-button" data-rw-action="edit-view">${e(t('apple.openDraft'))}</button>`:
        !editable&&view?completed(s):s.step===1?confirm(s):s.editor?s.step===2?edit(s):verify(s):`<p class="ia-muted">${e(t(s.loaded?'revision.notEditable':'revision.loading'))}</p>`}
    </div>`;
    host.querySelectorAll<HTMLButtonElement>('[data-rw-step]').forEach(b=>b.addEventListener('click',()=>{s.step=Number(b.dataset.rwStep);paint(s);}));
    host.querySelectorAll<HTMLButtonElement>('[data-rw-action]').forEach(b=>b.addEventListener('click',()=>void action(s,b.dataset.rwAction!)));
    host.querySelectorAll<HTMLButtonElement>('[data-rw-feedback]').forEach(b=>b.addEventListener('click',()=>void action(s,'feedback',b.dataset.rwFeedback)));
    host.querySelectorAll<HTMLButtonElement>('[data-rw-run]').forEach(b=>b.addEventListener('click',()=>ui.openRun(b.dataset.rwRun!)));
    host.querySelectorAll<HTMLButtonElement>('[data-rw-filter]').forEach(b=>b.addEventListener('click',()=>{
      host?.querySelectorAll('[data-rw-filter]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));
      const box=host?.querySelector('[data-rw-results]');if(box&&s.view)box.innerHTML=result(s.view,b.dataset.rwFilter);
    }));
    host.querySelectorAll<HTMLTextAreaElement>('textarea[name]').forEach(input=>input.addEventListener('input',()=>{
      const name=input.name as keyof Editor;if(!s.editor)return;
      if(name==='tags')s.editor.tags=input.value.split(/[,，]/).map(v=>v.trim()).filter(Boolean);else s.editor[name]=input.value;
      s.dirty=true;s.message='';const apply=host?.querySelector<HTMLButtonElement>('[data-rw-action="accept"]');if(apply)apply.disabled=true;
      const notice=host?.querySelector('[data-rw-dirty]');if(notice)notice.textContent=t('revision.dirty');
    }));
  }
  function confirm(s:Session) {
    const src=source(s), before=s.view?.base||s.context?.current, judgment=s.context?.feedback||src?.feedback;
    return `<h3>${e(t('apple.sources'))}</h3><p class="ia-muted">${e(t('apple.sourceCopy'))}</p>${src?`<button class="ia-source-row" data-rw-run="${e(src.run_id)}">${icon('clock-counter-clockwise')}<span>${e(t('apple.openRun'))}<small>${e(src.run_id)}</small></span>${icon('caret-right')}</button><small class="ia-muted">${e(t('revision.version'))}: ${e(src.revision)}</small>`:''}
      <div class="ia-excerpt"><span class="ia-eyebrow">${e(t('apple.original'))}</span><h3>${e(before?.title||t('apple.inspectMissing'))}</h3><p>${e(before?.context||'')}</p><p>${e(before?.fix||'')}</p></div>
      <p class="ia-muted">${e(t('apple.currentFeedback'))}: ${e(t('revision.'+(judgment||'unrated')))}</p>
      ${!s.view?`<div class="ia-feedback">${['helpful','irrelevant','harmful'].map(f=>`<button data-rw-feedback="${f}" aria-pressed="${judgment===f}" ${s.busy?'disabled':''}>${e(t('revision.'+f))}</button>`).join('')}</div>`:''}
      ${!feedbackReady(s)?`<p class="ia-muted">${e(t('apple.feedbackRequired'))}</p>`:''}
      ${s.editor?`<footer class="ia-workflow-footer"><span class="ia-muted">${e(t('apple.unsaved'))}</span><button class="primary" data-rw-step="2" ${s.busy?'disabled':''}>${e(t('apple.nextEdit'))}</button></footer>`:''}`;
  }
  function edit(s:Session) {
    const before=s.view?.base||s.context?.current;
    return `<div class="ia-edit-grid"><aside class="ia-before"><span class="ia-eyebrow">${e(t('apple.original'))}</span>${before?['title','context','mistake','fix'].map(k=>`<h4>${e(t('revision.field.'+k))}</h4><p>${e(before[k as keyof RevisionFields])}</p>`).join(''):''}</aside><div class="ia-editor"><span class="ia-eyebrow">${e(t('apple.draft'))}</span>${field(s,'title',t('revision.field.title'),1)}${field(s,'context',t('revision.field.context'))}${field(s,'mistake',t('revision.field.mistake'))}${field(s,'fix',t('revision.field.fix'),4)}${field(s,'tags',t('revision.field.tags'),1)}${field(s,'reason',t('revision.reason'))}</div></div><p class="ia-muted" data-rw-dirty>${e(t(s.dirty?'revision.dirty':'apple.unsaved'))}</p><footer class="ia-workflow-footer"><button class="ia-text-button" data-rw-step="1" ${s.busy?'disabled':''}>${e(t('apple.back'))}</button><div><button data-rw-action="save" ${s.busy||!feedbackReady(s)?'disabled':''}>${e(t('revision.save'))}</button><button class="primary" data-rw-step="3" ${s.busy?'disabled':''}>${e(t('apple.nextTest'))}</button></div></footer>`;
  }
  function verify(s:Session) {
    return `<h3>${e(t('apple.examples'))}</h3><p class="ia-muted">${e(t('revision.testHelp'))}</p><div class="ia-example-grid">${field(s,'positive',t('revision.positive'),3)}${field(s,'negative',t('revision.negative'),3)}</div>${s.view?.evaluation?result(s.view):''}<p class="ia-muted" data-rw-dirty>${e(t(s.dirty?'revision.dirty':'apple.unsaved'))}</p>${!feedbackReady(s)?`<p class="ia-notice">${e(t('revision.feedbackRequired'))}</p>`:''}<footer class="ia-workflow-footer"><button class="ia-text-button" data-rw-step="2" ${s.busy?'disabled':''}>${e(t('apple.back'))}</button><div><button data-rw-action="evaluate" ${s.busy||!feedbackReady(s)?'disabled':''}>${e(t('revision.evaluate'))}</button><button class="primary" data-rw-action="accept" ${ready(s)?'':'disabled'}>${e(t('revision.accept'))}</button></div></footer>${s.view?`<button class="ia-text-button" data-rw-action="reject" ${s.busy||s.dirty?'disabled':''}>${e(t('revision.reject'))}</button>`:''}`;
  }
  function completed(s:Session) {
    const v=s.view!;
    return `<div class="ia-success">${icon('check-circle')}<h3>${e(t('revision.'+v.status))}</h3>${v.commit?`<p>${e(t('revision.appliedAt'))}: ${e(v.commit.accepted_at)}</p>`:''}<button data-rw-action="verification">${e(t('apple.savedHistory'))}</button></div><h3>${e(t('apple.change'))}</h3><div class="ia-diff"><p class="removed">${e(v.base.fix)}</p><p class="added">${e(v.fields.fix)}</p></div><h3>${e(t('revision.activity'))}</h3>${v.activity?.availability==='unavailable'?`<p>${e(t('revision.activityUnavailable'))}</p>`:v.activity?.runs.length?v.activity.runs.map(r=>`<button class="ia-source-row" data-rw-run="${e(r.id)}"><span>${e(r.id)}<small>${r.exposures} ${e(t('revision.exposures'))} · ${e(t('revision.'+(r.feedback||'unrated')))}</small></span>${icon('caret-right')}</button>`).join(''):`<p class="ia-muted">${e(t('revision.activityEmpty'))}</p>`}<p class="ia-muted">${e(t('apple.boundary'))}</p>${v.status==='accepted'?`<footer class="ia-workflow-footer"><button data-rw-action="rollback" ${s.busy?'disabled':''}>${e(t('revision.rollback'))}</button></footer>`:`<p class="ia-muted">${e(t('apple.cancelled'))}</p>`}`;
  }
  async function save(s:Session) {
    if(!s.editor)return;
    const editor=structuredClone(s.editor);
    const cases:RevisionCase[]=(['positive','negative'] as const).flatMap(k=>editor[k].split('\n').map(q=>q.trim()).filter(Boolean).map(query=>({query,expectation:k==='positive'?'include':'exclude'})));
    install(s,await post<RevisionView>(s,'draft',{id:s.id,eventId:s.eventId,digest:s.view?.digest,draft:{...editor,cases}}));
  }
  async function action(s:Session,name:string,feedback?:string) {
    if(s.busy)return;
    if(name==='edit-view'){ui.edit(s.id);return;}
    if(name==='verification'){ui.verify(s.id);return;}
    if(name==='retry'){s.loaded=false;await mount(host!,s.project,s.key,readOnly);return;}
    s.busy=true;s.error='';s.message='';paint(s);
    try {
      if(name==='feedback') {
        if(!s.pendingFeedback||s.pendingFeedback.feedback!==feedback)s.pendingFeedback={eventId:s.eventId,feedback:feedback!,requestId:crypto.randomUUID()};
        const result=await post<{event_id:string}>(s,'feedback',s.pendingFeedback);
        s.eventId=result.event_id;s.context=await get<RevisionContext>(s,'context',{eventId:s.eventId});s.pendingFeedback=undefined;s.message=t('revision.feedbackSaved');
      } else if(name==='save'||name==='evaluate') {
        await save(s);
        if(name==='evaluate')install(s,await post<RevisionView>(s,'evaluate',{id:s.id,digest:s.view!.digest}));
        s.message=t(name==='save'?'revision.saved':s.view!.evaluation?.passed?'revision.pass':'revision.fail');
      } else if(s.view&&['accept','rollback','reject'].includes(name)) {
        if(name==='accept'&&(s.dirty||!s.view.evaluation?.passed))throw new Error(t('revision.dirty'));
        install(s,await post<RevisionView>(s,name,{id:s.id,digest:s.view.digest}));s.message=t('revision.'+s.view.status);
      }
      ui.changed(s.project,s.view?.id,s.key);
    } catch(error){s.error=error instanceof Error?error.message:String(error);}
    finally{s.busy=false;paint(s);}
  }
  window.addEventListener('beforeunload',event=>{if([...sessions.values()].some(s=>s.dirty||s.busy)){event.preventDefault();event.returnValue='';}});
  return {mount, result, detach(){host=null;current=null;}, hasDrafts:()=>[...sessions.values()].some(s=>s.dirty||s.busy)};
}
