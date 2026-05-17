# SemTools 专项参考分析

Date: 2026-05-15

基于对 `run-llama/semtools` v3.0.0 的完整源码分析，提取对 codetrap 有帮助的思想和可落地的改进。

Status: 本文是 SemTools 专项参考附录，不再作为实施路线图。可执行优先级已经归并到
`docs/codetrap-optimization-roadmap.zh-CN.md`，后续排期以主 roadmap 为准。

---

## 一、两个项目的定位差异

| 维度 | codetrap | semtools |
|---|---|---|
| 用途 | AI 编码陷阱记忆库 | 文档解析 + 语义搜索工具链 |
| 语言 | TypeScript (Bun) | Rust |
| 搜索 | SQLite FTS5 + Jina API 语义嵌入 (hybrid + RRF) | model2vec 静态本地嵌入 |
| 向量存储 | SQLite BLOB + 暴力余弦 | Qdrant Edge (嵌入式向量 DB) |
| 集成 | 原生 MCP Server + CLI + Skills | CLI only (Unix 管道) |
| 分发 | `bun build --compile` 独立二进制 | cargo + npm (预编译二进制) |
| 嵌入粒度 | 每条 trap 一个向量 | 每行文档一个向量 |

核心差异：semtools 是**通用文档搜索引擎**，codetrap 是**专用知识库**。两者不竞争，但 semtools 在几个关键设计决策上值得 codetrap 借鉴。

---

## 二、对 codetrap 有直接价值的设计

### 1. 本地静态嵌入模型（最大启发）

**semtools 的选择**：`model2vec` 静态嵌入模型（`minishlab/potion-multilingual-128M`），256 维，多语言，纯本地运行，无需 API key，无需网络。

**codetrap 的现状**：依赖 Jina AI 远程 API（`jina-embeddings-v5-text-small`，1024 维）。没有 API key 时语义搜索完全不可用，只能降级到 FTS。

**为什么 model2vec 值得关注**：

- **零外部依赖**：model2vec 是"静态嵌入"——本质是大词向量查找表 + 平均池化，没有 Transformer 层。推理速度 1-5ms，而 Jina API 往返 200-800ms
- **模型极小**：130MB，对比 bge-m3 的 2GB
- **多语言**：potion-multilingual-128M 支持中文和英文
- **SemTools 已验证**：在文档语义搜索场景中表现可用

**model2vec 的质量权衡**：

model2vec 用速度换质量。MTEB 基准上，256 维静态嵌入的质量大约是全量 Transformer 模型（如 bge-m3）的 70-80%。对于 codetrap 的陷阱搜索场景，这个质量降级需要评估——陷阱的语义匹配（"HTTP 请求有什么约定" → `fetchWrapper` 的使用规范）需要一定的语义分辨力。

**可落地的路径**：

不是直接上 model2vec，而是参考 semtools 的思想——**把嵌入模型从远程 API 迁移到本地执行**。具体方案见本文第四节。

#### 2026-05-15 本地模型选型更新

经过进一步对比，codetrap 的本地 embedding 方案不应该把 `model2vec` 等同于默认模型。SemTools 证明了静态嵌入模型的本地优先价值，但 codetrap 的默认模型还要同时考虑中文/英文混合检索质量、TypeScript/Bun 集成成本、开源 license、模型体积、下载体验和后续分发。

当前建议：

```text
默认本地 provider 候选：
  onnx-community/gte-multilingual-base

极速可选 provider：
  minishlab/potion-multilingual-128M

高质量可选 provider：
  BAAI/bge-m3
  Qwen/Qwen3-Embedding-0.6B

继续保留：
  Jina API provider
```

模型对比：

| 模型 | 类型 | 参数/体积 | 维度 | License | JS/Bun 集成 | 对 codetrap 的判断 |
|---|---|---:|---:|---|---|---|
| `onnx-community/gte-multilingual-base` | Transformer encoder ONNX | 基于 305M 参数模型 | 768 | Apache-2.0 | 好，Transformers.js 可直接跑 | **默认本地候选**：质量、体积、集成成本最平衡 |
| `minishlab/potion-multilingual-128M` | Model2Vec 静态 embedding | 约 128M / 小体积 | 256 | MIT | 一般，主要是 Python/Rust 生态 | **极速候选**：非常快，但质量低于 transformer embedding |
| `BAAI/bge-m3` | 多功能 embedding | 569M / 2.27GB | 1024 | MIT | 中等，主流是 Python/TEI | **高质量候选**：强但偏重，dense/sparse/ColBERT 对当前 codetrap 过剩 |
| `Qwen/Qwen3-Embedding-0.6B` | LLM-based embedding | 0.6B | up to 1024 | Apache-2.0 | 中等，更适合作为本地服务 | **服务型候选**：适合 TEI/Ollama/llama.cpp provider |
| `jina-embeddings-v5-text-small` 本地权重 | LLM-based embedding | 677M | 1024 | CC-BY-NC-4.0 | 中等 | **不建议默认**：质量强，但非商业 license 不适合开源工具默认分发 |

`gte-multilingual-base` 与 `potion-multilingual-128M` 的核心取舍：

