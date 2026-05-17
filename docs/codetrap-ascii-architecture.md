# codetrap ASCII 架构说明

更新日期：2026-05-17

本文用纯 ASCII 流程图整理 codetrap 当前代码里的架构、数据流，以及已经落到代码中的思想架构。

范围说明：本文只写当前代码已经体现出来的架构。compact action card、CLI JSON、MCP thin adapter、`codetrap doctor`、embedding health、evidence/source metadata、lifecycle、archive/supersede、schema v5 path/module/owner scope、config defaults、generic rerank、Codex plugin scaffold 和 release preflight 等能力已经落到代码中；team sharing、multimodal evidence、cross-encoder reranking、本地 embedding provider 仍属于未来方向。

## 1. 一句话理解 codetrap

codetrap 是一个本地优先的“编程踩坑记忆库”：它把过去犯过的编码错误记录成结构化的 `Trap`，让开发者或 AI agent 在写代码前先检索相关坑，避免重复犯错。

```text
过去踩过的坑
      |
      v
+------------------+
| Structured Trap  |
| context/mistake/ |
| fix/scope/tags   |
+--------+---------+
         |
         v
+------------------+
| 写代码前先搜索    |
| search before act|
+--------+---------+
         |
         v
避免重复犯同一个错误
```

## 2. 顶层项目结构

```text
codetrap/
|
+-- src/                         运行时代码
|   |
|   +-- index.ts                 CLI 入口
|   +-- mcp-server.ts            MCP server 入口
|   |
|   +-- commands/                CLI 命令适配层
|   |   +-- router.ts
|   |   +-- workflow.ts
|   |   +-- command-result.ts
|   |
|   +-- mcp/                     MCP 适配层
|   |   +-- server.ts
|   |   +-- tools.ts
|   |   +-- resources.ts
|   |
|   +-- domain/                  核心领域定义
|   |   +-- trap.ts
|   |
|   +-- lib/                     策略、搜索、格式化、embedding
|   |   +-- store.ts
|   |   +-- scope.ts
|   |   +-- scope-context.ts
|   |   +-- trap-operations.ts
|   |   +-- trap-mutation-result.ts
|   |   +-- output-json.ts
|   |   +-- search-result-card.ts
|   |   +-- search-service.ts
|   |   +-- search-policy.ts
|   |   +-- search-normalizer.ts
|   |   +-- fts-query.ts
|   |   +-- trap-search-document.ts
|   |   +-- trap-json-fields.ts
|   |   +-- trap-codec.ts
|   |   +-- trap-scope-match.ts
|   |   +-- trap-archive.ts
|   |   +-- trap-transfer.ts
|   |   +-- embedder.ts
|   |   +-- embedding-job.ts
|   |   +-- embedding-health.ts
|   |   +-- doctor.ts
|   |   +-- format.ts
|   |   +-- constants.ts
|   |
|   +-- db/                      SQLite 访问层
|   |   +-- connection.ts
|   |   +-- schema.ts
|   |   +-- queries.ts
|   |   +-- embedding-queries.ts
|   |   +-- repository.ts
|   |
|   +-- tests/                   搜索和存储行为测试
|
+-- skills/                      给 agent 使用的操作 playbook
|
+-- plugins/codetrap-agent/      Codex plugin/bundle 示例
|
+-- scripts/                     build-release / release-preflight
|
+-- docs/                        架构、计划、参考分析文档
|
+-- .codetrap/                   当前项目的本地 trap 数据库目录
|
+-- package.json                 Bun 包元信息和构建脚本
+-- tsconfig.json                TypeScript 配置
+-- bun.lock                     依赖锁文件
```

## 3. 运行时分层架构

核心原则：入口层保持薄，scope 策略集中在 `TrapStore`，cwd/repository 解析集中在 `ScopeContext`，单数据库操作集中在 `TrapRepository`，检索候选在 `SearchService`，排序和 applicability 策略集中在 `SearchPolicy`。

