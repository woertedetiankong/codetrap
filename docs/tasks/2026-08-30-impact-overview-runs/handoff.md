---
title: Handoff 2026-08-30 - Impact Overview and Runs Web slice
status: Complete
updated: 2026-08-30
---

# Handoff

## Summary

Codetrap Web Console 现在有生产级蓝色 `Impact` 入口：Overview 从完整本地 Observation Ledger 投影展示事实总览，Runs 列表可下钻到单次任务的隐私白名单证据时间线。打开页面是严格只读的；未配置观测时不会创建 identity、目录或 SQLite 文件。

## Current State

本工作单元完成。真实 Overview/Runs 已实现；Evals 仍是假数据原型，自动 Codex/Claude hooks、Team Hub、正文 blob、OTLP 和 controlled runner 尚未实现。

## Git And Persistent State

- Branch: `main`；工作区开始前已有未提交的 Learning、设计、原型、Skill、Observation 与 Web 改动，本任务全部保留。
- 没有向当前项目创建生产 Observation 数据；API tests 使用临时项目。
- 没有 commit、push、release、全局安装或候选自动接受。
- 待审核候选仍包括 session `2026-08-30-capture-finalize-bun-sqlite-statements-before-closing-temporary` 的 `cand-001`。

## Key Decisions

- 新增 `openObservationLedgerReadOnly()`：Ledger 不存在时返回 `null`，存在时以 SQLite readonly 模式打开并校验 schema；Web GET 不调用会初始化持久状态的写入型 opener。
- Overview 总数调用完整 `overview()` 投影；单 Run 使用无界的 `getRun()`/`listRunEvents()`，不从默认 1000 条 event list 推算。
- Web DTO 不返回完整 `RunObservationProjection` 或任意 `event.attributes`。每种事件都经过显式事实白名单，屏蔽 query/command/note fingerprint、session ref、revision、branch、model、source/body refs。
- UI 沿用现有三栏 shell：项目在左、Run 队列在右、Overview/时间线在中。视觉采用深蓝飞行记录器与蓝图网格，证据分类和 partial warning 优先于装饰性分数。
- 页面只陈述观测关联；observed fact、human label、inference 和 controlled eval 分开显示，不把曝光与测试通过直接写成因果收益。

## Changed Surfaces

- `src/lib/observation-ledger.ts`：只读 opener、单 Run 完整投影和事件读取。
- `src/web/observation-view.ts`：Overview/Runs payload 与 timeline privacy allowlist。
- `src/web/server.ts`：三个只读 `/api/observations/*` route。
- `src/web/client-impact.ts`：独立可编译的 Impact browser render block。
- `src/web/client-script.ts`、`client-text.ts`、`static.ts`：真实数据状态、双语入口、蓝色响应式 UI。
- `src/tests/observation-web.test.ts` 及 Web tests：只读、隔离、隐私、脚本和视觉合同。
- `src/tests/session-cli.test.ts`：多 CLI 进程纵向测试显式使用 15 秒预算，生产行为和断言不变。

## Cross-Module References

- Depends on: [Observation adapters](../2026-08-30-observation-adapters/handoff.md) - explicit real Run evidence.
- Depends on: [Observation Ledger v1](../2026-08-30-observation-ledger-v1/handoff.md) - append-only facts and projections.
- Product contract: [Impact、轨迹观测与 Evals](../../impact-evals-design.zh-CN.md).
- Referenced by: future real-data Evals slice and optional client hook integration.

## Red Lines And Gotchas

- 不要让 GET route 调用 `openObservationLedger()`；那会把浏览动作变成持久化初始化。
- 不要把 timeline serializer 改成返回任意 attributes；新增事件字段必须逐项做 UI disclosure decision。
- Run id 是用户/客户端提供的 opaque metadata；前端必须持续 escape，不能拼成未经编码的 URL 或 HTML。
- `Impact` 不代表自动采集已经开启；没有显式 Run context 时应继续显示 opt-in 空状态。
- Browser smoke 在当前 Windows 环境仍按仓库既有策略 skip；曾尝试启用系统 Chrome，但 Playwright 卡在 launch 阶段，尚未发生页面请求。API、inline-script compile 和响应式静态合同已通过。

## Validation

- Focused Observation/Web regression：54 pass、1 skip、0 fail（397 expects）。
- `bun test`：480 pass、1 skip、0 fail（481 tests across 66 files，2316 expects）。
- `bun run typecheck`：通过。
- `bun run build`：通过，生成 Windows CLI 和 MCP server。
- `git diff --check`：通过。
- Implementation Journal strict scan：0 error；广域扫描的 4 个既有 warning 位于 `README.md:1046-1047` 和父路线图的字面日期格式示例；本任务 dossier/index/NEXT 扫描为 0 warning。

## Restart Verify

```powershell
git status --short  # expected: 既有未提交工作与本阶段 Impact 文件同时存在；mismatch means worktree baseline drifted
bun run typecheck  # expected: exit 0; mismatch means the API/client contract no longer compiles
bun test src/tests/observation-web.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts  # expected: 18 pass, 0 fail; mismatch means read-only/privacy/UI contracts drifted
rg -n "openObservationLedgerReadOnly|/api/observations/|data-main-view=\"impact\"" src README.md docs  # expected: 命中 ledger、API、client、tests 和 current docs；mismatch means integration docs drifted
```

## Next Steps

1. 建立真实数据 Evals v1 任务档案：将现有 Search Evals 与 Observation validation/human-label evidence 放进同一界面，但保持“检索质量”和“真实任务关联”两类结论分离。
2. 用已记录 Run 定义可审核 eval case 候选和 cohort/filter，不自动把观测事实升级成 ground truth。
3. 再决定是否增加受控 baseline/candidate runner；模型 judge 只作辅助，测试断言和人工反馈优先。
4. 自动 hooks、Team Hub 和正文 blob 继续独立分片，避免扩大本地只读 Impact 的信任边界。

## Docs And Wiki

- Created: Web observation view、Impact renderer、API tests 与本 handoff。
- Rewritten: README Web workflow、安装说明、主设计进度、父路线图、任务索引和 NEXT-SESSION。
- Wiki 未创建：仓库没有手工维护的 wiki。

## Implementation Log

- [implementation-log.md](implementation-log.md) 记录只读边界、隐私 allowlist、视觉方向、基线数字勘误和测试预算决策。