| 维度 | `gte-multilingual-base` | `potion-multilingual-128M` |
|---|---|---|
| 质量 | 更好，尤其适合语义检索默认模型 | 中等偏好，主要胜在速度 |
| 速度 | 慢于静态 embedding，但对几百到几千条 trap 可接受 | 极快，适合无感 pre-flight check |
| 体积 | 中等 | 小 |
| 维度 | 768 | 256 |
| 集成 | ONNX + Transformers.js 路线更顺 | 需要 Python/Rust sidecar、WASM 或额外二进制 |
| 推荐角色 | 默认本地 provider | fast mode / optional provider |

因此，本地化路线应从“直接用 model2vec 替代 Jina”调整为：

1. 先抽象 `EmbeddingProvider` 的本地 provider 接口和模型缓存目录。
2. 第一版默认候选用 `onnx-community/gte-multilingual-base`，因为它更容易在 TypeScript/Bun 里落地，且质量更稳。
3. 同时保留 `potion-multilingual-128M` 作为极速实验 provider，用现有 search eval 比较 Recall@5。
4. 把 `BAAI/bge-m3` 和 `Qwen3-Embedding-0.6B` 放到高质量 provider 候选，不作为默认随工具下载。
5. 最终默认模型必须由 codetrap 自己的评估集决定，而不是由 MTEB 排名或模型卡描述决定。

---

### 2. Unix 管道可组合性

**semtools 的设计**：每个命令都是管道中的一环。

```bash
# semtools 的典型用法
find . -name "*.pdf" | xargs semtools parse | xargs semtools search "query"

# 也支持 stdin
cat report.md | semtools search "semantic search"
```

每个子命令读 stdin、写 stdout，不关心输入从哪来、输出到哪去。

**codetrap 的原始现状**：CLI 命令是独立终端交互，不参与管道。

```bash
codetrap search "http 请求约定" --mode hybrid
```

输出是格式化的终端文本，不适合被下游工具消费。

**2026-05-17 已落地**：

- `codetrap search` 增加 `--json` 标志，输出 JSON 到 stdout。
- 当没有 positional query 且 stdin 不是终端时，从 stdin 读取查询文本。
- `search/show/list/stats --json` 使用共享 JSON presenter。
- `add/edit --json` 仍表示 JSON 输入；机器可读输出用 `--output-json`。
- 配合 `--json` + `jq` 或其他工具做后处理：

```bash
echo "认证实现模式" | codetrap search --json --limit 3 | jq '.[].title'
```

---

### 3. Workspace 增量更新模型

**semtools 的设计**：workspace 系统用 `(mtime, size, embedding_version)` 三元组做变更检测，三个状态：

```
Unchanged  → 跳过
Changed    → 重新嵌入
New        → 首次嵌入
```

Qdrant 中存两份数据：文档元数据（用于变更检测）和行嵌入（用于搜索）。两者分离，各行其责。

**codetrap 的现状**：`embedding-job.ts` 中已经有 `trapsNeedingEmbeddings()` 方法，通过 `passage_hash` 检测内容变更。逻辑上是相同的思路，但实现比较朴素。

**2026-05-17 已落地/待补**：

- 已抽出 `src/lib/embedding-health.ts`。
- `codetrap stats --json` 和 `codetrap doctor --json` 已展示 `fresh` / `stale` / `missing` 计数、provider、model、dimensions 和 passage_version。
- 待补：本地 embedding provider、模型缓存目录和离线默认 provider。

---

### 4. 集成 Agent 的系统提示设计

**semtools 的设计**：`semtools ask` 有一个精心设计的系统提示，明确指导 LLM 何时用哪个工具：

```
- Use grep for known exact patterns (function names, config keys, error codes)
- Use search for conceptual queries (ideas, topics, themes)
- Use read to get full context around a relevant match
- Cite sources with numbered references [1], [2] including file paths and line numbers
- Include a ## References section at the end
```

**codetrap 的原始现状**：MCP tools 有 description，但 Skill 文件（`skills/codetrap-check/SKILL.md`）中的指导比较笼统。没有"何时用 search_traps vs get_trap vs list_traps"的决策树。

**2026-05-17 已落地**：

`codetrap-check` / `codetrap-search` skills 已改成 CLI-first，MCP 作为 optional adapter。默认路径是：

```
codetrap search "<keywords>" --mode hybrid --json
codetrap show <id> --scope <project|global> --json
```

规则也已明确：先看 top 3 action cards；`critical` / `error` 且相关时必须下钻。

---

### 5. 配置优先级链

**semtools 的设计**：

```
CLI args > config file (~/.semtools_config.json) > env vars > built-in defaults
```

配置文件和 env vars 各司其职——API key 走 env var（安全性），行为参数走 config file（可版本化、可分享）。

**codetrap 的现状**：主要靠 env var（`JINA_API_KEY`）和 CLI args。没有配置文件支持。

**可落地的**：

目前 codetrap 配置项很少（基本只有一个 `JINA_API_KEY`），配置文件的边际收益不大。但当以下功能上线后值得做：

