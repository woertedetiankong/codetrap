# codetrap 检索增强开发计划

## Context

codetrap 当前只有 SQLite FTS5 关键词搜索，存在四个阻塞性问题：

1. **FTS5 查询语法不安全** — `MATCH ?` 已经避免 SQL 注入，但用户输入仍会被 FTS5 当 query language 解析，特殊字符、未闭合引号、`-term` 等会导致运行时崩溃
2. **中文搜索不工作** — 默认 `unicode61` tokenizer 会把连续 CJK 文本当成一个 token，搜 `"网络请求"` 很难命中 `"网络请求超时"` 这类 trap
3. **无语义搜索** — 纯关键词匹配，OBLIQ-Bench 已证明这种模式在 oblique query 场景接近零分
4. **排序不可评估** — 当前没有 gold trap IDs 和 Recall@5 这类评估基线，排序改动无法判断是变好还是变坏

目标：搜索安全加固 + 中文/混合语言搜索 + 评估集 + 语义搜索 + 混合排序。6 个 Phase，依赖顺序推进。

## Architecture Guardrails

本计划必须保持当前项目已有的 Module locality：

- `TrapRepository` 仍然只负责**单数据库** trap 操作。
- `TrapStore` 仍然负责 project/global scope policy：默认先 project 后 global，显式 `scope` 只读一个数据库。
- `SearchService` 是单数据库 Search Module。它可以在一个数据库内做 FTS、semantic、hybrid、RRF，但不能知道 project/global，也不能替代 `TrapStore` 的 scope policy。
- CLI 和 MCP 仍然是薄 Adapter：解析输入、调用 `TrapStore`、渲染输出。检索逻辑不能散落到 adapter 里。
- 远程 embedding provider 缺席时，默认搜索路径必须仍然可用；hybrid 可以降级到 FTS，显式 semantic 模式才报清晰错误。

## 修改文件清单

| 操作 | 文件 | 改什么 |
|------|------|--------|
| **NEW** | `src/lib/fts-query.ts` | `prepareFTSQuery()` — 默认把用户输入编译成 literal FTS query，不暴露 FTS 操作符 |
| **NEW** | `src/lib/search-normalizer.ts` | CJK bigram 分词 + 小型同义词映射 + `buildSearchText` / `normalizeQuery` |
| **NEW** | `src/lib/search-service.ts` | 单数据库 Search Module：FTS/semantic/hybrid/RRF/length normalization |
| **NEW** | `src/lib/embedder.ts` | `EmbeddingProvider` Interface、`JinaEmbedder` Adapter、passage builder、向量编码、余弦相似度 |
| **NEW** | `src/tests/search-safety.test.ts` | FTS5 安全查询和 CLI 参数解析测试 |
| **NEW** | `src/tests/search-normalizer.test.ts` | CJK bigram、同义词、search_text 构建测试 |
| **NEW** | `src/tests/search-chinese.test.ts` | 中文/混合语言搜索测试 |
| **NEW** | `src/tests/search-eval.test.ts` | 检索评估集 runner，按 Phase gate 验证 Recall@5 |
| **NEW** | `src/tests/search-semantic.test.ts` | mock embedding provider 的语义/混合搜索测试；真实 Jina 测试有 API key 才跑 |
| **NEW** | `src/tests/fixtures/search-eval.json` | 15 条标注查询：exact、中文、混合、semantic、oblique |
| **MODIFY** | `src/db/connection.ts` | 加 `PRAGMA busy_timeout=5000` |
| **MODIFY** | `src/db/schema.ts` | v2 迁移（`search_text` + 重建 FTS5），v3 迁移（`trap_embeddings` + freshness metadata） |
| **MODIFY** | `src/db/queries.ts` | insert/update 计算 `search_text`；FTS search 使用 safe compiled query；新增 embedding CRUD |
| **MODIFY** | `src/db/repository.ts` | `search()` 通过单库 `SearchService`；新增 embedding CRUD 方法 |
| **MODIFY** | `src/domain/trap.ts` | `Trap.search_text`；`TrapSearchResult.sources` / `score` |
| **MODIFY** | `src/lib/constants.ts` | `SCHEMA_VERSION` 1 -> 3 |
| **MODIFY** | `src/lib/store.ts` | `search()` 变 async + `mode`；保留 scope policy；新增 `ensureEmbeddings()` |
| **MODIFY** | `src/mcp/tools.ts` | `search_traps` 增加 `mode` 参数 |
| **MODIFY** | `src/mcp/server.ts` | `search_traps` handler `await store.search()` 并返回 `sources` / `score` |
| **MODIFY** | `src/commands/router.ts` | 重构参数解析；`cmdSearch` 变 async；新增 `cmdEmbed` |
| **MODIFY** | `src/index.ts` | `run()` 变 async；help 文本加 `--mode` 和 `embed` |