```text
+---------------------+        +----------------------+
| Human developer     |        | AI agent / MCP client|
+----------+----------+        +----------+-----------+
           |                              |
           v                              v
+---------------------+        +----------------------+
| CLI entry           |        | MCP entry            |
| src/index.ts        |        | src/mcp-server.ts    |
+----------+----------+        +----------+-----------+
           |                              |
           v                              v
+---------------------+        +----------------------+
| CLI adapter         |        | MCP adapter          |
| commands/router.ts  |        | mcp/server.ts        |
| workflow.ts         |        | tools/resources      |
| CommandResult       |        | return JSON text     |
+----------+----------+        +----------+-----------+
           |                              |
           +--------------+---------------+
                          |
                          v
              +----------------------+
              | TrapStore            |
              | src/lib/store.ts     |
              | project/global       |
              | scope policy         |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | ScopeContext         |
              | src/lib/scope-context|
              | cwd -> repositories  |
              +----------+-----------+
                         |
          +--------------+--------------+
          |                             |
          v                             v
+----------------------+       +----------------------+
| Project repository   |       | Global repository    |
| TrapRepository       |       | TrapRepository       |
| one SQLite database  |       | one SQLite database  |
+----------+-----------+       +----------+-----------+
           |                              |
           +--------------+---------------+
                          |
                          v
              +----------------------+
              | Single-DB services   |
              | SearchService        |
              | SearchPolicy         |
              | SQL queries          |
              | Embedding job        |
              | Schema migrations    |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | SQLite               |
              | traps.db             |
              +----------------------+
```

## 4. 模块职责

```text
+------------------------------+-----------------------------------------+
| Module                       | Responsibility                          |
+------------------------------+-----------------------------------------+
| src/domain/trap.ts           | Trap 类型、输入 schema、字段筛选        |
| src/lib/store.ts             | project/global scope 策略               |
| src/lib/scope-context.ts     | cwd/project/global DB 解析与 repository 选择 |
| src/lib/trap-operations.ts   | CLI/MCP 共享命令语义                    |
| src/lib/trap-mutation-result.ts | mutation 结果与 scope fallback 语义  |
| src/lib/output-json.ts       | CLI/MCP 共享 JSON presenter             |
| src/lib/doctor.ts            | doctor 诊断报告                         |
| src/lib/embedding-health.ts  | fresh/stale/missing 统计与 fallback 原因 |
| src/db/repository.ts         | 单个 SQLite 数据库的门面                |
| src/lib/search-service.ts    | FTS / semantic / hybrid 候选检索协调    |
| src/lib/search-policy.ts     | applicability、rerank、RRF、diagnostics |
| src/lib/search-result-card.ts | agent-facing action card 构建          |
| src/db/queries.ts            | traps 表 SQL                            |
| src/db/embedding-queries.ts  | trap_embeddings 表 SQL                  |
| src/db/schema.ts             | schema 初始化和迁移                     |
| src/lib/scope.ts             | 查找项目根目录和数据库路径              |
| src/lib/search-normalizer.ts | CJK bigram、同义词、search_text 构建    |
| src/lib/fts-query.ts         | 安全 FTS literal query 编译             |
| src/lib/trap-search-document.ts | search_text / passage / hash 派生数据 |
| src/lib/trap-json-fields.ts  | tags / path_globs / related_files 编解码 |
| src/lib/trap-codec.ts        | storage / JSON / archive / import 形状转换 |
| src/lib/trap-scope-match.ts  | path/module/owner 适用范围匹配          |
| src/lib/trap-archive.ts      | import/export 兼容与 evidence remap     |
| src/lib/embedder.ts          | EmbeddingProvider 和 JinaEmbedder       |
| src/lib/embedding-job.ts     | 批量生成 embedding                      |
| src/commands/router.ts       | CLI 薄适配和输出渲染                    |
| src/commands/workflow.ts     | CLI 命令行为                            |
| src/mcp/server.ts            | MCP tools / resources                   |
+------------------------------+-----------------------------------------+
```

## 5. 存储模型

codetrap 有两个 scope，每个 scope 都有自己的 SQLite 数据库。

