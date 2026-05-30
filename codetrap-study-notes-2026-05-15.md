# codetrap 学习笔记：渐进披露、Action Card、Evidence 与 Lifecycle

- 日期：2026-05-15
- 项目：codetrap
- 路径：`/Users/superstorm/Documents/Code/windsurf/codetrap`
- 本次主题：TencentDB-inspired agent memory 架构，以及后续抽出的共享操作层、归档层和 JSON 字段 codec

> 2026-05-17 校准：这份笔记记录的是 2026-05-15 的 progressive disclosure / evidence / lifecycle 改造。当前代码已经继续前进到 schema v5：新增 `path_globs`、`module`、`owner`，并抽出 Search Policy、Trap Shape Codec、Scope Context、Trap Mutation Result 和 CLI Command Workflow。读当前架构时请同时看 `CONTEXT.md` 和 `docs/codetrap-ascii-architecture.md`。

> 2026-05-24 校准：当前代码又新增 Session Mode v1：`src/domain/session.ts`、`src/lib/session-store.ts`、`src/lib/session-operations.ts`、`src/lib/session-capture.ts`、`src/lib/trap-quality.ts` 和 `src/lib/session-conflicts.ts`。Session files 是 temporary working memory；只有用户 accept 的 candidate traps 会通过 `TrapOperations` 写入长期 `traps.db`。`session accept` 会先应用 accept-time edits，再做冲突检测，并把 accepted/possible-conflict diagnostics 写回 candidate document。

> 2026-05-26 校准：`session-capture.ts` 不再把 raw failure/test_failure/correction/review notes 套模板生成 candidate traps。`session close --propose-traps` 只从显式包含 `Title`、`Context`、`Mistake`、`Fix` 的结构化 trap note 生成候选；原始失败和 review 文本只作为 session notes/recap 证据。

本笔记用一个小型学习小组的方式复盘 2026-05-15 写入的代码。目标不是记住每一行，而是理解背后的架构思想：为什么要把搜索结果变短、为什么要保留证据、为什么 lifecycle 不应该只是几个随便能改的字段，以及为什么 CLI/MCP 入口要共享同一层操作语义。

---

## 重点文件速查表

这次改造可以按“类型定义 -> 存储迁移 -> 行为封装 -> 入口适配 -> 测试保护”来读。

| 文件 | 本次重点 | 适合怎么读 |
|---|---|---|
| `src/domain/trap.ts` | 定义 `TrapActionCard`、`TrapDetails`、`TrapEvidence`、`TrapStatus`，以及 MCP tool schema builders | 先看类型，理解系统有哪些“名词” |
| `src/lib/constants.ts` | 增加 `TRAP_STATUSES`、`EVIDENCE_SOURCE_TYPES`、`DEFAULT_TRAP_STATUS`，并把 schema version 升到 4 | 看枚举和默认值从哪里来 |
| `src/db/schema.ts` | 2026-05-15 的 v4 migration：给 `traps` 增加 lifecycle 字段，新增 `trap_evidence` 表 | 看数据库结构如何支持 evidence 和 lifecycle |
| `src/db/queries.ts` | 原始 SQL：active 默认过滤、`addTrapEvidence`、`archiveTrap`、`supersedeTrap` transaction | 看最终落库行为和状态不变量 |
| `src/db/repository.ts` | 单数据库门面：`getDetails`、`addEvidence`、`archive`、`supersede` | 看 raw SQL 如何被包成单库操作 |
| `src/lib/store.ts` | project/global scope policy：跨 scope 查找、写入、下钻、lifecycle 操作 | 看为什么 `id + scope` 很重要，也看它如何把归档语义委托出去 |
| `src/lib/trap-operations.ts` | CLI/MCP 共用的 Trap 操作执行层：add/search/get/list/update/delete/evidence/archive/supersede/stats/export/import | 看薄 Adapter 如何复用同一个深 Module |
| `src/lib/trap-archive.ts` | Trap archive import/export 兼容层：导出 evidence、导入时 remap 到新 trap id | 看备份和迁移语义如何集中 |
| `src/lib/trap-json-fields.ts` | 统一处理 `tags` 和 `related_files` 的 JSON string-array 转换 | 看 canonical JSON、legacy raw string、空值如何保持一致 |
| `src/lib/search-service.ts` | 把 `status` 过滤传进 FTS/semantic/hybrid search | 看 lifecycle 过滤如何留在 search/query 层 |
| `src/db/embedding-queries.ts` | semantic candidates 也支持 status 过滤，但 evidence 不进入 embedding passage | 看“不让 evidence 污染搜索默认上下文”的实现 |
| `src/lib/search-result-card.ts` | 把 `TrapSearchResult + scope` 压缩成 `TrapActionCard` | 这是 Action Card 的核心文件，建议重点读 |
| `src/lib/format.ts` | CLI 渲染 action card 和 full details/evidence/lifecycle | 看人类终端输出如何复用同一套 card 数据 |
| `src/mcp/tools.ts` | MCP tool 描述：`search_traps`、`get_trap`、`add_trap_evidence`、`archive_trap`、`supersede_trap` | 看 agent 会看到什么工具说明 |
| `src/mcp/server.ts` | `handleToolCall()`：MCP 工具如何调用 `TrapOperations`，并返回 compact cards 或 full details | 看 MCP adapter 如何保持薄 |
| `src/commands/router.ts` | CLI 命令：search/show/add evidence/archive/supersede | 看人类入口如何委托给 `TrapOperations` 再渲染终端输出 |
| `src/tests/search-result-card.test.ts` | 验证 card 字段、`id + scope`，以及 project/global 同 id 场景 | 看 action card 的架构承诺 |
| `src/tests/mcp-tools.test.ts` | 验证 MCP `search_traps` 返回 compact card，`get_trap` 返回 details + evidence | 看 agent-facing payload 是否正确 |
| `src/tests/trap-lifecycle-evidence.test.ts` | 验证 2026-05-15 的 schema v4、active 默认过滤、`status=all`、supersede、evidence 下钻 | 看 lifecycle/evidence 的行为保护 |
| `src/tests/import-export-cli.test.ts` | 验证 export/import 不丢 evidence，坏 JSON 不冒 stack trace | 看归档层和 CLI 错误处理的保护 |
| `src/tests/trap-json-fields.test.ts` | 验证 `tags` / `related_files` 的 JSON field codec | 看字段兼容规则如何被锁住 |

