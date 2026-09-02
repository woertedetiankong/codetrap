# Task Brief: Impact Overview and Runs Web vertical slice

> Created: 2026-08-30
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Product design: [Impact、轨迹观测与 Evals](../../impact-evals-design.zh-CN.md)
> Status: Complete

## Goal

让用户在现有 Codetrap Web 控制台中直接看懂真实 Observation Ledger 带来的任务成效，并能从 Overview 下钻到单次 Run 的隐私安全证据时间线。

## Success Criteria

- 只读 API 返回完整 Ledger 投影生成的 Overview、Run 列表和单 Run 详情，不从 1000 条有界事件视图计算总量。
- 未创建 Ledger 时 GET 不创建 `.codetrap/observations` 或项目身份，并返回可操作空状态。
- Impact 一级入口提供 Overview/Runs 两个视图，使用真实项目数据且延续用户确认的蓝色视觉方向。
- 用户能区分 observed fact、human label、partial/unknown 与 validation failure；界面不做未经证据支持的因果宣称。
- Run 时间线不展示 prompt、diff、工具正文、完整路径、secret、raw reasoning 或未筛选 attributes。
- API、客户端脚本/文案、静态结构、响应式和浏览器 smoke 测试通过。

## Scope

In scope:

- Observation Ledger 的只读打开、单 Run 完整投影和安全时间线 DTO。
- `GET /api/observations/overview`、`/runs`、`/run`。
- 现有 Web shell 内的 Impact 导航、Overview/Runs 切换、Run 选择与详情。
- 无项目、未启用观测、无 Run、partial/unknown、failed validation 和读取错误状态。

Out of scope:

- 自动 Codex/Claude hooks、后台 transcript 扫描或正文 blob。
- Evals controlled runner、Team Hub、OTLP/Logfire 或远程同步。
- Learning/Library 自动转化、因果评分、成员排行榜或写入型 Impact 操作。

## Constraints

- Web GET 必须保持只读；不能因为用户打开 Impact 页面而初始化 Ledger。
- 现有 trap/Learning stores 仍是各自 source of truth；Impact 只呈现证据投影。
- 保留当前工作区已有 Learning、设计、原型、Skill 与 Web 改动。
- UI 采用蓝图式飞行记录器方向：蓝色为主、数字与时间线优先、克制动效，并与现有三栏布局和双语体系兼容。

## Expected Knowledge Updates

- Update product design implementation progress and Web integration contract.
- Update parent roadmap, task index, README, handoff and NEXT-SESSION.
- Wiki: not created because the repository has no hand-maintained wiki.