```text
Project scope:
  <project-root>/.codetrap/traps.db

Global scope:
  ~/.codetrap/traps.db
```

单个 SQLite 数据库内部结构：

```text
+-------------------+
| schema_version    |
| version           |
+---------+---------+
          |
          | 控制迁移版本
          v
+-------------------+        SQLite triggers        +-------------------+
| traps             | ----------------------------> | traps_fts         |
| canonical rows    |                               | FTS5 search index |
+----+---------+----+                               +-------------------+
     |         |
     |         | traceable source metadata
     |         v
     |   +-------------------+
     |   | trap_evidence     |
     |   | source metadata   |
     |   +-------------------+
     |
     | optional cached vector
     v
+-------------------+
| trap_embeddings   |
| rebuildable cache |
+-------------------+
```

`traps` 是唯一的 canonical source of truth，主要字段如下：

```text
id
title
category
tags
scope
context
mistake
fix
search_text
before_code
after_code
severity
state_key
status
supersedes_id
valid_from
valid_until
project_path
path_globs
module
owner
hit_count
created_at
updated_at
```

关键点：

- `traps` 是原始事实表。
- `status` 支持 `active`、`superseded`、`archived` 三种 lifecycle 状态。
- `trap_evidence` 保存来源、相关文件、观察时间和备注，用于下钻解释 trap 来历。
- `path_globs`、`module`、`owner` 是 schema v5 的可选适用范围字段；为空表示 trap 对所有路径/模块/owner 生效。
- `traps_fts` 是由 `traps` 派生出来的 FTS5 索引表。
- `search_text` 是由 Trap 字段派生出来的检索文本，用于中文 bigram 和同义词扩展。
- `trap_embeddings` 是可重建缓存，不是事实来源。
- embedding 是否新鲜由 provider、model、dimensions、passage_version、passage_hash 共同决定。

## 6. CLI 数据流

例子：`codetrap search "HTTP request convention" --mode hybrid`

```text
Terminal command
      |
      v
+----------------------+
| src/index.ts         |
| reads process.argv   |
+----------+-----------+
           |
           v
+----------------------+
| commands/router.ts   |
| thin adapter          |
+----------+-----------+
           |
           v
+----------------------+
| commands/workflow.ts |
| parseArgs()          |
| cmdSearch()          |
+----------+-----------+
           |
           v
+----------------------+
| TrapStore.search()   |
| resolve scope order  |
+----------+-----------+
           |
           +--------------------------+
           |                          |
           v                          v
+----------------------+    +----------------------+
| project repo         |    | global repo          |
| if project exists    |    | always available     |
+----------+-----------+    +----------+-----------+
           |                          |
           v                          v
+----------------------+    +----------------------+
| SearchService        |    | SearchService        |
| mode: hybrid         |    | mode: hybrid         |
+----------+-----------+    +----------+-----------+
           |                          |
           v                          v
  FTS + optional semantic     FTS + optional semantic
           |                          |
           +------------+-------------+
                        |
                        v
+----------------------+
| TrapSearchResult[]   |
| grouped by scope     |
+----------+-----------+
           |
           v
+-----------------------+
| formatTrapActionCard()|
| compact search cards  |
+-----------------------+
```

补充：

- `codetrap show <id>` 找到 trap 后会调用 `store.hit(id, scope)`，增加 `hit_count`。
- MCP 的 `get_trap` 不会增加 `hit_count`；当前计数主要反映 CLI `show` 使用情况。

## 7. MCP 数据流

例子：MCP client 调用 `search_traps`。

```text
AI agent / MCP client
        |
        v
+--------------------------+
| src/mcp-server.ts        |
| starts MCP server        |
+------------+-------------+
             |
             v
+--------------------------+
| src/mcp/server.ts        |
| ListTools / CallTool     |
| ReadResource handlers    |
+------------+-------------+
             |
             v
+--------------------------+
| toolDefinitions          |
| src/mcp/tools.ts         |
| declares expected args   |
+------------+-------------+
             |
             v
+--------------------------+
| TrapStore                |
| shared core behavior     |
+------------+-------------+
             |
             v
+--------------------------+
| ScopeContext             |
| resolve cwd if provided  |
+------------+-------------+
             |
             v
+--------------------------+
| Repositories + services  |
| same core path as CLI    |
+------------+-------------+
             |
             v
+--------------------------+
| JSON text payload        |
| returned to MCP client   |
+--------------------------+
```