推荐阅读顺序：

```text
1. src/domain/trap.ts
2. src/lib/search-result-card.ts
3. src/lib/trap-operations.ts
4. src/mcp/server.ts
5. src/db/schema.ts
6. src/db/queries.ts
7. src/lib/trap-archive.ts
8. src/lib/trap-json-fields.ts
9. src/tests/mcp-tools.test.ts
10. src/tests/trap-lifecycle-evidence.test.ts
11. src/tests/import-export-cli.test.ts
12. src/tests/trap-json-fields.test.ts
```

---

## 学习会开场

╔═══════════════════════════════════════════════════════╗
║  Study Session #8: codetrap                           ║
║  Today's Topic: Progressive Trap Memory               ║
╚═══════════════════════════════════════════════════════╝

Teacher Zhang：本次我们学 2026-05-15 写进去的这层新架构。简单说，codetrap 在这个阶段更像一个“有目录卡片、有档案原件、有版本历史的错题本”。

Xiao Ming：等等，所以它不是只多加几个字段？

Sister Lin：我猜是把“AI 要看的短提醒”和“人要追溯的完整证据”分开？

Teacher Zhang：对，这就是本次最核心的思想。

---

## 1. 这个项目到底做什么？

Teacher Zhang：codetrap 是一个本地优先的 coding pitfall memory bank。换成人话，它像一本给 AI coding agent 用的“错题本”：以前踩过的坑记录下来，下次写代码前先查一眼，避免重复犯错。

Xiao Ming：所以它不是普通 TODO，也不是聊天记录？

Teacher Zhang：不是。它记录的是结构化的 `Trap`：什么时候容易出错、错法是什么、正确做法是什么、严重程度如何。

Sister Lin：像厨房里的“不要把盐当糖”的提醒卡，但背后还可以翻到事故记录？

Teacher Zhang：漂亮。2026-05-15 这次改造，就是把“提醒卡”和“事故记录”明确分层。

┌─ New Word ────────────────────────────────────────────┐
│ Trap：一条结构化的坑。它不是随手备注，而是包含 context、 │
│ mistake、fix、severity 等字段的可检索经验。             │
└───────────────────────────────────────────────────────┘

---

## 2. 本次改造的大图

以前的搜索结果更像把整份档案直接递给 agent。现在改成三层：

```text
第一层：Action Card
  搜索时默认返回，短、小、可行动

第二层：TrapDetails
  需要细节时 get_trap 下钻

第三层：Evidence + Lifecycle
  追溯来源、查看规则演化历史
```

Teacher Zhang：这像图书馆。你不会一进门就抱走整本档案夹，而是先看目录卡片。目录卡片告诉你：“这本书可能相关，在 A3 架第 12 号。”真的需要时再去取原书。

Xiao Ming：那 Action Card 就是目录卡片？

Teacher Zhang：正是。`get_trap` 就是去档案柜拿完整原件。

Sister Lin：那 evidence 是原件里的附件，lifecycle 是“这条规则现在还有效吗”？

Teacher Zhang：完全对。

---

## 3. 顶层架构地图

