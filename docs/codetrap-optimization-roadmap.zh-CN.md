# codetrap 后续优化路线图

Date: 2026-05-16
Last updated: 2026-06-05

本文记录一次真实使用 codetrap 后得到的改进方向，并归并 Claude Code 和 SemTools
相关参考对产品定位、agent harness、CLI 体验的启发。测试场景来自
`/Users/superstorm/Documents/Code/esp32/sticks3_hello`：从 4 份 StickS3
项目文档中提炼出 8 条踩坑经验，然后用 CLI 和 MCP 分别查询、迁移、验证。

结论先行：

```text
codetrap 应该变成 CLI-first 的本地知识工具。
CLI 应该成为一等 Agent API，而不是退而求其次的 fallback。
MCP 可以保留，但应降级为可选适配层。
AGENTS.md + CLI --json 应该能覆盖 agent 使用 codetrap 的主路径。
```

## 状态快照

2026-06-05 增量：

- `codetrap session capture --trap-markdown - ...` / `--trap-json ...` 已落地：agent-drafted post-flight trap 会进入 session candidate inbox，不直接写入 `traps.db`；没有 active session 时会创建并关闭一个 post-flight session。
- `src/lib/session-capture.ts` 现在负责 capture draft normalization、capture evidence、显式 note 候选提取和 merge/dedupe；`src/lib/session-candidate-document.ts` 负责 `candidate-traps.json` 的纯状态转换。
- Candidate Review Visibility + Workbench 已落地：CLI status/list、doctor、`/api/sessions` 和 Web Review 都能看到 pending candidates；Web Review 的 Accept / Accept anyway / Supersede 使用当前可见候选表单作为 accept-time edit。
- `src/lib/session-review.ts` 成为 CLI/Web 共享的 session review contract，统一 accept/reject/cleanup payload、accepted-missing trap review shape 和 transport-neutral conflict payload；CLI `next_actions` 由 `sessionCliConflictPayload` 单独添加。
- `src/web/client-review.ts` 负责 Review queue state 和 candidate draft/request normalization；`src/web/client-script.ts` 只组合 Web modules 与 DOM event wiring。
- `src/lib/embedding-runtime.ts` 已抽出 embedding provider runtime：provider selection、config/status、setup action 和 unavailable error 由一个模块负责，Jina 仍是当前唯一实际 provider。
- Agent guidance、README、install docs、release playbook、skills/plugin templates 已改成 post-flight 候选先走 `session capture`，confirmed trap 仍需要显式 accept 或用户确认后的外部来源写入。

2026-06-03 增量：

- Session Capture 候选 inbox 闭环落地，并把 capture draft normalization、candidate document mutation、session review payload contract 分别收敛到 `session-capture`、`session-candidate-document`、`session-review`。

2026-05-24 / 2026-05-26 增量：

- Session Mode v1 已完成 CLI 闭环：`session start/note/capture/status/list/show/notes/close/candidates/candidate/accept/reject/delete/prune/cleanup`。
- Session files 保存在 `.codetrap/sessions/`，作为 temporary working memory、recap 和 candidate trap 池；默认 search 仍只检索 confirmed traps。
- Candidate accept 已集中到 `SessionOperations`：接受时先应用 `--edit-json`，再做 possible conflict check、写入 `TrapOperations` / `TrapStore`、自动挂 `source_type=conversation` session evidence，并更新 candidate 状态。
- Candidate quality scorer 和 possible conflict check 已落地；存在相似 active trap 时会把 edited candidate shape 与 conflict diagnostics 写回 `candidate-traps.json`，并要求 `--accept-anyway` 或 `--supersedes <trap-id>`。
- 2026-05-26 产品决策：`session-capture.ts` 只从显式 `Title`/`Context`/`Mistake`/`Fix` 结构生成 candidate，包括 trap note、Markdown capture 或 JSON capture；raw failure/test output/review/correction 只进入 notes/recap，不再通过 fallback 模板生成候选。
- Dogfood Eval Flywheel v1 已新增 maintainer script：deterministic report 用固定 eval embedder，live report 用真实 embedding provider，record 命令把 curated query 追加到 repo fixture。
- Session command request normalization 已移入 `src/lib/command-requests.ts`，避免 `workflow.ts` 重复解析 session flags。

仍未完成：

- 本地 embedding provider、模型缓存、ONNX/local model path。
- Playbook export、learning review、staleness review、session archive/export。
- MCP session tools；当前 session mode 是 CLI-first。

截至 2026-05-17，roadmap 里的 v0.2 主线已经完成，并顺手做完除本地 embedding provider 之外的大部分 v0.3 / v0.4 架构硬化。

已完成：

