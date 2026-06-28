# codetrap 成熟产品路线图：Agent Experience Compiler

Date: 2026-06-22
Status: Product direction / long-term roadmap
Scope: Parent plan for codetrap mature product evolution

本文记录 codetrap 的成熟产品目标。它不是单个实现任务，也不是当前版本承诺；后续开发应把本文作为 parent plan，再用 implementation-journal 为每个里程碑建立 task dossier、implementation log 和 handoff。

本版本对原计划做了一个关键上移：

```text
codetrap 不硬编码“学到了什么”。
codetrap 提供类型化、可审计、可审核的 experience compiler layer，
让 Codex、Claude Code、Cursor 等 AI 编程工具安全地提出经验候选。
```

换句话说：

```text
Agent / Skill 负责理解真实工作历史；
codetrap CLI 负责证据、结构、校验、去重、staging 和 durable write gate；
Web Learning Inbox 负责人类审核；
Durable destinations 负责让已确认经验影响下一次 agent 行动。
```

---

## 1. 核心判断

codetrap 不应停留在“失败记录库”，也不应膨胀成通用 Agent Memory 平台。成熟形态应是一个本地优先、agent-assisted、human-approved 的 **Agent Experience Compiler**。

成熟飞轮：

```text
真实工作历史
  -> agent-native discovery
  -> LessonCandidate 起草
  -> codetrap compiler 校验、去重、staging
  -> Web Learning Inbox 审核
  -> 用户确认固化到正确出口
  -> runtime guardrails
  -> 下次 agent 更聪明
```

一句话英文定位：

```text
codetrap compiles real coding-agent work history into human-approved guardrails.
```

一句话中文定位：

```text
codetrap 把真实 AI 编程协作历史编译成用户批准的下一次行动护栏。
```

更完整的产品定位：

```text
codetrap mines real coding-agent work history, lets agents draft reusable lessons,
validates those lessons with evidence and coverage checks, lets humans approve what
becomes durable, and injects approved lessons back into future agent work as traps,
project guidance, skills, custom agents, automations, evals, docs updates, or reviewed skips.
```

中文定位：

```text
codetrap 从真实编程协作历史里发现可复用经验，
允许 AI agent 起草学习候选，
再由 codetrap 做证据化、类型化、去重和审核编译，
最后由用户确认哪些经验能固化成 trap、项目规范、skill、custom agent、自动化建议、检索评估、文档更新或 skip 记录，
并在下一次 agent 工作前把已确认经验变成护栏。
```

关键边界：

- codetrap 不拥有所有原始历史。
- codetrap 只拥有可审核、可固化、可执行的经验。
- codetrap 不把所有经验都塞进 `traps.db`。
- codetrap 不替代 Codex、Claude Code、Cursor 等 agent 的语义判断。
- codetrap CLI 不应该硬编码“什么经验值得保存”。
- `.codetrap/sessions` 是候选与 review 工作区，不是成熟产品的唯一经验发现源。
- 自动化只负责发现、聚类、起草、分流、校验和 staging；最终固化必须由用户确认。

---

## 2. 为什么要升级

现有 codetrap 已经能解决一个明确问题：在 agent 动手前检索已确认的 trap，避免重复犯错。这个方向仍然成立，但它只覆盖了经验的一小部分。

真实使用中，用户和 agent 的历史里还会出现更多可复用信号：

- 用户反复纠正 agent 的项目偏好。
- 同一类失败在多个 session 里重复出现。
- 某个发布、复盘、调试、评估、文档更新流程被多次手动执行。
- 某些任务适合委派给一个 bounded specialist subagent。
- 某些周期性检查适合变成 automation proposal。
- 外部文章、issue、blog、paper 暴露出未来可能遇到的坑。
- 某些检索 query 代表了必须保护的召回行为。
- 有些内容看似有道理，但太泛、证据不足、过期、敏感或一次性，应该明确 skip。

如果所有经验都被压成 trap，数据库会变脏。
如果这些经验都不记录，用户就感受不到“越用越懂我”。
如果让 agent 直接创建 skill、automation、AGENTS patch 或 trap，用户会失去信任。

成熟产品需要一个比 trap 更高一层的候选模型：`LessonCandidate`。

---

## 3. 产品原则

### 3.1 codetrap 是 compiler，不是大脑

codetrap core 不应该用脆弱关键词规则决定“学到了什么”。

不应做：

```text
session 里出现 "test failed" -> 自动创建 pitfall_trap
session 里出现 "release" -> 自动创建 skill_candidate
session 里出现 "every day" -> 自动创建 automation_idea
session 里出现 "AGENTS" -> 自动改 AGENTS.md
```

