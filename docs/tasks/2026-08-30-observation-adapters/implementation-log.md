# Implementation Log

> Created: 2026-08-30

## Task

实现 Codex/Claude 对称 Observation Run 适配与真实 search/exposure/validation/feedback 旁路。

## Assumptions

- 第一版使用显式 `run_id`、`device_id` 和可选稳定 `event_id`，不猜测客户端私有环境变量。
- transcript adapter 只消费既有 `NormalizedSession` 的结构化元数据，不读取或复制 turns 正文。

## Initial Approach

- 先建立可由 CLI、MCP 和未来 hooks 共用的 recorder，再在 TrapOperations 成功边界旁路接线。

## Log

### 2026-08-30

- Observation 失败采用“业务成功 + 可见 warning/diagnostic”，而不是让 search/useful 回滚，也不是静默吞错。原因是 Ledger 是旁路证据，但用户仍需知道证据链不完整。
- 不隐式猜 Codex/Claude session：客户端格式会变化且 MCP/CLI 进程未必暴露可靠 session id。第一版要求显式 observation context；既有 transcript readers 只用于安全的 metadata backfill 适配。
- CLI 与 MCP 共享 `ObservationRunRecorder` 和 `recordObservation` 分发合同，避免两套入口产生不同事件语义；未知字段在进入账本前 fail closed。
- 自动 `seq` 在 SQLite immediate transaction 内按 Run 分配；稳定 event id 的重试复用既有序号，search 的 exposure 子事件也从父 event id 派生稳定 id。
- trap id 只在各自 project/global store 内唯一，而 v1 exposure payload 没有独立 scope 字段，因此 `trap_revision` 使用 `${scope}:${updated_at}` 命名空间，避免跨 scope 产生歧义且不修改已冻结事件 schema。
- `query`、path/module hint、validation command、feedback note 与 missed query 只落 SHA-256 fingerprint；adapter 不输出 cwd、完整路径、turn 正文或 raw reasoning。调用方控制的 id、branch、`source_ref` 仍需遵守 README 的非敏感输入边界。
- 验证完成：focused observation tests 43 pass；全量 473 pass、1 skip、0 fail；typecheck、diff check 与本地 Windows build 均通过。
