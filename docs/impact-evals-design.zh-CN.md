# Codetrap 成效 Impact、轨迹观测与 Evals 产品设计

> 状态：已确认的北极星设计；Observation Ledger v1、显式 CLI/MCP 链路、生产 Impact Overview/Runs/观测型 Evals v1、受治理的 Eval 候选闭环、主动开启的 Codex/Claude 自动 Run hooks，以及零成本确定性受控 Eval runner v1 已实现；真实 Agent/worktree 对照、模型 judge 与 Team Hub 尚未实现
> 日期：2026-08-30
> 父计划：[Agent Experience Compiler Roadmap](agent-experience-compiler-roadmap.md)
> 任务档案：[Impact、Evals 与团队观测设计](tasks/2026-08-30-impact-evals-design/task-brief.md)
> 历史设计原型：[打开早期 Evals 可交互原型](prototypes/evals-ui-prototype.html)（本地静态页面、明确标记的假数据、不调用 Agent；生产界面已经使用真实投影）

## 1. 摘要

Codetrap 的观测能力不是一个通用日志查看器，也不只统计“经验被搜索了几次”。它要回答三个用户问题：

1. Codetrap 在这次任务里做了什么？
2. 这些知识是否真的帮助了人或 Agent？
3. 一个人发现的经验，能否安全地变成团队可复用、可验证的资产？

产品采用三层模型：

```text
┌───────────────────────────────────────────────────────────┐
│ 内容层                                                    │
│ Learning：给人学习             Library：给 Agent 运行时使用 │
└───────────────────────────┬───────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│ 治理层                                                    │
│ Candidate Inbox：提议、编辑、批准、拒绝、替代、回滚         │
└───────────────────────────┬───────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│ 证据层                                                    │
│ Observation Ledger → Impact → Evals → Team Impact         │
└───────────────────────────────────────────────────────────┘
```

`Learning`、`Library` 与 `Impact` 必须保持不同职责：

- `Learning` 保存供人理解的 Insight、来源、背景、例子和学习顺序。
- `Library` 保存经过确认、会影响 Agent 运行时行为的 pitfall/trap。
- `Impact` 保存事实、反馈和评测证据，不成为第三个内容库。

## 2. 已确认的产品决策

| 决策 | 结论 |
|---|---|
| 主要受众 | 远程协作团队优先，同时保证个人本地体验完整 |
| 产品入口 | 一级导航 `成效 Impact` |
| Impact 信息架构 | `Overview`、`Runs`、`Evals`、`Team` 四个视图 |
| 首屏目标 | 先回答“Codetrap 带来了什么价值”，再下钻原始轨迹 |
| 捕获默认值 | 自动记录结构化元数据；敏感正文按需捕获和共享 |
| 团队架构 | 本地客户端 + 可自托管 Team Hub，并兼容未来托管服务 |
| 团队可见性 | 默认团队聚合；个人明细默认私有；不做成员排行榜 |
| 评测真值 | 测试断言和人工反馈优先；模型评分只作辅助 |
| Evals 顺序 | 先做真实使用观测，再做 baseline/candidate 受控实验 |
| 因果表述 | 只有用户明确确认或受控实验支持时，才使用因果语言 |
| Learning 转化 | Insight 只有经用户操作和审核才能变成 Agent trap |
| Agent 调用 | `创建 Agent 经验候选` 默认不调用 Codex/Claude，不产生模型费用或外发内容 |
| 保留策略 | 结构化摘要与聚合长期保留；明确共享的正文默认 30 天 |
| 外部观测平台 | OTLP/Logfire 是可选出口，不是 Codetrap 核心依赖 |

## 3. 当前基础与缺口

Codetrap 已有以下可复用基础：

- `traps.db`：项目/全局 confirmed trap、生命周期和 usefulness。
- Candidate Inbox：版本、内容哈希、授权、接受、拒绝、替代和回滚。
- Learning Insight Shelf：项目本地 `insights.json`、来源集合、顺序、来源覆盖和 learned 状态。
- Feedback Improver：相关联的人类反馈、候选路由和 `BehaviorOutcome`。
- Search Evals：Recall@3、Recall@5、MRR 等确定性检索指标。
- Codex 与 Claude Code 学习来源适配器。
- 独立的 Observation Ledger v1、可重建 Run/Overview 投影，以及 CLI/MCP 共用的 metadata-only Run recorder。
- 在显式提供 Run context 时，`search → exposure → validation → feedback` 已能形成真实、失败隔离的本地证据链。
- 生产 Web Console 已提供蓝色 `Impact → Overview / Runs / Evals`：Overview/Run 从完整投影读取真实本地数据，Evals 将项目内确定性 Search Eval、真实 Run 结果与待人工审核候选分舱展示。`#/impact/evals`、Run 和候选均可刷新恢复；失效访问凭证会进入持续恢复页，加载、空状态和错误状态不会再隐藏 Impact 导航。
- 首次进入无 Run 项目时，Overview 会用三步流程解释轨迹来源，并可在浏览器内存中预览一条明确标记为“示例、不保存”的五事件时间线；预览不会创建身份、Ledger 或影响 Overview/Evals，真实 Run 仍走显式 CLI/MCP 合同。