```text
                         ┌─────────────────────────────┐
                         │        codetrap root         │
                         │      (Local Memory Bank)     │
                         └──────────────┬──────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
   ┌──────▼──────┐              ┌───────▼───────┐              ┌──────▼──────┐
   │    src/     │              │    docs/      │              │   skills/   │
   │  (Factory)  │              │   (Manual)    │              │ (Playbook)  │
   └──────┬──────┘              └───────────────┘              └─────────────┘
          │
          ├── domain/      (Blueprint)  类型、schema、输入构造
          ├── db/          (Warehouse)  SQLite schema 与 SQL
          ├── lib/         (Workshop)   store、search、card、format
          ├── mcp/         (Agent Door) MCP tools 和 handler
          ├── commands/    (CLI Door)   命令行入口
          └── tests/       (Gym)        行为验证
```

Teacher Zhang：这张图可以先这样记：`domain/` 定义“什么是 Trap”，`db/` 管“怎么存”，`lib/` 管“怎么组织行为”，`mcp/` 和 `commands/` 只是两个门口。

Xiao Ming：门口？就是用户和 AI 进来的地方？

Teacher Zhang：对。CLI 是人从终端进来，MCP 是 AI agent 通过工具进来。门口不应该自己决定复杂规则。

┌─ New Word ────────────────────────────────────────────┐
│ Adapter：适配入口。这里的 CLI 和 MCP 都是 Adapter。它们 │
│ 负责接待请求和返回结果，不应该把业务规则藏在自己里面。 │
└───────────────────────────────────────────────────────┘

---

## 4. 本次新增的核心模块

### 4.1 Action Card：给 agent 的短提醒卡

关键文件：

- `src/domain/trap.ts`
- `src/lib/search-result-card.ts`
- `src/lib/format.ts`
- `src/mcp/server.ts`
- `src/commands/router.ts`

核心类型：

```ts
export interface TrapActionCard {
  trap_id: number;
  scope: Scope;
  title: string;
  why_relevant: string;
  avoid: string;
  do_instead: string;
  severity: string;
  score: number | null;
  sources: ("fts" | "semantic")[];
  next_action: {
    details_tool: "get_trap";
    details_args: {
      id: number;
      scope: Scope;
    };
  };
}
```

Teacher Zhang：Action Card 的重点是“小而够用”。它告诉 agent：为什么相关、不要做什么、应该做什么、如果需要细节下一步调哪个工具。

Xiao Ming：为什么 `next_action.details_args` 里面一定要有 `scope`？

Teacher Zhang：因为 project 数据库和 global 数据库是两个 SQLite 文件，它们都可能有 `id = 1`。只给 id，就像只说“去 1 号柜子”，但没说是项目柜还是全局柜。

Sister Lin：所以 `id + scope` 才是完整地址。

Teacher Zhang：对。这是一个很重要的小设计。

数据变换：

```text
TrapSearchResult + scope
          │
          ▼
toTrapActionCard()
          │
          ▼
TrapActionCard
          │
          ├── MCP: JSON 序列化
          └── CLI: formatTrapActionCard() 渲染
```

┌─ New Word ────────────────────────────────────────────┐
│ Progressive Disclosure：渐进披露。先给最少但可行动的信息，│
│ 真需要时再展开完整细节。像先看菜单，再决定要不要进厨房。 │
└───────────────────────────────────────────────────────┘

### 4.2 TrapDetails + Evidence：完整档案和证据附件

关键文件：

- `src/domain/trap.ts`
- `src/db/schema.ts`
- `src/db/queries.ts`
- `src/db/repository.ts`
- `src/lib/store.ts`

核心类型：

```ts
export interface TrapDetails {
  trap: Trap;
  evidence: TrapEvidence[];
  scope: Scope;
}

export interface TrapEvidence {
  id: number;
  trap_id: number;
  source_type: string;
  source_ref: string | null;
  observed_at: string;
  related_files: string;
  note: string | null;
  created_at: string;
}
```

Teacher Zhang：Evidence 是“为什么我们相信这条 trap”的来源。它可以来自 commit、issue、conversation、test failure 等。

Xiao Ming：那为什么 search 不直接带 evidence？

Teacher Zhang：因为默认搜索是给 agent 快速判断用的。如果每条结果都塞证据，context 会变重，agent 反而更容易迷路。Evidence 应该在 `get_trap` 时下钻。

Sister Lin：就像餐厅菜单不会把供应商发票也印上去。

Teacher Zhang：对，菜单负责选菜，发票负责追溯。

数据流：

```text
search_traps
    │
    ▼
Action Card
    │  如果相关
    ▼
get_trap(id, scope)
    │
    ▼
TrapDetails
    ├── full trap
    ├── before_code / after_code
    ├── lifecycle fields
    └── evidence[]
```

