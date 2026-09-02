---
title: Handoff 2026-08-30 - Observation Ledger v1 foundation
status: Complete
updated: 2026-08-30
---

# Handoff

## Summary

Codetrap 已具备本地 Observation Ledger v1 基础：17 类版本化事件经过严格运行时校验，写入独立、幂等、只追加的 SQLite 账本，并能从历史事实重建 Run 与 Overview 投影。该基础不改变现有 trap、candidate、Learning 或 feedback 的业务 source of truth。

## Current State

本工作单元完成。它提供领域与持久化 API，但现有 CLI/Web/Agent 客户端尚未自动写入 observation；Evals 原型仍是假数据页面。下一个纵向工作单元应接入 Codex 与 Claude Code 的对称 Run 适配器，并贯通真实的 `search → exposure → validation → feedback` 事件。

## Git And Persistent State

- Branch: `main`; 工作区在开始前已有未提交的 Learning source-coverage、设计和原型改动，本任务只做增量修改。
- 新账本路径：项目内 `.codetrap/observations/ledger.sqlite`；测试只使用系统临时目录，没有向当前项目创建生产账本。
- 待审核 Codetrap 候选：session `2026-08-30-capture-finalize-bun-sqlite-statements-before-closing-temporary` 的 `cand-001`，当前仍为 proposed。

## Key Decisions

- Observation 使用独立 SQLite schema，不把高频事件塞入 `traps.db`。
- `(project_id, id)` 的完全相同重试为 duplicate；相同 ID 不同内容和 Run 内重复 `seq` 明确失败。
- 历史事件不可 update/delete；Run/Overview 是可丢弃、可重建的投影。
- metadata payload 按事件类型严格白名单；正文通过独立 `body_ref` 边界表达，metadata 事件不得引用正文。
- 未知版本 fail closed；推断必须带 `basis_event_ids` 和 `inference_version`；人工反馈与受控实验不能伪装成普通观测事实。
- Bun SQLite statements 显式 finalize，随后严格 close，以保证 Windows 上确定性释放 WAL 文件句柄。

## Changed Surfaces

- `src/domain/observation.ts`：事件词汇、payload、证据分类和投影类型。
- `src/lib/observation-ledger.ts`：路径、schema、校验、幂等 append、查询和投影。
- `src/tests/observation-ledger.test.ts`：9 个领域、存储、隐私和完整性测试。
- 主设计、父路线图、任务索引和 NEXT-SESSION：同步实际完成范围与后续入口。

## Cross-Module References

- Product contract: [Impact、轨迹观测与 Evals](../../impact-evals-design.zh-CN.md)
- Existing data lifecycle: [Phase 3 storage lifecycle](../2026-08-29-phase3-storage-lifecycle/handoff.md)
- Existing Learning state: [Learning source coverage](../2026-08-29-learning-source-coverage/handoff.md)
- Next dependent work: Codex/Claude observation adapters, Overview/Runs API and observational Evals。

## Red Lines And Gotchas

- 不要将 Observation Ledger 变为 trap/Learning 的新 source of truth。
- 不要把 prompt、diff、工具正文、完整路径、secret 或 raw reasoning 放进 metadata attributes。
- 不要通过修改历史事件“修正”轨迹；应追加更正/状态事件并重新投影。
- `listEvents()` 默认有 1000 条展示预算；聚合必须使用完整账本或服务端聚合，不能基于这个有界视图算总数。
- 当前没有 sensitive blob store；`body_ref` 只是事件边界的一部分，不能据此声称正文捕获已经实现。

## Validation

- `bun run typecheck`：通过。
- `bun test src/tests/observation-ledger.test.ts`：9 pass、0 fail。
- `bun test`：465 pass、1 skip、0 fail（466 tests across 63 files）。
- `bun run build`：成功生成 Windows CLI 和 MCP server。
- `bun run build:release`：因 Bun Darwin ARM64 运行时下载/解压不完整而失败；本机源码构建通过。

## Restart Verify

```powershell
git status --short  # expected: 既有 Learning 改动与 Observation 新文件同时存在
bun run typecheck  # expected: exit 0
bun test src/tests/observation-ledger.test.ts  # expected: 9 pass, 0 fail
rg -n "openObservationLedger|validateObservationEvent|observation_events" src docs  # expected: 命中 domain、ledger、tests、design 和 handoff
```

预期：类型检查通过，Observation 测试 9/9，通过搜索能命中事件 API、SQLite 表和本 handoff。工作区仍同时包含先前 Learning 改动；不应清理或覆盖它们。
A mismatch means the implementation, task status, or preserved worktree baseline drifted and must be reconciled before adapter work.

## Next Steps

1. 建立下一任务档案并为 Codex、Claude Code 定义同构的归一化 Run 输入，明确支持与不支持的 transcript 字段。
2. 在现有 search、exposure、validation、feedback 边界追加旁路事件；业务写入成功不应依赖 Ledger 成功。
3. 用两个客户端 fixture 证明同一语义生成同构事件，并增加默认无正文的 privacy snapshots。
4. 再提供只读 Overview/Runs API 与蓝色生产 UI；Team Hub、正文 blob 和 controlled runner 继续后置。

## Docs And Wiki

- Created: Observation domain、ledger、tests 和本 task handoff。
- Updated: 主设计状态、父路线图、任务索引和 NEXT-SESSION。
- README 未更新：本工作单元没有新增用户可调用的命令、配置或 Web 路由。
- Wiki 未创建：仓库没有手工维护的 wiki。

## Implementation Log

- [implementation-log.md](implementation-log.md) 记录实现拆分、隐私边界、SQLite 生命周期和验证结果。