当前缺口：

- Codex/Claude 已可按项目预览并主动开启 turn-scoped 自动 Run hooks；不会扫描 transcript。普通 `search`/`useful` 仅在恰好一条自动 Run 活跃时自动关联，多 Run 并发时仍需显式 context。
- Team 页面和受控 runner 尚未实现；自动验证推断和自动人类反馈不在 hooks 范围内。观测候选现在可以进入人工校准台，但仍不会自动变成标准答案。
- Learning 只能表示入库和 learned，不能表达内容反馈、转化或任务关联。
- 没有远程团队身份、项目隔离、RBAC、共享投影和聚合查询。
- 现有检索评测不能证明真实任务效果，也不能支持可靠因果结论。

## 4. 用户与核心任务

### 4.1 个人开发者

- 不配置团队也能完整使用 Codetrap。
- 在两次点击内看懂某次任务中 Codetrap 提供了什么帮助。
- 对 trap 或 Insight 给出一次明确反馈即可完成记录。
- 默认不上传 prompt、diff、工具输出或个人学习行为。

### 4.2 团队成员

- 将一个人的纠正沉淀为全队可审核的候选经验。
- 查看团队已经确认的知识，不重复踩坑。
- 共享运行证据前能预览、脱敏和设置有效期。
- 看到团队知识覆盖，不被个人表现排名。

### 4.3 团队维护者

- 判断哪些 trap 有帮助、噪声高、已经过时或经常漏召回。
- 审核团队候选并保留来源、版本和决策历史。
- 通过固定 eval case 比较规则、检索或提示变化。
- 管理项目成员、保留策略、共享权限和删除请求。

## 5. 信息架构与页面契约

Codetrap Web Console 的一级导航为：

```text
Review | Library | Learning | Impact | Embeddings
```

### 5.1 Overview：先解释价值

首屏不得以 span 数量、token 总量或工具调用次数作为主价值卡片。默认展示：

- 有明确 Helpful 反馈的运行数。
- Irrelevant/Harmful 噪声率。
- 用户报告的 `Should have matched` 漏召回。
- 通过测试或检查的任务结果趋势。
- Insight 转为 Agent candidate、confirmed trap 和已验证帮助的转化漏斗。
- 需要用户处理的高价值事项：有害提示、过时知识、反复失败和待审核候选。

所有结论显示证据标签：

```text
[事实]     测试通过、trap 被展示、用户进行了修改
[用户确认] Helpful、Harmful、已过时、应该命中
[系统推断] 根据多条事实生成的解释，可展开查看依据
[受控评测] baseline/candidate 的可复现实验结论
```

### 5.2 Runs：从摘要下钻证据

Runs 列表支持按项目、客户端、分支、模型、结果、trap、反馈、共享状态和时间过滤。

Run 详情默认展示领域化轨迹，而不是原始遥测表格：

```text
任务              Codetrap             Agent / Tools          验证
 │                    │                       │                  │
 ├─用户提出任务───────┤                       │                  │
 │                    ├─搜索 traps───────────┤                  │
 │                    ├─展示 Trap #42────────►│                  │
 │                    │                       ├─编辑代码─────────┤
 │                    │                       ├─运行测试────────►│
 │                    │                       │             测试通过
 │                    │                       │                  │
 └────────────────────┴───────────────────────┴──────────────────┘
```

详情顶部先显示“Codetrap 改变了什么”，随后提供：

- trap 搜索请求、命中排名、诊断和版本。
- Agent/工具/测试步骤和准确持续时间；未知时留空。
- 输入、输出、token、工具正文等高级字段，仅在本地存在且用户展开时显示。
- `Helpful`、`Irrelevant`、`Harmful`、`Should have matched` 一键反馈。
- 分享预览、脱敏结果、到期时间和撤销操作。

