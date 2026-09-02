# Implementation Log

> Created: 2026-08-30

## Task

实现 Observation Ledger v1 的领域信封、独立 SQLite 账本和可重建的 Run/Overview 投影。

## Assumptions

- Slice 1 会分为 Ledger 基础、客户端适配接线、最小 Overview/Runs UI 三个可独立验证的工作单元。
- 当前工作单元完成后，现有命令尚不会自动写 observation；真实数据接线属于下一工作单元。

## Initial Approach

- 先固化 durable event boundary 和 append-only storage，再让 Codex/Claude 适配器及 Web UI 依赖该稳定接口。
- 复用现有 SQLite 的 `busy_timeout → WAL → foreign_keys → schema` 启动顺序，但使用独立数据库和 schema version。

## Log

### 2026-08-30

- 将 Slice 1 切为三个工作单元，先实现 Ledger 基础。原因是事件校验、幂等和不可变性是客户端适配器与 UI 的共同依赖；先接 UI 会把假数据结构固化进生产接口。
- Ledger 使用独立 `.codetrap/observations/ledger.sqlite`，不向现有 `traps.db` 添加表。现有 trap、candidate、Learning 和 feedback store 继续作为业务 source of truth。
- 固化 17 类 version 1 事件以及 `observed_fact`、`human_label`、`derived_inference`、`controlled_eval` 四类证据。未知事件版本、事件类型、枚举值和证据边界全部 fail closed；缺失观测值保留为 `null`/`unknown`。
- 元数据 payload 改为按事件类型白名单校验。任意额外字段（例如原始 prompt）不能借 `attributes` 混入账本；`metadata` 事件也不能引用正文 blob。推断事件还必须记录依据事件 ID 和推断版本。
- SQLite 使用 `(project_id, id)` 幂等键、Run 内 `(project_id, run_id, seq)` 唯一序列和 update/delete 拒绝 trigger。批量写入在任一冲突时整体回滚，投影只从事件重建。
- Run 列表保持有界读取，但 Overview 使用完整账本重建，避免默认 1000 条列表上限造成静默少算。Run 内事件按 `seq` 重排，因此不同设备的 `recorded_at` 顺序不会改变轨迹含义。
- Windows 测试揭示 Bun SQLite 的 prepared statement 必须显式 `finalize()` 才能确定性释放 WAL/SHM 句柄。账本查询统一 `try/finally` finalize，并以 `close(true)` 检查残留语句。该经验已作为待审核候选 `cand-001` 放入 session inbox，未自动接受。

## Validation

- `bun run typecheck`：通过。
- `bun test src/tests/observation-ledger.test.ts`：9 pass，覆盖路径副作用、schema、幂等、事务回滚、不可变 trigger、隐私字段、证据边界、未知值、未来 schema 和完整投影。
- `bun test`：465 pass、1 skip、0 fail；原有 Learning 工作区改动保持兼容。
- `bun run build`：Windows CLI 与 MCP server 编译通过。
- `bun run build:release`：未完成；Bun 无法解压下载的 Darwin ARM64 运行时，错误发生在跨平台运行时提取而非项目源码编译。
