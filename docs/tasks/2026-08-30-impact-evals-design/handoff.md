---
title: Handoff 2026-08-30 - Impact、Evals 与团队观测设计
status: Complete
updated: 2026-08-30
---

# Handoff

## Summary

Codetrap 的 Impact、Learning 观测、Evals 和 Team Hub 北极星方案已经固化为中文主设计，并提供了一个假数据、无后端依赖的 Evals 可交互原型。设计以用户价值和隐私为先，明确了页面、事件、存储、共享、权限、评测和分阶段验收契约。

## Current State

设计与界面原型阶段完成，产品代码尚未开始；后续应从本地 Observation Ledger 最小纵向切片实施。原型只验证信息架构和交互，不读取真实项目数据，不启动 Agent，也不代表 eval runner 已经存在。

## Git And Persistent State

- Branch: `main`; design started from local HEAD `d4bb3f3`.
- Persistent state: 当前工作区原有 Learning source-coverage 代码、测试、Skills 和文档仍未提交；本任务没有修改其运行时数据。

## Key Decisions

- Learning 给人、Library 给 Agent、Impact 给证据，三者不合并。
- `创建 Agent 经验候选` 不调用 Codex/Claude；可选 Agent 辅助必须单独授权。
- 本地结构化捕获默认开启，敏感正文显式共享；团队默认聚合且不做成员排名。
- 先做真实使用观测，后做隔离 baseline/candidate；测试与人工反馈优先于模型 judge。
- Team Hub 是异步共享服务，不是网络文件系统、消息总线或远程执行服务。

## Changed Surfaces

- `docs/impact-evals-design.zh-CN.md`: 产品、UX、数据、团队、隐私、Evals 和实施契约。
- `docs/prototypes/evals-ui-prototype.html`: 可直接在浏览器打开的 Evals 假数据交互原型。
- `scripts/verify-evals-prototype.ts`: 使用本机 Chrome/Edge 验证渲染、核心交互和窄屏溢出。
- 本任务 dossier: 设计范围、决策历史和后续实施入口。
- Parent roadmap、task index、NEXT-SESSION: 发现与续接指针。

## Cross-Module References

- Depends on: [Learning source coverage](../2026-08-29-learning-source-coverage/handoff.md) - Insight 集合、来源覆盖和个人 learned 状态的当前实现。
- Depends on: [Feedback improver loop](../2026-08-28-feedback-improver-loop/handoff.md) - 反馈与行为结果基础。
- Depends on: [Phase 3 storage lifecycle](../2026-08-29-phase3-storage-lifecycle/handoff.md) - 本地单主机存储和团队边界。

## Red Lines And Gotchas

- Red line: 不得让 Learning Insight 自动进入 trap recall。
- Red line: 不得在普通候选转化点击中启动 Agent 或上传正文。
- Red line: 不得把默认 Team payload 扩展为 prompt、diff、工具正文、完整路径或 raw reasoning。
- Gotcha: 当前工作区包含大量用户未提交的 Learning 改动，实施前必须基于现状增量工作。

## Validation

- Evals 原型采用用户确认的蓝色方向，并参考本地 DeepSeek Harness 的紧凑三栏、轨迹时间轴和事件账本；通过本机 Chrome 无头 smoke：6 条 case、case 选择、轨迹抽屉、新建实验对话框、人工评价和窄屏无页面级横向溢出。
- 主设计、任务档案、路线图和索引通过 implementation-journal validator：0 errors；路线图原有的两个日期模板占位符保留为 2 warnings。
- `git diff --check` 与 TypeScript typecheck 通过；本任务为文档和原型设计，没有运行产品功能测试。

## Restart Verify

```powershell
git status --short  # expected: 既有 Learning 改动与本次设计文档同时存在；缺失任一组意味着工作区基线变化
rg -n "创建 Agent 经验候选|Observation Ledger|Team Hub|controlled_eval" docs/impact-evals-design.zh-CN.md  # expected: 四类契约全部命中；缺失意味着主设计被删减或漂移
bun run scripts/verify-evals-prototype.ts  # expected: success=true、cases=6、horizontalOverflow<=1
```

预期：工作区仍显示既有 Learning 改动和本次文档改动；第二条命令命中产品按钮、事件账本、团队架构和评测证据契约。缺失任一项说明主设计被删减或漂移。
In validator terms, a mismatch means the implementation baseline or design contract changed and must be reconciled before coding.

## Next Steps

1. 建立 Slice 1 任务档案，先定义 version 1 event envelope、SQLite schema 和兼容迁移，不先做全量 Dashboard。
2. 用一条 Codex 和一条 Claude Code 真实任务 fixture 贯通 search → exposure → validation → feedback。
3. 实现 Overview/Runs 最小 UI，并完成默认无敏感正文的隐私 snapshot 测试。
4. 再进入 LearningProgress 和 `创建 Agent 经验候选`，最后才接 Team Hub。

## Docs And Wiki

- Created: `docs/impact-evals-design.zh-CN.md`, `docs/prototypes/evals-ui-prototype.html`, `scripts/verify-evals-prototype.ts` and this task dossier.
- Updated: parent roadmap, task index and NEXT-SESSION pointers.
- Wiki: not created because the repository has no hand-maintained wiki.

## Implementation Log

- [implementation-log.md](implementation-log.md) records the confirmed product, privacy, data and rollout decisions.
