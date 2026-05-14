# codetrap 检索增强开发计划

## Context

codetrap 当前只有 SQLite FTS5 关键词搜索，存在三个阻塞性问题：
1. **FTS5 查询不安全** — 用户输入直接拼接进 MATCH，特殊字符会导致运行时崩溃
2. **中文搜索不工作** — 默认 unicode61 tokenizer 逐字切分 CJK，搜"网络请求"找不到任何结果
3. **无语义搜索** — 纯关键词匹配，OBLIQ-Bench 已证明这种模式在 oblique query 场景接近零分

目标：搜索安全加固 + 中文/混合语言搜索 + 语义搜索 + 混合排序。6 个 Phase，依赖顺序推进。

## 修改文件清单

| 操作 | 文件 | 改什么 |
|------|------|--------|
| **NEW** | `src/lib/fts-query.ts` | `prepareFTSQuery()` — FTS5 特殊字符转义 |
| **NEW** | `src/lib/search-normalizer.ts` | CJK bigram 分词 + 同义词映射 + `buildSearchText` / `normalizeQuery` |
| **NEW** | `src/lib/search-service.ts` | `SearchService` 类 — FTS/语义/混合搜索编排, RRF 融合, 余弦相似度 |
| **NEW** | `src/lib/embedder.ts` | `EmbeddingProvider` 接口, `JinaEmbedder` 实现 |
| **NEW** | `src/tests/search-safety.test.ts` | FTS5 安全查询测试 |
| **NEW** | `src/tests/search-chinese.test.ts` | 中文/混合语言搜索测试 |
| **NEW** | `src/tests/search-normalizer.test.ts` | 分词器单元测试 |
| **MODIFY** | `src/db/connection.ts` | 加 `PRAGMA busy_timeout=5000` |
| **MODIFY** | `src/db/schema.ts` | v2 迁移（加 search_text + 重建 FTS5）, v3 迁移（加 trap_embeddings 表） |
| **MODIFY** | `src/db/queries.ts` | insert/update 时计算 search_text; searchTraps 加安全查询 + 查询标准化 |
| **MODIFY** | `src/db/repository.ts` | search() 委托给 SearchService（变 async）; 加 embedding CRUD 方法 |
| **MODIFY** | `src/domain/trap.ts` | Trap 加 search_text, TrapSearchResult 加 sources |
| **MODIFY** | `src/lib/constants.ts` | SCHEMA_VERSION 1→3 |
| **MODIFY** | `src/lib/store.ts` | search() 变 async + mode 参数; 加 ensureEmbeddings() |
| **MODIFY** | `src/mcp/server.ts` | search_traps handler 加 await |
| **MODIFY** | `src/commands/router.ts` | cmdSearch 变 async; 加 cmdEmbed |

## 实施顺序（6 个 Phase）

### Phase 1: FTS5 查询安全