应做：

```text
agent / skill 负责理解历史与起草候选；
codetrap 负责：
- source manifest
- evidence refs
- redaction
- schema validation
- coverage check
- risk flags
- skip archive
- staging review
- durable write gate
```

可以硬编码的是产品契约和安全边界；不应硬编码的是学习判断。

### 3.2 显式触发，不后台偷偷扫描

learning review 必须由用户显式触发。

允许的触发方式：

```text
$codetrap-learning-review
codetrap learn review --since 30d --limit 10 --dry-run
用户明确说：扫描最近 30 天 Codex sessions，生成 LessonCandidate
Web 中点击：Start Learning Review
MCP 中明确调用：codetrap.learn.review
```

不允许的触发方式：

```text
agent 因为普通 coding task 自动扫描历史
CLI 后台定期扫描用户 sessions
Web 打开时偷偷读取 Codex 历史
MCP 被普通 search 隐式触发为 learning review
```

### 3.3 默认 dry-run，用户确认前无 durable write

默认行为必须是：

```text
生成候选和报告可以；
写 confirmed trap 不可以；
修改 AGENTS.md 不可以；
安装 skill 不可以；
创建 custom agent 不可以；
启用 automation 不可以；
污染 eval fixture 不可以。
```

`accepted` 不等于 runtime injection。
只有进入 durable destination 且处于 runtime eligible 状态的经验，才可以影响下一次 agent 行为。

### 3.4 typed destination 优先于统一入库

成熟产品价值不是“把所有东西存起来”，而是“把经验放到正确的长期载体里”。

---

## 4. 成熟产品系统

成熟 codetrap 由六个系统组成：

```text
1. Experience Sources
2. Agent-native Discovery
3. Lesson Candidate Layer
4. codetrap Compiler Layer
5. Learning Review Web Workbench
6. Durable Destinations + Runtime Guardrail Injection
```

---

## 5. Experience Sources

经验来源分为一等来源、agent-native 来源和补充来源。

### 5.1 一等来源

一等来源是成熟产品最先应该支持和验证的来源：

- Codex local sessions
- Codex task summaries / rollout summaries
- Codex memories, 在用户显式允许且 agent 能访问时
- `.codetrap/sessions`
- 已有 traps
- pending candidates
- existing skills
- existing custom agents / subagents
- existing automations
- AGENTS / CLAUDE / Cursor rules / project guidance
- docs / roadmap / dogfood log / eval fixtures

### 5.2 agent-native 来源

有些历史或上下文只有具体 agent 能稳定访问，例如：

- Codex Memories
- Chronicle, 如果用户启用
- Codex app 内部 task summaries
- Claude Code 会话摘要
- Cursor / Windsurf / 其他 agent 的本地上下文
- agent 已知的 custom skills、subagents、automations

codetrap core 不应假设自己能直接读取这些来源。它应该支持 **agent-submitted candidates**：

```text
Agent 读取自己能访问的历史
  -> 起草 LessonCandidate JSON
  -> 调用 codetrap learn stage
  -> codetrap 做 schema、evidence、coverage、risk、staging
```

### 5.3 补充来源

补充来源可以增强 discovery，但不属于基础成熟形态的必要条件：

- 用户纠正
- review feedback
- test failure / command failure
- 外部 article、issue、blog、paper
- Chronicle 发现的跨工具重复工作
- Slack、Jira、Linear、GitHub Issues、Notion 等未来可选集成

原则：

- 读取这些来源是为了发现经验，不是为了把原始历史整体导入 codetrap。
- 默认不后台扫描。
- 必须由用户显式触发 learning review。
- 对敏感或外部来源，应优先保存 evidence pointer、短 excerpt、hash、日期和来源类型，而不是复制全文。
- Chronicle 等更宽来源只用于 discovery；重要事实应回到相关 source system 确认。

---

## 6. Agent-native Discovery

Agent-native discovery 是成熟产品的重要入口。

### 6.1 为什么需要 agent-native discovery

codetrap 是给 AI 编程工具使用的经验工具。不同 agent 对历史、memory、task summary、skills、subagents、automations 的访问方式不同。

因此，不应要求 codetrap CLI 独自理解所有来源。更合理的分工是：

```text
Codex Skill / Claude command / Cursor workflow
  -> 询问用户范围
  -> 使用 agent 自己能访问的 sessions / memories / summaries
  -> 起草候选
  -> 调用 codetrap CLI stage
```

codetrap core 只负责稳定契约。

### 6.2 推荐 skill 入口

成熟产品应提供一个显式 skill，例如：