长轨迹必须支持搜索、折叠、分页或虚拟化；初次打开只加载尾部和摘要。

### 5.3 Learning：负责学习动作

Learning 保持独立入口，继续以内容和来源为中心。新增：

- 状态：`未开始`、`学习中`、`已学习`。
- 内容反馈：`有帮助`、`不清楚`、`已过时`。
- `创建 Agent 经验候选`。
- 可选地将 Insight 与一次真实 Run 关联。

不默认记录停留时长、鼠标移动、滚动深度或页面点击次数，也不根据这些行为推断“已经掌握”。

#### 创建 Agent 经验候选

按钮名称必须是 `创建 Agent 经验候选`，旁边显示：

```text
不会调用模型，也不会直接写入 Agent Library。
```

流程：

```text
[创建 Agent 经验候选]
          │
          ▼
本地生成结构化草稿
Trigger / Mistake / Fix / Scope / Source Insight
          │
          ▼
用户检查和编辑
          │
          ▼
Candidate Inbox
          │
          ▼
人工接受后进入 Library
```

第一版通过确定性映射生成草稿，不直接启动 Codex 或 Claude Code。未来可以增加独立的 `让 Agent 帮我整理`，但必须先展示提供方、发送内容、隐私范围和预计费用，再由用户确认。没有主动 Agent 控制通道时，只生成可复制的提示。

### 5.4 Evals：比较变化而不是堆分数

生产 `Impact → Evals` 读取选中项目的 `.codetrap/evals/suite.json`，缺少本地集合时兼容已有的 `src/tests/fixtures/search-eval.json`，确定性计算 Recall@3、Recall@5 与 MRR；同时从 Observation Ledger 投影 Helpful、噪音、漏召回和验证比例，并显示明确分子/分母。用户可预览并建立固定经验语料，或显式复制旧测试，再审核正反例、运行对照和下载集合。来源身份与测试位置分开，旧审核及其回滚保留原路径，见[评测集合指南](project-evaluation-suites.md)。

漏召回、Irrelevant/Harmful 和“曝光后验证失败”仍只是 `review_required`、`unconfirmed` 的证据候选。用户须主动填写查询、检索模式、判断和期望 fixture ID；草稿只创建会话候选和精确预览，不改集合。明确接受后才通过 Phase 2 写入并标记 `confirmed`，拒绝保持集合不变，回滚检查后续修改并逐字恢复原文件。Observation 仍不返回或还原原始 query、排序标题和任意事件 attributes。

[早期可交互 Evals 原型](prototypes/evals-ui-prototype.html)保留为历史设计证据。它明确使用假数据，只验证更远期受控 baseline/candidate 用户旅程，不读取真实 Observation Ledger，也不代表 runner 或模型调用已经实现。

Evals 包含：

- Suite：一组稳定评测目标。
- Case：输入、代码基线、允许范围和断言。
- Experiment：一次 baseline/candidate 对比。
- Trial：一次隔离执行。
- Score：测试、人工或模型评分。

实验列表首先显示 pass/regression、人工结论、成本和持续时间；模型 judge 分数单独标记为“辅助”。每个失败结果必须能跳转到对应 Run 和证据。首屏采用 Baseline/Candidate 并排比较，下面提供逐 case 结果和证据检查；用户可以选择 case、打开轨迹抽屉、给出人工评价，或从安全说明明确的新建实验对话框开始下一次评测。

### 5.5 Team：聚合知识成效

Team 默认展示：

- 团队 trap 的 Helpful、Irrelevant、Harmful 和漏召回趋势。
- 重复出现的 pitfall 和知识覆盖缺口。
- Insight → candidate → trap → helpful run 的聚合转化。
- 已过时或需要复核的共享知识。
- 团队 Evals 的通过率、回归和开销。

禁止展示成员错误次数、提交速度、token 消耗排名或学习排行榜。成员个人轨迹只有本人默认可见；其他成员只能查看明确共享的明细。

## 6. 通俗例子：从文章到真实帮助

用户学习一篇“外部 HTTP 请求必须设置 timeout”的文章：

```text
文章进入 Learning
      │
      ├─为什么会永久等待
      ├─Timeout 与取消信号
      └─如何测试超时
      │
用户标记：已学习 + 有帮助
      │
点击：创建 Agent 经验候选
      │
本地生成候选（不调用模型）
      │
人工审核并接受
      │
进入 Agent Library
      │
未来任务：增加 GitHub API 调用
      │
Codetrap 展示 timeout trap
      │
Agent 使用 AbortSignal.timeout()
      │
timeout 测试通过
      │
用户标记 Helpful
      │
Impact 展示事实和用户确认
```