- 默认搜索模式（fts / semantic / hybrid）
- 默认 scope（project / global）
- 嵌入 provider 选择（jina / local / ollama）
- 结果数量默认值

格式参考 semtools 的 JSON 方案（`~/.codetrap/config.json`），比 TOML/YAML 更适合 JS 生态。

---

### 6. 特征门控的模块化架构

**semtools 的设计**：Cargo features 允许最小安装：

```toml
[features]
default = ["parse", "search", "workspace", "ask"]
parse = ["dep:reqwest", "dep:tokio", ...]
search = ["dep:model2vec-rs", "dep:simsimd"]
workspace = ["dep:qdrant-edge", ...]
ask = ["dep:async-openai", "dep:model2vec-rs", ...]
```

`cargo install semtools --no-default-features --features=search` 只装搜索功能。

**codetrap 的现状**：所有功能编译进一个二进制。当前体量下这不是问题（Bun 编译产物 ~50MB），但如果后续加入更多模型文件（如 ONNX 嵌入模型），二进制体积会膨胀。

**可落地的**：

短期不需要。但如果未来做了多个嵌入后端（Jina HTTP + Ollama HTTP + 本地 ONNX），可以考虑：

- 把 ONNX 模型文件作为可选下载，不在编译时打包
- CLI 首次使用时提示下载（类似 semtools 的模型缓存机制）

---

### 7. 双通道分发

**semtools 的设计**：

- `cargo install semtools`（Rust 原生用户）
- `npm i -g @llamaindex/semtools`（JS/Node 生态用户）
- npm 包通过 `scripts/install.js` 下载预编译二进制，自动检测平台和架构

**codetrap 的现状**：目前只有源码构建（`bun build --compile`）。没有发布到任何 registry。

**可落地的**：

当 codetrap 准备对外发布时，可以参考 semtools 的分发策略：
- npm 包发布 `codetrap`，`postinstall` 脚本下载对应平台的预编译二进制
- 或者直接用 Bun 的 `bun build --compile --target` 交叉编译多平台二进制，发布 GitHub Releases
- 考虑到 codetrap 的目标用户是 AI 开发者（通常有 Node/Bun 环境），npm 分发是阻力最小的路径

---

## 三、对 codetrap 不适用或不需要的设计

以下 semtools 的特性与 codetrap 的场景不匹配，明确不跟：

| semtools 特性 | 为什么不适用于 codetrap |
|---|---|
| LlamaParse 文档解析 | codetrap 不处理文档，陷阱条目是人工录入的结构化 JSON |
| 逐行嵌入（每行一个向量） | codetrap 的粒度是陷阱条目，不是文档行。一个 trap 几百字，不需要行级嵌入 |
| Qdrant Edge 向量数据库 | codetrap 的向量量级（几百到几千条）用 SQLite BLOB + 暴力余弦完全够用，ANN 索引是过度设计 |
| Grep 工具 | codetrap 不需要对文档做正则搜索 |
| Rust 重写 | codetrap 的核心价值在 MCP 集成和数据模型，Bun/TypeScript 完全胜任。Rust 的性能优势对当前场景不是瓶颈 |

---

## 四、已归并到主 roadmap 的结论

SemTools 相关行动项已经收敛到 `docs/codetrap-optimization-roadmap.zh-CN.md`：

| SemTools 启发 | 主 roadmap 归属 |
|---|---|
| `--json` + stdin + stdout 机器输出 | Phase 1: CLI JSON 成为稳定契约 |
| AGENTS/skill 工具选择协议 | Phase 2: CLI-first Agent 使用协议 |
| embedding fresh/stale/missing 状态 | Phase 6: Embedding 健康度显式化 |
| 本地 embedding provider 候选 | Phase 6: 本地 embedding 与离线体验 |
| 配置优先级链 | Phase 8: 配置文件 |
| npm / 预编译二进制 / onboarding | Phase 8: Hooks、plugin/bundle 与 onboarding |

本文件只保留 SemTools 的来源分析、模型取舍和“不该照搬”的判断，避免和主 roadmap 形成两套排期。

---

## 五、总结

SemTools 给 codetrap 最大的启发不是某一个具体技术，而是**"本地优先"的彻底性**：

- 嵌入模型本地执行，不依赖外部 API
- 管道组合让 CLI 融入更大的工具生态
- Workspace 持久化让重复操作零成本
- 静态嵌入模型证明"够快够好"比"最好但慢"更实用

对于 codetrap 而言，从 semtools 学到的最重要一课是：**语义搜索不一定要靠远程 API**。一个 130MB 的本地静态模型可以在 1-5ms 内完成嵌入，质量虽然不如全量 Transformer，但对陷阱搜索场景大概率够用。

2026-05-15 的进一步判断是：**默认本地模型不必绑定 SemTools 的 model2vec 选择**。对 codetrap 来说，更稳的路线是先用 `onnx-community/gte-multilingual-base` 作为默认本地 provider 候选，再用 `minishlab/potion-multilingual-128M` 做极速 provider 对照实验。

无论最终选哪个模型，目标都不变：把语义搜索从"依赖外部 API"变成"纯本地能力"，但默认体验必须先保证查得准。具体实施顺序见主 roadmap。