```text
$codetrap-learning-review
```

职责：

```text
帮助用户显式触发一次 codetrap learning review：
读取指定时间范围内可用的 Codex sessions / memories / rollout summaries / existing skills / agents / automations，
dry-run 生成 LessonCandidate，
交给 codetrap CLI 做校验和 staging，
最后引导用户进入 Web Learning Inbox 审核。
```

默认参数：

```text
source: Codex sessions，必要时加 memories / summaries
range: 最近 30 天，或可用历史更短时使用全部可用历史
limit: 10 条 LessonCandidate
mode: dry-run
write_durable: false
output: .codetrap/learning/reviews/<review-id>/
```

如果用户已经说清楚范围，例如：

```text
读取最近 30 天 Codex sessions，dry-run 生成 10 条 LessonCandidate
```

skill 不应重复询问，只需要确认红线：

```text
我会读取最近 30 天 Codex sessions，最多生成 10 条 LessonCandidate。
本次只 dry-run，结果写入 .codetrap/learning/reviews/<review-id>/。
不会写 traps.db，不会改 AGENTS.md，不会安装 skill，不会创建 custom agent，不会开启 automation。
```

如果用户只说：

```text
帮我跑一次 codetrap learning review
```

skill 应简短询问范围：

```text
要扫描哪个范围？
1. 最近 7 天
2. 最近 30 天，默认
3. 自定义开始/结束日期
4. 最近 N 个 sessions
```

### 6.3 skill 的安全原则

learning review skill 应只允许显式调用，不应隐式触发。

推荐原则：

```text
allow_implicit_invocation: false
```

安全规则：

- 不要在普通 coding task 中自动扫描历史。
- 默认 dry-run。
- 不要写 `traps.db`。
- 不要编辑 `AGENTS.md`、`CLAUDE.md` 或 Cursor rules。
- 不要安装或修改 skills。
- 不要创建或修改 custom agents / subagents。
- 不要启用 automations。
- 不要复制完整 Codex session transcript 到 codetrap。
- 只保存 source manifest、evidence pointer、短 excerpt、hash、日期和必要元数据。

### 6.4 codetrap 化的 discovery prompt

可把通用 Codex prompt 改造成 codetrap skill 的上层提示：

```text
Look back over my recent work from the requested range, defaulting to the last 30 days
or all available history if shorter, and identify reusable lessons worth staging for
codetrap review.

Use available evidence in this order:
- Recent Codex sessions and task summaries.
- Codex Memories and rollout summaries, when explicitly available, to find patterns repeated across sessions.
- Chronicle, if enabled, for discovery only; confirm important details in the relevant source system when possible.
- Existing traps, pending candidates, AGENTS/CLAUDE/Cursor guidance, skills, custom agents, automations, docs, and eval fixtures,
  so you reuse or extend what already exists instead of duplicating it.

Look broadly for lessons that are repeated, costly, error-prone, context-heavy,
or likely to improve future agent behavior.

Choose the smallest appropriate LessonCandidate type:
- pitfall_trap: repeated failure or misuse pattern.
- project_convention: stable project or team preference.
- skill_candidate: reusable workflow or playbook.
- custom_agent_candidate: bounded specialist role or investigation task suitable for delegation.
- automation_idea: scheduled or recurring check, report, reminder, or monitor.
- search_eval_case: query or recall behavior that should be protected.
- docs_guidance: README, roadmap, install docs, or agent guidance update.
- skip: too one-off, ambiguous, sensitive, broad, risky, or poorly evidenced.

First produce a compact shortlist with:
- candidate title
- type
- trigger
- lesson
- recommended action
- supporting evidence and dates
- frequency / confidence
- existing coverage
- risk
- recommended destination
- why it is or is not worth staging

Stage only high-confidence missing proposals.
Do not write traps.db.
Do not edit AGENTS.md.
Do not install skills.
Do not create custom agents.
Do not enable automations.
Do not merge eval fixtures.
Do not create speculative, overlapping, or overly broad assets.

Finish with:
- what was staged
- what was deliberately skipped
- what needs more evidence before packaging
- confirmation that no durable destination was modified
```

---

## 7. Lesson Candidate Layer

成熟产品应引入上位概念 `LessonCandidate`。Trap 是 lesson 的一种，不是全部。

### 7.1 候选类型