Impact 可以说：

- `[事实]` Trap #42 在编码前被展示。
- `[事实]` 最终代码包含 timeout，超时测试通过。
- `[用户确认]` 用户认为该 trap 有帮助。

在没有用户确认或受控实验时，不得说“Codetrap 阻止了一次生产事故”。

## 7. 本地数据架构

### 7.1 存储边界

```text
Codex / Claude transcripts     CLI / MCP       tests / hooks
            │                     │                 │
            └──────────────┬──────┴─────────────────┘
                           ▼
                    Source Adapters
                           ▼
              Redaction + Observation Ledger
                     ┌─────┴─────┐
                     ▼           ▼
              Local projections  Share Outbox
                     │           │
                     ▼           ▼
                Impact UI     Team Hub ingest
```

本地新增独立的 `.codetrap/observations/ledger.sqlite`，不复用 `traps.db`：

- 事件账本只追加，不原地重写历史事实。
- Overview、Runs 和 Evals 使用可重建投影。
- 结构化事件与敏感正文分离。
- 按显式设置捕获的正文放入本地 content-addressed blob 目录，通过 `body_ref` 引用。
- 删除正文可以保留非敏感事件和 tombstone，避免破坏审计关系。
- `.codetrap/` 仍是单主机存储，不得放在网络共享目录充当团队数据库。

### 7.2 事件信封

```ts
type EvidenceClass =
  | "observed_fact"
  | "human_label"
  | "derived_inference"
  | "controlled_eval";

type Sensitivity = "metadata" | "sensitive" | "restricted";

interface ObservationEvent<TType extends ObservationEventType = ObservationEventType> {
  version: 1;
  id: string;
  project_id: string;
  run_id: string | null;
  actor_ref: string | null;
  device_id: string;
  seq: number;
  occurred_at: string;
  recorded_at: string;
  type: TType;
  evidence_class: EvidenceClass;
  sensitivity: Sensitivity;
  attributes: ObservationPayloadMap[TType];
  body_ref: string | null;
  source_ref: string | null;
}
```

约束：

- `id` 在重试和同步中稳定，Hub 按 `project_id + id` 幂等去重。
- 同一 Run 的 `seq` 单调递增；Hub 可接收乱序批次，但投影按序重放。
- 未知事件版本 fail closed，不静默丢字段。
- `derived_inference` 必须包含依据事件 ID 和推断版本。
- 不知道的时间、token、结果或正文使用 `null`，禁止编造。

### 7.3 第一版事件词汇

```ts
type ObservationEventType =
  | "run/started"
  | "run/completed"
  | "trap/search-completed"
  | "trap/exposed"
  | "trap/feedback-recorded"
  | "trap/missed-reported"
  | "validation/completed"
  | "learning/insight-shelved"
  | "learning/status-changed"
  | "learning/feedback-recorded"
  | "learning/promoted-to-candidate"
  | "learning/linked-to-run"
  | "candidate/status-changed"
  | "share/created"
  | "share/revoked"
  | "share/expired"
  | "eval/experiment-completed";
```

第一版不记录 `learning/insight-opened`、页面停留时间或细粒度点击。

### 7.4 核心记录

```ts
interface RunRecord {
  id: string;
  project_id: string;
  source_client: "codex" | "claude-code" | "other";
  source_session_ref: string | null;
  repository_revision: string | null;
  branch: string | null;
  model_provider: string | null;
  model_name: string | null;
  started_at: string;
  completed_at: string | null;
  completeness: "complete" | "partial" | "unknown";
}

interface SearchReceipt {
  query_fingerprint: string;
  mode: "fts" | "semantic" | "hybrid";
  path_hint: string | null;
  module_hint: string | null;
  results: Array<{ trap_id: number; revision: string; rank: number }>;
  diagnostics: string[];
  duration_ms: number | null;
}

interface ValidationReceipt {
  kind: "test" | "typecheck" | "lint" | "build" | "manual";
  command_fingerprint: string | null;
  status: "passed" | "failed" | "cancelled" | "unknown";
  passed: number | null;
  failed: number | null;
  duration_ms: number | null;
}

type TrapFeedback = "helpful" | "irrelevant" | "harmful" | "should_have_matched";
type LearningStatus = "not_started" | "in_progress" | "learned";
type LearningFeedback = "helpful" | "unclear" | "outdated";

interface LearningProgress {
  actor_ref: string;
  insight_id: string;
  status: LearningStatus;
  feedback: LearningFeedback | null;
  updated_at: string;
}
```

