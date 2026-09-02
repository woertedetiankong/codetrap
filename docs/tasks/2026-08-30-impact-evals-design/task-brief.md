# Task Brief: Impact、Evals 与团队观测设计

> Created: 2026-08-30
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

形成一份以用户价值为中心、可直接指导后续开发的 Codetrap Impact、Learning 观测、Evals 与 Team Hub 北极星设计。

## Success Criteria

- 明确区分 Learning、Agent Library、Candidate Inbox 和 Observation/Impact。
- 描述个人、团队、Learning 转化和 baseline/candidate 评测的完整用户旅程。
- 定义第一版事件词汇、核心记录、本地存储、Team Hub 接口、RBAC、共享与保留策略。
- 明确 `创建 Agent 经验候选` 默认不调用 Codex/Claude。
- 区分观测事实、人工标签、系统推断和受控评测，限制未经证明的因果表述。
- 给出可按纵向切片实施的路线和可验证验收条件。
- 提供一个使用假数据的 Evals 可交互原型，验证桌面、窄屏和核心交互方向。

## Scope

In scope:

- 中文主设计文档、ASCII 用户流程和通俗例子。
- 独立、无后端依赖的 Evals HTML 交互原型和浏览器 smoke verifier。
- Impact、Runs、Learning Impact、Evals、Team 的产品与系统契约。
- 对 DeepSeek Harness 与 Logfire 可借鉴边界的说明。
- 后续实现的阶段、测试矩阵和停止条件。

Out of scope:

- 实现事件账本、生产 UI、Team Hub 或 eval runner。
- 修改现有 Learning、trap、candidate 或 feedback 数据。
- 调用外部 Agent、上传遥测、安装服务或发布版本。
- 提交或推送当前工作区。

## Constraints

- Learning Insight 与 Agent trap 分库；不自动复制或训练模型。
- 本地优先、敏感正文显式共享、团队默认聚合且无成员排行榜。
- Codex 与 Claude Code 保持对称适配。
- 现有未提交 Learning source-coverage 工作必须保留。
- 当前 source of truth 是代码和已确认产品决策；参考项目只提供设计启发。

## Expected Knowledge Updates

- Create `docs/impact-evals-design.zh-CN.md`.
- Update the roadmap status dashboard and `docs/tasks/INDEX.md`.
- Refresh `docs/tasks/NEXT-SESSION.md` without losing the pending Learning state.
- No wiki update: no hand-maintained project wiki exists.