- Phase 1 核心：`search/show/list/stats --json`、stdin query、CLI `next_action.command`、`add/edit --output-json`、JSON stdout 与 stderr 分层。
- Phase 2 核心：README、AGENTS 模板、`codetrap-check` / `codetrap-search` skills 已改成 CLI-first；top 3 review 规则已写入项目指导。
- Phase 3 主要项：MCP tool 已支持可选 `cwd`；CLI/MCP 共用 `src/lib/output-json.ts`；MCP tools/resources 通过 `TrapOperations` 和共享 presenter 输出 JSON。
- Phase 4：home/global `.codetrap` 不再被误判为 project root；新增 `codetrap doctor` 与 `doctor --json`；scope 回归测试覆盖 home/global、nested project、home 外项目；`repair-scope` / `migrate-project` 已支持 dry-run、`--apply`、backup 与 JSON 输出；迁移实现已收敛到 `scope-migration` + `trap-transfer` 两个深模块。
- Phase 5 部分：StickS3 8 条真实 traps/queries 已加入 `src/tests/fixtures/search-eval.json`，并在测试里锁住 Recall@3 / Recall@5。
- Phase 6 部分：embedding freshness 已产品化为 fresh/stale/missing 计数，并出现在 `stats --json` 和 `doctor --json`。
- Mutation JSON：`delete/archive/supersede/import --json` 与 `add_trap_evidence --output-json` 已提供机器可读结果。
- Ranking/MRR：测试已计算 MRR，并加入通用 title/tag/code-identifier/severity/path/module/owner rerank signals；未内置 ESP32/StickS3 专用词库。
- Path/module scoped traps：schema v5 已加入 `path_globs`、`module`、`owner`，CLI/MCP search/list 可用 `--path`、`--module`、`--owner` 过滤与加权。
- 配置文件：`~/.codetrap/config.json` 已支持 search mode/limit/scope/rerank，优先级为 CLI args > config file > env vars > built-in defaults。
- Agent harness：post-flight capture 规则已写入文档/skills，`session capture --trap-markdown -` 优先提供 candidate-inbox path，`--trap-json` 保留结构化兼容入口，`plugins/codetrap-agent` 提供 Codex plugin/bundle 示例，`release:preflight` 串联发布前 dry-run 检查。
- Session architecture：candidate draft normalization/merge、candidate document mutation、session review payload contract 已分别收敛到 `session-capture`、`session-candidate-document`、`session-review`；Web Review draft/request normalization 已收敛到 `client-review`，CLI conflict next actions 与 Web/API neutral payload 已分离。
- Embedding architecture：provider selection/status/setup action 已收敛到 `embedding-runtime`，为后续 local provider 留出接口。
- MCP resources：resource URI 已支持 `?cwd=`，静态 URI 仍兼容 server 启动 cwd。

仍未完成：

- 本地 embedding provider 尚未做；当前仍是 Jina 可选 provider + 无 key 时 hybrid fallback 到 FTS。
- 本地模型缓存、ONNX/local model path、离线默认 embedding provider 尚未做。

## 0. 参考来源与定位修正

这份 roadmap 吸收了几类参考，但只保留对 codetrap 产品方向有直接影响的结论：

- Claude Code 大型代码库实践：coding agent 应该通过 live code navigation 理解当前代码，包括文件读取、`rg`、LSP、测试和类型检查。不要把高变更代码库误解成“只要预先建一个全量 RAG index 就能解决”的问题。
- SemTools 工程实践：local-first、Unix-friendly、`stdin/stdout`、`--json`、可诊断状态和低摩擦分发，会决定一个 agent 工具能不能进入日常工作流。
- Agent memory 参考：默认上下文应该是紧凑 action card，低层证据和完整记录按需下钻，避免一次性把所有信息塞给 agent。

专项分析仍保留在独立文档中：

- `docs/semtools-analysis.md`：SemTools 源码和实现细节。
- `docs/agent-memory-reference-analysis.md`：已实现的 agent memory、检索、lifecycle、证据下钻参考归档。

因此 codetrap 的产品定位是：

```text
codetrap is a local-first pitfall memory layer for AI coding agents.
It does not index your whole codebase.
It remembers the mistakes your team already paid for,
retrieves them before code changes,
and turns new failures into future guardrails.
```

中文版本：

```text
codetrap 是 AI coding agent 的本地优先陷阱记忆层。
它不索引整个代码库，而是记住团队已经踩过的坑，
在 agent 动手前提醒它避开，
并把新的失败沉淀成下一次的护栏。
```

明确不做：

- 不做通用代码库 RAG。
- 不做文档搜索引擎。
- 不把源代码逐行 embedding 进 codetrap。
- 不内置完整 ask/chat agent。
- 不为了性能焦虑重写成 Rust。
- 不引入超过当前规模需要的独立向量库。

## 1. 当前观察

### 1.1 真实测试结果

用 8 条 StickS3 traps 做黑盒测试，CLI-only 表现已经足够好：