- 新增 `src/lib/fts-query.ts`: `prepareFTSQuery()` — FTS5 操作符(AND/OR/NOT/NEAR)保留，其余 term 用双引号包裹转义
- 新增 `src/tests/search-safety.test.ts`: 验证特殊字符(*/\()/-/"/~)不抛异常
- 修改 `src/db/connection.ts`: `configureDatabase()` 加 `PRAGMA busy_timeout=5000`
- 修改 `src/db/queries.ts`: `searchTraps()` 调用 `prepareFTSQuery(query)` 再传入 MATCH

### Phase 2: 中文搜索（Schema v1→v2）

**目标定位**：解决"中文搜中文 trap"这个核心场景。跨语言搜索（中文搜英文 trap / 英文搜中文 trap）留给 Phase 5 的语义 embedding 解决。

**两种机制、两种性质**：

| 机制 | 性质 | 覆盖范围 |
|---|---|---|
| CJK bigram 分词 | **自动的**，纯统计算法 | 所有中文字符，无上限 |
| 同义词映射 | **硬编码**，仅 5-8 组高频术语 | 请求→http/fetch/axios, 认证→auth/login, 数据库→db/sql, 配置→config/env, 缓存→cache/redis |

同义词映射是过渡补丁，不是核心机制。它只在 Phase 5 语义搜索上线前，让最高频的跨语言查询不至于完全失效。不应该持续膨胀——每加一个词都是在推迟正解（embedding）。

- 新增 `src/lib/search-normalizer.ts`:
  - `bigramCJK()`: "网络请求" → ["网络","络请","请求"]（纯算法，不依赖词典）
  - 同义词映射表：严格控制 5-8 组，只保留编码领域最高频术语
  - `buildSearchText(fields)`: 合并字段 → bigram + 保留英文原文 + 同义词展开 → 去重 → 空格拼接
  - `normalizeQuery(query)`: 对查询做同样的处理，确保查询和索引的 token 形式一致
- 修改 `src/db/schema.ts`: v2 迁移
  1. ALTER TABLE traps ADD COLUMN search_text TEXT DEFAULT ''
  2. 遍历已有行，用 buildSearchText 回填 search_text
  3. DROP FTS5 + triggers，重建 FTS5 包含 search_text 列，重建 triggers
  4. INSERT INTO traps_fts SELECT ... FROM traps 重建索引
- 修改 `src/db/queries.ts`: insert/update trap 时计算 search_text；searchTraps 将 normalized query 追加到原查询
- 修改 `src/domain/trap.ts`: Trap 接口加 search_text 字段
- 新增 `src/tests/search-normalizer.test.ts` + `src/tests/search-chinese.test.ts`

**Phase 2 不做的事**：
- 不做英→中反向同义词（英文 query → 中文 trap），因为同义词维护成本是双向的
- 不让同义词表超过 8 组，大量同义词会增加索引膨胀和噪音
- 不追求跨语言搜索的完美覆盖——这是 Phase 5 embedding 的职责

### Phase 3: Search Service 抽象层

- 新增 `src/lib/search-service.ts`: `SearchService` 类
  - `search(query, opts)` → 根据 mode 分发到 fts/semantic/hybrid
  - `ftsSearch()`: 同步，封装当前 FTS5 逻辑（含 prepareFTSQuery + normalizeQuery）
  - `semanticSearch()` / `hybridSearch()`: async，占位（Phase 5 实现）
- 修改 `src/db/repository.ts`: `search()` 委托给 SearchService，签名变 async
- 修改 `src/lib/store.ts`: `search()` 变 async
- 修改 `src/mcp/server.ts`: search_traps handler 加 await
- 修改 `src/commands/router.ts`: cmdSearch 变 async

### Phase 4: Embedding 存储 + Provider（Schema v2→v3）

- 修改 `src/lib/constants.ts`: SCHEMA_VERSION 2→3
- 修改 `src/db/schema.ts`: v3 迁移 — 创建 trap_embeddings 表（trap_id PK FK, model, dimensions, embedding BLOB, updated_at）
- 新增 `src/lib/embedder.ts`:
  - `EmbeddingProvider` 接口: `embed(texts[], task)` → `Promise<Float32Array[]>`
  - `JinaEmbedder`: model=jina-embeddings-v5-text-small, 1024维, task 支持 retrieval.query / retrieval.passage
  - `buildPassage(trap)`: 将 trap 字段拼接为 embedding 输入
  - `cosineSimilarity(a, b)`: 纯 JS 余弦计算
- 修改 `src/db/repository.ts`: 加 embedding CRUD — getEmbedding, upsertEmbedding, deleteEmbedding, getAllEmbeddings, getTrapsWithoutEmbeddings
- 修改 `src/lib/store.ts`: SearchService 构造时注入 embedder; 加 `ensureEmbeddings()` 为无 embedding 的 trap 生成向量

### Phase 5: 语义搜索 + RRF 混合融合

- 修改 `src/lib/search-service.ts`:
  - `semanticSearch()`: embed 查询 → 取所有 embedding → 暴力余弦 → hard min score (0.3) → 排序
  - `hybridSearch()`: `Promise.all([ftsSearch, semanticSearch])` → RRF 融合
  - `rrfFuse()`: `score(d) = Σ 1/(k+rank_i(d))` (k=60) → length normalization (>500 chars 惩罚) → 排序
- 修改 `src/domain/trap.ts`: TrapSearchResult 加 `sources?: ("fts"|"semantic")[]`
- 新增 `src/tests/search-semantic.test.ts`: 语义搜索测试（无 API key 时 skip）

### Phase 6: CLI embed 命令 + 全局接线

- 修改 `src/lib/store.ts`: search 加 mode 参数（fts/semantic/hybrid，默认 hybrid）；ensureEmbeddings 完成
- 修改 `src/commands/router.ts`: 加 `cmdEmbed()`,"embed" 到路由 switch
- 修改 `src/index.ts`: run() 变 async, help 文本加 embed 命令

## 关键设计决策

1. **中文分词用应用层 bigram，不用 SQLite ICU tokenizer** — bigram 实现简单、跨平台无依赖、对短查询（codetrap 的主要场景）足够。所有 CJK 文本自动处理，不依赖词典
2. **同义词映射是过渡方案，严格控制在 5-8 组** — 只覆盖最高频编码术语。跨语言搜索的正解是 Phase 5 的语义 embedding（Jina 模型支持近 100 种语言），不应在 Phase 2 过度投入
3. **search_text 存在数据库而非纯应用层处理** — FTS5 的 BM25 排序直接在预分词文本上运行，比后过滤效果好
4. **RRF 融合而非加权求和** — 不同检索器的分数尺度不同（FTS5 rank 是 BM25 分数，语义是余弦相似度），RRF 只需要 rank 位置
5. **远程 embedding API 而非本地 ONNX** — 路线图和 reference-analysis 的共识，先远程后本地
6. **search() 变 async 但 FTS 路径同步返回** — `ftsSearch()` 是同步的，但 `search()` 签名是 async 以支持语义/混合模式

## 验证方法

```bash
# 1. 类型检查
bunx tsc --noEmit

# 2. 单元测试
bun test src/tests/

# 3. FTS5 安全检查
bun run src/index.ts search "*test (query) -bad"

# 4. 中文搜索检查
bun run src/index.ts search "网络请求超时"

# 5. 语义搜索（需要 JINA_API_KEY）
bun run src/index.ts search "HTTP 请求约定" --mode hybrid

# 6. MCP 工具测试
# 启动 MCP 服务器后，调用 search_traps 验证 async 路径
bun run src/mcp-server.ts
```
