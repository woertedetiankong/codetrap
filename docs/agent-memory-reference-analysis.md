# Agent Memory 与检索参考归档

Date: 2026-05-14
Consolidated: 2026-05-17

本文归并原 `docs/reference-analysis.md` 和 `docs/tencentdb-agent-memory-lessons.md`。这些文档里的主要行动项已经落到代码或主 roadmap 中，因此本文只保留参考来源、已经吸收的设计原则和少量仍可作为后续参考的判断。

可执行优先级以 `docs/codetrap-optimization-roadmap.zh-CN.md` 为准。

## 1. 已吸收的设计原则

### 1.1 检索式记忆，而不是全文上下文

Mem0 和 TencentDB Agent Memory 的共同启发是：记忆系统不应该把所有原始内容塞进上下文，而应该先检索、再下钻。

codetrap 已采用的产品形态：

```text
search -> compact action cards -> get/show -> full trap details + evidence
```

对应实现：

- `src/lib/search-result-card.ts` 生成 agent 友好的 action card。
- `search_traps` 默认返回紧凑结果。
- `get_trap` / `show` 返回完整 trap、before/after、lifecycle 和 evidence。
- 搜索结果带 `next_action`，提示下钻到完整记录。

### 1.2 证据可追溯

TencentDB 的 refs 思想被映射成 codetrap 的 evidence 层：摘要不是黑盒，agent 可以根据 trap id 下钻到来源。

对应实现：

- `trap_evidence` 表记录 `source_type`、`source_ref`、`observed_at`、`related_files`、`note`。
- `add_trap_evidence` 支持给已有 trap 挂来源证据。
- archive import/export 会保留 evidence 并重映射 trap id。

### 1.3 Lifecycle 解决规则演化

Mem0 temporal / supersede 思想被收敛为 codetrap 的轻量 lifecycle，而不是完整 temporal reasoning 系统。

对应实现：

- `status`: `active` / `superseded` / `archived`
- `state_key`
- `supersedes_id`
- `valid_from` / `valid_until`
- `archive_trap`
- `supersede_trap`

默认搜索只返回 `active` trap；需要历史时使用 `status=all` 或显式状态筛选。

### 1.4 Hybrid search 是必要能力

OBLIQ-Bench、lerim-cli 和 lancedb-pro 的共同结论是：coding trap 查询经常是 oblique query，只靠关键词检索不够。

对应实现：

- FTS5 + derived `search_text` 支持中文 bigram、英文 token、code identifier 和同义词。
- Jina embedding provider 支持 semantic search。
- Hybrid search 使用 RRF 融合 FTS 和 semantic 结果。
- 通用 rerank 已加入 title/tag/code identifier exact match、severity、path/module/owner scope match signals；测试中持续观察 MRR。
- Semantic min score 过滤明显无关候选。
- Length normalization 防止长 trap 霸榜。
- Search eval fixtures 覆盖 exact、中文、semantic、hybrid 查询。

### 1.5 不照搬大型 memory / vector 架构

这些参考资料也明确了不该做的事：

- 不把 codetrap 变成 persona memory。
- 不 patch agent runtime。
- 不引入 Mermaid task canvas。
- 不使用 LanceDB / Qdrant Edge 作为当前默认存储。
- 不把源代码逐行 embedding。
- 不因为参考项目使用 Python/Rust 就重写 codetrap。

codetrap 的边界仍然是：SQLite + FTS5 + optional embeddings + MCP/CLI/skills 的本地优先 trap memory。

## 2. 参考来源和取舍

| 来源 | 保留的判断 | 不采用的部分 |
|---|---|---|
| Mem0 file vs database | 检索式数据库记忆优于 flat-file 全量上下文；需要 lifecycle 和冲突治理 | Mem0 SaaS/API 依赖 |
| Mem0 temporal reasoning | 用 `state_key`、`valid_from`、`valid_until` 表达规则演化 | LLM temporal enrichment、复杂 query intent 分类 |
| Jina embeddings | OpenAI-compatible embedding API 适合第一版 semantic search | 当前不需要多模态 |
| OBLIQ-Bench | trap 查询天然有隐含语义，必须评估 hybrid/semantic | 复杂 benchmark 构建流程只作参考 |
| memory-lancedb-pro | hard min score、length normalization、MMR/rerank 是有价值的 ranking 信号 | LanceDB、tier memory、自动抽取 |
| lerim-cli | SQLite + FTS + vector/RRF + index health 是接近 codetrap 的架构参考 | Python/ONNX/sqlite-vec 技术栈不直接复制 |
| TencentDB Agent Memory | progressive disclosure、refs 下钻、低上下文占用 action card | L0/L1/L2/L3 persona memory、runtime patch、多后端架构 |

## 3. 仍可作为后续参考的点

这些不是当前文档里的行动计划，只是未来改 search/ranking 时可回看的参考：

- MMR diversity：如果 top results 开始出现高度重复，可以在 hybrid 后加去重/降权。
- Reranker：当前已有轻量通用 rerank；如果 eval set 显示 top-k 召回高但排序仍差，再考虑 cross-encoder 或 LLM reranker。
- Duplicate/conflict detection：当 trap 数量上升后，`add` 时可提示相似或冲突 trap。
- Doctor/index health：scope 诊断、embedding freshness 和 hybrid fallback reason 已落到 `codetrap doctor` / `stats --json`；后续仍可补 FTS 覆盖率、重复项和冲突检测。

## 4. 当前权威文档

- 主路线图：`docs/codetrap-optimization-roadmap.zh-CN.md`
- SemTools 专项实现参考：`docs/semtools-analysis.md`
- 安装与使用：`docs/installation.md`