| 测试问题 | 预期命中 | 结果 |
|---|---|---|
| 从 ESP-IDF hello_world 重建 StickS3 项目 | `#1` target + 8MB Flash | 命中，但排第 2 |
| StickS3 屏幕/按键是否直接用 M5Unified | `#2` M5Unified 兼容性 | 命中，但排第 2 |
| 原生 SPI/ST7789 屏幕不亮 | `#3` PMIC I2C 开电源 | 命中第 1 |
| 把豆包 ASR 直接放进 ESP32 固件 | `#4` ASR 留在 Mac 代理侧 | 命中第 1 |
| `VOICE_SERVER_URI=127.0.0.1` 连不上 | `#5` 用 Mac 局域网 IP | 命中第 1 |
| ES8311 probe 到 `0x18` | `#6` 7-bit/8-bit 地址区别 | 命中第 1 |
| WAV 全 0，I2S DIN 写 GPIO14 | `#7` DIN 应为 GPIO16 | 命中第 1 |
| `peak=32768` 是否马上降增益重刷 | `#8` 先看 quality/asr_timing | 命中第 1 |

CLI 查询已经能召回关键坑。主要问题不是“找不到”，而是：

- 少数 query 的排序还可以更准。
- CLI 输出是给人看的文本，agent 解析不如 JSON 稳。
- MCP 常驻进程会引入启动目录和重启问题。

### 1.2 已发现并修复的 scope 问题

旧版 `findProjectRoot()` 会从当前目录一路向上找 `.codetrap/`。但全局库也是
`~/.codetrap/`，所以当项目没有自己的 `.codetrap/` 时，工具会把用户 home
误判为 project root。

错误后果：

```text
project_path = /Users/superstorm
```

正确结果应该是：

```text
project_path = /Users/superstorm/Documents/Code/esp32
```

这说明 codetrap 的 project/global scope 策略必须非常严格。scope 是这个工具的信任基础。

## 2. 产品原则

### 2.1 CLI 是一等接口

codetrap 的核心价值是本地、透明、可脚本化。CLI 应该是最可靠的入口：

- 每次运行都按当前 `cwd` 重新解析 project scope。
- 用户可以直接看到命令、输出和 exit code。
- 任何 agent 只要能跑 shell，就能使用 codetrap。
- 不依赖常驻 server，不需要客户端插件状态正确。

如果 CLI JSON 做得足够稳定，它不只是 MCP 的替代方案，甚至可以比 MCP 更顺滑：

- CLI 每次调用都从当前工作目录解析 project scope，不会拿着旧 MCP 进程的启动目录。
- CLI 不需要 server 生命周期管理，不存在“代码已修但 server 没重启”的状态漂移。
- CLI 可以被 `AGENTS.md`、shell 脚本、CI、任意 agent 客户端复用。
- CLI 的行为更容易复制、记录、回放和调试。

因此后续目标应从“CLI 也能用”调整为：

```text
CLI = 一等 Agent API
MCP = 可选工具 schema / transport adapter
```

所谓“一等 Agent API”意味着 CLI 输出不是给人类终端看的副产品，而是稳定、版本化、可测试的机器契约。

### 2.2 MCP 是可选增强，不是核心依赖

MCP 的价值是工具 schema、JSON payload 和更自然的 agent 集成。但 MCP 不应该拥有独立行为。

原则：

- MCP 只做薄适配层。
- MCP 与 CLI 共享同一套 domain/store/search/format 逻辑。
- 所有 MCP 能做的核心事情，CLI `--json` 也应该能做。
- MCP 的任何 project scope 判断都必须可测试、可解释、可重启恢复。

### 2.3 AGENTS.md 是默认集成方式

参考 `run-llama/semtools` 的 CLI-first 思路，codetrap 应该支持通过项目里的
`AGENTS.md` 指导 agent 使用 CLI：

```md
## Codetrap

Before non-trivial code edits, run:

codetrap search "<keywords>" --mode hybrid --scope project --json

If a result looks relevant, inspect it with:

codetrap show <id> --scope project --json

Prefer project scope when `.codetrap/` exists. Use global only for cross-project rules.
```

这条路径比 MCP 更容易跨 Codex、Claude Code、Gemini CLI、OpenCode 等工具迁移。

### 2.4 Trap 质量比数量重要

codetrap 不应该变成普通笔记库。只存：

- AI 容易重复犯的错误。
- 有明确触发场景的项目约束。
- 错误做法和正确做法都清楚的经验。
- 能在未来动手前改变实现路径的规则。

普通命令备忘、一次性日志、泛泛心得应留在 docs，不应进入 codetrap。

## 3. 优先级路线图

### Phase 1: CLI JSON 成为稳定契约（核心已完成）

目标：让 CLI 成为比 MCP 更顺滑的一等 Agent API。agent 不依赖 MCP，也能稳定消费 codetrap。

当前状态（2026-05-17）：