`LearningProgress` 与 Insight 内容分开存储，因为学习状态属于个人，而 Insight 属于项目内容。现有 `consulted_count > 0` 在迁移时映射为当前本地用户的 `learned`，其余映射为 `not_started`；迁移后读取旧字段保持兼容，新的状态写入个人进度表。

## 8. Team Hub

### 8.1 定位

Team Hub 是远程团队的异步共享服务，不是：

- 网络文件系统。
- Agent 消息总线。
- 远程代码执行服务。
- 实时协同编辑器。

Hub 优先支持自托管，并让同一协议可用于未来托管版本。

### 8.2 最小接口

```text
POST   /v1/projects/{projectId}/events:batch   幂等上传共享投影
POST   /v1/projects/{projectId}/shares         创建明细共享授权
DELETE /v1/projects/{projectId}/shares/{id}    撤销明细共享
GET    /v1/projects/{projectId}/impact         查询项目聚合
GET    /v1/projects/{projectId}/runs/{runId}   读取有权限的运行投影
POST   /v1/projects/{projectId}/feedback       写入用户反馈
GET    /v1/projects/{projectId}/evals          查询评测与实验
```

写接口需要设备凭证、成员身份和 idempotency key；所有读取都验证团队、项目和明细共享权限。

### 8.3 角色

| 角色 | 默认权限 |
|---|---|
| Owner | 团队、成员、项目、保留策略、导出和删除的全部权限 |
| Admin | 管理项目与成员、审核团队候选、查看共享明细 |
| Member | 提交候选和反馈、共享自己的运行、查看项目聚合与已共享明细 |
| Viewer | 只读项目聚合与明确共享的只读工件 |

只有 Owner/Admin 可以让候选成为团队范围 confirmed trap。Member 可以提出和编辑自己的候选，但不能自行授权团队级运行时影响。

### 8.4 共享投影

默认自动同步：

- 不透明项目、run、event、trap revision ID。
- 事件类型、时间、持续时间、排名和状态。
- 检索诊断代码、验证状态和显式反馈枚举。
- 经过聚合的数据点。

明确授权后才能同步：

- prompt、任务标题和自由文本反馈。
- 工具参数、工具结果、测试输出。
- diff、文件正文、完整路径和来源摘录。
- Insight 正文或外部文章摘录。

第一版永不向 Hub 同步：

- API key、token、cookie、凭证和匹配到的 secret。
- 原始隐藏 reasoning。
- 未通过脱敏规则的受限制正文。

分享对话框必须展示最终 payload 预览、敏感项、到期时间和接收范围。脱敏失败时 fail closed。

### 8.5 保留与删除

- 结构化摘要、审核收据和聚合指标长期保留，受项目删除策略约束。
- 明确共享的正文默认保留 30 天，Owner 可缩短或延长。
- 撤销后立即禁止访问正文并进入删除队列。
- 删除正文后保留 tombstone、共享审计和不含正文的聚合贡献。
- 本地用户可以导出和删除自己的 observation 数据。

## 9. Evals 设计

### 9.1 两种评测不可混写

#### 观测型 Evals

来自真实使用，回答“通常发生了什么”：

- trap 展示后的 Helpful/Irrelevant/Harmful。
- 用户报告漏召回。
- 测试通过、纠正或失败。
- 同类 pitfall 是否复发。
- 时间、token 和工具调用开销。
- Learning 到 Agent candidate 的转化。

这些结果主要是相关性证据。

#### 受控 Evals

实现进度（2026-09-04）：第一版零成本确定性 runner 已接入项目评测集合与旧路径兼容，见 [Controlled Eval runner handoff](tasks/2026-08-31-controlled-eval-runner/handoff.md)和[评测集合指南](project-evaluation-suites.md)。它提供 `retrieval_policy_v1`（FTS-only 对比 case 已确认检索策略）和 `memory_contribution_v1`（目标经验不可用对比可用）两个命名 profile。两侧只在内存快照上运行，记录实际集合路径、SHA、仓库 revision/dirty、配置指纹、seed、trial 顺序、耗时和逐 case 证据，并将不可变结果保存在项目本地 `.codetrap/evals/`。当前集合损坏或缺失不会隐藏已有历史，但会禁止新对照。界面优先展示回归和变化，并与观测比例保持独立。

