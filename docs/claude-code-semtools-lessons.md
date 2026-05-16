# Claude Code 与 SemTools 对 codetrap 的启发

Date: 2026-05-15

本文综合两类参考：

- Claude Code 官方博客：[How Claude Code works in large codebases: Best practices and where to start](https://claude.com/blog/how-claude-code-works-in-large-codebases-best-practices-and-where-to-start)
- SemTools 开源项目：[run-llama/semtools](https://github.com/run-llama/semtools)

相关专项文档：

- `docs/semtools-analysis.md`：SemTools 源码和实现细节专项分析
- `docs/tencentdb-agent-memory-lessons.md`：Agent memory 渐进式披露和证据下钻专项分析
- `docs/reference-analysis.md`：早期检索、记忆、rerank 参考资料分析

## 文档归属决策

这篇内容不直接写进 `docs/semtools-analysis.md`，而是单独成文。

原因是 `semtools-analysis.md` 已经是一个清晰的 SemTools 专项分析文档，重点是本地嵌入、workspace、Unix 管道、配置和分发。Claude Code 这篇博客提供的是另一层视角：大型代码库里的 agent harness 应该怎么搭建，`CLAUDE.md`、hooks、skills、plugins、MCP、LSP、subagents 分别承担什么角色。

因此更好的拆分是：

```text
docs/semtools-analysis.md
  -> SemTools 作为搜索工具链的实现参考

docs/claude-code-semtools-lessons.md
  -> Claude Code 方法论 + SemTools 工程实践，对 codetrap 路线的综合影响
```

一句话结论：

> codetrap 不应该变成通用代码库 RAG 或文档搜索引擎；它应该成为 AI coding harness 里的“陷阱记忆层”，在 agent 动手前提醒历史错误，在 agent 完成后沉淀新经验。

## 一、对 codetrap 定位的影响

Claude Code 博客的关键判断是：在大型代码库里，优秀的 coding agent 不是主要依赖预先构建的全量 embedding index，而是像工程师一样在本地活代码库中读文件、grep、跟引用、用 LSP 导航。全量索引容易过期，特别是在多人高频提交的代码库中，索引结果可能指向已经重命名或删除的代码。

这对 codetrap 很重要。codetrap 的目标不应该是“帮 agent 理解整个代码库”，因为这件事应该交给：

- 文件系统读取
- `rg` / grep
- LSP symbol navigation
- 测试和类型检查
- 代码库自己的 `CLAUDE.md` / `AGENTS.md`

codetrap 的目标应该更窄、更硬：

```text
Live codebase navigation
  -> 当前代码现在是什么样

codetrap
  -> 这个项目过去踩过哪些坑
  -> 哪些错误模式不应该再发生
  -> 当新坑出现时如何沉淀成可检索经验
```

也就是说，codetrap 是“经验防错层”，不是“代码理解层”。

## 二、从 Claude Code 博客学到的思想

### 1. Harness 比单个模型更重要

博客把大型代码库中的 Claude Code 能力拆成多个 extension point：

| 组件 | 对 codetrap 的启发 |
|---|---|
| `CLAUDE.md` / context files | 放稳定、全局、低噪音的规则和入口说明 |
| Hooks | 在任务开始/结束时自动检查或沉淀 trap |
| Skills | 把“什么时候查 trap、怎么用 trap”做成按需加载的工作流 |
| Plugins | 把 MCP、skills、hooks、配置打包分发 |
| MCP servers | codetrap 当前最核心的 agent 集成方式 |
| LSP | codetrap 不要替代 symbol navigation |
| Subagents | 可用于探索某个模块的历史坑，再把结论交给主 agent |

codetrap 已经有 MCP server 和 skills，这是很好的方向。后续不是单纯加更多字段，而是把它产品化成一个完整 harness：

```text
codetrap MCP
  + codetrap-check skill
  + codetrap-add skill
  + hook 示例
  + 推荐 AGENTS.md / CLAUDE.md 片段
  + install / doctor / onboarding
```

### 2. 上下文要分层，不要全量加载

博客强调 root context 应该保持精简，子目录 context 才放局部约定。对应到 codetrap：

当前 scope 只有：

```text
project
global
```

后续可以增加更细的适用范围：

```text
path_globs: ["src/db/**", "src/mcp/**"]
module: "db" | "mcp" | "cli" | "search"
owner: "platform" | "infra" | "frontend"
```

这样 agent 在改 `src/db/**` 时优先看到数据库相关 trap，而不是被全项目所有 trap 干扰。

### 3. 自我改进要发生在上下文还新鲜的时候

博客提到 hooks 的价值不只是“阻止错误”，还可以在 session 结束时回顾刚发生的事情，提出 context 或 skill 更新建议。

映射到 codetrap，最自然的是 post-flight trap capture：

```text
任务结束
  -> 如果出现测试失败、review 修正、用户纠错、反复尝试
  -> hook 或 skill 询问：这是不是值得记录的 trap？
  -> 调用 add_trap
  -> 下次类似任务前 search_traps 能命中
```

短期不建议完全自动写入 trap。更好的体验是：agent 自动提出候选 trap，由用户确认或让 agent 补全结构化字段。

### 4. MCP 适合暴露结构化内部工具

博客认为 MCP servers 适合把内部工具、数据源、API 变成 agent 可直接调用的工具。codetrap 当前的 MCP 方向非常正确，因为 trap 数据不是普通文档，应该通过结构化工具访问：

```text
search_traps
  -> 发现可能相关的坑

get_trap
  -> 下钻完整 context / mistake / fix / before-after

add_trap
  -> 沉淀新坑

get_stats
  -> 看记忆库健康度
```

后续应该把工具说明写得更像“决策协议”，而不是只描述输入输出。

### 5. 不要把大型代码库问题误解成“索引问题”

Claude Code 博客明确提醒：全量 RAG index 在高变更代码库里可能过期。codetrap 后续开发要避开一个诱惑：把项目代码也全部切片、embedding、塞进 codetrap。

codetrap 应该保存的是稳定经验：

- “不要绕过 auth middleware”
- “schema 改动必须走 migration”
- “MCP 返回值要保持 JSON text payload”
- “混合搜索没有 fresh embeddings 时必须降级到 FTS”

它不应该保存的是短期代码事实：

- 当前某个函数定义在哪一行
- 某个接口当前有哪些参数
- 某个文件最新实现细节

这些事实由 live code navigation 解决。

## 三、从 SemTools 学到的思想

### 1. 本地优先的语义搜索

SemTools 的 `search` 和 `workspace` 是 local-only，默认使用 `model2vec` 静态多语言 embedding。这个选择对 codetrap 的启发非常直接：

> 语义搜索不一定必须依赖远程 API。

codetrap 现在的语义搜索依赖 `JINA_API_KEY`。没有 API key 时，semantic/hybrid 只能降级到 FTS。对一个本地优先的 coding 工具来说，这会削弱默认体验。

建议路线不是立刻替换 Jina，而是把 provider 做成可选：

```text
jina
  -> 高质量远程 provider，适合联网和质量优先场景

local
  -> 本地 provider，适合默认离线体验

ollama 或其他 local server
  -> 适合已有本地模型服务的用户
```

落地时必须用现有 `src/tests/search-eval.test.ts` 的 Recall@5 思路做评估，不能只凭感觉切换模型。

### 2. Unix-friendly CLI 是 agent-friendly CLI

SemTools 很重视 stdin/stdout、管道和 `--json`。这点对 codetrap 非常值得借鉴。

当前 codetrap 的 CLI 更偏人类终端输出：

```bash
codetrap search "HTTP 请求约定" --mode hybrid
```

建议增加：

```bash
echo "HTTP 请求约定" | codetrap search --json --mode hybrid --limit 3
```

收益：

- agent 可以稳定解析 JSON
- shell 脚本可以组合 `jq`
- CI 或 hook 可以调用 codetrap 并根据结果做提示
- 人类输出和机器输出分离

优先级很高，改动量也小。

### 3. Workspace 增量状态值得产品化

SemTools workspace 用 `mtime + size + embedding_version` 判断文档是否需要重嵌入。codetrap 已经有类似机制：用 `passage_hash`、provider、model、dimensions、passage_version 判断 embedding 是否 fresh。

现在的问题不是能力缺失，而是状态没有显式产品化。

建议抽象成：

```ts
type EmbeddingState = "fresh" | "stale" | "missing";
```

并在 `codetrap stats` 或未来 `codetrap doctor` 中展示：

```text
Embeddings:
  fresh: 128
  stale: 4
  missing: 12
  provider: jina
  model: jina-embeddings-v5-text-small
```

这会让用户知道 hybrid search 为什么有时降级，也方便调试。

### 4. Agent prompt 要明确工具选择

SemTools 的 `ask` prompt 明确告诉 agent：

- exact string 用 grep
- conceptual query 用 semantic search
- 找到候选后用 read 看完整上下文
- 回答要引用来源

codetrap 的 `skills/codetrap-check/SKILL.md` 也应该从“提醒 agent 去查”升级成“工具选择协议”：

```text
search_traps:
  当任务是概念性、风险性、约定性问题时使用。
  例："这个项目对 HTTP 请求有什么约定？"

get_trap:
  当 search_traps 返回高相关 trap，且准备修改代码前使用。

list_traps:
  当需要浏览某类规则时使用。
  例："列出 security 相关 trap"

add_trap:
  当用户纠错、测试失败、review 指出 recurring mistake 后使用。
```

这比单纯在 MCP tool description 里写一句话更可靠。

### 5. 配置优先级链后续有价值

SemTools 使用：

```text
CLI args > config file > env vars > built-in defaults
```

codetrap 现在配置项很少，短期不必急着做配置系统。但一旦出现以下选项，就值得引入 `~/.codetrap/config.json`：

- 默认 search mode
- 默认 result limit
- 默认 embedding provider
- local model path
- rerank 开关
- project/global 默认 scope 策略

API key 仍应放 env var，行为偏好可以放 config file。

### 6. 分发体验会决定 adoption

SemTools 支持 npm 安装，并通过安装脚本下载预编译二进制，失败时 fallback 到本地构建。codetrap 目标用户大概率也是 AI coding 工具用户，npm 分发会非常自然：

```bash
npm i -g codetrap
codetrap init
codetrap serve
```

后续理想分发形态：

```text
GitHub Releases
  -> 多平台二进制

npm package
  -> 下载对应平台二进制

Codex / Claude / Cursor setup snippets
  -> 一键配置 MCP + skills
```

## 四、不应该照搬的部分

### 不做全量代码库 RAG

Claude Code 博客已经解释了大型代码库里全量 index 的 stale 风险。codetrap 不应该把源代码当成主要语料做 RAG。

### 不照搬 SemTools 的文档解析

SemTools 的 `parse` 面向 PDF、DOCX、PPTX 等文档解析。codetrap 的数据是人工或 agent 沉淀的结构化 trap，不需要 LlamaParse 或文档解析管线。

### 不做逐行 embedding

SemTools 搜索文档，所以逐行 embedding 合理。codetrap 的基本粒度是 trap，一条 trap 应该作为一个整体 passage 检索。拆成行会破坏 `context -> mistake -> fix` 的完整语义。

### 不急着引入 Qdrant Edge

SemTools workspace 用 Qdrant Edge 存 line embeddings。codetrap 的向量规模预计是几百到几千条，SQLite BLOB + 暴力余弦足够。引入独立向量库会增加安装、迁移和调试成本。

### 不重写成 Rust

SemTools 用 Rust 很适合高性能 CLI 和本地 embedding。codetrap 的核心优势在 TypeScript/Bun、MCP、skills、结构化数据模型和快速迭代。当前没有性能瓶颈需要 Rust 重写。

### 不内置完整 ask agent

SemTools 有 `ask` agent，用于问答文档集合。codetrap 不需要自己变成聊天 agent。它应该作为已有 coding agent 的工具存在。

## 五、建议路线图

### P0：马上做，提升 agent 可用性

| 事项 | 文件/模块 | 收益 |
|---|---|---|
| `codetrap search --json` | `src/commands/router.ts` | 机器可读，方便 agent/hook/脚本 |
| stdin query 支持 | `src/commands/router.ts` | 支持 Unix 管道 |
| 强化 skill 工具选择协议 | `skills/codetrap-check/SKILL.md` | 让 agent 更稳定地使用 MCP |
| search result compact action card | `src/mcp/tools.ts` / `src/lib/format.ts` | 降低上下文占用 |

### P1：近期做，完善本地优先

| 事项 | 文件/模块 | 收益 |
|---|---|---|
| 本地 embedding provider 实验 | `src/lib/embedder.ts` | 无 API key 也能 semantic/hybrid |
| 用 eval set 比较 provider | `src/tests/search-eval.test.ts` | 避免凭感觉换模型 |
| embedding 状态显式化 | `src/db/embedding-queries.ts` | 可诊断 fresh/stale/missing |
| `stats` 展示 embedding 覆盖率 | `src/commands/router.ts` | 用户知道搜索健康度 |

### P2：中期做，贴近大型代码库

| 事项 | 说明 | 收益 |
|---|---|---|
| path/module scoped traps | 给 trap 增加适用路径或模块 | 减少无关 trap 干扰 |
| post-flight capture workflow | 测试失败、用户纠错、review 后记录 trap | 形成自我改进闭环 |
| `codetrap doctor` | 检查 FTS、embedding、重复 trap、stale trap | 提升维护体验 |
| trap lifecycle | `active/superseded/archived` | 解决旧规则和新规则冲突 |

### P3：发布和组织采用

| 事项 | 说明 | 收益 |
|---|---|---|
| npm 分发 | 全局安装 codetrap 二进制 | 降低安装门槛 |
| plugin/bundle | MCP + skills + hooks + 文档片段 | 团队统一配置 |
| 配置文件 | `~/.codetrap/config.json` | 稳定个人/团队默认行为 |
| onboarding docs | Claude Code / Codex / Cursor 示例 | 降低首次使用成本 |

## 六、推荐的产品叙事

codetrap 可以这样定位：

> codetrap is a local-first pitfall memory layer for AI coding agents. It does not index your whole codebase. It remembers the mistakes your team already paid for, retrieves them before code changes, and turns new failures into future guardrails.

中文版本：

> codetrap 是 AI coding agent 的本地优先陷阱记忆层。它不索引整个代码库，而是记住团队已经踩过的坑，在 agent 动手前提醒它避开，并把新的失败沉淀成下一次的护栏。

这条叙事同时吸收了 Claude Code 博客和 SemTools 的关键思想：

- 从 Claude Code 学到：agent 需要 harness，不只是模型；活代码库应该 live navigation，不该依赖 stale index。
- 从 SemTools 学到：本地优先、Unix-friendly、可组合、可诊断的 CLI 体验会让工具真正进入日常工作流。
- codetrap 自己的独特价值：结构化 trap 数据模型 + MCP 集成 + coding pitfall 场景专用检索。

## 七、最终判断

这两个参考都对 codetrap 有帮助，但帮助层级不同：

| 参考 | 帮助类型 | 对 codetrap 的结论 |
|---|---|---|
| Claude Code 博客 | 产品定位和 agent harness 方法论 | codetrap 应该成为 harness 中的陷阱记忆层 |
| SemTools | 本地搜索、CLI、分发、配置的工程参考 | codetrap 应该补齐本地 embedding、JSON/stdin、stats、npm 分发 |

最重要的决策是：

> 不做通用 RAG，不做文档搜索，不做完整 agent。专心把“历史错误 -> 结构化 trap -> 动手前检索 -> 新错误沉淀”的闭环做顺。
