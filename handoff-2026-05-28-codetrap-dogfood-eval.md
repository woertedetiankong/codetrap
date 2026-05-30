# codetrap 会话交接文档

Date: 2026-05-28
Workspace: `/Users/superstorm/Documents/Code/windsurf/codetrap`

## 1. 本轮会话做了什么

本轮主要围绕 codetrap 的产品定位和下一步开发方向：

- 对比 Anthropic "agents-that-remember" 演讲与 codetrap。
- 明确 codetrap 不是通用 agent memory / Dreaming，而是本地优先的 coding pitfall memory。
- 确认当前 `session` 闭环已经实现，但原来的 fallback 模板候选生成不符合用户真实工作流。
- 用户明确表示：每次记录踩坑主要通过 `codetrap-add` skill 让 Codex 帮忙结构化，不希望工具内部用规则模板猜候选。
- 因此做了产品调整：raw failure/test_failure/review/correction notes 只作为 notes/recap/evidence，不再自动生成 candidate trap。
- 随后讨论下一步方向，决定优先做 Dogfood Eval Flywheel，而不是继续堆 Web 或新功能。
- 已实现 Dogfood Eval Flywheel v1。

## 2. 关键产品决策

### Session candidate 生成边界

新边界：

```text
Codex / codetrap-add skill = 负责理解和提炼踩坑经验
codetrap core = 负责存储、候选状态、冲突检查、证据、生命周期和检索
```

具体行为：

- `session close --propose-traps` 只从显式包含 `Title` / `Context` / `Mistake` / `Fix` 的结构化 note 生成 candidate。
- raw failure/test_failure/correction/review 不再通过 fallback 模板变成 candidate。
- raw notes 仍保留在 `.codetrap/sessions/`，用于 recap、证据和人工追溯。

### Dogfood Eval Flywheel v1

目标不是先做 Web，也不是先加更多功能，而是证明：

```text
codetrap 的真实搜索结果是否能帮助 agent 避免重复踩坑。
```

第一版是 maintainer-only script，不是公开 `codetrap eval` CLI。

## 3. 当前未提交改动概览

当前工作树有未提交改动。执行过 `git status --short --untracked-files=all`，主要包括：

- `src/lib/session-capture.ts`
  - 删除 fallback candidate 生成逻辑。
  - `proposeCandidateTraps` 只走 explicit `Title/Context/Mistake/Fix` 解析。
- `src/tests/session-cli.test.ts`
  - raw `test_failure` 现在断言为 notes-only，`candidate_count: 0`。
- `scripts/dogfood-eval.ts`
  - 新增 Dogfood Eval Flywheel script。
- `src/tests/dogfood-eval.test.ts`
  - 新增 script 测试。
- `src/tests/search-eval.test.ts`
  - 允许 `phaseGate: "dogfood"` 和 dogfood metadata。
- `package.json`
  - 新增 script: `eval:dogfood`.
- 文档同步：
  - `README.md`
  - `CONTEXT.md`
  - `docs/session-mode-capture-spec.zh-CN.md`
  - `docs/codetrap-ascii-architecture.md`
  - `docs/codetrap-optimization-roadmap.zh-CN.md`
  - `docs/installation.md`
  - `codetrap-study-notes-2026-05-15.md`

注意：`AGENTS.md` 是本地存在但被 `.gitignore` 忽略的项目指导文件，本轮也同步过其中的 session-capture 规则，但它不会出现在普通 git diff 里。

## 4. Dogfood Eval Flywheel v1 已实现内容

新增入口：

```bash
bun run eval:dogfood -- report [--json]
bun run eval:dogfood -- report --live [--json]
bun run eval:dogfood -- record --json '<record>'
```

可选：

```bash
--fixture <path>
```

用于测试临时 fixture，不污染真实 `src/tests/fixtures/search-eval.json`。

### deterministic report