## 实施顺序（6 个 Phase）

### Phase 0: Safety + Args Parser + Eval Baseline

**目标定位**：先保证搜索不会崩，并建立排序改动的判断尺。此 Phase 不改 schema。

- 新增 `src/lib/fts-query.ts`:
  - `prepareFTSQuery(query)` 默认把输入当 literal text，不保留 `AND` / `OR` / `NOT` / `NEAR` 等 FTS 操作符
  - 按空白切分 term；每个 term 用双引号包裹；内部 `"` 转义为 `""`
  - 空白查询返回空字符串，由 `searchTraps()` 直接返回空结果
  - 未来如需高级 FTS query，另开显式 `advanced` mode，不扩大默认 Interface
- 修改 `src/db/queries.ts`:
  - `searchTraps()` 只接收 `prepareFTSQuery()` 的输出传给 `MATCH`
  - FTS5 syntax error 不应冒泡到 CLI/MCP；安全测试覆盖 `*`、`(`、`)`、`/`、`-`、`"`、`~`
- 修改 `src/db/connection.ts`:
  - `configureDatabase()` 加 `PRAGMA busy_timeout=5000`
- 修改 `src/commands/router.ts`:
  - 重构 `parseArgs()`，返回 `{ opts, positionals }`
  - flag value 不再进入 query，例如 `search "HTTP 请求约定" --mode hybrid` 的 query 必须只有 `HTTP 请求约定`
- 新增 `src/tests/fixtures/search-eval.json`:
  - 至少 15 条 query，分成 `exact`、`chinese`、`mixed`、`semantic`、`oblique`
  - 每条记录包含 `query`、`mode`、`goldTrapIds`、`phaseGate`、`minRecallAt5`
- 新增 `src/tests/search-eval.test.ts`:
  - Phase 0 只 gate `exact` 和 safety 类查询
  - 后续 Phase 逐步打开 `chinese`、`mixed`、`semantic`、`oblique`

### Phase 1: 中文搜索（Schema v1 -> v2）

**目标定位**：解决“中文搜中文 trap”这个核心场景。跨语言搜索（中文搜英文 trap / 英文搜中文 trap）主要留给 Phase 4 的 semantic/hybrid。

**两种机制、两种性质**：

| 机制 | 性质 | 覆盖范围 |
|---|---|---|
| CJK bigram 分词 | **自动的**，纯统计算法 | 所有中文字符，无上限 |
| 同义词映射 | **硬编码**，仅 5-8 组高频术语 | 请求 -> http/fetch/axios, 认证 -> auth/login, 数据库 -> db/sql, 配置 -> config/env, 缓存 -> cache/redis |

同义词映射是过渡补丁，不是核心机制。它只在 semantic search 上线前，让最高频的混合语言查询不至于完全失效。不应该持续膨胀；每加一个词都是在推迟正解。

- 新增 `src/lib/search-normalizer.ts`:
  - `bigramCJK()`: `"网络请求"` -> `["网络", "络请", "请求"]`
  - 同义词映射表严格控制在 5-8 组，只保留编码领域最高频术语
  - `buildSearchText(fields)`: 合并 `title/context/mistake/fix/tags/before_code/after_code` -> CJK bigram + 英文原文 token + 同义词展开 -> 去重 -> 空格拼接
  - `normalizeQuery(query)`: 对查询做同样处理；英文原始 token 必须保留
- 修改 `src/db/schema.ts`: v2 迁移
  1. `ALTER TABLE traps ADD COLUMN search_text TEXT NOT NULL DEFAULT ''`
  2. 遍历已有行，用 `buildSearchText()` 回填 `search_text`
  3. DROP FTS5 table + triggers
  4. 重建 FTS5，包含 `title, context, mistake, fix, tags, search_text`
  5. 重建 insert/update/delete triggers
  6. `INSERT INTO traps_fts ... SELECT ... FROM traps` 重建索引
- 修改 `src/db/queries.ts`:
  - `insertTrap()` 写入 `search_text`
  - `updateTrap()` 在任一 searchable field 变化时先读取现有 trap，合并 partial update，再重算 `search_text`
  - `searchTraps()` 用 `normalizeQuery(query)` 后的输出进入 `prepareFTSQuery()`
- 修改 `src/domain/trap.ts`:
  - `Trap` 加 `search_text`
- 新增测试：
  - `src/tests/search-normalizer.test.ts`
  - `src/tests/search-chinese.test.ts`
  - `src/tests/search-eval.test.ts` 打开 `chinese` / `mixed` Phase gate

