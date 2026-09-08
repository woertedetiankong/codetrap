// All records in this prototype are illustrative. No product API is accessed.
export const lessons = {
  sqlite: { id:'sqlite', title:'先设置 busy_timeout，再初始化 SQLite', version:'v3', context:'SQLite 连接启动、WAL 与并发初始化。', mistake:'锁等待配置晚于可能持锁的启动操作。', fix:'创建连接后立即设置 busy_timeout，再配置 WAL 并执行迁移。用独占锁测试覆盖启动路径。', tags:['SQLite','并发'], source:'项目经验 · #5' },
  migration: { id:'migration', title:'数据库迁移需要可重复执行', version:'v2', context:'新增字段、修改索引以及升级已有数据库。', mistake:'只在新建数据库上验证迁移脚本。', fix:'从旧版数据库运行迁移，再重复执行一次。检查字段、索引与原有数据是否保持正确。', tags:['迁移','幂等性'], source:'项目经验 · #8' },
  retry: { id:'retry', title:'操作失败后重试，最多三次', version:'v1', context:'执行操作出现超时或失败时。', mistake:'第一次失败就直接退出。', fix:'失败后重新执行，最多重试三次，仍失败时返回错误。', tags:['重试','错误处理'], source:'项目经验 · #12' },
  fetch: { id:'fetch', title:'请求失败也要释放加载状态', version:'v2', context:'通过 fetchWrapper 发起界面请求。', mistake:'只在请求成功后关闭 loading，错误时页面无法继续操作。', fix:'在 finally 中释放 loading；保留错误状态，提供明确的重试入口。取消请求不弹出普通失败提示。', tags:['请求','界面状态'], source:'项目经验 · #16' },
};
export const baseRuns = [
  {id:'sqlite-startup',title:'修复 SQLite 并发启动失败',date:'2026-09-07',time:'18:42',client:'Codex',duration:'12 分 24 秒',status:'completed',checks:[8,0],query:'sqlite busy_timeout WAL startup database locked',summary:'调整连接初始化顺序，并验证持锁时的启动行为。',lessons:[{id:'sqlite',feedback:'helpful'},{id:'migration',feedback:null}],events:['开始任务','检索项目经验','展示 2 条经验','8 项检查通过','任务结束']},
  {id:'page-motion',title:'调整页面切换动效',date:'2026-09-07',time:'17:10',client:'Claude Code',duration:'6 分 18 秒',status:'completed',checks:[4,0],query:'animation transition timeout interrupt state',summary:'切换页面时保留当前进度，让动画可以被下一次操作打断。',lessons:[{id:'retry',feedback:'irrelevant'}],events:['开始任务','检索项目经验','展示重试建议','4 项检查通过','记录不相关反馈']},
  {id:'api-wrapper',title:'整理 API 请求层',date:'2026-09-07',time:'14:08',client:'Codex',duration:'18 分 09 秒',status:'failed',checks:[11,1],query:'fetchWrapper loading request cancellation finally',summary:'统一错误处理与加载状态。取消请求的测试仍有一项未通过。',lessons:[{id:'fetch',feedback:'helpful'}],events:['开始任务','检索项目经验','展示加载状态经验','11 项通过 · 1 项未通过','用户反馈有帮助']},
  {id:'loading-state',title:'补充前端加载状态',date:'2026-09-06',time:'16:35',client:'Claude Code',duration:'9 分 31 秒',status:'completed',checks:[5,0],query:null,summary:'请求失败后页面一直显示加载中。用户报告：已有经验本应出现，但没有被找到。',lessons:[],miss:true,events:['开始任务','完成检索 · 未找到经验','5 项检查通过','记录漏召回反馈']},
  {id:'migration-check',title:'验证迁移脚本幂等性',date:'2026-09-06',time:'11:20',client:'Codex',duration:'8 分 42 秒',status:'completed',checks:[6,0],query:'sqlite migration rerun existing database',summary:'从旧版数据运行迁移，检查重复执行后的结构和内容。',lessons:[{id:'migration',feedback:'helpful'}],events:['开始任务','检索项目经验','展示迁移经验','6 项检查通过','任务结束']},
  {id:'responsive-layout',title:'调整响应式布局',date:'2026-09-05',time:'19:04',client:'Claude Code',duration:null,status:'incomplete',checks:null,query:null,summary:'目前只有任务开始记录。尚未收到结束或检索事件。',lessons:[],events:['开始任务']},
  {id:'transition-cancel',title:'修复动画取消后的闪烁',date:'2026-09-04',time:'15:27',client:'Codex',duration:'14 分 02 秒',status:'completed',checks:[7,0],query:'animation retry cancelled transition',summary:'重复播放使闪烁更明显。用户反馈重试建议在这个任务中有误导。',lessons:[{id:'retry',feedback:'harmful'}],events:['开始任务','展示重试建议','取消重复动画','7 项检查通过','记录有误导反馈']},
  {id:'toast-timing',title:'调整状态提示的消失时机',date:'2026-09-03',time:'10:12',client:'Claude Code',duration:'5 分 16 秒',status:'completed',checks:[3,0],query:'notification timeout dismiss interaction',summary:'提示停留时间由当前交互决定，不需要重新执行任务。',lessons:[{id:'retry',feedback:'irrelevant'}],events:['开始任务','展示重试建议','3 项检查通过','记录不相关反馈']},
  {id:'request-finally',title:'修正请求封装的错误边界',date:'2026-08-30',time:'13:25',client:'Codex',duration:'16 分 08 秒',status:'completed',checks:[8,0],query:'fetch finally cancel loading',summary:'在请求的所有退出路径释放状态，并将修订后的经验加入回归验证。',lessons:[],events:['开始任务','修订经验','8 项检查通过','人工应用新版本']},
];
export const retryDraft = { title:'仅对 SQLite 瞬时锁冲突进行有限重试',context:'SQLite 返回 BUSY 或 LOCKED，且操作支持安全重试时。',fix:'仅对可恢复的数据库锁冲突进行有限重试，最多三次。界面动画、取消操作和参数错误不应重试。',reason:'这条建议在三次界面任务中被误召回，需要缩小适用范围。' };
export const retryCases = [
  {query:'SQLite BUSY 时重试事务',expected:'include',before:true,after:true},
  {query:'数据库写锁冲突如何恢复',expected:'include',before:true,after:true},
  {query:'SQLite LOCKED 有限重试',expected:'include',before:true,after:true},
  {query:'事务冲突后安全重试',expected:'include',before:true,after:true},
  {query:'重复执行幂等数据库操作',expected:'include',before:true,after:true},
  {query:'动画切换 timeout',expected:'exclude',before:false,after:true},
  {query:'取消页面 transition',expected:'exclude',before:false,after:true},
  {query:'提示消息自动消失',expected:'exclude',before:false,after:true},
];
export const fetchCases = [
  {query:'请求失败关闭 loading',expected:'include',before:true,after:true},
  {query:'fetchWrapper finally 释放状态',expected:'include',before:true,after:true},
  {query:'用户取消请求之后的界面',expected:'include',before:false,after:true},
  {query:'网络异常恢复操作入口',expected:'include',before:false,after:true},
  {query:'接口成功之后清理状态',expected:'include',before:true,after:true},
  {query:'请求重试的加载状态',expected:'include',before:true,after:true},
  {query:'SQLite schema migration',expected:'exclude',before:true,after:true},
  {query:'动画帧率与缓动',expected:'exclude',before:true,after:true},
];
export function initialState() {return {
 project:'demo',period:'week',page:'overview',selectedRun:null,runFilter:'all',query:'',selectedJob:'retry',step:1,
 runs:structuredClone(baseRuns),jobs:[{id:'retry',lesson:'retry',kind:'noise',status:'open',title:'重试建议的适用范围太宽',description:'2 次不相关 · 1 次有误导',sources:['page-motion','transition-cancel','toast-timing'],draft:structuredClone(retryDraft),tested:false,signature:null},{id:'missing',lesson:'fetch',kind:'miss',status:'open',title:'加载状态经验没有被找到',description:'1 次漏召回反馈',sources:['loading-state'],draft:{title:lessons.fetch.title,context:lessons.fetch.context,fix:lessons.fetch.fix,reason:'补充用户的检索方式，确认经验是否能被找到。'},tested:false,signature:null},{id:'fetch',lesson:'fetch',kind:'revision',status:'applied',title:'补齐请求错误与取消的处理边界',description:'8 项验证通过 · 已应用 v2',sources:['request-finally'],draft:{title:lessons.fetch.title,context:lessons.fetch.context,fix:lessons.fetch.fix,reason:'覆盖取消和错误路径。'},tested:true,signature:'initial'}],
 verification:'fetch',caseFilter:'all',verifyKind:'revision',theme:'light',reduced:false,scenario:'normal',evaluations:[{id:'fetch',title:'请求加载状态 · v1 → v2',lesson:'fetch',date:'2026-08-30',cases:structuredClone(fetchCases),kind:'revision',job:'fetch'}]
};}
export const draftSignature = job => JSON.stringify(job.draft);
export function visibleRuns(state) {return state.project==='empty'?[]:state.runs.filter(run=>state.period==='all'||run.date>='2026-09-02');}
export function counts(state) {const runs=visibleRuns(state), exposures=runs.flatMap(run=>run.lessons), feedback=exposures.filter(item=>item.feedback);return {runs:runs.length,exposures:exposures.length,rated:feedback.length,helpful:feedback.filter(x=>x.feedback==='helpful').length,negative:feedback.filter(x=>x.feedback==='irrelevant'||x.feedback==='harmful').length,unrated:exposures.filter(x=>!x.feedback).length,checks:runs.filter(x=>x.checks).length,checkPass:runs.filter(x=>x.checks&&x.checks[1]===0).length};}