这一版不创建隔离 worktree、不运行任意命令、不调用 Codex/Claude 或模型 judge，模型调用、token 和成本均为 0；因此它证明的是检索策略或已确认经验对固定 Eval case 的贡献，不是完整 Agent 编码任务的因果效果。下面的 worktree/模型固定契约仍是未来真实 Agent 对照的准入条件。

在隔离的新 worktree 中运行同一 case：

```text
                    同一个 Eval Case
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    Baseline：不提供目标 trap      Candidate：提供目标 trap
             │                           │
             └─────────────┬─────────────┘
                           ▼
              比较测试、修正、耗时和成本
```

必须固定：

- repository revision 和 fixture。
- 模型提供方、模型版本和参数。
- Agent 客户端版本、权限和工具集合。
- 可写范围和隔离 worktree。
- 测试 oracle、超时和预算。

支持随机顺序和重复 trial；涉及真实模型费用前需要用户批准。不得在用户真实工作区运行破坏性 baseline/candidate 对照。

### 9.2 评分优先级

1. 确定性测试、schema 和静态断言。
2. 人类显式反馈与审核结果。
3. 可复现的行为指标。
4. LLM judge 辅助评分。

模型 judge 必须显示模型、提示版本和依据，且不得覆盖测试失败或人工 Harmful 结论。

### 9.3 核心指标

| 指标 | 定义 |
|---|---|
| Retrieval Recall@K / MRR | 保留当前检索质量指标 |
| Helpful rate | Helpful / 已评分的 trap exposure |
| Noise rate | (Irrelevant + Harmful) / 已评分 exposure |
| Miss report rate | Should have matched / 有明确反馈的运行 |
| Correction rate | 发生相关人工修正的运行 / 可判定运行 |
| Recurrence rate | 同一 pattern 再次出现 / 后续可观察机会 |
| Validation pass rate | 通过确定性验证的 trial / 全部 trial |
| Regression rate | Candidate 通过而 baseline 通过的反向损失，按 case 统计 |
| Overhead | Candidate 相对 baseline 的时间、token 和工具调用差值 |
| Learning conversion | Insight → candidate → confirmed trap → helpful run 的漏斗 |

每个比例必须展示分母和样本量；小样本不显示趋势结论。

## 10. 与 DeepSeek Harness 和 Logfire 的关系

### 10.1 DeepSeek Harness

参考：

- 类型化追加式 SessionEvent 日志。
- 从事件投影轨迹，而不是让 UI 直接解释原始存储。
- turn/step、工具、request timing、长轨迹虚拟化和 record inspector。
- Web UI 的浅层三栏布局、紧凑工具栏、时间轴 lanes、事件账本和选中记录详情；Codetrap 使用蓝色交互态，并保留自己的 case、证据与人工反馈语义。
- Agent Teams 的持久 mailbox、任务 revision 和事件重放思想。

不采用：

- 将实验性单进程 Agent Team 当作真人远程团队基础。
- 把共享 checkout、进程内身份或浏览器启动 token 当作组织/RBAC。
- 直接复制通用轨迹 UI，而忽略 Codetrap 的 trap、Learning 和 eval 语义。

参考仓库：<https://github.com/deepseek-ai/deepseek-harness>

### 10.2 Logfire

参考：

- Organization、Project、角色和项目级访问。
- Trace 详情、Explore、Evals、人类标注和分享链接。
- OpenTelemetry 兼容出口。

Codetrap 的差异化是知识治理闭环：来源 → Insight/trap candidate → 审核 → Agent 召回 → 真实结果 → Evals。Logfire/OTLP 可以接收 Codetrap 的可选遥测投影，但不能替代本地治理、隐私授权和 Team Hub 领域模型。

参考：

- <https://pydantic.dev/docs/logfire/manage/organizations-and-projects/>
- <https://pydantic.dev/docs/logfire/observe/public-traces/>

## 11. 分阶段开发路线

### Slice 1：本地 Observation Ledger

实现进度（2026-08-30）：version 1 领域信封、独立账本、可重建投影、显式 CLI/MCP 真实 Run 链路、生产 Overview/Runs，以及主动开启的 Codex/Claude turn-scoped hooks 已经完成，见 [Observation Ledger v1 handoff](tasks/2026-08-30-observation-ledger-v1/handoff.md)、[Observation adapters handoff](tasks/2026-08-30-observation-adapters/handoff.md)、[Impact Overview/Runs handoff](tasks/2026-08-30-impact-overview-runs/handoff.md) 与 [Opt-in Agent observation handoff](tasks/2026-08-30-opt-in-agent-observation/handoff.md)。Web GET 使用只读连接；没有 Ledger 时不会创建目录或身份。单 Run 时间线只暴露显式白名单事实，不透传任意 attributes。hooks 只读取客户端、匿名会话/turn 身份、模型和时间，不读取 prompt、回复、transcript 路径/正文、diff、工具正文、密钥或隐藏推理。

