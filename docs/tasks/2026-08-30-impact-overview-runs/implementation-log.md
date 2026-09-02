# Implementation Log

> Created: 2026-08-30

## Task

实现真实 Ledger 驱动的 Impact Overview/Runs Web 纵向切片。

## Assumptions

- 第一版沿用现有三栏 Web shell：项目在左、Run 列表在右、Overview 或单 Run 详情在中，避免新增第二套导航模型。
- 只展示由结构化 metadata 直接支持的事实，不把 exposure、validation 或 feedback 自动表述为因果收益。

## Initial Approach

- 先建立不会创建持久状态的只读 Ledger API，再让 Impact UI 消费稳定 DTO；前端不得直接解释任意 event attributes。

## Log

### 2026-08-30

- 基线勘误：上一 handoff/NEXT-SESSION 将同一组 recorder/CLI/MCP 测试写成 43 pass；本轮按其 restart 命令复跑实际为 21 pass、0 fail、96 expects，typecheck 通过。当前阶段以后使用可复现的命令输出，不传播 43 这个数字。
- Web GET 必须在 Ledger 不存在时返回 `not_configured`，而不是调用会创建 project identity、目录和 SQLite schema 的写入型 `openObservationLedger`。这是“浏览不产生数据”的信任边界。
- UI 方向选为蓝图式飞行记录器：复用三栏控制台与双语体系，用深蓝/电蓝、证据分类和纵向时间线形成辨识度；不照搬假数据原型的信息架构，也不引入外部字体或网络资源。
- 首次全量回归中，既有 session CLI 纵向测试在全套负载下耗时 5.207 秒，超过 Bun 默认 5 秒；单独复跑以 4.979 秒通过，证明不是产品回归。该测试同步启动多次真实 CLI 进程，因此为它显式设置 15 秒预算，保留断言和生产逻辑不变，避免机器负载把完整门禁变成随机失败。
- 最终验证：54 个聚焦 Observation/Web tests 通过并保留 1 个既有 browser skip；全量 480 pass、1 skip、0 fail；typecheck、本地 Windows build 和 diff check 通过。Journal strict scan 没有 error；广域扫描的 4 个 warning 来自 `README.md:1046-1047` 的既有相对时间文案和父路线图中的字面日期格式示例，不属于本阶段新增内容。