| Type | 适用场景 | 推荐出口 | 红线 |
|---|---|---|---|
| `pitfall_trap` | 失败模式、误用模式、容易重复踩的坑 | confirmed trap + evidence + lifecycle | 不自动写 `traps.db` |
| `project_convention` | 项目偏好、团队规范、边界约束 | AGENTS/CLAUDE/Cursor guidance patch proposal | 不静默改 agent guidance |
| `skill_candidate` | 重复流程、SOP、可复用 playbook | staged skill draft | 不自动安装，不自动触发 |
| `custom_agent_candidate` | bounded specialist role、调查任务、可委派角色 | custom subagent proposal | 不自动创建或启用 subagent |
| `automation_idea` | 周期检查、报告、提醒、监控 | automation proposal | 不自动启用，不创建外部副作用 |
| `search_eval_case` | 检索质量必须保护的 query/case | eval candidate / fixture proposal | 不污染 fixture，不塞普通 no-result |
| `docs_guidance` | README、roadmap、安装文档、agent guidance 需要更新 | docs patch proposal | 不把临时想法写成长期事实 |
| `skip` | 泛泛知识、一次性任务、证据不足、风险过高 | skip record / archive reason | 不让低质量候选反复出现 |

### 7.2 每条候选的最低字段

每条 `LessonCandidate` 至少需要表达：

```text
id
schema_version
title
type
status
trigger
lesson
recommended_action
evidence
source_manifest_refs
frequency
confidence
coverage
risk
recommended_destination
runtime_eligibility
created_at
updated_at
```

字段语义：

- `title`: 一句话摘要。
- `type`: 推荐候选类型。
- `trigger`: 什么时候应该想起它。
- `lesson`: 学到了什么。
- `recommended_action`: 下次 agent 应该怎么做。
- `evidence`: 来源、日期、片段、相关文件、session/ref id、hash。
- `source_manifest_refs`: 指向本次 review 使用的来源清单。
- `frequency`: 出现次数或重复信号。
- `confidence`: 置信度。
- `coverage`: 是否已有 trap、pending candidate、AGENTS、CLAUDE、Cursor rules、skill、custom agent、automation、docs、eval 或 skip 覆盖。
- `risk`: 误用、过泛、过期、隐私、敏感、外部副作用风险。
- `recommended_destination`: 推荐长期载体。
- `runtime_eligibility`: 是否以及何时允许进入 runtime recall。
- `status`: 当前审核状态。

### 7.3 推荐状态机

```text
proposed
  -> edited
  -> staged
  -> accepted
  -> merged
```

旁路状态：

```text
rejected
skipped
superseded
```

状态定义：

- `proposed`: agent 或 CLI 生成，尚未审核。
- `edited`: 用户或 agent 修改过候选内容。
- `staged`: 已进入某个 destination proposal/draft，但没有 durable write。
- `accepted`: 用户认可候选和推荐出口，但不一定已经写入长期载体。
- `merged`: 已写入长期载体，且具备明确回退路径。
- `rejected`: 不采纳，通常不用于降噪。
- `skipped`: 明确归档 skip reason，用于抑制重复噪音。
- `superseded`: 被已有或新的更好候选覆盖。

关键原则：

```text
accepted 不等于 runtime injection。
merged / installed / enabled / fixture accepted 才可能成为 runtime guardrail。
```

### 7.4 质量门槛

- 没有触发条件的经验不能成为 guardrail。
- 没有推荐动作的经验不能进入 runtime。
- 证据不足的内容应进入 skip 或待观察，而不是强行固化。
- 重复出现不是唯一条件；高代价且明显会复发的经验也可以成为候选。
- 与已有内容重复的候选应 merge、supersede 或 skip，而不是新建。
- 误用风险高于收益的候选不得进入 runtime。
- 敏感来源的候选必须经过 redaction 和明确确认。

---

## 8. codetrap Compiler Layer

codetrap CLI 是 compiler layer，不是学习判断的大脑。

### 8.1 CLI 应负责什么

CLI 应负责：

- source discovery, 当来源是本地可读取文件时。
- source manifest 生成。
- evidence pack 生成。
- evidence excerpt 长度限制。
- redaction / privacy checks。
- LessonCandidate schema validation。
- coverage check。
- duplicate detection。
- risk flagging。
- skip archive。
- staging review directory。
- durable write gates。
- JSON / Web / MCP contract。

### 8.2 CLI 不应负责什么

CLI 不应硬编码：

- 哪些自然语言总结一定是 trap。
- 哪些命令序列一定是 skill。
- 哪些日期词一定是 automation。
- 哪些项目文件一定应该修改 AGENTS。
- 哪些候选一定应进入 runtime。
- 固定只支持 Codex。
- 固定只读最近 30 天。
- 固定只生成 10 条。

### 8.3 两种 review 模式

#### 模式 A：Pull mode

codetrap 自己读取本地来源：

