# Implementation Log

> Created: 2026-08-30

## Task

把经过讨论确认的 Codetrap 观测、Learning Impact、Evals 和团队协作方向固化为后续开发契约。

## Assumptions

- 远程团队是主要增长场景，但个人本地体验不能依赖 Team Hub。
- 当前实现继续作为兼容基础，后续通过旁路 Observation Ledger 渐进接入。

## Initial Approach

- 先以用户价值旅程定义产品，再定义事件、共享和评测基础设施。
- 将 DeepSeek Harness 用作 typed event/trajectory 参考，将 Logfire 用作组织、项目、分享和 OTLP 参考。

## Log

### 2026-08-30

- 选择 `成效 Impact` 作为一级入口，并在内部统一提供 Overview、Runs、Evals、Team；避免让原始 trace 成为用户第一屏。
- 保持 Learning、Library 和 Impact 三者边界：Insight 给人学习，trap 给 Agent 运行时使用，Impact 只保存和解释证据。
- Learning 增加轻量三态进度、内容反馈、任务关联和候选转化；不采集阅读时长、鼠标、滚动或细粒度点击。
- 将按钮定名为 `创建 Agent 经验候选`。默认使用本地确定性映射，不调用 Codex/Claude、不产生模型费用、不直接写入 Library。未来 Agent 辅助必须成为单独的显式授权动作。
- 选择本地客户端 + Team Hub。默认只同步结构化元数据，正文通过预览与显式授权共享；共享正文默认保留 30 天。
- 团队默认展示聚合，不显示成员排行榜；个人 run 和 Learning 状态默认私有。
- 选择测试和人工反馈作为 Evals 主要真值，LLM judge 仅辅助；未经用户确认或受控实验不得做强因果宣称。
- 选择独立 `.codetrap/observations/ledger.sqlite`，以旁路方式接入现有 store；不把 `.codetrap/` 变成网络共享数据库。
- 将个人 LearningProgress 与 Insight 内容分离，为多用户和隐私边界预留正确模型。
- 设计仅落文档，不修改当前未提交的 Learning source-coverage 实现，也不触发外部写入、Agent 调用或遥测上传。
- 增加独立 Evals HTML 原型；首版“证据实验台”视觉经用户反馈后被替换为更克制的开发工具界面，直接参考本地 DeepSeek Harness 的浅灰白壳层、紧凑间距、三栏下钻、蓝色选中态、时间轴 lanes 和事件账本，但不复制其品牌或源码。
- 原型保留 Codetrap 的 Baseline/Candidate 摘要、逐 case 结果和右侧证据检查，并支持 case 选择、DeepSeek Harness 风格轨迹抽屉、人工评价、观测/受控模式提示和新建实验安全说明；新建实验不会启动 Agent。
- 增加本机 Chrome/Edge 无头校验脚本，覆盖六条 case 渲染、核心交互 smoke 和窄屏横向溢出检查；Windows 无头 Chrome 的最小布局宽度会影响 390px 截图裁切，但不改变实际移动浏览器的 CSS 布局。