- 已实现 `search --json`，返回 compact action cards。
- 已实现 stdin query：无 positional query 时可 `echo "..." | codetrap search --json`。
- 已实现 CLI `next_action.command`：`codetrap show <id> --scope <scope> --json`。
- 已实现 `show --json`，输出完整 `TrapDetails`，并把 `tags`、`related_files` 规范化为数组。
- 已实现 `list --json`、`stats --json`；`stats --json` 包含 embedding health。
- 已实现 `add/edit --output-json`，保留 `add/edit --json` 作为输入语义。
- 已实现 `delete/archive/supersede/import --json`，以及 `add_trap_evidence --output-json`。
- 已抽出 `src/commands/command-result.ts`，CLI 命令先返回 `CommandResult`，再统一渲染 stdout/stderr/exit code。
- 已抽出 `src/commands/workflow.ts`，`src/commands/router.ts` 只保留薄 CLI adapter 和渲染入口。

设计标准：

- **稳定 JSON shape**：字段名、嵌套结构、错误对象和 exit code 都要可测试。
- **目录卡片优先**：搜索默认返回 action cards，而不是完整 trap。
- **按需下钻**：详情通过 `show --json` 获取，避免每次搜索塞满上下文。
- **CLI next_action**：CLI 输出里的下一步应是可执行命令，而不是 MCP 工具名。
- **stdout/stderr 分层**：JSON 只进 stdout，诊断和错误进 stderr。

#### 1.1 `search --json`

增加：

```bash
codetrap search "StickS3 WebSocket localhost" --mode hybrid --scope project --json
echo "StickS3 WebSocket localhost" | codetrap search --mode hybrid --scope project --json
```

输出 MCP action cards 同构结构：

```json
[
  {
    "trap_id": 5,
    "scope": "project",
    "title": "VOICE_SERVER_URI 不能使用 localhost 或 127.0.0.1",
    "why_relevant": "...",
    "avoid": "...",
    "do_instead": "...",
    "severity": "error",
    "score": 2.72,
    "sources": ["fts"],
    "next_action": {
      "command": "codetrap show 5 --scope project --json"
    }
  }
]
```

验收标准：

- `--json` 输出必须是合法 JSON。
- stdout 只输出 JSON，不混入提示文本。
- 错误信息走 stderr，或者在 `--json` 下输出稳定错误对象。
- `search --json` 与 MCP `search_traps` 字段保持一致或有清晰映射。
- `next_action.command` 必须能直接复制执行。
- 对 agent 的默认建议是读取 top 3 action cards，而不是只看第一条。
- query 可以来自命令参数或 stdin；stdin 支持能让 shell、hook、CI 和 agent 更容易组合。

#### 1.2 `show --json`

增加：

```bash
codetrap show 7 --scope project --json
```

输出完整记录：

```json
{
  "scope": "project",
  "trap": {
    "id": 7,
    "title": "...",
    "category": "bug",
    "tags": ["sticks3", "i2s"],
    "context": "...",
    "mistake": "...",
    "fix": "...",
    "before_code": "...",
    "after_code": "...",
    "severity": "critical",
    "project_path": "...",
    "status": "active"
  },
  "evidence": []
}
```

验收标准：

- 与 MCP `get_trap` 使用同一 formatter 或同一 domain shape。
- `tags`、`related_files` 等字段输出数组，而不是 JSON 字符串。
- not found 时返回非 0 exit code。

#### 1.3 其他命令 JSON 化

建议支持：

```bash
codetrap list --scope project --json
codetrap stats --json
codetrap add --json '{...}' --output-json
codetrap edit <id> --json '{...}' --output-json
codetrap delete <id> --scope project --json
```

注意：当前 `add --json` 的 `--json` 表示输入是 JSON。后续如果要让输出也是 JSON，避免语义冲突：

- 方案 A：保留 `--json` 输入，新增 `--output-json`。
- 方案 B：新增全局 `--format json`。
- 方案 C：长期迁移到 `--input-json` + `--json` 输出。

推荐短期用方案 A，兼容性最好。

### Phase 2: CLI-first Agent 使用协议（核心已完成）

目标：让 `AGENTS.md` 和 skills 能稳定指导 agent 使用 CLI。

当前状态（2026-06-05）：

- 项目根 `AGENTS.md` 已默认推荐 `codetrap search "<keywords>" --mode hybrid --json`。
- README 的 agent integration 已改成 CLI-first，MCP 是 optional adapter。
- `skills/codetrap-check/SKILL.md` 和 `skills/codetrap-search/SKILL.md` 已改成 CLI 优先、MCP 可选。
- top 3 action cards review 规则已写入 AGENTS/README/skills。
- `critical` / `error` 且相关时下钻 `show --json` 的规则已写入 AGENTS/README/skills。
- 用户纠正、重复测试失败或 review feedback 后，agent-drafted 候选应先进入 `codetrap session capture --trap-markdown - --kind review --json`，再由用户决定 accept/edit/reject/supersede；`--trap-json` 保留给已经有结构化对象的调用方。
- Web Review 可以在接受前编辑候选；Accept / Accept anyway / Supersede 使用当前可见 draft，不会丢掉未保存的表单修改。

