import {lessons,initialState,visibleRuns,counts,draftSignature,retryCases,fetchCases} from './data.js';
import {createSheet} from './motion.js';

let state = initialState(), undoAction = null, toastTimer;
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const icon = name => `<span class="icon" style="--icon:url('icons/${name}.svg')" aria-hidden="true"></span>`;
const names = {overview:'概览',tasks:'任务记录',improve:'改进工作台',verify:'验证'};
const icons = {overview:'squares-four',tasks:'clock-counter-clockwise',improve:'sliders-horizontal',verify:'flask'};
const feedbackNames = {helpful:'有帮助',irrelevant:'不相关',harmful:'有误导'};
const sheet = createSheet($('#sheet'), () => state.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches);
const button = (label, action, attrs = '', type = 'btn-secondary') => `<button class="btn ${type}" data-action="${action}" ${attrs}>${label}</button>`;
const textButton = (label, action, attrs = '') => `<button class="text-button" data-action="${action}" ${attrs}>${label}</button>`;
const badge = (label, color = '') => `<span class="badge ${color}">${label}</span>`;
const runById = id => state.runs.find(r => r.id === id);
const jobById = id => state.jobs.find(j => j.id === id);
const currentJob = () => jobById(state.selectedJob) || state.jobs[0];
const currentEval = () => state.evaluations.find(e => e.id === state.verification) || state.evaluations[0];
const baseLesson = j => j.id==='fetch' ? {...lessons.fetch,version:'v1',fix:'请求成功时，关闭加载状态。'} : lessons[j.lesson];
const nextVersion = j => `v${Number(baseLesson(j).version.slice(1))+1}`;
const isNegative = f => f === 'irrelevant' || f === 'harmful';
const status = r => r.status === 'incomplete' ? badge('记录不完整') : r.status === 'failed' ? badge('检查未通过','orange') : badge('已完成','green');
const runAttrs = id => `data-run="${id}"`;
const jobAttrs = id => `data-job="${id}"`;
const queryMatch = (s,q) => s.toLocaleLowerCase().includes(q.toLocaleLowerCase());