```bash
codetrap learn review \
  --source codex-sessions \
  --since 30d \
  --limit 10 \
  --dry-run
```

适合：

- Codex local sessions
- `.codetrap/sessions`
- 本地 dogfood log
- 本地 docs
- 明确路径下的 agent logs

#### 模式 B：Agent-submitted mode

agent 读取自己能访问的上下文，再提交候选给 codetrap：

```bash
codetrap learn stage \
  --review-dir .codetrap/learning/reviews/2026-06-22-codex-30d \
  --candidates lesson-candidates.json \
  --source-manifest source-manifest.json \
  --validate \
  --coverage-check \
  --dry-run
```

适合：

- Codex Memories
- Chronicle
- Codex task summaries
- Claude Code summaries
- Cursor / Windsurf context
- 其他 agent-native memory

#### 模式 C：Hybrid mode

codetrap 先生成 evidence pack，agent 再起草候选，codetrap 最后 stage：

```text
codetrap learn evidence-pack
  -> agent drafts lesson-candidates.json
  -> codetrap learn stage --validate --coverage-check
  -> Web Learning Inbox
```

这是推荐成熟形态。

### 8.4 推荐命令草案

发现 source：

```bash
codetrap learn sources \
  --source codex-sessions \
  --since 30d \
  --json
```

生成 evidence pack：

```bash
codetrap learn evidence-pack \
  --source codex-sessions \
  --since 30d \
  --out .codetrap/learning/reviews/2026-06-22-codex-30d
```

直接 review：

```bash
codetrap learn review \
  --source codex-sessions \
  --since 30d \
  --limit 10 \
  --dry-run
```

精确日期范围：

```bash
codetrap learn review \
  --source codex-sessions \
  --from 2026-05-18 \
  --to 2026-06-18 \
  --limit 10 \
  --dry-run
```

最近 N 个 sessions：

```bash
codetrap learn review \
  --source codex-sessions \
  --last-sessions 50 \
  --limit 10 \
  --dry-run
```

stage agent 生成的候选：

```bash
codetrap learn stage \
  --review-dir .codetrap/learning/reviews/<review-id> \
  --validate \
  --coverage-check \
  --dry-run
```

打开审核：

```bash
codetrap web
```

---

## 9. Learning Review Web Workbench

Web Review 应从 trap-only review 升级为 Learning Inbox。

### 9.1 列表视图

列表应让用户快速判断：

```text
[类型] [标题] [置信度] [出现次数] [证据日期] [推荐去向] [覆盖情况] [风险] [状态]
```

### 9.2 详情页

详情页应展示：

- 触发条件。
- 候选经验。
- 推荐动作。
- 支撑证据。
- source manifest。
- 与现有 trap、pending candidate、AGENTS/CLAUDE/Cursor guidance、skills、custom agents、automations、docs、eval、skip archive 的覆盖关系。
- 推荐去向和理由。
- 风险提示。
- 当前状态和可用动作。

### 9.3 用户动作

基础动作：

- accept
- edit
- merge
- supersede
- convert type
- reject
- skip as one-off
- stage proposal

不同类型的确认强度不同：

```text
pitfall_trap:
  accept -> confirmed trap proposal -> user confirms -> traps.db

project_convention:
  accept -> guidance patch proposal -> user reviews diff -> merge

skill_candidate:
  accept -> staged skill draft -> user installs explicitly

custom_agent_candidate:
  accept -> custom agent proposal -> user creates/enables explicitly

automation_idea:
  accept -> automation proposal -> user enables explicitly

search_eval_case:
  accept -> eval fixture proposal -> user merges into evals explicitly

docs_guidance:
  accept -> docs patch proposal -> user reviews diff -> merge

skip:
  accept skip -> archive reason -> suppress duplicate noise
```

关键 UX 原则：

- 统一入口，不同出口。
- Web 可以统一审核，但不能统一入库。
- 副作用越大的出口，确认越明确。
- 用户应感觉自己是在“批准学习”，不是在“录入数据库”。
- 默认显示低上下文 candidate card；按需下钻 evidence。
- 所有 durable write 都应该有 diff、确认和回退路径。

---

## 10. Durable Destinations

不同经验进入不同长期载体。