#### 2.1 项目级 AGENTS 模板

提供模板片段：

```md
## Codetrap

Before non-trivial code edits:

1. Search project traps:
   `codetrap search "<task keywords>" --mode hybrid --scope project --json`

2. Inspect highly relevant traps:
   `codetrap show <id> --scope project --json`

3. Apply the trap guidance before editing.

When a new recurring mistake or project convention is discovered, put a structured draft in the session candidate inbox:

`codetrap session capture --trap-markdown - --kind review --json`

Do not accept the candidate automatically.
```

#### 2.2 Skill 文档改成 CLI-first

现有 `codetrap-check` / `codetrap-search` / `codetrap-add` skills 可以改成：

```text
Default path:
  use CLI with --json from the current project cwd.

Optional path:
  use MCP only when it is already available and known to be project-scoped correctly.
```

产品上应强调 CLI 是可靠默认路径，MCP 是增强路径。skill 不应把 MCP 作为唯一推荐入口。

同时 skill 要写成工具选择协议，而不只是提醒 agent “去查一下”：

```text
search:
  当任务是概念性、风险性、约定性问题时使用。
  例："这个项目对 HTTP 请求有什么约定？"

show/get:
  当 search 返回高相关 trap，或 critical/error trap 可能相关，且准备修改代码前使用。

list:
  当需要浏览某类规则时使用。
  例："列出 security 相关 trap"

add:
  当用户纠错、测试失败、review 指出 recurring mistake 后使用。
```

#### 2.3 Agent Top-N 策略

测试显示部分 query 第 1 名不一定是唯一相关结果。AGENTS 规则应要求：

```text
Read top 3 search cards before deciding no trap applies.
If a result is critical/error and plausibly related, run codetrap show.
```

这样比只看 top 1 稳定。

### Phase 3: MCP 降级为薄适配层（主要项已完成）

目标：保留 MCP 的便利，但不让它成为复杂度来源。

当前状态（2026-05-17）：

- MCP tool schemas 已增加可选 `cwd` 参数。
- `handleToolCall()` 每次调用通过 `storeForScopeContext()` 按 `cwd` 派生 `TrapStore`；未传时 fallback 到 server 启动目录。
- CLI/MCP 共用 `src/lib/output-json.ts` 中的 `toCliSearchJson`、`toMcpSearchJson`、`toTrapDetailsJson`、`toListJson`、`toStatsJson`。
- MCP resources 也已通过 `TrapOperations` 和共享 JSON presenter 输出，避免直接在 server 里拼 payload。
- 剩余限制：MCP resources 没有 tool-call 参数，因此仍绑定 server 启动 cwd；跨项目精确 scope 应优先用 MCP tools 的 `cwd` 或 CLI。

#### 3.1 MCP 不应固定错误 cwd

当前 MCP server 启动时创建一次 `TrapStore(process.cwd())`。这会让 project scope 绑定到 MCP
进程启动目录，而不是当前工作项目。

改进方向：

- 每次 tool call 时按传入 `cwd` 创建或选择 `TrapStore`。
- 或者 MCP server 启动时接受显式 `--cwd /path/to/project`。
- 或者 MCP 工具参数支持 `project_path`，并且所有 project 操作都可显式指定。

推荐：

```json
{
  "query": "StickS3 WebSocket localhost",
  "scope": "project",
  "cwd": "/Users/superstorm/Documents/Code/esp32"
}
```

如果没有 `cwd`，再 fallback 到 server 启动目录。

#### 3.2 MCP 与 CLI 共享 JSON formatter

不要让 MCP 和 CLI 各自拼 payload。

建议抽出：

```text
src/lib/output-json.ts
  toSearchJson(...)
  toTrapDetailsJson(...)
  toListJson(...)
  toStatsJson(...)
```

CLI 和 MCP 都调用它。

#### 3.3 MCP 作为 optional install

安装文档应表述为：

```text
Recommended: CLI + AGENTS.md
Optional: MCP server for clients that prefer tool schemas
```

这会降低用户心智负担，也避免把调试焦点放在 MCP 生命周期上。

### Phase 4: Scope 与迁移工具硬化（已完成）

目标：彻底防止 project/global 混淆。

当前状态（2026-05-17）：