- 建立 version 1 事件信封和 SQLite 追加式账本。
- 接入 Codex/Claude run、trap search/exposure、validation 和现有 feedback/outcome。
- 保持现有 store 为业务 source of truth，Observation 先作为旁路证据。
- 实现 Overview 和 Runs 最小纵向切片。

验收：同一真实任务能显示从搜索到验证的完整、可解释证据；关闭正文捕获时不影响摘要。

### Slice 2：Learning Impact

实现进度（2026-08-31）：已完成，见 [Learning Impact handoff](tasks/2026-08-31-learning-impact/handoff.md)。

- 已完成：个人 LearningProgress 与共享 Insight 内容分离；旧 `consulted_count` 只做惰性兼容读取。
- 已完成：`未开始`、`学习中`、`已学习` 三态进度，内容反馈和可选 Observation Run 关联；重复提交保持幂等。
- 已完成：`创建 Agent 经验候选` 先显示可编辑的本地确定性 Trigger/Mistake/Fix 草稿，预览不写入，提交只进入 Candidate Inbox。
- 已完成：不调用 Codex/Claude，不自动接受，不直接写入 Library；已有 Learning 空状态继续提供可复制的 Agent 请求作为辅助入口。

验收：Insight 可以经过显式用户操作进入 Candidate Inbox，Learning 与 Library 无自动复制或召回污染。全量 510 项测试通过，OpenCLI 验证了进度、反馈、Run 关联、草稿/滚动保留、候选审核跳转，以及零失败网络请求和零控制台错误。

### Slice 3：Team Hub 最小闭环

- 建立团队、项目、成员、角色和设备凭证。
- 实现 metadata-only outbox、幂等批量 ingest 和聚合 Team Impact。
- 实现明细分享预览、30 天默认 TTL、撤销和审计。

验收：默认同步 payload 不含 prompt、diff、工具正文、完整路径或 secret；离线重试不重复计数。

### Slice 4：观测型 Evals

实现进度（2026-08-31）：观测投影与受治理候选闭环均已实现，见 [Observational Evals v1 task](tasks/2026-08-30-observational-evals-v1/task-brief.md) 和 [Governed Eval candidates handoff](tasks/2026-08-31-governed-eval-candidates/handoff.md)；入口恢复与路由体验见 [Web UX recovery handoff](tasks/2026-08-30-web-ux-recovery-routing/handoff.md)。生产页面把确定性检索、真实运行关联证据和人工确认的 ground truth 分开；缺失/无效 fixture 与未开启/空 Ledger 均有独立状态。候选可以保存草稿、预览、接受、拒绝和回滚，但永不自动升级。

可靠性加固（2026-09-02）：后台轮询不再替换正在编辑的 Evals workbench，未保存草稿、选中候选和 Run 往返上下文保持在浏览器内；发现新证据时以轻量提示告知“更新正在等待”，不会偷偷替换表单。Run 详情不再受最近 100 条摘要窗口限制。Hook 只有在追加式 start/completion 写入成功后才删除重试状态，状态达到上限时拒绝新增而不淘汰已记录 Run；`status/current` 与 Impact Overview 会显示容量和过期状态，`observe recover` 默认只预览，只有显式 `--apply` 才会先补写 `cancelled`/`partial` 再清理。损坏或不支持的 Hook 状态只把健康投影降级为 `unavailable`，不会隐藏正常 Ledger 和集成状态；数量保持未知而不是伪装成 0，恢复命令也不会自动重置未知 Run 状态。多项目页面的异步响应还会校验请求所属项目，避免旧项目数据覆盖当前视图。受控评测历史允许“部分可用”：正常实验继续显示，损坏文件明确告警且不参与指标，也不会被自动改写或删除。见 [Observation reliability hardening handoff](tasks/2026-09-02-observation-reliability-hardening/handoff.md)。

- 已完成：从真实 Run 投影可回到证据的只读审核候选，不自动创建 ground truth。
- 已完成：展示确定性检索、验证、反馈和漏召回指标，并为所有比例显示分母。
- 已完成：在 API 与界面中区分确定性检索、观测关联和人工标签。
- 后续：将人工确认后的候选写入受治理 Eval fixture，并补齐开销、复发与 Learning 转化指标。