### 4.3 Lifecycle：规则会演化

关键字段：

- `status`: `active | superseded | archived`
- `state_key`
- `supersedes_id`
- `valid_from`
- `valid_until`

关键操作：

- `archive_trap`
- `supersede_trap`

Teacher Zhang：Lifecycle 解决的是“旧规则怎么办”。不是所有旧规则都应该删除，有些应该保留历史，但默认搜索不再提示。

Xiao Ming：那为什么不让用户直接 edit status？

Teacher Zhang：因为状态变化不是单字段变化。比如 supersede 旧规则时，要同时把旧 trap 标记为 `superseded`，给它 `valid_until`，还要把新 trap 标记为 active，并记录 `supersedes_id`。这是一组动作，不是一格表格。

Sister Lin：所以 `supersede_trap` 是一个有语义的操作，不是裸字段编辑。

Teacher Zhang：是的。这就是“深一点的接口”。

```text
supersede_trap(old_id, new_id, scope)
          │
          ▼
TrapOperations：执行共享操作语义
          │
          ▼
TrapStore：决定 scope policy
          │
          ▼
TrapRepository：进入单库操作
          │
          ▼
queries.supersedeTrap()：一个 transaction 更新两条 trap
          │
          ├── old.status = superseded
          ├── old.valid_until = now
          ├── new.status = active
          └── new.supersedes_id = old_id
```

┌─ New Word ────────────────────────────────────────────┐
│ Transaction：事务。可以理解成“一口气办完的一组手续”。要么 │
│ 都成功，要么都不算，避免状态改一半。                    │
└───────────────────────────────────────────────────────┘

### 4.4 TrapOperations：CLI 和 MCP 共用的办事窗口

关键文件：

- `src/lib/trap-operations.ts`
- `src/mcp/server.ts`
- `src/commands/router.ts`
- `src/lib/store.ts`

Teacher Zhang：后来又做了一次架构整理，把 CLI 和 MCP 共同需要的 Trap 操作抽成了 `TrapOperations`。

Xiao Ming：它和 `TrapStore` 有什么区别？听起来都在管操作。

Teacher Zhang：`TrapStore` 主要管 project/global 的 scope policy，比如读 project 还是 global、没有 project 时怎么办。`TrapOperations` 则管“一个命令是什么意思”：search 返回 action card、update 怎么挑字段、add evidence 怎么构造输入。

Sister Lin：所以 CLI 和 MCP 都不用自己懂这些细节？

Teacher Zhang：对。CLI 负责命令行参数和终端输出，MCP 负责 tool payload。它们都把真正的 Trap 操作交给 `TrapOperations`。

```text
CLI Adapter ─┐
             ▼
        TrapOperations
             │
MCP Adapter ─┘
             ▼
          TrapStore
             ▼
       TrapRepository
```

┌─ New Word ────────────────────────────────────────────┐
│ TrapOperations：共享操作层。它让 CLI 和 MCP 通过同一个入口 │
│ 执行 Trap 语义，避免两个 Adapter 各自复制规则。          │
└───────────────────────────────────────────────────────┘

### 4.5 TrapArchive：导入导出不是简单复制行

关键文件：

- `src/lib/trap-archive.ts`
- `src/lib/store.ts`
- `src/db/queries.ts`
- `src/tests/import-export-cli.test.ts`

Teacher Zhang：导入导出听起来像“把 JSON 存出来再读回去”，但有一个小坑：导入时 trap 会生成新的 id。

Xiao Ming：那 evidence 里的 `trap_id` 不能照抄旧 id？

Teacher Zhang：正是。`TrapArchive` 的工作就是把导出的 evidence 重新挂到导入后新生成的 trap id 上。

```text
export:
  trap #12 + evidence[]
        │
        ▼
  archive JSON

import:
  archive JSON
        │
        ▼
  new trap #37
        │
        ▼
  evidence[] remap 到 #37
```

Sister Lin：所以这是备份/迁移语义，不该塞在 `TrapStore` 里。

Teacher Zhang：对。`TrapStore` 继续管 scope，`TrapArchive` 管归档格式和兼容。

### 4.6 Trap JSON Field Codec：统一处理 JSON 字段

关键文件：

- `src/lib/trap-json-fields.ts`
- `src/db/queries.ts`
- `src/lib/format.ts`
- `src/lib/trap-search-document.ts`
- `src/lib/trap-archive.ts`
- `src/tests/trap-json-fields.test.ts`

Teacher Zhang：SQLite 里 `tags` 和 evidence 的 `related_files` 都是 JSON string，但代码入口通常想用 string array。

Xiao Ming：所以如果每个地方自己 `JSON.parse`，规则会不一样？