- `findProjectRoot()` 已避免把 home 目录下的 `~/.codetrap/` 当成 project root。
- scope 测试已覆盖 home/global `.codetrap`、nested project、home 外项目。
- 新增 `src/lib/scope-context.ts`，集中 cwd、project_root、project_db、global_db 诊断事实。
- 新增 `codetrap doctor` / `doctor --json`，展示 scope、DB 路径、trap 数、embedding health、hybrid fallback reason。
- 已完成：`repair-scope` / `migrate-project` 官方迁移命令，默认 dry-run，`--apply` 前备份 source/destination DB，输出候选 trap、id mapping、计数和 JSON。
- 已完成：迁移架构清理。`src/lib/scope-migration.ts` 负责 plan / apply / result / text rendering；`src/lib/trap-transfer.ts` 负责 DB-to-DB 保真搬运，保留 lifecycle、timestamps、hit_count、Trap Evidence，并 remap `supersedes_id`。
- 已完成：迁移命令保持 CLI-only maintenance workflow，不再通过 `TrapOperations` 做空转发；`TrapOperations` 继续只承载 CLI/MCP 共享 trap 操作语义。

#### 4.1 project root 检测规则

规则应明确：

```text
~/.codetrap 是 global store，不是 project root。
只有 home 以下、且不是 home 本身的 .codetrap 才能作为 project store。
```

需要覆盖：

- macOS/Linux: `/Users/name/.codetrap`
- Windows: `C:\Users\name\.codetrap`
- WSL: `/home/name/.codetrap`
- 项目在 home 外部的路径
- nested project `.codetrap`

#### 4.2 增加诊断命令

建议新增：

```bash
codetrap doctor
```

输出：

```text
cwd: /Users/superstorm/Documents/Code/esp32
project_root: /Users/superstorm/Documents/Code/esp32
project_db: /Users/superstorm/Documents/Code/esp32/.codetrap/traps.db
global_db: /Users/superstorm/.codetrap/traps.db
project_traps: 8
global_traps: 0
mcp_hint: restart codetrap serve if project_root changed
```

这个命令能快速解释“为什么 search 没命中”。

#### 4.3 增加迁移命令

这次手工迁移说明需要官方命令：

```bash
codetrap migrate-project \
  --from-project-path /Users/superstorm \
  --to-project-path /Users/superstorm/Documents/Code/esp32
```

或更安全：

```bash
codetrap repair-scope --dry-run
codetrap repair-scope --apply
```

验收标准：

- 默认 dry-run。
- 操作前自动 `.backup`。
- 输出将移动/删除的 trap id/title。
- 迁移后验证 source/destination 计数。

当前实现补充（2026-05-17）：

- `repair-scope` 默认 `from_project_path=$HOME`，`to_project_path=current project root`。
- `migrate-project` 要求显式 `--from-project-path` 和 `--to-project-path`。
- 两个命令只移动 `scope='project'` 且 `project_path` 精确匹配 source path 的 rows；真正的 `global` traps 不会被移动。
- `--json` 输出 command、mode、source/destination DB、候选 traps、id mapping、backup paths、计数和 dry-run 的 `next_action.command`。
- 目标项目必须已经有 `.codetrap/`；未初始化时提示先运行 `codetrap init`。

### Phase 5: 检索质量与评估集（评估集部分完成）

目标：用真实问题持续评估搜索效果。

当前状态（2026-05-17）：

- StickS3 8 条真实 traps 和 8 个真实 query 已加入 `src/tests/fixtures/search-eval.json`。
- `src/tests/search-eval.test.ts` 对这些 query 锁住 `Recall@3 = 100%` 和 `Recall@5 = 100%`。
- MRR 已在 eval 测试中计算；通用 title/tag/code-identifier/severity/path/module/owner rerank signals 已落地。
- Dogfood Eval Flywheel v1 已新增：把真实 codetrap 使用查询整理进 repo fixture，并通过 `bun run eval:dogfood -- report` 做稳定回归，通过 `--live` 用真实 embedding provider 验证本机产品体验。

#### 5.1 固化 StickS3 评估集

把本次 8 个测试问题加入 `src/tests/fixtures/search-eval.json` 或独立 fixture：

```json
{
  "query": "VOICE_SERVER_URI=ws://127.0.0.1:8765/sticks3，板子连不上电脑服务",
  "expected": [5],
  "scope": "project"
}
```

指标：

- Recall@3：必须 100%
- Recall@5：必须 100%
- MRR：持续观察，不硬性阻塞初期迭代

#### 5.1.1 Dogfood Eval Flywheel v1

第一版保持 maintainer-only，不新增公开 `codetrap eval` 命令。

```bash
bun run eval:dogfood -- report
bun run eval:dogfood -- report --live
bun run eval:dogfood -- record --json '{"query":"...","mode":"hybrid","goldTrapIds":[1],"judgment":"useful_hit"}'
```

- deterministic report 使用固定 eval embedder，适合 CI 和回归。
- live report 使用当前真实 embedding provider；没有 provider 时明确显示 semantic unavailable / hybrid fallback。
- record 只追加 curated dogfood query，不自动挖本地 `.codetrap` 或 telemetry。

#### 5.2 排序改进

已观察到：

- hello_world/烧录 query 命中 `#1`，但 `#2` 排第 1。
- M5Unified query 命中 `#2`，但 `#3` 排第 1。