当前 MCP tools：

```text
search_traps
add_trap
get_trap
list_traps
update_trap
delete_trap
add_trap_evidence
archive_trap
supersede_trap
get_stats
```

当前 MCP resources：

```text
codetrap://project/recent
codetrap://global/recent
codetrap://project/top
codetrap://global/top
codetrap://project/trap/{id}
codetrap://global/trap/{id}
```

## 8. Add Trap 数据流

CLI `add --json` 和 MCP `add_trap` 最后都会进入同一条核心路径。

```text
Trap input
  title/category/scope/context/mistake/fix/tags/path_globs/module/owner/...
        |
        v
+--------------------------+
| buildTrapInput()         |
| domain/trap.ts           |
+------------+-------------+
             |
             v
+--------------------------+
| TrapStore.add()          |
| validate scope           |
| attach project_path      |
+------------+-------------+
             |
             v
+--------------------------+
| TrapRepository.add()     |
+------------+-------------+
             |
             v
+--------------------------+
| insertTrap()             |
| db/queries.ts            |
+------------+-------------+
             |
             v
+--------------------------+
| trap-codec.ts            |
| encode tags/path_globs   |
+------------+-------------+
             |
             v
+--------------------------+
| buildTrapSearchText()    |
| derived search_text      |
+------------+-------------+
             |
             v
+--------------------------+
| INSERT INTO traps        |
+------------+-------------+
             |
             v
+--------------------------+
| SQLite FTS triggers      |
| update traps_fts         |
+--------------------------+
```

## 9. Update Trap 数据流

更新 trap 时，代码会根据字段变化决定是否重建 `search_text`，以及是否删除过期 embedding。

```text
Update request
      |
      v
+--------------------------+
| pickTrapUpdate()         |
| keep allowed fields only |
+------------+-------------+
             |
             v
+--------------------------+
| TrapStore.update()       |
| select writable scope    |
+------------+-------------+
             |
             v
+--------------------------+
| trap-mutation-result.ts  |
| scope fallback result    |
+------------+-------------+
             |
             v
+--------------------------+
| TrapRepository.update()  |
+------------+-------------+
             |
             v
+--------------------------+
| updateTrap()             |
| db/queries.ts            |
+------------+-------------+
             |
             +-------------------------------+
             |                               |
             v                               v
+--------------------------+      +--------------------------+
| searchable fields changed|      | passage fields changed   |
| rebuild search_text      |      | delete stale embedding   |
+------------+-------------+      +------------+-------------+
             |                               |
             +---------------+---------------+
                             |
                             v
                  +--------------------------+
                  | UPDATE traps             |
                  | FTS triggers refresh     |
                  +--------------------------+
```

两类字段的意义：

- searchable fields：影响 FTS / 中文 bigram / 同义词检索。
- passage fields：影响 semantic embedding 的 passage 和 passage_hash。

## 10. Search 数据流

`TrapStore` 决定查哪些 scope；`SearchService` 决定在一个数据库里如何取候选；`SearchPolicy` 决定 applicability、rerank、fusion 和 diagnostics。