Teacher Zhang：对。现在统一交给 `trap-json-fields.ts`。它知道怎么处理：

- 标准 JSON array：`["api", "fetch"]`
- legacy raw string：`"api"` 当成 `["api"]`
- 空值：当成 `[]` 或 optional undefined
- array 输入：统一转成 string array

```text
SQLite JSON string
      │
      ▼
Trap JSON Field Codec
      │
      ├── storage 写入
      ├── CLI 展示
      ├── search passage
      └── archive import/export
```

Sister Lin：这就是把一个小规则变成一个可靠 Module。

Teacher Zhang：对，小但很值钱。

---

## 5. 请求是怎么走的？

### 5.1 MCP 搜索：从 agent 请求到 Action Card

```text
AI Agent
   │
   │ search_traps(query="fetchWrapper")
   ▼
┌───────────────┐
│ mcp/server.ts │  (Agent Door)
└───────┬───────┘
        │ handleToolCall()
        ▼
┌────────────────┐
│ TrapOperations │  (Shared Clerk)
└───────┬────────┘
        │ shared trap command semantics
        ▼
┌──────────────┐
│  TrapStore   │  (Dispatcher)
└──────┬───────┘
       │ project first, then global
       ▼
┌────────────────┐
│ TrapRepository │  (Single DB Desk)
└──────┬─────────┘
       ▼
┌────────────────┐
│ SearchService  │  (Search Engine)
└──────┬─────────┘
       ▼
┌───────────────┐
│ db/queries.ts │  (SQL Shelf)
└──────┬────────┘
       ▼
TrapSearchResult[]
       │
       ▼
toTrapActionCards()
       │
       ▼
compact JSON cards
```

Teacher Zhang：你可以把 `mcp/server.ts` 想成前台，把 `TrapOperations` 想成共享办事员，把 `TrapStore` 想成分诊台，`TrapRepository` 是某一个数据库柜台，`SearchService` 是搜索员，`queries.ts` 是真正翻柜子的手。

Xiao Ming：那 `search-result-card.ts` 呢？

Teacher Zhang：它是“摘要员”。搜索员找到一堆资料后，摘要员把它变成 agent 能快速消费的卡片。

### 5.2 下钻：从 Action Card 到完整 TrapDetails

```text
Action Card
  next_action.details_args = { id, scope }
              │
              ▼
        get_trap(id, scope)
              │
              ▼
        TrapOperations.getTrapDetails()
              │
              ▼
        TrapStore.getDetails()
              │
              ▼
        Repository.getDetails()
              │
              ▼
        trap + evidence[]
```

Sister Lin：这跟前面“菜单和档案柜”的比喻对应上了。搜索是看菜单，下钻是拿档案。

Teacher Zhang：对。学架构的时候，能把代码和比喻对应起来，就不容易迷路。

---

## 6. 数据库变化：2026-05-15 schema v4

新增字段和表在 `src/db/schema.ts`。

```text
traps
  id
  title / context / mistake / fix
  severity
  status
  state_key
  supersedes_id
  valid_from
  valid_until
  ...

trap_evidence
  id
  trap_id
  source_type
  source_ref
  observed_at
  related_files
  note
  created_at
```

Teacher Zhang：以前 `traps` 表只记录“这条坑是什么”。现在它还知道“这条坑当前是否有效”和“它有没有来源证据”。

Xiao Ming：Evidence 为什么单独一张表？

Teacher Zhang：因为一条 trap 可以有多份证据。比如第一次来自 review，第二次来自 test failure，第三次来自 commit。放单独表更适合成长。

┌─ New Word ────────────────────────────────────────────┐
│ One-to-many：一对多。一条 trap 可以对应多条 evidence，像一个 │
│ 案件可以有多份证据材料。                                │
└───────────────────────────────────────────────────────┘

---

## 7. 为什么这是“好架构”？

### 7.1 Adapter 变薄

CLI 和 MCP 不再各自拼凑 Trap 操作语义。它们共享：

- `TrapOperations`
- `toTrapActionCard()`
- `toTrapActionCards()`
- `formatTrapActionCard()`

这减少了重复逻辑，也让“搜索返回短卡片、get_trap 返回详情、add evidence 怎么校验、archive/supersede 怎么调用”这些规则不再散落在两个 Adapter 里。

### 7.2 状态规则集中

Lifecycle 不通过普通 edit 暴露，而通过：

- `archive`
- `supersede`

这样状态不变量集中在 Store/Repository/Query 的语义操作里。

### 7.3 Search 继续只负责搜索

Evidence 默认不进入 FTS/embedding passage。也就是说，本次改造没有混乱地改变底层检索质量逻辑。搜索仍然返回 trap 结果，卡片层负责压缩展示。

### 7.4 归档和 JSON 字段规则集中

