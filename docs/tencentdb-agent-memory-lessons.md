# TencentDB Agent Memory 对 codetrap 的借鉴备忘

Date: 2026-05-14

本文记录 [TencentDB Agent Memory](https://github.com/Tencent/TencentDB-Agent-Memory) 对 codetrap 的可借鉴思想。结论先行：它对 codetrap 的帮助是**中等偏大**，主要价值在产品形态和 agent 消费方式，而不是底层检索架构。

codetrap 的核心仍然应该是：

```text
SQLite + FTS5 + 中文 normalizer + semantic search + hybrid/RRF + eval set
```

TencentDB Agent Memory 更适合作为一个补充参考：帮助 codetrap 把检索结果设计成“渐进式、可追溯、低上下文占用”的 agent memory。

## 一句话结论

TencentDB Agent Memory 的核心启发不是“做一个大型 agent memory 系统”，而是：

> 低层保留完整证据，高层保留紧凑结构；agent 先消费高层摘要，必要时再按索引下钻到原文。

映射到 codetrap：

```text
TencentDB Agent Memory:
tool output 原文
  -> L1 摘要
    -> Mermaid task canvas / node_id
      -> 需要时按 node_id 召回 refs 原文

codetrap:
trap evidence / before-after / 来源上下文
  -> 完整 trap
    -> compact action card
      -> 需要时按 trap id 查看完整证据
```

也就是说，codetrap 不应该变成“无限上下文垃圾桶”，而应该成为“可追溯的错误模式记忆库”。

## 最值得借鉴的 5 个思想

### 1. 渐进式披露

TencentDB Agent Memory 不把所有工具日志都塞回上下文，而是先给高层结构，需要时再召回原文。这和 skill 的 progressive disclosure 很像。

codetrap 也应该采用同样的层次：

```text
第一层：search_traps 返回紧凑行动卡片
第二层：get_trap 返回完整 trap
第三层：可选 evidence/source 返回代码片段、文件、commit、历史原因
```

一个理想的第一层搜索结果不应该是完整数据库行，而应该像这样：

```text
Trap #12: 不要绕过 auth middleware
Why relevant: 当前任务涉及 session/auth
Avoid: 在 route handler 里手写 token 校验
Do instead: 使用 src/lib/auth.ts 的 requireUser()
Severity: critical
Next: call get_trap(12) for before/after examples
```

这能降低 agent 的上下文负担，也能避免搜索结果太长导致主任务被干扰。

### 2. 低层证据必须可恢复

TencentDB 的一个重要原则是：摘要不是不可逆黑盒，任何压缩后的节点都能回到原始 refs。

codetrap 现在已有 `before_code` / `after_code`，这是很好的起点。后续可以考虑把 evidence 明确建模：

```text
trap
  id
  title
  context
  mistake
  fix
  before_code
  after_code
  evidence/source metadata
```

可选字段或后续表设计：

```text
source_type: manual | conversation | commit | issue | test_failure
source_ref: file path, commit sha, issue url, transcript id
observed_at: first seen timestamp
related_files: JSON array
```

这样 agent 不只是“相信一条 trap”，而是可以追问“这条规则从哪里来的，能不能看具体例子”。

### 3. 高层结构比原文更适合作为默认上下文

TencentDB 用 Mermaid canvas 作为高层任务结构。codetrap 不需要 Mermaid，但需要自己的高层结构：**action card**。

建议把 MCP `search_traps` 的输出分成两种视图：

```text
compact: 默认给 agent 的行动卡片
full: get_trap 或显式 verbose 时返回完整字段
```

compact 视图可以固定包含：

- `trap_id`
- `title`
- `why_relevant`
- `avoid`
- `do_instead`
- `severity`
- `confidence/search_score`
- `next_action`

这比直接返回 `context/mistake/fix/before_code/after_code` 更适合作为 agent 的工作记忆。

### 4. 搜索结果应该支持下钻，而不是一次性塞满

TencentDB 的 `node_id -> refs` 思想，在 codetrap 里可以变成：

```text
trap_id -> get_trap -> evidence/source
```

这对 MCP 工具尤其重要。agent 首轮只需要知道“哪些坑可能相关”，不要马上读完所有细节。只有当它准备动手改代码，或者发现规则有冲突时，再调用 `get_trap`。

后续可以给 `search_traps` 加类似提示：

```json
{
  "trap_id": 12,
  "summary": "...",
  "action": "...",
  "details_tool": "get_trap",
  "details_args": { "id": 12, "scope": "project" }
}
```

### 5. 分层不是为了复杂，而是为了控制噪音

TencentDB 做 L0/L1/L2/L3 是因为它处理的是长对话和工具日志。codetrap 不需要复制这些层级，但可以保留“层级治理”的思想：

```text
Evidence 层：原始证据、代码片段、来源
Trap 层：结构化 mistake/fix
Policy 层：同一 state_key 下的当前有效规则
Guide 层：给 agent 的紧凑行动建议
```

这和当前 roadmap 中的 lifecycle 设计可以接上：

```text
state_key
status: active | superseded | archived
supersedes_id
valid_from / valid_until
```

当一个规则演化时，搜索默认应该优先给 active trap，但仍允许 agent 下钻查看旧 trap 的历史原因。

## 对当前 roadmap 的具体影响

### 已经对上的部分

当前 codetrap 已经吸收了更适合自己的检索路线：

- FTS query 安全化
- 中文 bigram + 小型同义词
- Jina embedding provider
- embedding freshness metadata
- semantic search
- hybrid/RRF
- length normalization
- Recall@5 eval set

这些仍然比 TencentDB 的具体实现更适合 codetrap。

### 建议新增或调整的部分

#### A. 增加 compact result formatter

位置建议：

```text
src/lib/search-result-card.ts
src/mcp/server.ts
src/lib/format.ts
```

目标：把 search result 转成 agent 友好的 action card。

#### B. 明确 `get_trap` 是下钻工具

MCP 工具描述里可以强调：

```text
search_traps 用于发现相关坑；
get_trap 用于在准备修改代码前读取完整细节和例子。
```

这会引导 agent 先搜索、再按需展开。

#### C. 后续考虑 evidence/source metadata

不需要马上做 schema 大改，但可以在 lifecycle 阶段一起设计。证据层比“更多摘要”更重要。

#### D. 让 `check_before_code` 成为更高层入口

如果后续新增工具，可以设计成：

```text
check_before_code(task_description, files?, category?)
  -> search_traps
  -> compact action cards
  -> 返回“动手前请避免这些坑”
```

这会比裸 `search_traps` 更符合 agent 工作流。

## 不建议借鉴的部分

### 1. 不要复制 L0/L1/L2/L3 persona memory

TencentDB 的长期画像和场景记忆适合通用 agent，不适合 codetrap。codetrap 的领域对象是 trap，不是用户人格画像。

### 2. 不要引入 Mermaid task canvas

Mermaid canvas 适合表达长任务进展。codetrap 的知识单元是错误模式，默认结构应该是 trap card，不是任务图。

### 3. 不要做 tool output offload

tool output offload 解决的是长上下文压力。codetrap 解决的是“复用已知错误经验”。这是相邻但不同的问题。

### 4. 不要 patch agent runtime

TencentDB 为了拿到完整上下文，会 patch OpenClaw runtime。codetrap 应保持本地工具/MCP 的低侵入路线，不应要求用户修改宿主 agent。

### 5. 不要引入大型多后端架构

codetrap 的优势是小、清楚、可编译成独立二进制。SQLite + HTTP embedding API 已经足够支撑当前路线。

## 和其他参考资料的关系

TencentDB Agent Memory 在 codetrap 参考体系中的位置：

```text
lerim-cli:
  本地 SQLite + FTS/向量/RRF 的架构参考

OBLIQ-Bench:
  证明 coding trap 查询天然需要 semantic/hybrid

Jina:
  提供 embedding/rerank 的可落地 API

memory-lancedb-pro:
  提供 ranking pipeline 细节：hard min score, length norm, MMR

Mem0:
  提供 lifecycle / temporal / supersede 的治理思路

TencentDB Agent Memory:
  提供 progressive disclosure、可追溯压缩、按需下钻的 agent 消费形态
```

因此，TencentDB 不应该替换现有 roadmap，而应该补充一条产品设计原则：

> 搜索结果默认给 agent 最小可行动信息；完整细节通过 trap id 按需展开。

## 推荐落地顺序

### P0: 不改变架构，先改输出形态

- 给 MCP `search_traps` 增加 compact action card 输出
- CLI `search` 保持人类可读，但可以展示 `Avoid` / `Do instead`
- 搜索结果包含 `next_action: get_trap`

### P1: 强化下钻能力

- `get_trap` 输出 before/after examples 更清晰
- MCP 返回 `source/scope/score/sources`
- 让 agent 能区分“只是相关”和“必须遵守”

### P2: 增加证据元数据

- 增加 source/evidence 字段或表
- 支持从历史对话、commit、issue、test failure 录入 trap 来源
- 搜索结果默认不展示完整 evidence，只提供可下钻引用

### P3: 接入 lifecycle

- `state_key`
- `supersede`
- `archived`
- 搜索默认偏向 active trap，但保留历史规则可追溯

## 最终判断

TencentDB Agent Memory 对 codetrap 的帮助可以概括为：

```text
底层检索架构帮助：低
agent 交互形态帮助：高
长期产品方向帮助：中高
代码复用价值：很低
```

最值得吸收的一句话：

> codetrap 的搜索结果应该像 skill 一样渐进披露：先给行动建议，再按需展开证据。