| Candidate | Durable destination | 用户确认 | 回退路径 |
|---|---|---|---|
| `pitfall_trap` | `traps.db` confirmed trap + evidence + lifecycle | 必须 | delete / supersede / lifecycle status |
| `project_convention` | AGENTS/CLAUDE/Cursor guidance patch | 必须 review diff | revert patch |
| `skill_candidate` | staged skill/playbook draft | 必须 install | remove skill / disable skill |
| `custom_agent_candidate` | custom subagent / agent config draft | 必须 create/enable | disable / remove agent |
| `automation_idea` | automation proposal | 必须 enable | disable automation |
| `search_eval_case` | eval fixture proposal | 必须 merge fixture | remove fixture / mark obsolete |
| `docs_guidance` | docs patch proposal | 必须 review diff | revert patch |
| `skip` | skip archive reason | accept skip | unskip / reopen |

红线：

- 不自动写 `traps.db`。
- 不静默改 agent guidance。
- 不自动安装 skill。
- 不自动创建 custom agent。
- 不自动开启 automation。
- 不污染 eval fixture。
- 不把临时想法写成长期事实。
- 不让低质量候选反复出现。

---

## 11. Runtime Guardrail Injection

已确认经验必须能影响下一次 agent 工作，否则它只是笔记，不是 guardrail。

### 11.1 Runtime 注入路径

- 已确认 `pitfall_trap` 进入 pre-flight search。
- 已确认 `project_convention` 进入 agent guidance。
- 已确认 `skill_candidate` 作为可触发 workflow。
- 已确认 `custom_agent_candidate` 作为可委派 specialist role。
- 已确认 `automation_idea` 在用户批准后作为 recurring action。
- 已确认 `search_eval_case` 保护检索质量。
- 已确认 `docs_guidance` 改善未来人类和 agent 的上下文。
- `skip` 记录用于抑制重复噪音。

### 11.2 Runtime eligibility

每条 lesson 需要独立字段判断是否能进入 runtime：

```text
runtime_eligibility:
  never
  after_acceptance
  after_durable_merge
  manual_only
```

推荐默认：

```text
pitfall_trap: after_durable_merge
project_convention: after_durable_merge
skill_candidate: manual_only until installed
custom_agent_candidate: manual_only until enabled
automation_idea: manual_only until enabled
search_eval_case: never for runtime, yes for eval protection
docs_guidance: after_durable_merge as documentation context
skip: never for runtime, yes for suppression
```

---

## 12. 成熟产品边界

必须坚持：

- local-first。
- CLI-first。
- Web review as main review UX。
- MCP optional。
- skill / agent workflow as trigger and drafting layer。
- 用户显式触发 learning review。
- 用户显式确认 durable write。
- 证据可追溯。
- source manifest 必填。
- coverage check 必跑。
- skip 是一等结果。
- 低上下文 action card / candidate card，按需下钻。

明确不做：

- 不做通用聊天记忆库。
- 不做全代码库 RAG。
- 不把 Codex session 原文批量导入 codetrap 数据库。
- 不后台偷偷扫描用户历史。
- 不自动写 confirmed trap。
- 不自动改 AGENTS/CLAUDE/Cursor guidance。
- 不自动安装 skill。
- 不自动创建 custom agent。
- 不自动开启 automation。
- 不把泛泛知识、励志总结、营销文案保存为 guardrail。
- 不让低置信候选进入 runtime recall。
- 不把 Codex-specific 能力写死成 codetrap core 的唯一入口。

---

## 13. 推荐演进路线

本文不是实现拆期，但后续开发可以按以下能力层推进。每一层都应有 task dossier、implementation log、handoff 和验证证据。

### Layer A: 产品语言与数据模型

目标：把产品语言从 `CandidateTrap` 扩展到 `LessonCandidate`。

成熟结果：

- 文档明确 lesson candidate 与 trap candidate 的关系。
- 现有 trap candidate 可视为 lesson candidate 的 `pitfall_trap` 子集。
- 类型、状态、质量门槛、证据模型、coverage 模型、risk 模型和 durable destination 语义稳定。
- 新增 `custom_agent_candidate`，避免把适合 subagent 的工作误塞进 skill。

完成信号：

- 后续实现者不再需要讨论“经验是否必须是 trap”。
- Web/CLI/skill 文案统一使用 learning candidate / lesson candidate 语义。
- 旧的 trap review 能继续工作。

### Layer B: Learning Review Trigger

目标：提供显式 learning review 入口。

成熟结果：

- 有 `codetrap learn review --dry-run`。
- 有 `$codetrap-learning-review` skill 或等效 agent workflow。
- skill 会询问或确认时间范围：最近 7 天、最近 30 天、自定义日期、最近 N 个 sessions。
- 默认 dry-run。
- 用户确认前不写 durable destination。

完成信号：

- 用户可以一句话触发：读取最近 30 天 Codex sessions，dry-run 生成 10 条 LessonCandidate。
- 工具会明确说明不会写 `traps.db`、不会改 guidance、不会安装 skill、不会开启 automation。

