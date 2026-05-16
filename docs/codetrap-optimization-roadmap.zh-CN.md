# codetrap 后续优化路线图

Date: 2026-05-16

本文记录一次真实使用 codetrap 后得到的改进方向。测试场景来自
`/Users/superstorm/Documents/Code/esp32/sticks3_hello`：从 4 份 StickS3
项目文档中提炼出 8 条踩坑经验，然后用 CLI 和 MCP 分别查询、迁移、验证。

结论先行：

```text
codetrap 应该变成 CLI-first 的本地知识工具。
CLI 应该成为一等 Agent API，而不是退而求其次的 fallback。
MCP 可以保留，但应降级为可选适配层。
AGENTS.md + CLI --json 应该能覆盖 agent 使用 codetrap 的主路径。
```

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

### Phase 1: CLI JSON 成为稳定契约

目标：让 CLI 成为比 MCP 更顺滑的一等 Agent API。agent 不依赖 MCP，也能稳定消费 codetrap。

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

### Phase 2: CLI-first Agent 使用协议

目标：让 `AGENTS.md` 和 skills 能稳定指导 agent 使用 CLI。

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

When a new recurring mistake or project convention is discovered, ask whether to record it:

`codetrap add --json '{...}'`
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

#### 2.3 Agent Top-N 策略

测试显示部分 query 第 1 名不一定是唯一相关结果。AGENTS 规则应要求：

```text
Read top 3 search cards before deciding no trap applies.
If a result is critical/error and plausibly related, run codetrap show.
```

这样比只看 top 1 稳定。

### Phase 3: MCP 降级为薄适配层

目标：保留 MCP 的便利，但不让它成为复杂度来源。

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

### Phase 4: Scope 与迁移工具硬化

目标：彻底防止 project/global 混淆。

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

### Phase 5: 检索质量与评估集

目标：用真实问题持续评估搜索效果。

#### 5.1 固化 StickS3 评估集

把本次 9 个测试问题加入 `src/tests/fixtures/search-eval.json` 或独立 fixture：

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

#### 5.2 排序改进

已观察到：

- hello_world/烧录 query 命中 `#1`，但 `#2` 排第 1。
- M5Unified query 命中 `#2`，但 `#3` 排第 1。

可尝试：

- severity 轻微加权，但不要让 critical 永远压过相关性。
- title/token exact match 加权。
- query 中出现 trap tag 时加权。
- 对 `target`、`flash`、`M5Unified`、`GPIO16` 这类强信号做 keyword boost。

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

### Phase 6: 本地 embedding 与离线体验

目标：让 hybrid search 不依赖远程 API。

当前 Jina API 方案可用，但有明显限制：

- 需要 `JINA_API_KEY`。
- 依赖网络。
- 延迟高于本地。
- 离线时只能 fallback 到 FTS。

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

## 4. 推荐实施顺序

建议按这个顺序做，不要一口气改太多：

```text
1. search --json 输出 action cards，并提供 CLI next_action.command
2. show --json 输出完整 trap details + evidence
3. list/stats 的 --json 输出
4. AGENTS.md CLI-first 模板
5. StickS3 搜索评估集
6. codetrap doctor
7. MCP 每次调用支持 cwd 或显式 project_path
8. repair-scope / migrate-project
9. 本地 embedding provider
```

其中前 5 项价值最高、风险最低。完成后，CLI-only 体验应该已经比 MCP 更稳定。

## 5. 最小可交付版本

如果只做一轮优化，建议目标定义为：

```text
codetrap v0.2: CLI-first agent integration
```

包含：

- `codetrap search --json`
- `codetrap show --json`
- `codetrap list --json`
- `codetrap stats --json`
- CLI JSON `next_action.command`
- AGENTS.md 推荐模板
- 搜索评估集覆盖 StickS3 8 traps
- scope root 回归测试覆盖 home/global `.codetrap`

不包含：

- 删除 MCP
- 本地 embedding
- 大规模 schema 改造
- 复杂配置系统

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
