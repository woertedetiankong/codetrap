# Codetrap 剩余简化状态

创建日期：2026-06-06  
来源：`goal-brief-remaining-simplification.md`、`docs/simplification-plan.zh-CN.md`、当前源码复核  
状态：完成。

## 总结

- 已实现：`0.7`、`1.6` 的有价值部分、`2.5`、`3.1`、`3.2`、`3.3`、`3.4`。
- 已由上一批完成：`0.1`、`0.2` 的 `filterTraps` 部分、`0.3` 的 `embeddingProfile` / `EmbeddingProfile` 部分、`0.6`、`5.1`、`5.2`、`8.1`。
- 误报或保留：`matchesTrap`、`FreshEmbedding`、`formatPolicySweepReport`、search-eval exports、多个小模块边界、`TrapRepository.searchPolicy`。
- 延后：中风险扁平化、Web 构建/序列化重构、文档归档/移动、`session-cli.test.ts` 大拆分。

## 第零优先级

- [x] `0.1` 删除 `queries.ts` 死函数：已完成。当前 `src/db/queries.ts` 不再导出旧 `archiveTrap(db, id)` / `supersedeTrap(db, ...)`；生命周期仍由 `src/lib/trap-lifecycle.ts` 和 `src/db/repository.ts` 组合。
- [x] `0.2` 删除 `search-policy.ts` 死方法：部分已完成，部分误报。`filterTraps` 已移除；`matchesTrap` 仍被 `TrapRepository.list()` 调用，用于 list 后的 path/module/owner applicability 过滤，不能删除。
- [x] `0.3` 删除 `embedder.ts` 死导出：部分已完成，部分误报。`embeddingProfile` / `EmbeddingProfile` 已移除；`FreshEmbedding` 仍被 `src/db/embedding-queries.ts` 使用。
- [x] `0.4` `search-policy-sweep` 死导出：误报。`scripts/search-policy-sweep.ts` 仍导入 `formatPolicySweepReport`。
- [x] `0.5` `search-eval` CLI-only 死导出：误报。`scripts/dogfood-eval.ts` 仍导入 `recordDogfoodCase`、`reportDogfood`、`parseEvalFixture`、`writeEvalFixture`、`formatSearchEvalReport`。
- [x] `0.6` 删除 `CloseSessionResult.traps_written`：已完成。`rg traps_written` 应只剩状态文档或历史计划引用。
- [x] `0.7` 简化 `migrateEmbeddingProfiles` 重复路径：本轮已实现。`src/db/schema.ts` 现在用一个早返回覆盖“无表”和“已 profile-aware”两种状态；`src/tests/embedding-profile-storage.test.ts` 覆盖无表、已 profile-aware、legacy v5 三种迁移路径。

## 第一阶段

- [ ] `1.1` 删除 `src/commands/router.ts`：保留。当前 `src/index.ts` 通过 router 进入 CLI，`src/tests/search-safety.test.ts` 通过 router 测 `parseArgs`；AGENTS 也允许它作为可选薄适配器存在。删除收益小于入口和测试重接线成本。
- [ ] `1.2` 内联 `src/lib/fts-query.ts`：保留。`prepareFTSQuery` 是 FTS5 literal escaping 的专门测试面，`src/tests/search-safety.test.ts` 直接覆盖特殊字符和 quote 行为。
- [ ] `1.3` 内联 `src/lib/trap-lifecycle.ts`：保留。它命名 archive/supersede lifecycle transition 语义，避免把状态 key、transaction、evidence 相关逻辑混回 repository。
- [ ] `1.4` 内联 `src/lib/trap-mutation-result.ts`：保留。CLI/MCP 共用 mutation fallback/result 语义，删除会导致适配器重复。
- [ ] `1.5` 内联 `src/lib/trap-archive.ts`：保留。`TrapStore` 通过它隔离 archive import compatibility；这是格式兼容边界，不只是文件数问题。
- [x] `1.6` 删除 `src/lib/embedding-index.ts`：本轮已实现。`TrapRepository` 和 `SearchService` 直接调用 `src/db/embedding-queries.ts`；`src/lib/embedding-index.ts` 已删除。
- [ ] `1.7` 合并 `trap-json-fields.ts` 到 `trap-codec.ts`：拒绝。当前非 codec 调用者很多，包括 `queries.ts`、`format.ts`、`trap-search-document.ts`、`session-conflicts.ts`、`trap-scope-match.ts`、`search-policy.ts`、`trap-transfer.ts` 和专门测试；保留字段级 codec 更清晰。
- [x] `1.8` `TrapRepository` 重复实例：重分类并部分完成。原计划称 `searchPolicy` 未使用是误报，它被 `list()` 使用；`embeddingIndex` 委托层随 `1.6` 删除。