### Layer C: Experience Mining / Agent-native Discovery

目标：从真实 Codex 工作历史中提出候选，同时允许 agent-native 提交。

成熟结果：

- Pull mode 能读取最近 N 天可用 Codex sessions / `.codetrap/sessions` / local docs。
- Agent-submitted mode 能接收 Codex skill 起草的 LessonCandidate。
- Hybrid mode 能先生成 evidence pack，再让 agent 起草候选，最后由 codetrap stage。
- 工具输出高置信候选和明确 skip。
- 工具检查已有 coverage，避免重复造条目。

完成信号：

- 至少能从真实历史中提出若干条可编辑候选。
- 每条候选都能给出来源日期、片段、source manifest ref 和推荐去向。
- 每条 skip 都有 reason，且能用于降噪。

### Layer D: codetrap Compiler Validation

目标：把 agent 生成的候选编译成可审核资产。

成熟结果：

- LessonCandidate schema validation。
- evidence refs validation。
- source manifest validation。
- coverage report。
- risk report。
- duplicate / supersede suggestions。
- staging review directory。

完成信号：

- agent 不能绕过 schema 和 durable write gate。
- 低质量候选会被标记为 skip / low confidence / needs more evidence。
- Web 能读取同一套 staged review artifacts。

### Layer E: Learning Inbox

目标：把 Web Review 升级成统一候选审核台。

成熟结果：

- 用户能在 Web 中浏览所有候选类型。
- 用户能编辑、转换类型、合并、拒绝、skip。
- trap 类型可复用现有 accept / supersede / conflict review 能力。
- 非 trap 类型先进入 proposal/draft，不做高风险写入。

完成信号：

- Web 成为用户管理 agent 经验的主入口。
- 用户不需要手写 JSON 或直接编辑内部 candidate 文件。

### Layer F: Durable Destination Workflows

目标：让不同经验进入正确载体。

成熟结果：

- `pitfall_trap` 接入现有 trap lifecycle。
- `project_convention` 生成 guidance patch proposal。
- `skill_candidate` 生成 staged skill draft。
- `custom_agent_candidate` 生成 custom agent proposal。
- `automation_idea` 生成 automation proposal。
- `search_eval_case` 进入 eval review。
- `docs_guidance` 生成 docs patch proposal。
- `skip` 记录归档理由。

完成信号：

- 用户能从同一个 Learning Inbox 把不同候选固化到不同出口。
- 每个出口都有明确确认、diff 和可回退路径。

### Layer G: Runtime Feedback Loop

目标：让固化经验改变下一次 agent 行为。

成熟结果：

- pre-flight search 消费 confirmed traps。
- agent guidance 消费 confirmed conventions。
- skills/playbooks 可被 agent 触发。
- custom agents 可被显式委派。
- automation 经用户批准后运行。
- search eval 持续保护召回质量。
- skip archive 抑制重复噪音。

完成信号：

- 用户能看到 learning review 接受的经验在后续 Codex / Claude Code / Cursor 工作中被引用或触发。
- “越用越懂我”成为可感知的产品体验。

---

## 14. First Proof Point

最小证明不是完整实现，而是跑一次真实历史 learning review。

推荐 proof point：

```text
用户显式触发：
  $codetrap-learning-review

skill 询问或确认：
  source = Codex sessions
  range = 最近 30 天，或可用历史更短时使用全部可用历史
  limit = 10
  mode = dry-run

系统执行：
  读取最近 30 天 Codex sessions
  可选使用 Codex memories / summaries 做重复模式发现
  生成 source manifest
  生成 evidence pack
  起草 10 条 LessonCandidate
  生成 skip candidates
  生成 coverage report
  stage 到 .codetrap/learning/reviews/<review-id>/

用户审核：
  用户愿意 accept / edit / stage 至少 3 条
  每条 accepted/editable 候选都能说清楚下次 agent 行为会如何改变

红线验证：
  0 条在用户确认前写入 traps.db
  0 次自动修改 AGENTS/CLAUDE/Cursor guidance
  0 次自动安装 skill
  0 次自动创建 custom agent
  0 次自动开启 automation
  0 次自动污染 eval fixture
```

若成立，说明产品飞轮成立：

```text
使用 -> 留下历史 -> agent 发现经验 -> codetrap 编译候选 -> 用户确认 -> 下次更聪明
```

---

## 15. Falsifier

如果真实历史中挖出的候选大多是以下形态，则说明自动 experience mining 还不成熟：