function notify(message, undo) {
  clearTimeout(toastTimer); undoAction = undo || null;
  $('#toast').innerHTML = `${icon('check-circle')}<span>${esc(message)}</span>${undo ? textButton('撤销','undo') : ''}<button class="icon-button toast-close" data-action="hide-toast" aria-label="关闭提示">${icon('x')}</button>`;
  $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), undo ? 12000 : 5000);
}
function route(page, extras = {}) {
  Object.assign(state,extras,{page});
  const anchor = page === 'tasks' && state.selectedRun ? `/${state.selectedRun}` : page === 'improve' ? `/${state.selectedJob}` : '';
  history.replaceState(null,'',`#/${page}${anchor}`);
  sheet.close(); render(); window.scrollTo({top:0,behavior:'instant'});
  $('#content').focus({preventScroll:true});
}
function sidebar() {
  const open = state.jobs.filter(j => j.status === 'open').length;
  $('#sidebar').innerHTML = `<a class="brand" href="#/overview" data-action="nav" data-page="overview"><span class="brand-mark">${icon('stack')}</span><span>codetrap</span></a>
    <label class="project-picker"><span class="project-mark">C</span><select aria-label="当前项目" id="project-select"><option value="demo" ${state.project==='demo'?'selected':''}>Codetrap · 示例项目</option><option value="empty" ${state.project==='empty'?'selected':''}>新项目 · 空状态</option></select>${icon('caret-down')}</label>
    <div class="nav-label">成效</div><nav class="nav-list">${Object.entries(names).map(([key,name]) => `<button class="nav-item ${state.page===key?'active':''}" data-action="nav" data-page="${key}" ${state.page===key?'aria-current="page"':''}>${icon(icons[key])}<span>${name}</span>${key==='improve'&&open&&state.project==='demo'?`<span class="nav-count">${open}</span>`:''}</button>`).join('')}</nav>
    <div class="sidebar-bottom"><button class="connection-link" data-action="connections"><span class="status-dot"></span><span>观测连接</span>${icon('caret-right')}</button><button class="prototype-note" data-action="about"><span>交互原型</span><small>示例数据 · 不连接真实项目</small></button></div>`;
}
function toolbar() {
  $('#toolbar').innerHTML = `<div class="breadcrumbs"><button class="icon-button mobile-only" data-action="mobile-nav" aria-label="打开导航">${icon('sidebar-simple')}</button><span>成效</span>${icon('caret-right')}<strong>${names[state.page]}</strong></div><div class="toolbar-actions"><button class="search-trigger" data-action="search" aria-label="搜索任务与经验">${icon('magnifying-glass')}<span>搜索</span><kbd>⌘ K</kbd></button><label class="period-picker"><select id="period-select" aria-label="记录时间范围"><option value="week" ${state.period==='week'?'selected':''}>最近 7 天</option><option value="all" ${state.period==='all'?'selected':''}>全部记录</option></select>${icon('caret-down')}</label><button class="demo-chip" data-action="about">示例数据</button></div>`;
}
function heading(title, description, action = '') {return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
function emptyPage() {
  return `<section class="page">${heading(names[state.page], '让每一次使用，都成为下一次改进的依据。')}<div class="empty"><div class="empty-icon">${icon('plugs-connected')}</div><h2>从第一条任务记录开始</h2><p>连接编码工具后，Impact 会把使用过的经验<br>和你的反馈放在同一条任务里。</p><div class="steps-copy"><span>1. 连接工具</span>${icon('caret-right')}<span>2. 完成任务</span>${icon('caret-right')}<span>3. 回顾反馈</span></div>${button('查看连接方式','connections','','btn-primary')}${textButton('体验示例项目','load-demo')}<p class="empty-note">当前为空状态演示。连接方式不会修改本机配置。</p></div></section>`;
}
function errorPage() {
  return `<section class="page">${heading(names[state.page], '草稿已保留在当前页面。')}<div class="empty"><div class="empty-icon">${icon('warning-circle')}</div><h2>暂时无法读取记录</h2><p>这是失败状态演示。恢复后会回到当前工作位置。</p>${button('重新加载','recover','','btn-primary')}</div></section>`;
}
function render() {
  document.body.dataset.theme = state.theme; document.body.dataset.reduced = state.reduced ? 'true' : 'false';
  sidebar(); toolbar();
  $('#content').innerHTML = state.scenario === 'error' ? errorPage() : state.project === 'empty' ? emptyPage() : ({overview:overview,tasks:tasks,improve:improve,verify:verify}[state.page] || overview)();
  document.title = `${names[state.page]} · Impact 原型`;
}
function activityRow(r) {
  return `<button class="activity-row" data-action="open-run" ${runAttrs(r.id)}><span class="agent-mark">${r.client==='Codex'?'C':'A'}</span><span class="activity-main"><strong>${esc(r.title)}</strong><small>${r.client} · ${r.lessons.length ? `${r.lessons.length} 条经验` : r.miss ? '报告了漏召回' : '尚无经验展示记录'}</small></span>${status(r)}<span class="date">${r.date.slice(5).replace('-','/')} ${r.time}</span>${icon('caret-right')}</button>`;
}
function overview() {
  const c = counts(state), retry = jobById('retry'), missing = jobById('missing');
  const applied = state.jobs.filter(j => j.status === 'applied').length;
  const focus = retry.status === 'open' ? `<div class="attention-label">${icon('warning-circle')} 3 次负面反馈指向同一条经验</div><h2>有一条经验，<br>出现在不适用的任务里。</h2><p>“操作失败后重试，最多三次”被用于页面动效。缩小适用范围，可以减少对后续任务的干扰。</p><div class="attention-actions">${button(`查看并改进 ${icon('arrow-right')}`,'open-job',jobAttrs('retry'),'btn-primary')}${textButton('查看相关任务','problem-runs')}</div>` : `<div class="attention-label">${icon('check-circle')} 修订已经应用</div><h2>下一步，看看<br>新版本是否真的有用。</h2><p>检索验证已通过。还需要后续任务的实际反馈，才能判断这次改动的效果。</p><div class="attention-actions">${button('查看这次改进','open-job',jobAttrs('retry'),'btn-primary')}${textButton('查看任务记录','nav','data-page="tasks"')}</div>`;
  return `<section class="page">${heading('成效概览','看看经验是否有用，知道下一步改哪里。')}
    <div class="stats"><div class="stat"><span class="stat-label">观测任务</span><div class="stat-value number">${c.runs}</div><span class="stat-foot">${c.checkPass} 次检查通过 · ${c.runs-c.checks} 次记录不完整</span></div><div class="stat"><span class="stat-label">经验被展示</span><div class="stat-value number">${c.exposures}</div><span class="stat-foot">${c.rated} 次已有反馈</span></div><div class="stat"><span class="stat-label">反馈认为有帮助</span><div class="stat-value number">${c.helpful}<span class="denom"> / ${c.rated}</span></div><span class="stat-foot">仅统计已反馈的展示</span></div><div class="stat"><span class="stat-label">已完成的改进</span><div class="stat-value number">${applied}</div><span class="stat-foot">${state.jobs.filter(j=>j.status==='open').length} 项等待处理 · 全部时间</span></div></div>
    <div class="overview-grid"><div class="attention-surface"><div class="attention-primary">${focus}</div><button class="attention-secondary" data-action="pending-feedback"><span class="object-icon blue">${icon('thumbs-up')}</span><span><strong>${c.unrated ? `${c.unrated} 次经验展示，还没有反馈` : '已看过的经验都有反馈了'}</strong><small>${c.unrated?'回顾 SQLite 启动任务，补充一次判断':'可以继续回顾任务里的使用证据'}</small></span><span class="row-arrow">${icon('arrow-right')}</span></button>${missing.status==='open'?`<button class="attention-secondary" data-action="open-job" ${jobAttrs('missing')}><span class="object-icon">${icon('magnifying-glass')}</span><span><strong>一条已有经验，没在需要时出现</strong><small>补充一个检索例子，验证加载状态经验</small></span><span class="row-arrow">${icon('arrow-right')}</span></button>`:''}</div>
    ${overviewFollowup()}</div>
    <div class="section-heading"><h2>最近的任务</h2>${textButton('查看全部','nav','data-page="tasks"')}</div><div class="activity-list">${visibleRuns(state).slice(0,4).map(activityRow).join('')}</div><p class="footnote">示例记录截至 2026 年 9 月 8 日。任务检查结果与经验反馈分别展示，不据此推断经验带来的因果效果。</p></section>`;
}
function overviewFollowup() {
  const j=state.jobs.find(j=>j.status==='applied');
  if(!j)return `<aside class="followup"><div class="followup-header"><span class="object-icon">${icon('sliders-horizontal')}</span><span class="eyebrow">改进记录</span></div><h2>每一次改动，<br>都可以回看依据。</h2><p>完成验证并应用经验后，这里会跟踪后续使用。</p>${textButton('查看改进工作台','nav','data-page="improve"')}</aside>`;
  const original=j.id==='fetch'&&!j.reapplied,missing=j.kind==='miss';
  const result=j.cases||fetchCases;
  return `<aside class="followup"><div class="followup-header"><span class="object-icon green">${icon('check-circle')}</span><span class="eyebrow">已完成的改进</span></div><h2>${original?'请求加载状态的经验，<br>已经补齐处理边界。':missing?'为需要找到的经验，<br>保留一个检索例子。':'适用范围已收窄，<br>继续观察后续使用。'}</h2><p>${esc(j.title)}</p><div class="followup-facts"><div><strong>${missing?'1 个':`${result.filter(c=>c.after).length} / ${result.length}`}</strong><span>${missing?'新收录的检索例子':'检索用例通过'}</span></div><div><strong>${original?'1 次':'待观察'}</strong><span>${original?'后续使用认为有帮助':'没有新的实际使用反馈'}</span></div></div><div class="followup-foot"><p>${original?'样本仍少，暂时无法判断长期效果。':'检索验证不能代替后续任务的反馈。'}</p>${textButton(`查看改进记录 ${icon('arrow-right')}`,'open-job',jobAttrs(j.id))}</div></aside>`;
}
function filteredRuns() {
  return visibleRuns(state).filter(r => (state.runFilter==='all'||state.runFilter==='pending'&&r.lessons.some(l=>!l.feedback)||state.runFilter==='problems'&&(r.miss||r.lessons.some(l=>isNegative(l.feedback))||r.status==='failed'))&&queryMatch(`${r.title} ${r.client} ${r.query||''}`,state.query));
}
function runList() {
  const runs = filteredRuns();
  return `<div class="list-caption">${runs.length} 条任务记录</div>${runs.length ? runs.map(r=>`<button class="task-row ${r.id===(state.selectedRun||runs[0]?.id)?'selected':''}" data-action="select-run" ${runAttrs(r.id)} ${r.id===state.selectedRun?'aria-current="true"':''}><span class="row-top"><strong>${esc(r.title)}</strong></span><span class="row-bottom"><span>${r.client} · ${r.date.slice(5).replace('-','/')}</span>${r.lessons.some(l=>!l.feedback)?badge('待反馈','blue'):r.miss?badge('漏召回','orange'):r.lessons.some(l=>isNegative(l.feedback))?badge('有负面反馈','orange'):r.status==='incomplete'?badge('记录不完整'):''}</span></button>`).join(''):`<div class="empty"><p>没有符合条件的任务。</p>${textButton('清除筛选','clear-filters')}</div>`}`;
}
function tasks() {
  const list = filteredRuns(), run = list.find(r=>r.id===state.selectedRun)||list[0];
  return `<section class="page task-page">${heading('任务记录','把当时的证据和现在的判断，放在一起。')}<div class="filter-bar"><div class="segmented" aria-label="筛选任务">${[['all','全部'],['pending','待反馈'],['problems','需要关注']].map(([k,n])=>`<button data-action="run-filter" data-filter="${k}" aria-pressed="${state.runFilter===k}">${n}</button>`).join('')}</div><label class="search-field">${icon('magnifying-glass')}<input id="run-search" aria-label="搜索任务" placeholder="搜索任务" value="${esc(state.query)}"></label></div><div class="task-workspace ${state.selectedRun?'has-selection':''}"><div class="task-list-pane" id="run-list">${runList()}</div><article class="task-detail" id="run-detail">${run?runDetail(run):'<div class="empty"><p>选择一条任务，查看使用证据。</p></div>'}</article></div></section>`;
}
function runDetail(r) {
  return `<button class="link-back mobile-only" data-action="back-list">${icon('arrow-left')} 任务记录</button><div class="detail-eyebrow">${r.client} ${status(r)}</div><h2>${esc(r.title)}</h2><p class="summary">${esc(r.summary)}</p><div class="detail-facts"><span>${r.date} · ${r.time} PDT</span><span>${r.duration||'时长未知'}</span><span>${r.checks?`${r.checks[0]} 项通过${r.checks[1]?` · ${r.checks[1]} 项未通过`:''}`:'没有检查结果'}</span></div>
    <div class="section-space"><div class="section-heading"><h3>当时在找什么</h3></div>${r.query?`<div class="evidence-query">${icon('magnifying-glass')}<code>${esc(r.query)}</code></div><p class="hint">查询为示例数据。真实项目需明确启用上下文采集，才能显示正文。</p>`:`<div class="callout">${icon('info')}<p>${r.status==='incomplete'?'尚未收到检索事件。':'这次记录没有查询正文。可以手动补充一个检索例子。'}</p></div>`}</div>
    <div class="section-space"><div class="section-heading"><h3>展示过的经验</h3><span class="hint">${r.lessons.length} 条</span></div>${r.lessons.length?r.lessons.map(l=>lessonRow(r,l)).join(''):`<div class="empty-note">${r.miss?'用户认为“请求失败也要释放加载状态”应该出现在这里。':'当前记录中没有经验展示事件。'}</div>`}${r.miss?button('补充检索例子','open-job',jobAttrs('missing')):''}</div>
    ${r.status==='failed'?`<div class="callout orange section-space">${icon('warning-circle')}<p><strong>取消请求的检查未通过</strong><br>这条经验被反馈为有帮助；任务仍有一个失败检查。两种信息需要分别判断。</p></div>`:''}
    <details class="disclosure section-space"><summary>查看事件记录 <span>${r.events.length} 个事件</span></summary><ol class="timeline">${r.events.map(e=>`<li>${esc(e)}</li>`).join('')}</ol><p class="hint">示例任务标识：${esc(r.id)} · 事件只表示记录到的操作。</p></details>`;
}
function lessonRow(r,l) {
  const lesson=lessons[l.id];
  return `<div class="lesson-row"><div class="lesson-row-head"><span class="object-icon">${icon('book-open')}</span><div class="lesson-row-main"><button class="lesson-title" data-action="lesson" data-lesson="${l.id}">${esc(lesson.title)} ${icon('arrow-square-out')}</button><small>${lesson.source} · 当时展示 ${lesson.version}</small></div></div><p>${esc(lesson.fix)}</p><div class="feedback-controls" role="group" aria-label="这条经验的帮助程度">${Object.entries(feedbackNames).map(([k,n])=>`<button data-action="feedback" data-value="${k}" data-lesson="${l.id}" ${runAttrs(r.id)} aria-pressed="${l.feedback===k}">${icon(k==='helpful'?'thumbs-up':k==='irrelevant'?'minus-circle':'warning-circle')}${n}</button>`).join('')}</div><div class="feedback-result">${l.feedback?`已记录：${feedbackNames[l.feedback]}${isNegative(l.feedback)?` · ${textButton('进入改进工作台','open-job',jobAttrs(l.id==='retry'?'retry':ensureJobId(r,l)))}`:''}`:'这条经验对这次任务有帮助吗？'}</div></div>`;
}
function ensureJobId(r,l) {return `feedback-${r.id}-${l.id}`;}
function jobList() {
  return `<div class="job-list"><div class="list-caption">待处理 · ${state.jobs.filter(j=>j.status==='open').length}</div>${state.jobs.filter(j=>j.status==='open').map(jobItem).join('')}<div class="list-caption">已完成 · ${state.jobs.filter(j=>j.status==='applied').length}</div>${state.jobs.filter(j=>j.status==='applied').map(jobItem).join('')}</div>`;
}
function jobItem(j) {return `<button class="job-item ${j.id===state.selectedJob?'selected':''}" data-action="select-job" ${jobAttrs(j.id)}><span class="object-icon ${j.status==='applied'?'green':''}">${icon(j.status==='applied'?'check-circle':j.kind==='miss'?'magnifying-glass':'sliders-horizontal')}</span><span><strong>${esc(j.title)}</strong><small>${esc(j.description)}</small></span></button>`;}
function relatedRun(id) {const r=runById(id);return `<button class="related-run" data-action="open-run" ${runAttrs(id)}><span class="agent-mark">${r.client==='Codex'?'C':'A'}</span><span class="related-copy"><strong>${esc(r.title)}</strong><small>${r.client} · ${r.date} ${r.lessons.find(l=>isNegative(l.feedback))?`· ${feedbackNames[r.lessons.find(l=>isNegative(l.feedback)).feedback]}`:''}</small></span>${icon('caret-right')}</button>`;}
function improve() {
  const j=currentJob();
  return `<section class="page">${heading('改进工作台','从一次具体反馈出发，把经验改到更合适。')}<div class="job-layout">${jobList()}<article class="job-detail"><div class="detail-eyebrow">${badge(j.status==='applied'?'已完成':j.kind==='miss'?'漏召回反馈':'经验修订',j.status==='applied'?'green':'orange')}<span>${j.sources.length} 条任务证据</span></div><h2>${esc(j.title)}</h2><p class="job-subtitle">${esc(j.description)}</p>${j.status==='applied'?appliedJob(j):j.kind==='miss'?missingJob(j):revisionJob(j)}</article></div></section>`;
}
function revisionJob(j) {
  const s=state.step, old=baseLesson(j);
  const steps=`<nav class="steps" aria-label="经验改进步骤">${['确认问题','修改经验','验证并应用'].map((n,i)=>`<button class="step-item ${s===i+1?'active':s>i+1?'done':''}" data-action="step" data-step="${i+1}" ${s===i+1?'aria-current="step"':''}><span class="step-number">${s>i+1?icon('check'):i+1}</span>${n}</button>`).join('')}</nav>`;
  if(s===1) return `${steps}<h3>哪些任务受到了影响</h3><p>先看反馈发生的上下文，再决定是否修改经验。</p><div class="activity-list">${j.sources.map(relatedRun).join('')}</div><div class="lesson-excerpt"><span class="overline">当时的经验 · ${old.version}</span><h3>${esc(old.title)}</h3><p>${esc(old.context)}</p><p>${esc(old.fix)}</p>${textButton('查看完整经验','lesson',`data-lesson="${j.lesson}"`)}</div><div class="callout">${icon('info')}<p>建议：${esc(j.draft.reason)}</p></div><div class="workflow-footer"><span class="hint">原版本会保留，改动验证后再应用。</span>${button('修改这条经验','step','data-step="2"','btn-primary')}</div>`;
  if(s===2) return `${steps}<div class="edit-grid"><aside class="edit-before"><span class="overline">当前版本 · ${old.version}</span><h3>${esc(old.title)}</h3><small>适用场景</small><p>${esc(old.context)}</p><small>建议做法</small><p>${esc(old.fix)}</p></aside><form class="edit-form" onsubmit="return false"><span class="overline">建议草稿 · 可编辑</span>${[['title','经验标题',2],['context','适用场景',3],['fix','建议做法',5],['reason','修改原因',3]].map(([key,label,rows])=>`<label>${label}<textarea data-draft="${key}" data-job="${j.id}" rows="${rows}" maxlength="2000">${esc(j.draft[key])}</textarea></label>`).join('')}<p class="hint" id="draft-status">草稿保留在当前页面，切换区域不会丢失。刷新页面会重置。</p></form></div><div class="workflow-footer">${textButton('返回问题','step','data-step="1"')}${button('下一步：验证','step','data-step="3"','btn-primary')}</div>`;
  const tested=j.tested&&j.signature===draftSignature(j), cases=j.cases||retryCases, passed=cases.filter(c=>c.after).length;
  return `${steps}<div class="section-heading"><h3>在原有例子和反例上检查改动</h3>${badge('示例验证')}</div><p>既要继续找到合适的经验，也要确认它不会再出现在不适用的任务里。</p><div class="callout">${icon('info')}<p>本原型演示验证状态与应用门槛，不运行 Codetrap 检索引擎。结果按示例规则计算，不能作为真实评测结论。</p></div>${tested?`<div class="validation-summary ${passed!==cases.length?'failed':''}"><span class="object-icon ${passed===cases.length?'green':''}">${icon(passed===cases.length?'check-circle':'warning-circle')}</span><div><strong>${passed} / ${cases.length} 项通过</strong><p>${passed===cases.length?'未发现示例回归，可以应用当前草稿。':'仍有用例未通过。调整适用场景后重新验证。'}</p></div></div>`:''}${caseTable(cases,tested,'job')}<details class="disclosure"><summary>验证范围与判定方式</summary><p>示例针对“SQLite / 数据库”的适用范围及“动画 / 取消”的排除说明检查草稿；其他经验检查字段是否完整。正式实现应使用同一份冻结语料和真实检索结果，并绑定草稿摘要。</p></details><div class="workflow-footer">${textButton('返回修改','step','data-step="2"')}<div>${button(tested?'重新验证':'运行示例验证','test-job',jobAttrs(j.id))} ${button('应用这个版本','apply-job',`${jobAttrs(j.id)} ${!tested||passed!==cases.length?'disabled':''}`,'btn-primary')}</div></div>`;
}
function missingJob(j) {
  return `<div class="section-space"><h3>应该找到哪条经验</h3><div class="lesson-excerpt"><span class="overline">已有经验 · ${lessons[j.lesson].version}</span><h3>${esc(lessons[j.lesson].title)}</h3><p>${esc(lessons[j.lesson].fix)}</p></div><h3>补充当时的检索方式</h3><p>这次任务没有保存查询正文。用你当时会搜索的话，补充一个可复用的检索例子。</p><label class="field">检索例子<input id="missing-query" value="${esc(j.query||'')}" maxlength="300" placeholder="例如：请求失败后，页面一直显示加载中"></label><p class="hint">期望：应找到“${esc(lessons[j.lesson].title)}”。经验正文保持当前版本。</p>${j.tested?`<div class="validation-summary ${j.match?'':'failed'}">${icon(j.match?'check-circle':'warning-circle')}<div><strong>${j.match?'示例检索找到了目标经验':'示例检索没有找到目标经验'}</strong><p>${j.match?'可以把这个例子收录到回归用例里。':'可以先收录为失败用例，保留后续改进的依据。'}</p></div></div>`:''}<div class="workflow-footer">${button('验证这个例子','test-missing',jobAttrs(j.id))}${button('收录为检索用例','apply-missing',`${jobAttrs(j.id)} ${!j.tested?'disabled':''}`,'btn-primary')}</div><div class="section-space"><h3>来自这条任务</h3>${j.sources.map(relatedRun).join('')}</div></div>`;
}
function appliedJob(j) {
  const original=j.id==='fetch'&&!j.reapplied, missing=j.kind==='miss';
  return `<div class="success-surface"><span class="object-icon green">${icon('check-circle')}</span><h3>${missing?'检索例子已收录':'新版本已应用'}</h3><p>${missing?'这个例子会成为后续检索改进的依据。':original?'经验 v2 已于 2026 年 8 月 30 日应用。':`原型内已应用草稿为 ${nextVersion(j)}。实际经验库没有被修改。`}</p>${button('查看验证记录','job-evaluation',jobAttrs(j.id))}</div>${!missing?`<div class="section-heading"><h3>改了什么</h3>${badge(original?'v1 → v2':`${baseLesson(j).version} → ${nextVersion(j)}`)}</div><div class="version-diff"><p class="removed">${original?'请求成功时，关闭加载状态。':esc(baseLesson(j).fix)}</p><p class="added">${esc(j.draft.fix)}</p></div>`:''}<div class="section-space"><h3>应用之后</h3><div class="followup-facts"><div><strong>${original?'1':'0'} 次</strong><span>新版本被展示</span></div><div><strong>${original?'1 次':'待观察'}</strong><span>${original?'反馈认为有帮助':'尚无新版本的任务反馈'}</span></div></div><p class="hint">只统计明确关联到这个版本的后续展示与反馈。检索通过不代表实际任务表现一定改善。</p>${original?textButton('查看后续任务','open-run',runAttrs('api-wrapper')):''}</div><details class="disclosure section-space"><summary>原始问题与来源</summary>${j.sources.map(relatedRun).join('')}</details><div class="workflow-footer"><span class="hint">此原型中的操作仅影响示例。</span>${textButton(missing?'撤销收录':'回滚这个版本','rollback',jobAttrs(j.id))}</div>`;
}
function caseTable(cases, tested=true, owner='evaluation') {
  const filtered=cases.map((c,index)=>({...c,index})).filter(c=>owner==='job'||state.caseFilter==='all'||state.caseFilter==='changed'&&c.before!==c.after||state.caseFilter==='failed'&&!c.after);
  return `<div class="table-region"><table class="case-table"><thead><tr><th>检索例子</th><th>期望</th><th>原版本</th><th>当前版本</th></tr></thead><tbody>${filtered.length?filtered.map(c=>`<tr><td><button class="case-query" data-action="case-detail" data-owner="${owner}" data-index="${c.index}">${esc(c.query)}</button></td><td>${c.expected==='include'?'应找到':'不应找到'}</td><td><span class="${c.before?'status-pass':'status-fail'}">${c.before?'通过':'未通过'}</span></td><td>${tested?`<span class="${c.after?'status-pass':'status-fail'}">${c.after?'通过':'未通过'}</span>`:'<span class="hint">待验证</span>'}</td></tr>`).join(''):'<tr><td colspan="4"><div class="empty-note">没有符合筛选条件的用例。</div></td></tr>'}</tbody></table></div>`;
}
function verify() {
  const evaluations=state.evaluations.filter(e=>e.kind===state.verifyKind);
  let e=evaluations.find(e=>e.id===state.verification)||evaluations[0]; if(e)state.verification=e.id;
  return `<section class="page verification-page">${heading('验证','每一次改动，都有可以回看的依据。',button(`${icon('plus')} 新建验证`,'new-eval','','btn-primary'))}<div class="filter-bar"><div class="segmented" aria-label="验证类型">${[['revision','经验改动'],['retrieval','检索对照']].map(([k,n])=>`<button data-action="verify-kind" data-kind="${k}" aria-pressed="${state.verifyKind===k}">${n}</button>`).join('')}</div>${e?`<label class="history-picker"><select id="evaluation-select" aria-label="选择验证记录">${evaluations.map(ev=>`<option value="${ev.id}" ${ev.id===e.id?'selected':''}>${esc(ev.title)}</option>`).join('')}</select>${icon('caret-down')}</label>`:''}</div>${e?evaluationDetail(e):`<div class="empty"><div class="empty-icon">${icon('flask')}</div><h2>比较检索方式，找到差异</h2><p>在相同例子和相同语料上比较配置，<br>查看哪些查询改善了，哪些发生了回归。</p>${button('运行检索对照示例','run-retrieval','','btn-primary')}<p class="empty-note">使用 8 个示例用例，结果只用于体验比较流程。</p></div>`}</section>`;
}
function evaluationDetail(e) {
  const before=e.cases.filter(c=>c.before).length,after=e.cases.filter(c=>c.after).length,improved=e.cases.filter(c=>!c.before&&c.after).length,regressed=e.cases.filter(c=>c.before&&!c.after).length;
  if(e.mode==='intake') return `<div class="validation-top"><div><div class="eyebrow">检索用例收录 · ${e.date} · 示例结果</div><h2>${esc(e.title)}</h2><p>${esc(lessons[e.lesson].title)} · ${textButton('查看对应改进','open-job',jobAttrs(e.job))}</p></div>${badge(`${after} / ${e.cases.length} 项通过`,after===e.cases.length?'green':'orange')}</div><div class="callout">${icon('info')}<p>这次只补充了检索例子，没有修改经验或比较两个版本。目前只有正例，还需要反例才能检查误召回。</p></div><div class="table-region"><table class="case-table intake"><thead><tr><th>新收录的检索例子</th><th>期望</th><th>收录时的结果</th></tr></thead><tbody>${e.cases.map((c,index)=>`<tr><td><button class="case-query" data-action="case-detail" data-owner="intake" data-index="${index}">${esc(c.query)}</button></td><td>应找到</td><td><span class="${c.after?'status-pass':'status-fail'}">${c.after?'通过':'未通过'}</span></td></tr>`).join('')}</tbody></table></div><p class="footnote">失败用例也可以收录，用于跟踪尚未解决的检索问题。</p>`;
  return `<div class="validation-top"><div><div class="eyebrow">${e.kind==='revision'?'经验版本对照':'检索配置对照'} · ${e.date} · 示例结果</div><h2>${esc(e.title)}</h2><p>${e.kind==='revision'?esc(lessons[e.lesson].title):'关键词匹配 → 加入场景约束'}${e.job?` · ${textButton('查看对应改进','open-job',jobAttrs(e.job))}`:''}</p></div>${badge(regressed?'有回归':'无新增失败',regressed?'orange':'green')}</div><div class="stats"><div class="stat"><span class="stat-label">用例通过</span><div class="stat-value number">${before}<span class="denom"> → </span>${after}<span class="denom"> / ${e.cases.length}</span></div><span class="stat-foot">在同一组用例上比较</span></div><div class="stat"><span class="stat-label">改善</span><div class="stat-value number">${improved}</div><span class="stat-foot">由未通过变为通过</span></div><div class="stat"><span class="stat-label">回归</span><div class="stat-value number">${regressed}</div><span class="stat-foot">由通过变为未通过</span></div><div class="stat"><span class="stat-label">用例构成</span><div class="stat-value number">${e.cases.filter(c=>c.expected==='include').length}<span class="denom"> 正例 / </span>${e.cases.filter(c=>c.expected==='exclude').length}<span class="denom"> 反例</span></div><span class="stat-foot">${e.cases.some(c=>c.expected==='exclude')?'同时检查召回和误召回':'还没有反例，暂不判断误召回'}</span></div></div><div class="case-head"><h3>逐项查看差异</h3><div class="segmented" aria-label="筛选用例">${[['all','全部'],['changed','有变化'],['failed','未通过']].map(([k,n])=>`<button data-action="case-filter" data-filter="${k}" aria-pressed="${state.caseFilter===k}">${n}</button>`).join('')}</div></div>${caseTable(e.cases)}<details class="disclosure method-note"><summary>这次验证能说明什么</summary><p>它展示同一组检索例子下，两个候选版本的差异。这里的数据是原型示例，没有调用真实检索服务，也没有运行 Agent 任务。</p><p>正式记录应保留语料快照、经验版本、查询期望、检索配置、结果与评分器版本，确保回看时不会被后续改动影响。</p></details>`;
}

function showLesson(id) {
  const l=lessons[id]; sheet.show('经验详情',`<div class="detail-eyebrow">${badge(l.version)}<span>${l.source}</span></div><h2>${esc(l.title)}</h2><div class="tag-list">${l.tags.map(t=>badge(t)).join('')}</div><section class="read-section"><h3>适用场景</h3><p>${esc(l.context)}</p></section><section class="read-section"><h3>容易犯的错误</h3><p>${esc(l.mistake)}</p></section><section class="read-section"><h3>建议做法</h3><p>${esc(l.fix)}</p></section><p class="hint">这是任务当时展示的示例版本，后续修订不会改变这份证据。</p><div class="sheet-footer">${button('进入改进工作台','lesson-job',`data-lesson="${id}"`,'btn-primary')}</div>`);
}
function showAbout() {
  sheet.show('关于这个原型',`<span class="prototype-strong">Impact · 完整流程原型</span><h2>经验有没有用，<br>下一步怎么改。</h2><p>所有任务名称、查询和数字都是示例。操作只保留在当前页面，刷新后重置，不调用真实项目 API。</p><div class="settings-row"><div><strong>外观</strong><small>检查浅色与深色下的信息层级</small></div><div class="segmented"><button data-action="theme" data-theme="light" aria-pressed="${state.theme==='light'}">${icon('sun')} 浅色</button><button data-action="theme" data-theme="dark" aria-pressed="${state.theme==='dark'}">${icon('moon')} 深色</button></div></div><label class="settings-row"><span><strong>减少动态效果</strong><small>同时尊重系统的动态效果设置</small></span><input type="checkbox" class="switch" id="reduce-motion" ${state.reduced?'checked':''}></label><div class="settings-row"><span><strong>读取失败</strong><small>模拟恢复，草稿与位置继续保留</small></span>${button('演示','simulate-error')}</div><div class="settings-row"><span><strong>重置示例数据</strong><small>重新从初始任务和反馈开始体验</small></span>${button('重置','reset')}</div><section class="read-section"><h3>设计依据</h3><p>依据 Apple Design skill：系统字体、克制分组、按下即反馈，以及能够被手势打断的面板动效。</p><a class="text-button" href="https://github.com/emilkowalski/skills/tree/main/skills/apple-design" target="_blank" rel="noopener">查看使用的 Skill ${icon('arrow-square-out')}</a></section>`);
}
function showConnections() {
  sheet.show('观测连接',`<h2>让任务留下使用证据。</h2><p>正式产品应分别显示连接状态、最近事件与采集范围。历史记录不代表工具当前在线。</p>${['Codex','Claude Code'].map((n,i)=>`<label class="connection-client"><span class="agent-mark">${i?'A':'C'}</span><span><strong>${n}</strong><small>示例连接 · ${state.connections?.[i]===false?'已暂停':'接收任务与经验展示事件'}</small></span><input type="checkbox" class="switch" data-client="${i}" aria-label="${n} 示例连接" ${state.connections?.[i]===false?'':'checked'}></label>`).join('')}<div class="callout">${icon('info')}<p>这些开关仅演示连接状态，不会安装 Hook 或修改工具配置。</p></div><section class="read-section"><h3>采集内容应由你决定</h3><ul class="note-list"><li>基础事件：任务、检索、经验展示、检查结果。</li><li>可选上下文：任务标题、查询正文。默认不采集，启用后应支持脱敏和删除。</li><li>用户判断：有帮助、不相关、有误导、漏召回。</li></ul></section>`);
}
function searchResults(query) {
  const runs=state.project==='empty'?[]:state.runs.filter(r=>queryMatch(r.title,query)).slice(0,5);
  const cards=state.project==='empty'?[]:Object.values(lessons).filter(l=>queryMatch(`${l.title} ${l.context}`,query)).slice(0,4);
  return `${runs.length?`<div class="search-group-label">任务</div>${runs.map(r=>`<button class="search-result" data-action="open-run" ${runAttrs(r.id)}>${icon('clock-counter-clockwise')}<span><strong>${esc(r.title)}</strong><small>${r.client} · ${r.date}</small></span>${icon('caret-right')}</button>`).join('')}`:''}${cards.length?`<div class="search-group-label">经验</div>${cards.map(l=>`<button class="search-result" data-action="lesson" data-lesson="${l.id}">${icon('book-open')}<span><strong>${esc(l.title)}</strong><small>${l.source} · ${l.version}</small></span>${icon('caret-right')}</button>`).join('')}`:''}${!runs.length&&!cards.length?'<div class="empty-note">没有匹配的任务或经验，试试更短的关键词。</div>':''}`;
}
function showCase(index,owner) {
  const j=currentJob(), e=currentEval(), c=(owner==='job'?(j.cases||retryCases):e.cases)[index];
  const lesson=lessons[owner==='job'?j.lesson:e.lesson||'retry'];
  const tested=owner!=='job'||j.tested&&j.signature===draftSignature(j);
  const resultText=(pass)=>c.expected==='include'?(pass?'找到目标经验':'没有找到目标经验'):(pass?'没有出现目标经验':'目标经验被误召回');
  sheet.show('检索例子',`<span class="eyebrow">${owner==='job'?'草稿验证':'历史验证'} · 示例证据</span><h2>${esc(c.query)}</h2><section class="read-section"><h3>期望结果</h3><p>${c.expected==='include'?'应该找到':'不应该找到'}：${esc(lesson.title)}</p></section>${owner==='intake'?'':`<section class="read-section"><h3>原版本</h3><p>${badge(c.before?'通过':'未通过',c.before?'green':'orange')} ${resultText(c.before)}</p></section>`}<section class="read-section"><h3>${owner==='intake'?'收录时的结果':'当前版本'}</h3><p>${tested?`${badge(c.after?'通过':'未通过',c.after?'green':'orange')} ${resultText(c.after)}`:'尚未验证'}</p></section><div class="callout">${icon('info')}<p>这里展示固定的示例判定。正式产品应展示本次检索保存的排名、分数、经验标题和版本，不从当前经验库重新拼接历史证据。</p></div>`);
}
function addEvaluation(j,cases) {
  const id=`${j.id}-${Date.now()}`;
  state.evaluations.unshift({id,title:`${j.kind==='miss'?'新增检索例子':j.draft.title+' · 草稿验证'}`,date:'2026-09-08',lesson:j.lesson,cases:structuredClone(cases),kind:j.kind==='miss'?'retrieval':'revision',mode:j.kind==='miss'?'intake':'comparison',job:j.id});
  j.evaluation=id; state.verification=id; return id;
}
function createJob(lessonId, source) {
  const existing=state.jobs.find(j=>j.lesson===lessonId&&j.status==='open'); if(existing)return existing.id;
  const l=lessons[lessonId], id=`feedback-${source||'review'}-${lessonId}`;
  state.jobs.push({id,lesson:lessonId,kind:'revision',status:'open',title:`检查“${l.title}”的适用范围`,description:'从使用反馈开始修订',sources:source?[source]:[],draft:{title:l.title,context:l.context,fix:l.fix,reason:'结合这次任务的反馈，核对适用范围。'},tested:false,signature:null});return id;
}
const actions = {
  nav: el=>route(el.dataset.page),
  'mobile-nav':()=>sheet.show('导航',`<nav class="nav-list">${Object.entries(names).map(([key,name])=>`<button class="nav-item ${state.page===key?'active':''}" data-action="nav" data-page="${key}">${icon(icons[key])}${name}</button>`).join('')}</nav>`),
  'open-run':el=>route('tasks',{selectedRun:el.dataset.run,runFilter:'all',query:'',period:runById(el.dataset.run).date<'2026-09-02'?'all':state.period}),
  'select-run':el=>{state.selectedRun=el.dataset.run;render();},
  'back-list':()=>{state.selectedRun=null;render();},
  'run-filter':el=>{state.runFilter=el.dataset.filter;state.selectedRun=null;render();},
  'clear-filters':()=>{state.runFilter='all';state.query='';state.selectedRun=null;render();},
  'problem-runs':()=>route('tasks',{runFilter:'problems',selectedRun:null,query:''}),
  'pending-feedback':()=>{const r=visibleRuns(state).find(r=>r.lessons.some(l=>!l.feedback));route('tasks',{runFilter:r?'pending':'all',selectedRun:r?.id||null,query:''});},
  'open-job':el=>{let id=el.dataset.job;if(!jobById(id)) {const r=state.runs.find(r=>r.lessons.some(l=>ensureJobId(r,l)===id));const l=r?.lessons.find(l=>ensureJobId(r,l)===id);if(l)id=createJob(l.id,r.id);}if(jobById(id))route('improve',{selectedJob:id,step:1});},
  'select-job':el=>{state.selectedJob=el.dataset.job;state.step=1;render();},
  step:el=>{state.step=Number(el.dataset.step);render();window.scrollTo({top:0,behavior:'instant'});},
  lesson:el=>showLesson(el.dataset.lesson),
  'lesson-job':el=>{const id=createJob(el.dataset.lesson,state.page==='tasks'?(state.selectedRun||filteredRuns()[0]?.id):null);route('improve',{selectedJob:id,step:1});},
  feedback:el=>{
    const r=runById(el.dataset.run),l=r.lessons.find(l=>l.id===el.dataset.lesson),before=l.feedback;
    l.feedback=el.dataset.value;render();notify(`已记录：${feedbackNames[l.feedback]}`,()=>{l.feedback=before;render();});
  },
  'test-job':el=>{
    const j=jobById(el.dataset.job);
    if(Object.values(j.draft).some(v=>!v.trim())) {notify('请先填写完整的标题、适用场景、做法和修改原因。');state.step=2;render();return;}
    const narrow=/SQLite|数据库|BUSY|LOCKED/i.test(j.draft.context),exclude=/动画|取消/.test(j.draft.fix);
    j.cases=structuredClone(j.lesson==='fetch'?fetchCases:retryCases).map(c=>({...c,after:j.lesson==='retry'?(c.expected==='include'?narrow:narrow&&exclude):true}));
    j.tested=true;j.signature=draftSignature(j);addEvaluation(j,j.cases);render();notify('示例验证完成，结果已保留。');
  },
  'apply-job':el=>{
    const j=jobById(el.dataset.job);if(!j.tested||j.signature!==draftSignature(j)||!j.cases.every(c=>c.after))return;
    const before=structuredClone(j);j.status='applied';j.reapplied=true;j.description=`${j.cases.length} 项示例验证通过 · 已应用 ${nextVersion(j)}`;render();notify('新版本已应用到示例。',()=>{Object.assign(j,before);render();});
  },
  'test-missing':el=>{
    const j=jobById(el.dataset.job);if(!j.query?.trim()){notify('先补充一个检索例子。');$('#missing-query').focus();return;}
    j.match=/请求|加载|loading|fetch|网络/i.test(j.query);j.tested=true;render();notify('示例验证完成。');
  },
  'apply-missing':el=>{
    const j=jobById(el.dataset.job);if(!j.tested)return;const before=structuredClone(j);
    addEvaluation(j,[{query:j.query,expected:'include',before:j.match,after:j.match}]);j.status='applied';j.description=`已收录 1 个${j.match?'通过':'未通过'}的检索用例`;render();notify('检索例子已收录到示例。',()=>{Object.assign(j,before);render();});
  },
  rollback:el=>{
    const j=jobById(el.dataset.job),before=structuredClone(j);j.status='open';j.description=j.kind==='miss'?'收录已撤销 · 可继续补充':'已回滚 · 可以继续修改';state.step=2;render();notify(j.kind==='miss'?'已撤销示例收录。':'已回滚示例版本，草稿仍然保留。',()=>{Object.assign(j,before);render();});
  },
  'job-evaluation':el=>{const j=jobById(el.dataset.job);route('verify',{verification:j.evaluation||'fetch',verifyKind:j.kind==='miss'?'retrieval':'revision',caseFilter:'all'});},
  'verify-kind':el=>{state.verifyKind=el.dataset.kind;state.caseFilter='all';render();},
  'case-filter':el=>{state.caseFilter=el.dataset.filter;render();},
  'case-detail':el=>showCase(Number(el.dataset.index),el.dataset.owner),
  'new-eval':()=>sheet.show('新建验证',`<h2>你想确认什么？</h2><p>选择要比较的改动，检查通过、改善与回归。</p><button class="search-result" data-action="open-job" data-job="retry">${icon('book-open')}<span><strong>验证经验改动</strong><small>打开重试经验草稿，在应用前检查正例和反例</small></span>${icon('caret-right')}</button><button class="search-result" data-action="run-retrieval">${icon('flask')}<span><strong>比较检索配置</strong><small>在相同的 8 个例子上运行对照示例</small></span>${icon('caret-right')}</button><p class="hint">此处执行的是原型演示，不运行真实检索或 Agent。</p>`),
  'run-retrieval':()=>{
    const id=`retrieval-${Date.now()}`;state.evaluations.unshift({id,title:'检索场景约束 · 对照示例',date:'2026-09-08',lesson:'retry',kind:'retrieval',cases:structuredClone(retryCases)});route('verify',{verification:id,verifyKind:'retrieval',caseFilter:'all'});notify('检索对照示例已生成。');
  },
  search:()=>sheet.show('搜索',`<label class="search-field search-sheet">${icon('magnifying-glass')}<input id="global-search" placeholder="搜索任务或经验" aria-label="搜索任务或经验" autocomplete="off"></label><div class="sheet-results" id="global-results">${searchResults('')}</div>`),
  about:showAbout, connections:showConnections,
  theme:el=>{state.theme=el.dataset.theme;render();showAbout();},
  'simulate-error':()=>{state.scenario='error';sheet.close();render();},
  recover:()=>{state.scenario='normal';render();notify('记录已恢复，工作位置与草稿已保留。');},
  'load-demo':()=>{state.project='demo';render();},
  reset:()=>{const previous=state;state=initialState();route('overview');notify('已重置示例数据。',()=>{state=previous;render();});},
  undo:()=>{const undo=undoAction;undoAction=null;if(undo){undo();notify('已撤销上一次操作。');}},
  'hide-toast':()=>$('#toast').classList.remove('show'),
  'close-sheet':()=>sheet.close(),
};
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const action=actions[el.dataset.action];if(action){event.preventDefault();action(el);}});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='run-search') {state.query=el.value;state.selectedRun=null;$('#run-list').innerHTML=runList();const r=filteredRuns()[0];$('#run-detail').innerHTML=r?runDetail(r):'<div class="empty"><p>没有匹配的任务。</p></div>';}
  if(el.id==='global-search')$('#global-results').innerHTML=searchResults(el.value);
  if(el.dataset.draft){const j=jobById(el.dataset.job);j.draft[el.dataset.draft]=el.value;j.tested=false;$('#draft-status').textContent='草稿已保留在当前页面。内容有改动，需要重新验证。';}
  if(el.id==='missing-query'){const j=currentJob();j.query=el.value;j.tested=false;const apply=$('[data-action="apply-missing"]');if(apply)apply.disabled=true;const result=$('.validation-summary');if(result)result.remove();}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='project-select'){state.project=el.value;state.scenario='normal';render();}
  if(el.id==='period-select'){state.period=el.value;state.selectedRun=null;render();}
  if(el.id==='evaluation-select'){state.verification=el.value;state.caseFilter='all';render();}
  if(el.id==='reduce-motion'){state.reduced=el.checked;document.body.dataset.reduced=String(state.reduced);}
  if(el.dataset.client!==undefined){state.connections ||= [true,true];state.connections[Number(el.dataset.client)]=el.checked;showConnections();}
});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();actions.search();}});
function fromHash(){const [page,id]=location.hash.replace(/^#\//,'').split('/');if(names[page]){state.page=page;if(page==='tasks'&&runById(id))state.selectedRun=id;if(page==='improve'&&jobById(id))state.selectedJob=id;}render();}
window.addEventListener('hashchange',fromHash);fromHash();