**Phase 1 不做的事**：

- 不做大型词典，不接 ICU/jieba
- 不让同义词表超过 8 组
- 不追求跨语言搜索的完整覆盖；那是 semantic/hybrid 的职责

### Phase 2: Search Module Seam + Async Plumbing

**目标定位**：把检索复杂度集中到一个深 Module，同时保持 project/global scope policy 在 `TrapStore`。

- 新增 `src/lib/search-service.ts`:
  - `SearchService` 是**单数据库** Module
  - Interface: `search(query, opts: { mode, category, scope, limit }): Promise<TrapSearchResult[]>`
  - `ftsSearch()` 封装 Phase 0/1 的 FTS query preparation + normalized query
  - `semanticSearch()` / `hybridSearch()` 先返回明确的 unavailable 状态或空实现，Phase 4 再完成
  - 不接收 `projectRoot`，不遍历 global/project，不决定 scope 顺序
- 修改 `src/db/repository.ts`:
  - `TrapRepository.search()` 委托给本数据库对应的 `SearchService`
  - `TrapRepository` 仍然是单数据库 Adapter
- 修改 `src/lib/store.ts`:
  - `search()` 变 async
  - 继续通过 `repositoriesForRead()` 执行 project-first/global-second policy
  - 将 `mode` 透传到每个 repository
- 修改 adapters：
  - `src/commands/router.ts`: `run()` / `cmdSearch()` 变 async
  - `src/index.ts`: await `run()`
  - `src/mcp/server.ts`: `await store.search()`
- 默认 `mode` 暂时仍是 `fts`，直到 Phase 4 完成 hybrid fallback。

### Phase 3: Embedding 存储 + Provider（Schema v2 -> v3）

**目标定位**：把 embeddings 当成可重建的派生数据缓存，并明确 freshness 规则。

- 修改 `src/lib/constants.ts`:
  - `SCHEMA_VERSION` 2 -> 3
- 修改 `src/db/schema.ts`: v3 迁移
  - 创建 `trap_embeddings`：

    ```sql
    CREATE TABLE trap_embeddings (
      trap_id INTEGER PRIMARY KEY REFERENCES traps(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      passage_version INTEGER NOT NULL,
      passage_hash TEXT NOT NULL,
      embedding BLOB NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    ```

- 新增 `src/lib/embedder.ts`:
  - `EmbeddingProvider` Interface: `embed(texts: string[], task: "retrieval.query" | "retrieval.passage"): Promise<Float32Array[]>`
  - `JinaEmbedder` Adapter:
    - model: `jina-embeddings-v5-text-small`
    - dimensions: 1024
    - task: `retrieval.query` / `retrieval.passage`
    - 读取 `JINA_API_KEY`
  - `buildPassage(trap)`: 稳定拼接 trap 字段作为 passage 输入
  - `PASSAGE_VERSION`: passage 拼接规则变化时递增
  - `hashPassage(passage)`: freshness 判断
  - `encodeEmbedding()` / `decodeEmbedding()`: `Float32Array` <-> SQLite BLOB
  - `cosineSimilarity(a, b)`: 纯 JS 余弦计算
- 修改 `src/db/queries.ts` / `src/db/repository.ts`:
  - `getEmbedding(trapId)`
  - `upsertEmbedding(record)`
  - `deleteEmbedding(trapId)`
  - `getAllFreshEmbeddings({ provider, model, dimensions, passageVersion })`
  - `getTrapsNeedingEmbeddings({ provider, model, dimensions, passageVersion })`: 无 embedding、model/dimensions 不匹配、`passage_hash` 过期都算 stale
  - `updateTrap()` 如果 passage 相关字段变化，删除该 trap 的 embedding；`deleteTrap()` 依赖 FK cascade 清理 embedding
- 修改 `src/lib/store.ts`:
  - `ensureEmbeddings(opts)` 遍历对应 scope 的 repositories
  - 支持 `limit`、`force`、`scope`
  - provider 不可用时返回清晰错误，不影响普通 FTS search
- 新增 `src/tests/search-semantic.test.ts`:
  - 使用 mock provider 验证 BLOB 编码、freshness、stale 识别

### Phase 4: Semantic Search + RRF Hybrid

**目标定位**：上线 semantic search 和 hybrid ranking，同时保证无 API key / 无 embeddings 时可降级。