这些 StickS3/ESP32 词只作为评估样例，不应变成 codetrap 内置词库。开源后用户会来自前端、后端、数据库、Rust、Python、嵌入式等不同项目，排序逻辑必须保持项目无关。

可尝试：

- severity 轻微加权，但不要让 critical 永远压过相关性。
- title/token exact match 加权。
- query 中出现 trap tag 时加权。
- 对通用 code-ish / identifier-ish token 做温和 boost，例如大小写混合、带数字、带分隔符、错误码、包名、函数名、环境变量、路径片段和符号名。
- `M5Unified`、`GPIO16` 这类样例应通过通用规则自然命中；类似 `fetchWrapper`、`EADDRINUSE`、`next-auth`、`TrapStore` 也应享受同类 boost。
- `target`、`flash` 这类普通词不要做全局强 boost；最多在 title、tag、error 片段等高信号字段精确命中时给弱加权。
- boost 要有上限，不能让偶然关键词压过整体相关性。
- 后续 JSON 可暴露 `ranking_signals`，方便 Claude Code、Codex 等 agent 理解结果为什么被 rerank。

#### 5.3 中文/英文混合搜索继续加强

codetrap 的典型 query 会混合：

```text
StickS3 语音输入慢 peak=32768 VOICE_MIC_GAIN
```

需要继续维护：

- CJK bigram。
- 英文原 token。
- code identifiers。
- 常见同义词。
- error code / symbol exact match。

### Phase 6: 本地 embedding 与离线体验（embedding health 已完成，本地 provider 未开始）

目标：让 hybrid search 不依赖远程 API。

当前状态（2026-06-05）：

- 已抽出 `src/lib/embedding-health.ts`。
- 已抽出 `src/lib/embedding-runtime.ts`，集中 provider selection、provider config/status、setup action 和 provider-required error。
- `stats --json` 和 `doctor --json` 已展示 fresh/stale/missing、provider、model、dimensions、passage_version。
- `doctor` 已展示 hybrid fallback reason：`semantic_unavailable` 或 `semantic_no_candidates`。
- 未完成：ONNX/local embedding provider、模型缓存、离线默认 provider。

当前 Jina API 方案可用，但有明显限制：

- 需要 `JINA_API_KEY`。
- 依赖网络。
- 延迟高于本地。
- 离线时只能 fallback 到 FTS。

#### 6.1 本地 provider 选择

可选路线：

```text
Default local provider candidate:
  onnx-community/gte-multilingual-base

Fast provider candidate:
  minishlab/potion-multilingual-128M

High-quality optional providers:
  BAAI/bge-m3
  Qwen/Qwen3-Embedding-0.6B
```

短期不必急着做本地模型。更重要的是先把 CLI JSON 和评估集打牢。

#### 6.2 Embedding 健康度显式化

SemTools workspace 用文件状态和 embedding version 判断是否需要重新嵌入。codetrap 已经有类似基础：`passage_hash`、provider、model、dimensions、passage_version 可以判断 embedding 是否 fresh。

建议把状态产品化：

```ts
type EmbeddingState = "fresh" | "stale" | "missing";
```

并在 `codetrap stats` 或 `codetrap doctor` 中展示：

```text
Embeddings:
  fresh: 128
  stale: 4
  missing: 12
  provider: jina
  model: jina-embeddings-v5-text-small
```

这样用户能理解 hybrid search 为什么有时降级，也方便比较本地 provider 和 Jina provider。

### Phase 7: 数据模型与证据链

目标：让 trap 更像可维护的规则，而不是孤立笔记。

#### 7.1 Evidence 更好用

当前已有 `trap_evidence` 表，但常规流程使用较少。

建议：

```bash
codetrap add_trap_evidence 7 \
  --scope project \
  --source_type conversation \
  --source_ref "2026-05-16 StickS3 voice typing session" \
  --related_files "sticks3_hello/docs/sticks3-voice-typing-pitfalls-2026-05-03.md" \
  --note "GPIO14 was speaker DOUT; DIN must be GPIO16."
```

`show --json` 应默认包含 evidence。

#### 7.2 Supersede/Archive 工作流

当项目升级后，旧 trap 可能不再适用。例如：

```text
ESP-IDF v6.1 + 新版 M5Unified 已兼容
```

这时不应删除旧规则，而应：

- archive：单纯过期。
- supersede：被新规则替代。

AGENTS.md 应提醒 agent：遇到冲突规则时先 `show`，不要只看搜索卡片。

#### 7.3 Post-flight trap capture

codetrap 不只应该在动手前阻止错误，也应该在任务结束时沉淀新错误。适合记录 trap 的触发条件包括：

- 用户明确纠正了 agent 的实现方向。
- 测试失败暴露出可复用的错误模式。
- review 指出 recurring mistake。
- agent 在同一问题上反复尝试后才找到正确做法。