```text
Caller asks search(query, mode, scope?, category?, limit?)
        |
        v
+--------------------------+
| TrapStore.search()       |
| scope policy             |
+------------+-------------+
             |
             +------------------------------------------+
             |                                          |
             v                                          v
  no explicit scope                           explicit scope
             |                                          |
             v                                          v
  project first, then global                  only requested scope
             |                                          |
             +-------------------+----------------------+
                                 |
                                 v
                      +--------------------------+
                      | TrapRepository.search()  |
                      | one database only        |
                      +------------+-------------+
                                   |
                                   v
                      +--------------------------+
                      | SearchService.search()   |
                      +------------+-------------+
                                   |
            +----------------------+----------------------+
            |                      |                      |
            v                      v                      v
     mode = fts             mode = semantic         mode = hybrid
            |                      |                      |
            v                      v                      v
     FTS search             vector search           FTS + vector
            |                      |                      |
            v                      v                      v
     Trap results           Trap results            RRF fused results
                                   |
                                   v
                      +--------------------------+
                      | SearchPolicy             |
                      | path/module/owner filter |
                      | exact boosts + severity  |
                      | ranking_signals optional |
                      +--------------------------+
```

### 10.1 FTS 搜索细节

```text
Raw query
   |
   v
+--------------------------+
| normalizeQuery()         |
| CJK bigram + synonyms    |
| preserve ASCII tokens    |
+------------+-------------+
             |
             v
+--------------------------+
| prepareFTSQuery()        |
| quote terms as literals  |
| avoid FTS syntax errors  |
+------------+-------------+
             |
             v
+--------------------------+
| SQLite FTS5 MATCH        |
| traps_fts                |
+------------+-------------+
             |
             v
+--------------------------+
| JOIN traps               |
| ORDER BY rank            |
+------------+-------------+
             |
             v
+--------------------------+
| SearchPolicy             |
| applicability + rerank   |
+------------+-------------+
             |
             v
+--------------------------+
| TrapSearchResult         |
| sources: ["fts"]         |
+--------------------------+
```

### 10.2 Semantic 搜索细节

Semantic 搜索需要 embedding provider，并且数据库里要有新鲜的 trap embeddings。

```text
Raw query
   |
   v
+--------------------------+
| embed(query,             |
| "retrieval.query")       |
+------------+-------------+
             |
             v
+--------------------------+
| getAllFreshEmbeddings()  |
| filter provider/model/   |
| dimensions/passage hash  |
+------------+-------------+
             |
             v
+--------------------------+
| cosineSimilarity()       |
| query vs trap embedding  |
+------------+-------------+
             |
             v
+--------------------------+
| hard min score >= 0.3    |
+------------+-------------+
             |
             v
+--------------------------+
| sorted TrapSearchResult  |
| sources: ["semantic"]    |
+--------------------------+
```

之后同样经过 `SearchPolicy` 做 applicability 过滤、query-aware rerank 和可选 ranking signals。

### 10.3 Hybrid 搜索细节

在 `TrapStore` 层，默认搜索模式是 `hybrid`。

```text
Hybrid query
      |
      v
+--------------------------+
| Run FTS search           |
+------------+-------------+
             |
             v
+--------------------------+
| Try semantic search      |
+------------+-------------+
             |
       +-----+-------------------------------+
       |                                     |
       v                                     v
semantic available                    semantic unavailable,
and has candidates                    failed, or no candidates
       |                                     |
       v                                     v
+--------------------------+      +--------------------------+
| RRF fusion               |      | Return FTS results       |
| FTS rank + semantic rank |      | with diagnostics         |
+------------+-------------+      +--------------------------+
             |
             v
+--------------------------+
| SearchPolicy             |
| generic rerank signals   |
+------------+-------------+
             |
             v
+--------------------------+
| length normalization     |
| long context/mistake/fix |
| get mild penalty         |
+------------+-------------+
             |
             v
+--------------------------+
| final ranked results     |
| sources may include both |
+--------------------------+
```

为什么使用 RRF：

```text
FTS rank scale          cosine similarity scale
       |                          |
       +------------+-------------+
                    |
                    v
        cannot safely add directly
                    |
                    v
      use rank position instead of raw score
```

## 11. Embedding 生成数据流

普通搜索不会自动生成 embeddings。embeddings 通过 `codetrap embed` 或 `TrapStore.ensureEmbeddings()` 显式生成。