- 修改 `src/lib/search-service.ts`:
  - `semanticSearch()`:
    - embed query with `retrieval.query`
    - 取 fresh embeddings
    - 暴力余弦
    - semantic candidates 低于 hard min score `0.3` 直接过滤
    - 返回 `sources: ["semantic"]` 和 `score`
  - `hybridSearch()`:
    - 先跑 `ftsSearch()`
    - 尝试跑 `semanticSearch()`
    - provider 缺失、API 失败、无 fresh embeddings 时降级返回 FTS results
    - 成功时用 RRF 融合
  - `rrfFuse()`:
    - `score(d) = sum(1 / (k + rank_i(d)))`，`k = 60`
    - 合并 `sources`
    - 在 RRF 后做 length normalization：`context + mistake + fix` 超过 500 chars 逐步惩罚
    - hybrid 保留 exact FTS hit；hard min score 只过滤 semantic candidates
- 修改 `src/domain/trap.ts`:
  - `TrapSearchResult` 加：

    ```ts
    sources?: ("fts" | "semantic")[];
    score?: number;
    ```

- 修改 `src/lib/store.ts`:
  - 默认 `mode` 改为 `hybrid`
  - hybrid 自动降级到 FTS；显式 `mode=semantic` 在 provider 不可用时抛清晰错误
- 新增/更新测试：
  - mock provider 下的 semantic top-k
  - hybrid RRF 融合
  - provider 缺失时 hybrid fallback
  - `src/tests/search-eval.test.ts` 打开 `semantic` / `oblique` Phase gate

### Phase 5: CLI Embed + MCP 接线

**目标定位**：让用户和 MCP client 真正使用新的检索路径。

- 修改 `src/commands/router.ts`:
  - 新增 `cmdEmbed()`:
    - `codetrap embed [--scope project|global] [--limit N] [--force]`
    - 显示生成数量、跳过数量、stale 数量、错误原因
  - `cmdSearch()` 支持：
    - `--mode fts|semantic|hybrid`
    - `--limit`
    - `--scope`
    - `--category`
- 修改 `src/index.ts`:
  - `run()` 变 async
  - help 文本加 `embed` 和 `search --mode`
- 修改 `src/mcp/tools.ts`:
  - `search_traps` tool schema 增加 `mode`
- 修改 `src/mcp/server.ts`:
  - `search_traps` await async search
  - 返回每条 trap 的 `sources` / `score`
  - 显式 semantic 错误以 MCP error 返回；hybrid fallback 不报错

## 关键设计决策

1. **FTS query 默认 literal，不暴露 FTS 操作符** — 这是最小 Interface。高级查询以后可以单独做显式 mode。
2. **评估集先于排序改动** — 没有 gold trap IDs 和 Recall@5，任何 RRF/semantic 调参都只是体感。
3. **中文分词用应用层 bigram，不用 SQLite ICU tokenizer** — bigram 简单、跨平台无依赖、对短查询足够。
4. **同义词映射是过渡方案，严格控制在 5-8 组** — 大量同义词会增加索引膨胀和噪音，跨语言搜索的正解是 embedding。
5. **`SearchService` 是单数据库 Search Module** — 它提供检索 leverage；`TrapStore` 保留 project/global locality。
6. **`search_text` 存在数据库而非纯应用层后过滤** — FTS5 的 BM25 排序直接在预分词文本上运行，比后过滤效果好。
7. **embeddings 是可重建缓存，必须带 freshness metadata** — `provider/model/dimensions/passage_version/passage_hash` 缺一不可。
8. **RRF 融合而非加权求和** — FTS5 rank 和余弦相似度尺度不同，RRF 只需要 rank 位置。
9. **远程 embedding API 先于本地 ONNX** — 保持 Bun 独立二进制路线；无 API key 时默认搜索仍可用。
10. **`search()` 统一 async** — FTS 内部仍然同步，但 public Interface async，避免 Phase 4 再次扩散改动。

## 验证方法

```bash
# 1. 类型检查
bunx tsc --noEmit

# 2. 单元测试
bun test src/tests/

# 3. 检索评估集
bun test src/tests/search-eval.test.ts

# 4. FTS5 安全检查：不应崩溃
bun run src/index.ts search "*test (query) -bad"

# 5. CLI 参数解析检查：hybrid 不应进入 query 文本
bun run src/index.ts search "HTTP 请求约定" --mode hybrid

# 6. 中文搜索检查
bun run src/index.ts search "网络请求超时" --mode fts

# 7. 生成 embeddings（需要 JINA_API_KEY）
JINA_API_KEY=... bun run src/index.ts embed --scope project

# 8. 语义/混合搜索（无 JINA_API_KEY 时 hybrid 应降级到 FTS）
bun run src/index.ts search "这个项目 HTTP 请求有什么约定" --mode hybrid

# 9. MCP 工具测试
# 启动 MCP 服务器后，调用 search_traps 验证 async 路径和 mode 参数
bun run src/mcp-server.ts
```