`TrapArchive` 把导入导出和 evidence remap 集中起来。`Trap JSON Field Codec` 把 `tags` 和 `related_files` 的 parse/encode 规则集中起来。

这两个 Module 很小，但很有用：一个防止备份丢 evidence，一个防止不同路径对 JSON 字段理解不一致。

### 7.5 测试覆盖的是行为，不只是函数

关键测试：

- `src/tests/search-result-card.test.ts`
  - 验证 action card 字段
  - 验证 project/global 同 id 时 scope 不丢

- `src/tests/mcp-tools.test.ts`
  - 验证 `search_traps` 返回 compact card
  - 验证 `get_trap` 返回 details 和 evidence

- `src/tests/trap-lifecycle-evidence.test.ts`
  - 验证 2026-05-15 schema v4 默认字段
  - 验证 archived/superseded 默认不出现在 search
  - 验证 `status=all` 能查历史
  - 验证 supersede 一次更新两条 trap
  - 验证 evidence 只在 details 里出现

- `src/tests/import-export-cli.test.ts`
  - 验证 export/import 不丢 evidence
  - 验证导入时 evidence 会挂到新 trap id
  - 验证坏 JSON 不会冒出 CLI stack trace

- `src/tests/trap-json-fields.test.ts`
  - 验证 canonical JSON array
  - 验证 legacy raw string
  - 验证空值和 encode 规则

Teacher Zhang：测试像健身房，不只是证明“代码能跑”，更是证明“架构承诺还有效”。

---

## 8. 小测验

┌─ Quick Check 1 ───────────────────────────────────────┐
│ Q1: `search_traps` 现在默认返回什么？                  │
│                                                        │
│ a) 完整 trap 数据库行                                  │
│ b) compact action cards                                │
│ c) evidence 全量列表                                   │
│                                                        │
│ Xiao Ming：我选 b！                                    │
│ Teacher Zhang：对。它现在先给 agent 短卡片。           │
└──────────────────────────────────────────────────────┘

┌─ Quick Check 2 ───────────────────────────────────────┐
│ Q2: 为什么 `next_action.details_args` 要带 scope？      │
│                                                        │
│ a) 因为 project/global 可能有相同 id                    │
│ b) 因为 scope 会提高 embedding 质量                     │
│ c) 因为 SQLite 必须这么写                               │
│                                                        │
│ Sister Lin：我选 a。                                   │
│ Teacher Zhang：对。id 只在单个数据库里唯一。            │
└──────────────────────────────────────────────────────┘

┌─ Quick Check 3 ───────────────────────────────────────┐
│ Q3: `supersede_trap` 为什么不是普通 edit 字段？         │
│                                                        │
│ a) 因为状态变化牵涉多字段和两条 trap                    │
│ b) 因为 TypeScript 不支持 status 字段                   │
│ c) 因为 MCP 不能调用 update                             │
│                                                        │
│ Xiao Ming：我差点选 c。                                │
│ Teacher Zhang：很正常，但正确是 a。supersede 是一个     │
│ 有语义的生命周期操作，不是一格表格。                   │
└──────────────────────────────────────────────────────┘

---

## 9. 这次代码里的核心思想

1. **默认短，上下文省**
   - Agent 先看 Action Card，不直接吃完整数据库行。

2. **需要时下钻**
   - `get_trap(id, scope)` 才返回完整 `TrapDetails`。

3. **证据可追溯**
   - Evidence 单独建表，一条 trap 可有多份来源。

4. **规则有生命周期**
   - 默认只搜 active，历史规则保留但不打扰。

5. **薄 Adapter，深 Module**
   - CLI/MCP 是门口，不是规则仓库。

6. **共享操作层**
   - `TrapOperations` 统一 CLI/MCP 的 Trap 操作语义。

7. **归档和 JSON 字段有专门 Module**
   - `TrapArchive` 保护 evidence 不丢。
   - `Trap JSON Field Codec` 统一 `tags` / `related_files` 的兼容规则。

---

## 10. 下次可以继续学哪里？

建议下一次打开这些文件深挖：

- `src/lib/store.ts`
  - 看 project/global scope policy 怎么统一管理。

- `src/lib/trap-operations.ts`
  - 看 CLI/MCP 如何共享 Trap 操作语义。

- `src/lib/trap-archive.ts`
  - 看 export/import 如何保留 evidence 并 remap 新 id。

- `src/lib/trap-json-fields.ts`
  - 看 JSON string-array 字段如何统一处理。

- `src/db/repository.ts`
  - 看单库操作如何包住 raw SQL。

- `src/lib/search-service.ts`
  - 看 FTS、semantic、hybrid search 怎么组合。

- `src/lib/trap-search-document.ts`
  - 看为什么 evidence 暂时不进入 embedding passage。