## 第二阶段

- [ ] `2.1` Scope 模块合并：部分完成，主要保留。`scope.ts` 到 `scope-path.ts` 的 pass-through re-export 已删除，调用方改为直接 import `scope-path`；`scope-context.ts`、`scope-maintenance.ts`、`scope-migration.ts` 和 `scope-path.ts` 仍保留，因为它们分别承担 repository context、maintenance safety、workflow orchestration、cross-platform path normalization。
- [ ] `2.2` Embedding 模块合并：部分完成。`embedding-index.ts` 已删除；`embedding-management.ts`、`embed-output.ts`、`embedding-health.ts` 保留，因为它们分别是 CLI presentation、CLI/tested output、provider/runtime health summary。
- [ ] `2.3` 合并 `session-candidate-document.ts`：保留。该文件是 pure `candidate-traps.json` transition layer；`SessionStore` 继续只管文件持久化和 session state。
- [ ] `2.4` 内联 `search-result-card.ts`：保留。action-card shaping 有独立测试和 CLI/MCP adapter 价值。
- [x] `2.5` 清理无用 re-export：本轮已实现。`scope.ts` 不再 re-export `scope-path`；`output-json.ts` 不再 re-export trap-codec helpers/types。

## 第三阶段

- [x] `3.1` 提取 `uniqueStrings`：本轮已实现。共享实现位于 `src/lib/string-list.ts`；`command-requests.ts` 保留边界处的 `undefined` 返回包装。
- [x] `3.2` 提取 `isRecord`：本轮已实现。共享实现位于 `src/lib/value-types.ts`，调用方保留各自错误消息和解析策略。
- [x] `3.3` 统一 trim helpers：本轮已实现。共享 `trimOuterBlankLines` 位于 `src/lib/text-lines.ts`；`session-capture.ts` 仍在字段边界执行 `.join("\n").trim()` 以保留原行为。
- [x] `3.4` 统一 accepted scope fallback：本轮已实现。共享 `candidateAcceptedScope` 位于 `src/lib/session-candidate-scope.ts`，供 session review 和 cleanup 使用。

## 第四阶段

- [ ] `4.1` 瘦身 `SessionOperations`：延后。当前 CLI、Web、doctor 和测试都以 `SessionOperations` 为共享执行层，文档也要求适配器不要重复候选 accept/conflict/evidence/maintenance 语义。去透传会扩大调用面，收益不足。
- [ ] `4.2` 瘦身 `TrapRepository` / 暴露 db：延后并限制。直接调用 `embedding-queries.ts` 已消除一个真实委托层；广泛暴露 raw db 会违反 raw SQL 只在 `src/db/` 的边界，并可能把查询策略扩散到上层。
- [ ] `4.3` 合并 `TrapOperations` 到 `TrapStore`：延后。`TrapOperations` 仍集中 CLI/MCP input building、scope fallback 和 action-card conversion，删除会让 adapter 或 store 吃掉不属于自己的职责。
- [ ] `4.4` 移动 session-review formatter：延后。`session-review.ts` 目前同时服务 CLI、Web 和测试，并且已区分 transport-neutral payload 与 CLI-only conflict presenter；不再拆动。