- 触发条件模糊。
- 推荐动作不明确。
- 证据不足。
- 只是泛泛总结。
- 与现有内容重复。
- 用户不愿意保存。
- 无法改变下一次 agent 行为。
- 误用风险高于收益。
- 涉及敏感历史但没有 redaction。
- agent 能总结，但 codetrap 无法审计来源。
- pure prompt 能创建东西，但没有 review gate。

若 falsifier 成立，应继续强化：

- 半自动 capture。
- evidence pack。
- coverage check。
- candidate quality scoring。
- skip archive。
- Learning Inbox UX。

不应强推自动 mining 或自动 durable write。

---

## 16. 与现有文档/机制的关系

现有机制应保留并上移语义：

- `codetrap session capture`: 继续作为低摩擦候选入口；长期可成为 lesson candidate capture 的一个来源。
- Web Review: 从 trap review 演进为 Learning Inbox。
- `docs/dogfood-flywheel.md`: 当前 promotion lanes 可作为 lesson destination 的雏形。
- `codetrap-capture-external`: 外部文章经验捕获应成为 Experience Sources 的一种，但仍不得让 CLI 直接联网爬取。
- `docs/codetrap-optimization-roadmap.zh-CN.md`: 继续作为技术优化主路线；本文作为成熟产品方向路线图。
- Codex skill / Claude command / Cursor workflow: 作为 agent-native discovery 和用户友好触发层，不替代 codetrap CLI/Web 的 compiler 和 review gate。

需要避免的误解：

- `.codetrap/sessions` 不是用户真实历史的唯一来源。
- `traps.db` 不是所有经验的唯一出口。
- Web Review 不是单纯的数据库管理界面，而是用户审核 agent 学习的界面。
- Skill 不是 durable destination 的自动安装器，而是显式触发和起草 workflow。
- CLI 不是智能大脑，而是可复用、可测试、可审计的 compiler layer。
- Codex-specific 能力不能成为 codetrap core 的唯一假设。

---

## 17. 后续 implementation-journal 使用方式

后续任何实现本文的里程碑，都应：

1. 把本文作为 parent plan。
2. 在 `docs/tasks/<YYYY-MM-DD>-<slug>/task-brief.md` 中写清当前实现切片。
3. 对影响产品模型、数据模型、Web review、CLI/MCP/skill contract 的决策写 `implementation-log.md`。
4. 在每个阶段结束时写 `handoff.md`，说明：
   - 当前完成了哪一层能力。
   - 哪些红线仍被遵守。
   - 用户如何验证 learning candidate 没有自动进入 durable destination。
   - source manifest 和 evidence 是否可追溯。
   - coverage check 是否运行。
   - 下一步最高 ROI 的实现任务。
5. 回写本文或主 roadmap，只记录状态和证据链接，不复制实现细节。

建议的 task slug 示例：

- `lesson-candidate-model`
- `learning-review-trigger-skill`
- `codex-history-learning-review`
- `agent-submitted-lesson-candidates`
- `learning-inbox-web`
- `lesson-durable-destinations`
- `runtime-guardrail-feedback`
- `custom-agent-candidate-destination`

---

## 18. 成熟产品成功标准

成熟产品成立时，应满足：

- 用户使用 Codex / Claude Code / Cursor 一段时间后，codetrap 能提出有证据的学习候选。
- 用户审核候选时，至少一部分候选能明显改变未来 agent 行为。
- trap 数据库保持高精度，没有被泛泛经验污染。
- Web Learning Inbox 成为用户管理 agent 经验的主入口。
- 已确认经验能回流到下一次 agent 工作，而不是停留在文档里。
- Skill、custom agent、automation、guidance patch 等高副作用出口都有明确确认和回退路径。
- skip archive 能减少重复噪音。
- 用户感受到“越用越懂我”，同时仍然信任系统不会擅自读取、写入、安装或启用东西。

---

## 19. 最小可执行总结

如果只能记住一句话：

```text
codetrap 不直接记住一切，也不替 agent 做所有判断；
它把 agent 从真实工作历史里提出的经验，编译成可审核、可追溯、可去重、可固化、可回流的 guardrails。
```

最小架构：

```text
$codetrap-learning-review
  -> ask/confirm range
  -> agent-native discovery
  -> LessonCandidate shortlist
  -> codetrap learn stage --validate --coverage-check --dry-run
  -> Web Learning Inbox
  -> user-approved durable destination
  -> runtime guardrail
```

最小 proof point：

```text
最近 30 天 Codex sessions
  -> 10 条 LessonCandidate
  -> 至少 3 条用户愿意 accept/edit/stage
  -> 0 个未确认 durable write
  -> 至少 1 条在后续 agent 工作中被引用或触发
```