Teacher Zhang：你已经抓住了 2026-05-15 这次改造最重要的架构骨架。别急着背字段，先记住这句话：搜索给行动卡片，下钻给完整证据，共享操作层让入口变薄，归档和 JSON 字段规则各自集中。

---

# 生图提示词包

说明：AI 图像模型经常会把中文文字画糊、画错、画成乱码。建议先生成“布局和插画”，再用 Excalidraw、Figma、Canva、Keynote 或 PPT 手动补中文标签。如果一定要让模型直接出中文，请让标签尽量短。

## 通用风格提示词

```text
生成一张中文手绘学习笔记风格的信息图，米白色纸张背景，黑色细线手绘，少量淡蓝色、淡黄色、淡绿色高亮，像课堂白板草图。整体风格温暖、清晰、适合放进 Markdown 复习文档。

要求：
- 一图只讲一个概念
- 模块之间不要重叠
- 箭头方向清晰
- 中文标签短而清楚
- 留出足够空白
- 不要真实人物
- 不要复杂背景
```

## 通用负面提示词

```text
不要照片风格，不要 3D 渲染，不要复杂背景，不要密集小字，不要英文乱码，不要文字重叠，不要过度装饰，不要真实人物，不要赛博朋克，不要黑暗科幻风，不要花哨渐变。
```

## 图 1：codetrap 新架构总览

```text
生成一张中文手绘学习笔记风格的信息图，主题是“codetrap 渐进披露架构总览”。

画面结构：
左边画一个“AI Agent”小终端图标，中间画一条主流程，先经过一个“TrapOperations 共享操作层”小柜台，再进入三层阶梯结构：
第 1 层是“Action Card 短提醒”
第 2 层是“TrapDetails 完整档案”
第 3 层是“Evidence + Lifecycle 追溯层”
右边画一个本地 SQLite 文件柜，旁边放两个小工具盒：“TrapArchive”和“JSON Field Codec”。
用箭头表示：AI 先 search_traps 拿短卡片，再 get_trap 下钻完整档案。

需要出现的中文标签：
- AI Agent
- TrapOperations
- search_traps
- Action Card
- get_trap
- TrapDetails
- Evidence
- Lifecycle
- TrapArchive
- JSON Field Codec
- SQLite

学习目的：
让初学者一眼看懂“先短卡片，再下钻证据”，以及 CLI/MCP 入口背后有共享操作层。
```

## 图 2：Action Card 像图书馆目录卡

```text
生成一张中文手绘学习笔记风格的信息图，主题是“Action Card 是目录卡片”。

画面结构：
左边画一个图书馆目录抽屉，抽屉里伸出一张卡片，卡片上用短标签列出：
trap_id、scope、avoid、do_instead、next_action。
右边画一个厚档案夹，标签是“TrapDetails”。
卡片上有箭头指向档案夹，箭头标签是“需要细节再下钻”。

需要出现的中文标签：
- 目录卡片
- trap_id + scope
- Avoid
- Do instead
- Next action
- 完整档案

学习目的：
解释为什么搜索结果不直接返回完整 trap。
```

## 图 3：MCP 搜索数据流

```text
生成一张中文手绘学习笔记风格的信息图，主题是“MCP search_traps 数据流”。

画面结构：
从左到右画一条流水线：
AI Agent -> mcp/server.ts -> TrapOperations -> TrapStore -> TrapRepository -> SearchService -> queries.ts -> search-result-card.ts -> JSON Cards
每个模块画成小盒子，下面加一个简短昵称：
mcp/server.ts 是“MCP 门口”
TrapOperations 是“共享办事员”
TrapStore 是“Scope 分诊台”
TrapRepository 是“单库柜台”
SearchService 是“搜索员”
queries.ts 是“SQL 货架”
search-result-card.ts 是“摘要员”

需要出现的中文标签：
- AI Agent
- MCP 门口
- 共享操作
- Scope 分诊
- 单库操作
- 搜索
- SQL
- 摘要卡片

学习目的：
让学习者理解请求从 agent 到数据库再回到 card 的旅程。
```

## 图 4：Evidence 为什么单独建表

```text
生成一张中文手绘学习笔记风格的信息图，主题是“一条 Trap 可以有多份 Evidence”。

画面结构：
左边画一个大文件夹，标签“Trap #12”。
右边从文件夹伸出三张小证据纸：
commit、issue、test failure。
用一对多关系箭头连接。
底部画一句短标签：“search 不加载完整 evidence，get_trap 才展开”。

需要出现的中文标签：
- Trap
- Evidence
- commit
- issue
- test failure
- get_trap 展开

学习目的：
解释独立 trap_evidence 表比内联字段更适合成长。
```

## 图 5：Lifecycle 规则演化