短期不建议完全自动写入 trap。更好的默认体验是：agent 用 `codetrap session capture --trap-markdown - --kind review --json` 提交显式 `Title` / `Context` / `Mistake` / `Fix` draft 到 candidate inbox；`--trap-json` 保留给已经有结构化对象的调用方。之后由用户决定 accept、edit、reject 或 supersede；confirmed trap 仍只能通过显式接受或用户确认后的外部来源保存。

### Phase 8: 大型代码库与组织采用

目标：让 codetrap 从单人本地工具成长为团队可采用的 agent harness 组件，但不膨胀成代码库 RAG。

#### 8.1 Path/module scoped traps

当前 coarse scope 仍然只有：

```text
project
global
```

schema v5 已增加更细的适用范围：

```text
path_globs: ["src/db/**", "src/mcp/**"]
module: "db" | "mcp" | "cli" | "search"
owner: "platform" | "infra" | "frontend"
```

这样 agent 在改 `src/db/**` 时可以用 `--path src/db/repository.ts --module db` 优先看到数据库相关 trap，而不是被全项目所有 trap 干扰。

#### 8.2 Hooks、plugin/bundle 与 onboarding

codetrap 可以作为完整 agent harness 的一层分发：

```text
codetrap CLI
  + CLI-first AGENTS.md / CLAUDE.md template
  + optional MCP server
  + codetrap-check / codetrap-search / codetrap-add skills
  + hook examples
  + doctor / onboarding
```

分发目标：

- npm 全局安装：`npm i -g codetrap`
- GitHub Releases 提供多平台二进制。
- Codex / Claude Code / Cursor / OpenCode 示例配置。
- plugin/bundle 把 MCP、skills、hooks 和文档片段统一打包；当前示例位于 `plugins/codetrap-agent`。

#### 8.3 配置文件

已引入 `~/.codetrap/config.json`，当前支持：

- 默认 search mode。
- 默认 result limit。
- rerank 开关。
- project/global 默认 scope 策略。

配置优先级建议：

```text
CLI args > config file > env vars > built-in defaults
```

API key 仍应放 env var，行为偏好可以放 config file。

## 4. 推荐实施顺序

建议按这个顺序做，不要一口气改太多：

```text
1. [done] search --json 输出 action cards，并提供 CLI next_action.command
2. [done] show --json 输出完整 trap details + evidence
3. [done] list/stats 的 --json 输出
4. [done] AGENTS.md CLI-first 模板
5. [done] StickS3 搜索评估集
6. [done] stdin query 支持
7. [done] codetrap doctor
8. [done] MCP tools 支持 `cwd`；resources 支持 `?cwd=`
9. [done] repair-scope / migrate-project + Trap Transfer 架构收敛
10. [done] embedding 健康度显式化
11. [done] ranking/MRR + 通用 identifier boost
12. [todo] 本地 embedding provider
13. [done] post-flight capture workflow
14. [done] path/module scoped traps
15. [done] npm/plugin/onboarding
```

除本地 embedding provider 外，上述收尾项已完成。下一步如果继续推进，应聚焦本地/离线 embedding provider。

## 5. 最小可交付版本

如果只做一轮优化，建议目标定义为：

```text
codetrap v0.2: CLI-first agent integration
```

包含：

- [done] `codetrap search --json`
- [done] `codetrap show --json`
- [done] `codetrap list --json`
- [done] `codetrap stats --json`
- [done] CLI JSON `next_action.command`
- [done] AGENTS.md 推荐模板
- [done] stdin query 支持
- [done] 搜索评估集覆盖 StickS3 8 traps
- [done] scope root 回归测试覆盖 home/global `.codetrap`
- [done] repair-scope / migrate-project 官方迁移命令与 Trap Transfer 架构收敛

不包含：

- 删除 MCP
- 本地 embedding
- 独立向量库或通用代码库 RAG

这样既能让 agent 稳定使用，也不会引入过多工程风险。

## 6. 对 MCP 的最终判断

不要急着删 MCP。

更好的定位是：

```text
CLI 是产品核心和一等 Agent API。
MCP 是 CLI/core 的一个可选 adapter。
AGENTS.md 是默认 agent 接入层。
```

这样 codetrap 会更像一个可靠的本地开发工具，而不是依赖某个特定 agent 客户端的插件。

如果未来 CLI JSON 足够稳定，MCP 可以长期保持很薄：

```text
MCP search_traps -> core search -> shared JSON formatter
MCP get_trap     -> core get   -> shared JSON formatter
MCP add_trap     -> core add   -> shared JSON formatter
```

这样保留生态兼容，同时避免 MCP 独立演化成第二套产品。

最终目标不是“CLI 勉强替代 MCP”，而是：

```text
CLI 路径最顺滑、最可调试、最跨客户端。
MCP 路径只负责把同一套能力包装成客户端喜欢的工具协议。
```