- 使用 in-memory fixture。
- 使用固定 eval embedder。
- 网络无关，适合 CI / 回归。
- 输出：
  - Recall@3
  - Recall@5
  - MRR
  - dogfood judgment counts
  - failures / misses / noisy_hits

### live report

- 使用当前真实 embedding provider 配置。
- 有 `JINA_API_KEY` 时走 Jina provider。
- 没有 provider 时显示 `semantic_available: false`，并统计 `hybrid_fallback_count` / `semantic_error_count`。
- 已验证 `JINA_API_KEY=` 空环境下可以正常报告 semantic unavailable，而不是崩掉。

### record

`record --json` 会追加 curated dogfood query：

必填：

```json
{
  "query": "...",
  "mode": "hybrid",
  "goldTrapIds": [1],
  "judgment": "useful_hit"
}
```

默认：

- `phaseGate: "dogfood"`
- `source: "dogfood"`
- `minRecallAt3: 1`
- `minRecallAt5: 1`

验证：

- unknown `goldTrapIds` 会失败，且不会写坏 fixture。
- 写入使用稳定 pretty JSON。

## 5. 已运行验证

已通过：

```bash
bun run eval:dogfood -- report --json
JINA_API_KEY= bun run eval:dogfood -- report --live --json
bun test src/tests/dogfood-eval.test.ts src/tests/search-eval.test.ts
bun test src/tests
bunx tsc --noEmit
bunx tsc --noEmit --ignoreConfig --target ESNext --module ESNext --moduleResolution bundler --types bun-types scripts/dogfood-eval.ts
```

一次错误命令也发生过：

```bash
bunx tsc --noEmit --target ESNext --module ESNext --moduleResolution bundler --types bun-types scripts/dogfood-eval.ts
```

它失败原因是指定文件时 tsconfig 不会被加载，需要加 `--ignoreConfig`。随后已用正确命令通过。

## 6. 新会话建议从哪里继续

建议下一轮先做这几件事：

1. Review 当前 diff。
   - 重点看 `scripts/dogfood-eval.ts` 的 schema、error handling 和 live fallback 行为。
   - 看是否需要把 eval fixture 类型抽到共享 module，避免 script 和 test 各自定义。
2. 运行一次真实 dogfood record。
   - 从最近一次真实 `codetrap search --mode hybrid --json` 中挑一个 query。
   - 用 `record --json` 写入 fixture。
   - 跑 deterministic report 和 live report。
3. 决定是否把 `eval:dogfood` 加进 `release:preflight`。
   - 当前没有加，因为它是 maintainer flywheel，不一定要阻塞 release。
4. 若准备提交或开 PR，先用高召回 review。

## 7. 建议新会话使用的 skills

- `codetrap-check`
  - 在继续改 eval/search/session 前查项目内已知坑。
- `code-review-high`
  - 准备提交前做高召回正确性 review，特别关注 script 对 fixture 的写入安全。
- `neat-freak`
  - 若继续修改 roadmap/README/docs，收尾时再次同步知识层。
- `office-hours`
  - 如果继续讨论“Web vs eval vs playbook export”的产品优先级。

## 8. 重要文件入口

- Dogfood script: `scripts/dogfood-eval.ts`
- Dogfood tests: `src/tests/dogfood-eval.test.ts`
- Existing eval test: `src/tests/search-eval.test.ts`
- Eval fixture: `src/tests/fixtures/search-eval.json`
- Session capture logic: `src/lib/session-capture.ts`
- Main roadmap: `docs/codetrap-optimization-roadmap.zh-CN.md`
- Session spec: `docs/session-mode-capture-spec.zh-CN.md`

## 9. 当前状态提醒

- 还没有 commit。
- 工作树包含本轮和上一轮的文档/代码改动。
- 不要误以为 `AGENTS.md` 没变：它被 `.gitignore` 忽略，不在 git status 里。
- 当前设计刻意不做 telemetry，也不自动挖 `.codetrap` 本地数据库；dogfood record 是 curated repo fixture。