```text
生成一张中文手绘学习笔记风格的信息图，主题是“Trap Lifecycle：规则会演化”。

画面结构：
画一条时间线，从左到右：
active -> superseded -> archived
在 active 上画绿色小旗，在 superseded 上画黄色替换箭头，在 archived 上画灰色档案盒。
旁边画一个 supersede_trap 操作，把 Old Trap 指向 New Trap。

需要出现的中文标签：
- active
- superseded
- archived
- supersede_trap
- valid_from
- valid_until

学习目的：
让学习者理解旧规则不删除，而是保留历史并默认不打扰。
```

## 图 6：为什么 `id + scope` 才是完整地址

```text
生成一张中文手绘学习笔记风格的信息图，主题是“Trap ID 需要配合 Scope”。

画面结构：
画两个并排文件柜：
左边柜子标签“project DB”，里面有“Trap #1”
右边柜子标签“global DB”，里面也有“Trap #1”
中间画一个警示牌：“只有 id 会混淆”
下方画正确地址格式：{ id: 1, scope: project }

需要出现的中文标签：
- project DB
- global DB
- Trap #1
- id + scope
- 完整地址

学习目的：
解释为什么 Action Card 的 next_action 必须带 scope。
```

## 图 7：薄 Adapter，深 Module

```text
生成一张中文手绘学习笔记风格的信息图，主题是“薄 Adapter，深 Module”。

画面结构：
上方画两个入口门：
CLI Door、MCP Door。
它们都先指向中间的大模块：
TrapOperations，共享执行层。
TrapOperations 再指向：
TrapStore、TrapRepository、SearchService、TrapArchive、JSON Field Codec、Action Card Module。
旁边用对比方式画一个红叉小图：CLI 和 MCP 各自复制规则。

需要出现的中文标签：
- CLI
- MCP
- TrapOperations
- TrapStore
- Repository
- SearchService
- TrapArchive
- JSON Field Codec
- Action Card Module
- 不重复规则

学习目的：
解释为什么不要把业务规则写在 Adapter 里，以及为什么共享操作层能让两个入口保持一致。
```

## 图 8：测试守住架构承诺

```text
生成一张中文手绘学习笔记风格的信息图，主题是“测试守住架构承诺”。

画面结构：
画一个小健身房，里面有五台训练器：
Action Card 测试
MCP Payload 测试
Lifecycle/Evidence 测试
Import/Export 测试
JSON Field Codec 测试
每台训练器用箭头指向一个承诺：
短卡片、下钻详情、历史可追溯、证据不丢失、JSON 字段一致。

需要出现的中文标签：
- 测试健身房
- Action Card
- MCP Payload
- Lifecycle
- Evidence
- Import/Export
- JSON Field Codec
- 架构承诺

学习目的：
让学习者理解测试不是形式，而是在保护设计。
```

## 图 9：搜索默认 active，历史按需查看

```text
生成一张中文手绘学习笔记风格的信息图，主题是“默认只看 active，历史按需打开”。

画面结构：
画一个筛子，输入是 active、superseded、archived 三种卡片。
筛子默认只让 active 通过，输出到 search results。
旁边画一个开关：status=all，打开后三种卡片都可以通过。

需要出现的中文标签：
- 默认搜索
- active
- superseded
- archived
- status=all
- 历史记录

学习目的：
解释 lifecycle 过滤放在 search/query 层的意义。
```

## 图 10：从 raw trap 到 agent 工作记忆

```text
生成一张中文手绘学习笔记风格的信息图，主题是“从完整 Trap 到 Agent 工作记忆”。

画面结构：
左边画厚厚的 raw trap 文档，包含 context、mistake、fix、before/after。
中间画一个压缩漏斗，标签“compact() + toTrapActionCard()”。
右边输出一张小卡片，只保留 why_relevant、avoid、do_instead、next_action。

需要出现的中文标签：
- 完整 Trap
- 压缩
- Action Card
- why relevant
- avoid
- do instead
- next action

学习目的：
说明为什么压缩不是丢信息，而是把信息分层。
```

---

## 本次学习总结

Teacher Zhang：2026-05-15 这份笔记把当时刚写的代码从“能运行”变成了“能理解”。你现在应该能说清楚：

- 为什么 `search_traps` 要返回短卡片
- 为什么 `get_trap` 才展开完整详情和 evidence
- 为什么 lifecycle 要用 `archive_trap` / `supersede_trap` 这种语义操作
- 为什么 CLI/MCP 要共用 `TrapOperations`
- 为什么导入导出要有 `TrapArchive` 来保留 evidence
- 为什么 `tags` / `related_files` 要通过 `Trap JSON Field Codec`
- 为什么测试要覆盖 scope、MCP payload、evidence、历史状态、导入导出和 JSON 字段兼容