v1 验收：用户可从失败、漏召回或负面反馈看到可审核候选并跳回 Run；候选仍明确为 `unconfirmed`。完整 Slice 4 验收还要求受治理的持久化/拒绝流程。

### Slice 5：受控 baseline/candidate Runner

实现进度（2026-08-31）：零成本确定性 v1 已完成，见 [handoff](tasks/2026-08-31-controlled-eval-runner/handoff.md)。用户可以选择固定 profile、trial 数和 seed，运行 baseline/candidate，对照逐 case 回归/改善/变化，查看完整配置指纹并从本地历史重新打开结果。fixture 和源码保持不变，结果独立于 Observation Ledger。

- 已完成：固定 fixture 快照、仓库身份、配置指纹、随机顺序和重复 trial。
- 已完成：测试优先、回归优先、零模型调用的检索/经验贡献比较。
- 后续扩展：隔离 worktree、真实 Codex/Claude、预算批准、超时与模型固定。
- 后续扩展：模型 judge 只作辅助，且不得覆盖确定性失败。

v1 验收：实验不修改真实工作区或 fixture；同一 case 可复现并记录完整配置指纹。完整 Slice 5 的 Agent 执行验收仍要求显式授权的隔离 worktree 和预算控制。

### Slice 6：可选 OTLP 与高级轨迹

- 增加采样、OTLP exporter、Logfire 等后端示例。
- 增加高级 timing、token、工具和请求 inspector。

验收：未配置 exporter 时没有遥测离开机器；配置后仍执行 Codetrap 自己的共享和脱敏策略。

## 12. 测试与验收矩阵

### 数据与适配器

- Codex 与 Claude Code 的同类输入产生相同领域事件。
- transcript schema 漂移、缺失 turn、部分日志和取消任务标记为 partial/unknown。
- 重复、乱序、离线重试和崩溃恢复不产生重复事件。
- 未知事件版本拒绝读取或明确降级，不静默忽略。

### 隐私与安全

- snapshot 测试证明默认 Team payload 不含敏感正文和完整路径。
- secret redaction、分享 TTL、撤销、删除和 tombstone 可重复验证。
- 跨团队、跨项目和角色越权请求全部拒绝。
- raw reasoning 不进入第一版 Hub payload。

### 用户体验

- 用户两次点击内从 Overview 到达一次帮助的证据。
- 一次操作完成 trap 或 Insight 反馈。
- `创建 Agent 经验候选` 不发起网络或模型请求。
- 数据缺失显示未知，不显示虚假 0 或成功。
- 长轨迹在目标数据量下保持可搜索和流畅滚动。
- 键盘、屏幕阅读器、窄屏和中英文文案通过现有 Web 质量门。

### Evals

- baseline/candidate 使用相同 repository、模型、权限、工具和断言。
- 测试失败不能被模型 judge 的高分掩盖。
- 样本量、分母、费用和失败 trial 都进入结果。
- Runner 超时、取消和预算耗尽有明确状态并清理隔离 worktree。

## 13. 成功标准与停止条件

### 成功标准

- 用户能准确复述某次 Run 中 Codetrap 做了什么以及证据来自哪里。
- 用户愿意给真实 exposure 提供反馈，而不是只产生无意义 hit_count。
- Learning 中有一部分 Insight 经明确选择转成高质量 Agent candidate。
- 团队成员从他人确认的 trap 获得帮助，同时默认共享不泄露正文。
- 受控 Evals 能发现至少一种检索、提示或 trap 版本回归。

### 停止或调整条件

- Impact 首屏只能展示遥测数量，无法解释用户价值。
- 大多数反馈是 Irrelevant/Harmful，且无法通过审核和排序降低。
- 用户不愿意在预览后共享任何明细，说明 Team 方案的信任模型需要重做。
- Learning 转化按钮产生大量低质量候选，消耗审核带宽。
- baseline/candidate 无法固定环境或复现，禁止发布因果结论。

## 14. 非目标

- 不建设员工监控或个人生产力排名。
- 不根据阅读时长判断学习掌握度。
- 不让 Learning 内容自动进入 Agent recall。
- 不让一次搜索命中自动计为“有帮助”。
- 不把 Team Hub 当作 Agent 消息总线或共享文件系统。
- 不在第一版同步隐藏 reasoning。
- 不绑定单一观测供应商。
- 不在未经批准时启动 Codex、Claude Code 或产生模型费用。