## 第五阶段 / 性能

- [x] `5.1` `getTrapsNeedingEmbeddings` N+1：已完成。`src/db/embedding-queries.ts` 通过 `LEFT JOIN trap_embeddings` 获取 embedding state rows。
- [x] `5.2` `getEmbeddingStateCounts` N+1：已完成。`src/db/embedding-queries.ts` 复用 set-based state rows 和 `EXISTS` 查询。

## 第六阶段 / Web

- [ ] `6.1` `client-script.ts` 大文件：延后。当前无前端 build pipeline，引入 esbuild 或 asset pipeline 超出本目标；仅记录为长期架构工作。
- [ ] `6.2` `client-review.ts` `fn.toString()` 序列化：延后。当前没有小而安全的替代方案；手写重复浏览器脚本会比现状更易漂移，真正修复应和浏览器脚本构建方案一起做。

## 第七阶段 / 文档

- [x] `7.1` 删除旧 goal brief：用户后续已删除 `goal-brief-local-ollama-embeddings.md` 和 `goal-brief-web-embeddings-settings.md`。相关日志改为把它们视为历史来源，不再要求文件保留。
- [ ] `7.2` 清理 handoff/implementation-log 子目录：保留。`docs/handoff.md` 明确索引这些 task-specific journals；删除会制造断链。
- [ ] `7.3` 移动 `dogfood-log.md`：拒绝/延后。`docs/dogfood-flywheel.md`、roadmap、handoff 和 `src/tests/agent-onboarding.test.ts` 都把根目录 `dogfood-log.md` 当作原始观察入口；移动会改变当前 guidance/test contract。

## 第八阶段 / 测试

- [x] `8.1` 消除测试 helper 重复：已完成。当前多个 CLI/Web/scope 测试从 `src/tests/helpers.ts` 引入 `tempProjectDir`、`tempHome`、`runCli`、`isolatedCliEnv` 等 helper。
- [ ] `8.2` 拆分 `src/tests/session-cli.test.ts`：延后。文件仍较大，但当前覆盖跨 session lifecycle、capture、conflict、accept/edit flow；拆分主要是文件组织工作，风险/收益不如本轮已完成的行为无关简化。

## 验证结果

- `codetrap search "codetrap simplification module merge dead code duplicate utilities architecture cleanup" --mode hybrid --json`：已运行并记录到 `dogfood-log.md`。返回 #3 applicability filters 和 #5 SQLite busy_timeout；本轮据此避免修改 search applicability 和 SQLite connection startup。
- Targeted tests：`bun test src/tests/embedding-profile-storage.test.ts src/tests/search-safety.test.ts src/tests/scope.test.ts src/tests/session-review.test.ts src/tests/session-cli.test.ts` 通过，26 tests passed。
- `bunx tsc --noEmit`：通过。
- `bun test src/tests`：通过，138 tests passed，0 failed。
- `git diff --check`：通过，无输出。
- `bun run eval:dogfood -- report`：通过，24 cases，Recall@3 = 1，Recall@5 = 1，MRR = 1。

## 最终复核

- `rg` 复核：`traps_written` 只剩历史计划/状态文档引用；`embedding-index` 只剩历史计划、状态、handoff/log 等文档引用。源码、README、CONTEXT 不再引用已删除的 `src/lib/embedding-index.ts`。
- `rg` 复核：`scope.ts` 不再 re-export `scope-path`；调用方直接从 `scope-path` 导入 path resolver。
- `rg` 复核：`output-json.ts` 不再 re-export trap-codec helpers/types。
- `git status --short` 仍显示进入本轮前已存在的脏工作树，以及本轮新增的状态文档和 helper 文件。未执行 commit/push/branch 操作。
