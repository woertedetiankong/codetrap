# Task Brief: Observation adapters and real run path

> Created: 2026-08-30
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Product design: [Impact、轨迹观测与 Evals](../../impact-evals-design.zh-CN.md)
> Status: Complete

## Goal

让 Codex 与 Claude Code 能通过同一 metadata-only 合同记录真实 Run，并把现有 trap search/exposure/useful feedback 和显式 validation 旁路写入 Observation Ledger。

## Success Criteria

- Codex、Claude Code 的等价会话元数据生成同构 Run 事件，客户端差异只出现在明确字段。
- `observe start|validation|feedback|missed|complete` 提供严格 JSON CLI 合同；未知字段和正文内容 fail closed。
- `search` 在提供 observation context 时记录 query fingerprint、结果 revision 和 exposure，不存查询正文或完整路径。
- `useful` 在业务写入成功后记录 human-label feedback；Observation 失败不得撤销业务结果，并必须返回可见 warning/diagnostic。
- Run 内 seq 由 SQLite 事务安全分配；重试可用稳定 event id 幂等去重。
- 双客户端等价、完整纵向路径、失败隔离和隐私快照测试通过。

## Scope

In scope:

- Observation Run input/adapter、recorder 与自动 seq 分配。
- CLI `observe` 合同，以及 `search`/`useful` 的可选 observation flags。
- MCP search/useful 的同构 observation context。
- 单元、CLI、MCP 和 privacy snapshot 测试。

Out of scope:

- 自动读取 raw reasoning、prompt、diff 或工具正文。
- 自动安装 Codex/Claude hooks，或假设客户端存在稳定的隐式 session 环境变量。
- 生产 Overview/Runs Web UI、正文 blob、Team Hub、OTLP 和 controlled eval runner。

## Constraints

- 现有 trap store 始终是业务 source of truth；Observation 是可失败的旁路证据。
- 不得从失败的 search/useful 操作生成成功事件。
- path/module/query/command/note 默认只记录 fingerprint；不得保存原文。
- 同一 API 对 Codex 与 Claude Code 对称，缺失字段显式为 `null`/`unknown`。
- 保留当前工作区所有既有 Learning、设计和原型改动。

## Expected Knowledge Updates

- Update product design implementation progress and CLI integration contract.
- Update parent roadmap, task index, handoff and NEXT-SESSION.
- README/installation updates are required because `observe` is a user-facing command.
- Wiki: not created because the repository has no hand-maintained wiki.
