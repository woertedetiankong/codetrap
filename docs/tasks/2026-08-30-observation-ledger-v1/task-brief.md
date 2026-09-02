# Task Brief: Observation Ledger v1 foundation

> Created: 2026-08-30
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Product design: [Impact、轨迹观测与 Evals](../../impact-evals-design.zh-CN.md)
> Status: Complete

## Goal

建立 Codetrap 本地 Observation Ledger 的第一个可验证基础单元，让版本化事件可以安全、幂等、只追加地持久化，并可重建 Run 与 Overview 摘要。

## Success Criteria

- version 1 事件信封和第一版事件词汇在 durable boundary 经过运行时校验，未知版本 fail closed。
- 项目事件写入独立的 `.codetrap/observations/ledger.sqlite`，不修改或复用 `traps.db`。
- 相同 `project_id + event.id` 重试幂等；内容冲突和同一 Run 的重复 `seq` 明确失败。
- SQLite trigger 禁止原地更新或删除历史事件，投影始终可从事件重建。
- Run 与 Overview 投影区分事实、人工标签、推断和受控评测，并将缺失数据保留为 `null`/unknown。
- 针对 schema、隐私元数据、幂等、顺序、不可变性和投影的测试通过。

## Scope

In scope:

- `src/domain/observation.ts` 事件和投影领域类型。
- `src/lib/observation-ledger.ts` 独立路径、SQLite schema、append/query/projection。
- Ledger 单元和持久化测试。
- 当前 Slice 的路线图、任务索引和续接文档。

Out of scope:

- Codex/Claude Code transcript 适配器和现有 search/feedback 命令接线。
- 敏感正文 blob 写入、分享 outbox、Team Hub 和 OTLP。
- 生产 Overview/Runs/Evals Web 页面与受控 eval runner。
- 修改现有 Learning source-coverage 实现或持久化状态。

## Constraints

- 现有 store 继续作为业务 source of truth；Ledger 只是旁路证据。
- SQLite 连接必须先设置 `busy_timeout`，再执行 WAL、foreign keys 和 schema 初始化。
- 路径解析无副作用；只有实际打开 Ledger 才创建目录。
- 默认事件仅包含结构化元数据；`metadata` 事件不得引用正文 blob。
- 不存储原始隐藏 reasoning，不把未知值变成虚假 `0` 或成功。
- 当前工作区已有大量未提交 Learning 改动，必须增量工作且不得覆盖。

## Expected Knowledge Updates

- Update `docs/impact-evals-design.zh-CN.md` only if implementation reveals a contract change.
- Update roadmap status dashboard and `docs/tasks/INDEX.md`.
- Rewrite `docs/tasks/NEXT-SESSION.md` and this dossier handoff before pausing.
- Wiki: not created because the repository has no hand-maintained wiki.