```text
codetrap embed --scope project
        |
        v
+------------------------------+
| cmdEmbed()                   |
| commands/workflow.ts         |
+--------------+---------------+
               |
               v
+------------------------------+
| TrapStore.ensureEmbeddings() |
| iterate selected scopes      |
+--------------+---------------+
               |
               v
+------------------------------+
| TrapRepository.ensureEmbeddings() |
+--------------+---------------+
               |
               v
+------------------------------+
| runEmbeddingJob()            |
+--------------+---------------+
               |
               v
+------------------------------+
| getTrapsNeedingEmbeddings()  |
| missing/stale/forced         |
+--------------+---------------+
               |
               v
+------------------------------+
| buildTrapPassage()           |
| stable text for embedding    |
+--------------+---------------+
               |
               v
+------------------------------+
| JinaEmbedder.embed()         |
| retrieval.passage            |
+--------------+---------------+
               |
               v
+------------------------------+
| upsertEmbedding()            |
| store Float32Array BLOB      |
+--------------+---------------+
               |
               v
+------------------------------+
| trap_embeddings              |
| cache row saved              |
+------------------------------+
```

embedding freshness 规则：

```text
Fresh only if all match:

provider
model
dimensions
passage_version
passage_hash
```

如果 trap 的 passage 相关字段变化，`TrapRepository.update()` 会删除旧 embedding，避免之后 semantic search 使用过期向量。

## 12. Scope 策略

Scope 策略属于 `TrapStore`，不属于 CLI、MCP、Repository 或 SearchService。

```text
Current working directory
          |
          v
+--------------------------+
| findProjectRoot(cwd)     |
| walk upward looking for  |
| .codetrap/               |
+------------+-------------+
             |
     +-------+------------------+
     |                          |
     v                          v
project root found        no project root found
     |                          |
     v                          v
project DB available      project scope unavailable
global DB available       global DB still available
```

读取策略：

```text
No explicit scope:
  1. read project scope, if available
  2. read global scope

Explicit scope:
  1. read only that scope
```

写入策略：

```text
scope = project:
  require a discovered project root

scope = global:
  write to ~/.codetrap/traps.db
```

## 13. 当前已经实现的思想架构

这一节只写当前代码已经体现出来的思想，不写尚未落地的未来产品形态。

### 13.1 Trap-first memory

codetrap 的核心记忆单位不是原始聊天记录，而是一个可复用的错误模式。

```text
Not the core unit:

  "Here is a long chat transcript..."

Core unit:

  Trap:
    context  -> 什么时候容易踩坑
    mistake  -> 常见错误做法
    fix      -> 应该怎么做
```

这个设计让记忆可行动。系统不是为了归档所有历史，而是为了在未来动手前提醒“别再这样错”。

### 13.2 Local-first storage

canonical 数据保存在本地 SQLite 文件中。

```text
+----------------------+        +----------------------+
| Project memory       |        | Global memory        |
| .codetrap/traps.db   |        | ~/.codetrap/traps.db |
+----------------------+        +----------------------+
```

远程 embedding API 是增强能力，不是基本可用性的前提。没有 `JINA_API_KEY` 时，FTS 搜索仍然可用。

### 13.3 Scope-aware memory

有些经验只适用于当前项目，有些经验可以跨项目复用。

```text
Project trap:
  "In this repo, always use src/lib/auth.ts"

Global trap:
  "Do not hand-edit generated lockfiles unless required"
```

代码把这个思想落成了 `project` 和 `global` 两种 scope，并默认 project-first、global-second。

### 13.4 Retrieval-first agent help

codetrap 不是把所有记忆一次性塞给 agent，而是在需要时检索相关 trap。

```text
Bad shape:
  load all traps -> agent context

Current shape:
  task/query -> search -> top matching traps -> act with warning
```

这让上下文更轻，也让检索质量成为系统的核心能力。

### 13.5 Thin adapters, shared core

CLI 和 MCP 是同一套核心逻辑的两个入口。

```text
CLI:
  human-friendly text

MCP:
  JSON text payloads for agents

Shared:
  CLI workflow
  TrapStore
  ScopeContext
  TrapRepository
  SearchService
  SearchPolicy
  SQLite schema
```

