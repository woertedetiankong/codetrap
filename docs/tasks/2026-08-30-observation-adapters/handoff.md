---
title: Handoff 2026-08-30 - Observation adapters and real run path
status: Complete
updated: 2026-08-30
---

# Handoff

## Summary

Codetrap 现在可以通过对称、显式、metadata-only 的 CLI/MCP 合同记录 Codex 与 Claude Code Run，并把真实 `search → exposure → validation → feedback` 旁路写入本地 Observation Ledger。观测失败不会回滚 search/useful 的业务结果，但会返回用户可见的 warning 或 diagnostic。

## Current State

本工作单元完成。用户或 Agent 可用 `observe start|validation|feedback|missed|complete` 建立 Run，并在 `search`/`useful` 上传入相同 `run_id` 与 `device_id`。当前不会自动安装 hooks、猜测客户端私有 session 环境变量或扫描 transcript；生产 Overview/Runs UI 也尚未实现。

## Git And Persistent State

- Branch: `main`；工作区开始前已有未提交的 Learning、设计、原型、Skill 与 Web 改动，本任务保留并只做增量修改。
- 生产账本路径仍为 `.codetrap/observations/ledger.sqlite`；本轮测试只使用临时目录，没有在当前项目创建生产 observation 数据。
- 没有 commit、push、release、全局安装或候选自动接受。
- 待审核 Codetrap 候选仍为 session `2026-08-30-capture-finalize-bun-sqlite-statements-before-closing-temporary` 的 `cand-001`；不要自动接受。

## Key Decisions

- 第一版要求显式 `run_id`、`device_id` 和可选稳定 `event_id`，不依赖不稳定或私有的 Codex/Claude session 环境变量。
- CLI、MCP 和未来 hooks 共用一个 recorder/dispatcher；`NormalizedSession` adapter 只读取结构化元数据，不复制 turns、cwd、完整路径或 reasoning。
- Run `seq` 在 SQLite immediate transaction 内原子分配；稳定 event id 的重试幂等，search 派生的 exposure id 同样稳定。
- query、path/module hint、validation command、feedback note 和 missed query 只保存 SHA-256 fingerprint。Fingerprint 不是加密，调用方控制的 id、branch 和 `source_ref` 也不得放 secret。
- trap id 在 project/global scope 间可能重复；v1 `trap_revision` 用 `${scope}:${updated_at}` 消除歧义，不回改事件 schema。
- 现有 trap store 继续作为业务 source of truth。Search/useful 成功但 observation 失败时，保留业务成功并明确报告证据链缺口。

## Changed Surfaces

- `src/lib/observation-ledger.ts`：事务安全的自动 seq 分配和幂等批量追加。
- `src/lib/observation-recorder.ts`：严格 recorder、统一分发、双客户端 metadata adapter 与 fingerprint 边界。
- `src/commands/observation-commands.ts`：新增 `observe` CLI；search/useful 接受可选 Run context。
- `src/lib/trap-operations.ts`：在业务成功边界记录 search/exposure/useful feedback，并隔离观测失败。
- `src/mcp/tools.ts`、`src/mcp/server.ts`：新增 `record_observation` 并让 search/useful 使用同构 context。
- README 与安装文档：新增用户工作流、隐私边界和失败语义。
- Observation recorder、CLI 与 MCP tests：覆盖对称性、纵向路径、幂等、隐私与存储失败。

## Cross-Module References

- Product contract: [Impact、轨迹观测与 Evals](../../impact-evals-design.zh-CN.md)
- Ledger foundation: [Observation Ledger v1](../2026-08-30-observation-ledger-v1/handoff.md)
- User contract: [Metadata-only Observation Runs](../../../README.md#metadata-only-observation-runs)
- Next dependent work: read-only Overview/Runs Web API and blue production Impact UI.

## Red Lines And Gotchas

- 当前是显式接线，不得描述成自动监听 Codex/Claude 或自动获取所有 Agent 行为。
- 不要把 prompt、diff、工具正文、完整路径、secret 或 raw reasoning 塞进 metadata 或 caller-controlled IDs。
- Observation warning 不能替换或撤销已成功的 search/useful 结果。
- `event_id` 可省略，但跨进程重试只有使用稳定 id 才能得到幂等语义。
- 没有 sensitive blob store；正文捕获、OTLP、Team Hub 与 controlled eval runner 仍未实现。

## Validation

- `bun run typecheck`：通过。
- Focused observation recorder/CLI/MCP tests：43 pass、0 fail（240 expects）。
- `bun test`：473 pass、1 skip、0 fail（474 tests across 65 files，2234 expects）。
- `bun run build`：成功生成 Windows CLI 和 MCP server。
- `git diff --check`：通过（完成文档同步后应再次运行）。

## Restart Verify

```powershell
git status --short  # expected: 既有 Learning/设计改动与本任务 Observation 改动同时存在
bun run typecheck  # expected: exit 0
bun test src/tests/observation-recorder.test.ts src/tests/observation-cli.test.ts src/tests/mcp-tools.test.ts  # expected: 43 pass, 0 fail
rg -n "ObservationRunRecorder|record_observation|observation_write_failed" src README.md docs  # expected: 命中 recorder、CLI/MCP、tests、README、设计和 handoff
```

预期：类型检查和 43 个 focused tests 通过，搜索可看到共享 recorder、MCP tool 与失败隔离合同。工作区仍包含本任务开始前的未提交改动，不应清理或覆盖。
A mismatch means the implementation, task status, or preserved worktree baseline drifted and must be reconciled before UI work.

## Next Steps

1. 建立只读 Overview/Runs Web API，直接从 rebuildable projections 读取，不从有界 event list 推算总量。
2. 将已确认的蓝色 Evals 原型收敛为生产 Impact shell，先做 Overview 和 Runs 的真实数据、空状态、partial/warning 状态与隐私提示。
3. 用临时真实 ledger 做 Web API、客户端文案、浏览器 smoke 和移动布局验收。
4. 自动 hooks、正文 blob、Team Hub 和 controlled eval runner 继续独立分片，不与只读 UI 一次性捆绑。

## Docs And Wiki

- Created: recorder、CLI、tests 与本 handoff。
- Updated: README、安装文档、主设计、父路线图、任务索引和 NEXT-SESSION。
- Wiki 未创建：仓库没有手工维护的 wiki。

## Implementation Log

- [implementation-log.md](implementation-log.md) 记录显式 context、失败隔离、scope revision 与隐私决策。