这个设计避免 CLI 和 MCP 慢慢变成两套分叉逻辑。

### 13.6 Search quality as core architecture

当前代码已经把搜索质量当成一等架构问题，而不是附属功能。

```text
safe FTS query compiler
        |
        v
CJK bigram and synonym normalization
        |
        v
search_text stored in SQLite
        |
        v
optional semantic embeddings
        |
        v
hybrid RRF ranking
        |
        v
generic exact-match rerank
        |
        v
evaluation tests
```

这里的核心判断是：记忆工具只有在关键时刻找得到正确记忆，才真的有用。

### 13.7 Derived data is rebuildable

代码把事实数据和派生数据分开。

```text
Canonical:
  traps table
  trap_evidence table

Derived:
  search_text
  traps_fts
  trap_embeddings
```

这让项目以后可以继续改进检索和 embedding，而不改变 trap 本身的含义。

### 13.8 Progressive disclosure

搜索默认返回 compact action card，而不是把完整 trap 和 evidence 全塞进结果。需要更多上下文时，再用 `show <id>` 或 MCP `get_trap` 下钻。

```text
search query
   |
   v
action cards
   |
   v
show/get_trap for selected result
   |
   v
full TrapDetails + evidence
```

### 13.9 Lifecycle-aware memory

trap 可以被归档或被新的 trap 取代。默认搜索只返回 `active`，历史规则仍可通过 `--status archived|superseded|all` 查询。

```text
active trap
   |
   +--> archive_trap
   |
   +--> supersede_trap -> newer trap
```

### 13.10 Scoped applicability and generic rerank

schema v5 让一条 trap 可以声明它适用的路径、模块或 owner。搜索和列表可以用 `--path`、`--module`、`--owner` 过滤，匹配的 scoped trap 会得到轻量 rerank boost。

```text
+--------------------------+
| Trap                    |
| path_globs/module/owner |
+------------+-------------+
             |
             v
+--------------------------+
| SearchPolicy             |
| applicability filter     |
| ranking_signals          |
+--------------------------+
```

排序信号保持通用：title/tag/code identifier exact match、severity、path/module/owner match。代码没有内置 ESP32、StickS3 或其他项目专用词库。

## 14. 当前没有实现的内容

下面这些不是当前 runtime 架构的一部分：

```text
team sharing
multimodal evidence
cross-encoder reranking
local embedding provider
local model cache / ONNX provider
```

其中一些想法出现在计划或参考文档中，但目前还没有形成完整代码功能。action cards、CLI JSON、doctor、repair-scope/migrate-project、embedding health、evidence/source metadata、lifecycle、supersede/archive commands、path/module/owner scoped traps、config defaults、plugin scaffold 和 release preflight 已经是当前 runtime/packaging 功能。

## 15. 最简心智模型

```text
codetrap is a local mistake-pattern index.

CLI/MCP are doors.
TrapStore decides which notebook to open.
ScopeContext resolves the right notebook for a cwd.
TrapRepository manages one notebook.
SearchService retrieves possible matches.
SearchPolicy filters and ranks them.
SQLite stores the notebooks.
Embeddings are optional index cards for semantic lookup.
```

压缩成一张图：

```text
+-------------+      +-------------+
| CLI user    |      | MCP agent   |
+------+------+      +------+------+
       |                    |
       +---------+----------+
                 |
                 v
          +-------------+
          | TrapStore   |
          | scope rules |
          +------+------+
                 |
                 v
          +-------------+
          | ScopeContext|
          | cwd -> DBs  |
          +------+------+
                 |
       +---------+----------+
       |                    |
       v                    v
+-------------+      +-------------+
| Project DB  |      | Global DB   |
| repository  |      | repository  |
+------+------+      +------+------+
       |                    |
       +---------+----------+
                 |
                 v
          +-------------+
          | Search      |
          | retrieval + |
          | policy      |
          +------+------+
                 |
                 v
          +-------------+
          | SQLite      |
          | traps.db    |
          +-------------+
```
