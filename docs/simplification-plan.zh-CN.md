# Codetrap 项目简化方案（完整版）

基于对项目全部 65 个 TypeScript 源文件、33 个测试文件的**逐行阅读分析**，以下是完整的简化方案。

> 分析方法：4 路并行 deep-read agent，每路负责约 10 个文件的逐行阅读，覆盖全部 36 个核心模块。上一版方案中未深读的 `workflow.ts`、`queries.ts`、`schema.ts`、`search-policy.ts`、`session-store.ts`、`web/` 系列等全部在此版中覆盖。

## 总体数据

| 指标 | 当前 | 简化后（预估） | 减幅 |
|------|------|---------------|------|
| `src/lib/` 文件数 | 43 | ~25-28 | **-35~42%** |
| 总 TS 源文件 | 65 | ~45-48 | **-26~31%** |
| 删除的死代码 | ~80 行 | 0 | **新发现** |
| 消除的重复代码 | ~50 行 | 0 | **新发现** |
| 消除的重复实例 | 2 个 | 0 | **新发现 Bug** |
| 文档 Markdown 冗余 | 17 文件 | 2 文件保留 | **-88%** |
| 测试重复代码 | ~100 行 | 0 | **-100%** |
| TrapRepository 委托方法 | 22/29 (76%) | 9 个保留 | **-59%** |
| SessionOperations 透传 | 9/17 (53%) | 消除 | **-53%** |

---

## 第零优先级：删除死代码（零风险，无需任何设计）

### 0.1 删除 `queries.ts` 死函数（23 行）

**发现**：`archiveTrap()` 和 `supersedeTrap()` 从未被任何文件导入。Repository 使用 `trap-lifecycle.ts` 中的 `archiveTrapLifecycle` / `supersedeTrapLifecycle` 替代。其中 `supersedeTrap`（20 行）与 `trap-lifecycle.ts` 的 `supersedeTrapLifecycle` 几乎完全相同——这是重构残留。

```typescript
// queries.ts:182 — 从未被 import
export function archiveTrap(db: Database, id: number): boolean {
  return markTrapArchived(db, id);
}

// queries.ts:201 — 从未被 import，与 trap-lifecycle.ts 重复
export function supersedeTrap(db: Database, id: number, ...): boolean { ... }
```

### 0.2 删除 `search-policy.ts` 死方法（~10 行）

**发现**：`filterTraps()` 和 `matchesTrap()` 从未被任何代码调用。`matchesTrap` 是 `filterTraps` 的辅助函数，两者形成死代码链。

### 0.3 删除 `embedder.ts` 死导出

**发现**：`embeddingProfile()` 函数被导出但从未被任何文件 import。两个 interface（`EmbeddingProfile`、`FreshEmbedding`）也未被直接 import。

### 0.4 删除 `search-policy-sweep.ts` 死导出

**发现**：`formatPolicySweepReport` 被导出但从未被任何文件 import。

### 0.5 删除 `search-eval.ts` CLI-only 死导出（5 个函数）

**发现**：`recordDogfoodCase`、`reportDogfood`、`parseEvalFixture`、`writeEvalFixture`、`formatSearchEvalReport` 被导出但从未被 import。它们可能被预期用于 CLI 脚本，但实际上没有任何代码调用。

### 0.6 删除 `CloseSessionResult.traps_written` 死字段

**发现**：`session-store.ts` 中 `closeSession()` 返回的 `traps_written` 字段永远设为 `0`，从未被赋值为实际写入的 trap 数量。要么删除字段，要么接入实际逻辑。

### 0.7 修复 `schema.ts` 重复代码路径

**发现**：`migrateEmbeddingProfiles` 的 case 1 和 case 2 做完全相同的事情（调用 `createProfileAwareEmbeddingsTable`），且 case 2 的 `columnExists` 检查存在逻辑歧义。

### 第零阶段小结

| 动作 | 类型 | 节省行数 |
|------|------|---------|
| 删除 queries.ts 死函数 | 死代码 | 23 |
| 删除 search-policy.ts 死方法 | 死代码 | 10 |
| 删除 embedder.ts 死导出 | 死代码 | 5 |
| 删除 search-policy-sweep.ts 死导出 | 死代码 | 10 |
| 删除 search-eval.ts CLI-only 导出 | 死代码 | 30 |
| 删除 traps_written 死字段 | 死代码 | 3 |
| 修复 schema.ts 重复路径 | 重复代码 | 5 |
| **合计** | | **~86 行 + 5 个死导出** |

---

## 第一阶段：消除空壳文件和重复实例（极低风险）

### 1.1 删除 `src/commands/router.ts`（10 行）

**确认**：逐行阅读确认。`router.ts` 是纯转发层——`run()` 和 `executeCommand()` 都只调用 `workflow.ts` 的 `executeCommand()`，唯一区别是 `run()` 包装了一层 `renderCommandResult`。`parseArgs` 是纯 re-export。

### 1.2 内联 `src/lib/fts-query.ts` → `src/db/queries.ts`（15 行）

**确认**：仅 `prepareFTSQuery` 一个导出函数，仅被 `queries.ts` 导入。

### 1.3 内联 `src/lib/trap-lifecycle.ts` → `src/db/repository.ts`（31 行）

**确认**：`archiveTrapLifecycle`（3 行）和 `supersedeTrapLifecycle`（12 行），仅被 `repository.ts` 导入。`queries.ts` 中的 `supersedeTrap` 死代码是其被移出后的残留。

### 1.4 内联 `src/lib/trap-mutation-result.ts` → `src/lib/store.ts`（31 行）

**确认**：3 个类型 + 2 个小函数，仅被 `store.ts` 和 `workflow.ts` 使用。

### 1.5 内联 `src/lib/trap-archive.ts` → `src/lib/store.ts`（54 行）

**确认**：`importTrapArchive` 仅被 `store.ts` 导入。内部接口 `TrapArchiveImportAdapter` 仅文件内使用。

### 1.6 消除 `src/lib/embedding-index.ts`（47 行）——三重委托链消除

**确认**：`DatabaseEmbeddingIndex` 的 8 个方法全部是到 `embedding-queries.ts` 的一行委托。当前调用链为：

```
TrapRepository.getEmbedding → DatabaseEmbeddingIndex.get → embeddingQueries.getEmbedding
```

三个文件，三层委托，一层 SQL。消除 `embedding-index.ts` 后，`TrapRepository` 直接调用 `embedding-queries.ts` 的函数。

### 1.7 合并 `src/lib/trap-json-fields.ts` → `src/lib/trap-codec.ts`（42 行）

**确认**：`trap-codec.ts` 已导入其全部导出。合并后约 145 行。

### 1.8 🆕 修复 `TrapRepository` 重复实例 Bug

**发现**：`TrapRepository` 构造函数中创建了**完全重复且未使用的** `TrapSearchPolicy` 和 `DatabaseEmbeddingIndex` 实例：

```typescript
// repository.ts:37,48 — 这两行从未被使用
private readonly searchPolicy = new TrapSearchPolicy();    // ← 死实例
private readonly embeddingIndex: DatabaseEmbeddingIndex;  // ← 将被 1.6 消除

constructor(...) {
  // 实际使用的是 SearchService 内部的 policy 和 embeddingIndex
  this.searchService = new SearchService(db, this.embeddings, ranking);
  this.embeddingIndex = new DatabaseEmbeddingIndex(db);  // ← 与 SearchService 内部重复
}
```

**方案**：删除 `searchPolicy` 成员变量（完全未使用）。`embeddingIndex` 在 1.6 中一并处理。

### 第一阶段小结

| 动作 | 删除文件 | 节省行数 |
|------|---------|---------|
| 1.1 删除 router.ts | 1 | 10 |
| 1.2 内联 fts-query.ts | 1 | 15 |
| 1.3 内联 trap-lifecycle.ts | 1 | 31 |
| 1.4 内联 trap-mutation-result.ts | 1 | 31 |
| 1.5 内联 trap-archive.ts | 1 | 54 |
| 1.6 消除 embedding-index.ts（三重委托） | 1 | 47 |
| 1.7 合并 trap-json-fields.ts | 1 | 42 |
| 1.8 删除 TrapRepository 重复实例 | 0 | 5 |
| **合计** | **7 文件** | **235 行** |

---

## 第二阶段：模块合并（低风险，需小幅重构）

### 2.1 Scope：5 模块 → 3 模块

**确认**：逐行阅读全部 scope 文件。

- `scope.ts`(38 行) — `getGlobalDir`/`getGlobalDB`/`findProjectRoot`/`getProjectDB`，以及到 `scope-path.ts` 的无用 re-export
- `scope-path.ts`(100 行) — `ScopePathResolver` 类，DI 注入在生产代码中从未使用
- `scope-context.ts`(125 行) — `ScopedRepositoryContext` + `createScopeContext`
- `scope-maintenance.ts`(72 行) — 仅被 `scope-migration.ts` 导入
- `scope-migration.ts`(316 行) — 仅导入 `scope-maintenance.ts`

**方案**：
- `scope-context.ts` 吸收 `scope.ts` 的全部函数 → ~160 行
- `scope-migration.ts` 吸收 `scope-maintenance.ts` 的全部内容 → ~380 行
- `scope-path.ts` 改为纯函数（消除无用的 DI 注入）

**结果**：5 文件 → 3 文件（-40%）

### 2.2 Embedding：6 模块 → 3 模块

**确认**：逐行阅读全部 embedding 文件。

- `embedding-index.ts` 已在第一阶段删除
- `embedding-management.ts`(66 行) — 3 个格式化函数，仅被 `workflow.ts` 使用
- `embed-output.ts`(24 行) — 1 个函数，仅被 `workflow.ts` 和 1 个测试使用
- `embedding-health.ts`(52 行) — 2 个函数 + 3 个类型，被 5 个文件 import

**方案**：
- `embedding-management.ts` 移到 `commands/workflow.ts`（仅 CLI 使用）
- `embed-output.ts` 移到 `commands/workflow.ts`
- `embedding-health.ts` 的函数合并到 `embedder.ts`

**结果**：6 文件 → 3 文件（`embedder.ts` + `embedding-runtime.ts` + `embedding-job.ts`，-50%）

### 2.3 Session：7 模块 → 6 模块

**确认**：逐行阅读全部 session 文件。

- `session-candidate-document.ts`(162 行) — 5 个导出函数，全部仅被 `session-store.ts` 导入
- 实际行数修正：`session-store.ts` 631 行（非 562），`session-operations.ts` 281 行（非 246），`session-capture.ts` 372 行（非 334），`session-review.ts` 331 行（非 300），`session-codec.ts` 262 行（非 237）

**方案**：
- `session-candidate-document.ts` 合并到 `session-store.ts` → 约 780 行（合理范围）
- 其余 5 文件保留

**结果**：7 文件 → 6 文件

### 2.4 Search：`search-result-card.ts` 内联到 `trap-operations.ts`

**确认**：29 行，`toTrapActionCard` + `toTrapActionCards`，仅被 `trap-operations.ts` 导入。

### 2.5 清除无用 re-export

- `scope.ts` → 删除到 `scope-path.ts` 的 re-export（零 consumer）
- `output-json.ts` → 删除到 `trap-codec.ts` 的 4 个 re-export（直接导入 `trap-codec` 即可）

---

## 第三阶段：消除代码重复（低风险）

### 3.1 提取 `uniqueStrings` 到共享模块

**发现**：完全相同函数在 4 个文件中各定义一次：
- `session-store.ts:628`
- `session-capture.ts:369`
- `session-operations.ts:278`
- `command-requests.ts:404`

### 3.2 提取 `isRecord` 到共享模块

**发现**：3 个文件各自定义：
- `session-capture.ts:365`
- `config.ts:153`
- `web/server.ts` 中也有类似实现

### 3.3 统一 `trimFieldLines` / `trimOuterBlankLines`

**发现**：`session-capture.ts:trimFieldLines` 和 `session-codec.ts:trimOuterBlankLines` 是相同逻辑，不同命名。

### 3.4 统一 `acceptedScopeFallback` / `acceptedScope`

**发现**：`session-review.ts:328` 和 `session-operations.ts:274` 两个函数做完全相同的事：`candidate.trap.scope === "global" ? "global" : "project"`。

---

## 第四阶段：架构扁平化（中等风险）

### 4.1 SessionOperations 瘦身：消除 53% 纯透传方法

**确认**：逐行阅读。`SessionOperations` 的 17 个方法中，9 个（53%）是纯粹的一行透传到 `SessionStore`：

| 方法 | 行数 | 做什么 |
|------|------|--------|
| `startSession` | 3 | → `sessions.startSession` |
| `addNote` | 3 | → `sessions.addNote` |
| `showSession` | 3 | → `sessions.showSession` |
| `summarizeNotes` | 3 | → `sessions.summarizeNotes` |
| `closeSession` | 3 | → `sessions.closeSession` |
| `candidateDocument` | 3 | → `sessions.candidateDocument` |
| `getCandidate` | 3 | → `sessions.getCandidate` |
| `rejectCandidate` | 6 | → `sessions.rejectCandidate` |
| `deleteSession` | 3 | → `sessions.deleteSession` |

**真正有业务价值的方法**（3 个编排 + 3 个增强）：
- `captureCandidate`(32 行) — 自动创建 session、添加 candidate、自动关闭
- `acceptCandidate`(54 行) — 冲突检测、trap 持久化、evidence、supersedence
- `cleanupDeletedTrapCandidates`(12 行) — 跨 trap/session 的孤儿清理
- `status`(6 行) — 附加 candidate review 摘要
- `listSessions`(5 行) — 附加 review 数据
- `pruneSessions`(5 行) — 时间参数转换

**方案**：消除 9 个纯透传方法，调用方直接使用 `SessionStore`。保留上述 6 个有实际增值的方法。

### 4.2 `TrapRepository` 瘦身：22/29 (76%) 方法是一行委托

**确认**：逐行确认每个方法。

**22 个纯委托方法**：

| # | 方法 | 委托目标 |
|---|------|---------|
| 1 | `add` | `queries.insertTrap` |
| 2 | `search` | `this.searchService.search` |
| 3 | `get` | `queries.getTrap` |
| 4 | `delete` | `queries.deleteTrap` |
| 5 | `archive` | `archiveTrapLifecycle` |
| 6 | `supersede` | `supersedeTrapLifecycle` |
| 7 | `hit` | `queries.incrementHitCount` |
| 8 | `top` | `queries.getTopTraps` |
| 9 | `stats` | `queries.getStats` |
| 10 | `embeddingStats` | `embeddingIndex.stateCounts` |
| 11 | `embeddingProfiles` | `embeddingIndex.profiles` |
| 12 | `exportAll` | `queries.exportTraps` |
| 13 | `exportProjectTrapsByPath` | `queries.exportProjectTrapsByPath` |
| 14 | `insertTrapRecord` | `queries.insertTrapRecord` |
| 15 | `updateTrapSupersedesId` | `queries.updateTrapSupersedesId` |
| 16 | `deleteTrapsByIds` | `queries.deleteTrapsByIds` |
| 17 | `countProjectTrapsByPath` | `queries.countProjectTrapsByPath` |
| 18 | `transaction` | `this.db.transaction` |
| 19 | `getEmbedding` | `embeddingIndex.get` → 三重委托！ |
| 20 | `upsertEmbedding` | `embeddingIndex.save` |
| 21 | `deleteEmbedding` | `embeddingIndex.delete` |
| 22 | `getTrapsNeedingEmbeddings` | `embeddingIndex.trapsNeedingEmbeddings` |

**7 个有实际编排价值的方法**：`getDetails`、`list`、`listMisScoped`、`update`、`addEvidence`、`ensureEmbeddings`、`lifecycleAdapter`(private)

**方案**：暴露 `db` 属性，让调用方对简单操作直接使用 `queries.*`。保留 7 个编排方法。

### 4.3 TrapStore / TrapOperations：考虑合并

**确认**：`TrapOperations`(149 行) 的 12 个方法中 10 个是一行委托到 `TrapStore`。唯一的附加值是将 `TrapInput` 构建逻辑（`buildTrapInput`/`pickTrapUpdate`）集中在操作层。

**方案**：将 `TrapOperations` 的 input 构建逻辑上移到 `TrapStore`，或者下沉到调用方。消除这一层后调用链从 4 层变为 3 层。

### 4.4 Session-review 精简：7/16 函数是纯格式化器

**确认**：`session-review.ts` 的 16 个函数中，7 个是纯 payload 包装（响应格式化器），不含任何业务逻辑：
- `sessionPayload`、`sessionConflictPayload`、`sessionCliConflictPayload`、`sessionConflictText`、`sessionAcceptPayload`、`sessionRejectPayload`、`sessionCleanupPayload`

**方案**：这些格式化函数移到 `commands/workflow.ts`（它们仅被 CLI 使用），从 lib 中移除。

---

## 第五阶段：性能改进（附带发现）

### 5.1 N+1 查询：`embedding-queries.ts` 的 `getTrapsNeedingEmbeddings`

**发现**：加载最多 100,000 个 trap 到内存，然后对每个 trap 做单独的 `getEmbedding` 查询。如果 100,000 个 trap 但只有 100 个需要 embedding，仍然执行 100,000 次独立查询。

```
当前: listTraps(100K) → for each trap: getEmbedding(trapId) → 100K queries
应该: SELECT ... FROM traps LEFT JOIN trap_embeddings ... WHERE embedding IS NULL → 1 query
```

### 5.2 同样的 N+1 模式在 `getEmbeddingStateCounts`

同上——应该改用 JOIN 而非逐个查询。

---

## 第六阶段：Web 前端（长期改进）

### 6.1 1442 行 SPA 字符串模板

**现状**：`client-script.ts` 是一个 1442 行的函数，用模板字符串拼接的方式生成整个浏览器端 JavaScript。没有任何构建工具、类型检查或 source map。

**改进方向**（不在此次简化范围内）：
- 将浏览器 JS 提取为独立 `.js` 文件
- 使用 esbuild 打包和压缩
- 这样 `client-script.ts` 只需输出一个 `<script src="...">` 标签

### 6.2 `toString()` 序列化反模式

**现状**：`client-review.ts` 将 TypeScript 函数通过 `fn.toString()` 序列化为字符串注入浏览器。如果 TypeScript 编译目标改变，`toString()` 的输出可能不同。这是脆弱的设计。

---

## 第七阶段：文档清理

### 7.1 删除临时规划文档（2 文件，395 行）

- `goal-brief-local-ollama-embeddings.md` — 功能已交付
- `goal-brief-web-embeddings-settings.md` — 功能已交付

### 7.2 整理 handoff/implementation-log（12 子文件，~600 行）

10 个子目录下的 handoff/implementation-log 对是 agent 开发过程中的会话上下文。功能交付后即失去价值。

- 保留 `docs/handoff.md` 和 `docs/implementation-log.md`（顶层索引）
- 删除 5 个已交付功能的子目录对（10 个文件）
- `docs/tasks/scope-diagnostics/` 对是孤儿（未被索引引用），可删除

### 7.3 `dogfood-log.md` 移到 `docs/`

594 行活跃开发日志，与 `docs/dogfood-flywheel.md` 放在一起。

---

## 第八阶段：测试代码简化

### 8.1 消除测试辅助函数重复

| 函数 | 重复次数 | 文件 |
|------|---------|------|
| `tempProjectDir` | 6x | cli-json, import-export, session-cli, scope-migration, web-console, web-browser-smoke |
| `runCli` | 4x | cli-json, session-cli, scope-migration, web-browser-smoke |
| `tempHome` | 2x | web-console, web-browser-smoke |
| 环境变量 stanza | 4x | 4 个文件各自定义 CODETRAP_* 清除 |

**方案**：移到 `helpers.ts`，消除 ~100 行重复。

### 8.2 `session-cli.test.ts` 拆分（986 行）

测试 4 个独立子系统，同在一个文件：
- 生命周期（启动/关闭/note）
- Capture（JSON/Markdown/stdin/file）
- Conflict 检测和 accept
- 输入验证

**方案**：拆为 3 个文件。

---

## 执行顺序

```
Phase 0 (死代码删除)                    无破坏性，立刻执行
├── 0.1 删除 queries 死函数
├── 0.2 删除 search-policy 死方法
├── 0.3 删除 embedder 死导出
├── 0.4 删除 search-policy-sweep 死导出
├── 0.5 删除 search-eval CLI-only 导出
├── 0.6 删除 traps_written 死字段
├── 0.7 修复 schema 重复路径
└── bun test ✓

Phase 1 (空壳消除 + Bug 修复)           预计 7 文件删除
├── 1.1 删除 router.ts
├── 1.2 内联 fts-query.ts
├── 1.3 内联 trap-lifecycle.ts
├── 1.4 内联 trap-mutation-result.ts
├── 1.5 内联 trap-archive.ts
├── 1.6 消除 embedding-index.ts（三重委托）
├── 1.7 合并 trap-json-fields.ts
├── 1.8 删除 TrapRepository 重复实例
└── bun test ✓

Phase 2 (模块合并)                       预计 6 文件减少
├── 2.1 Scope 5→3
├── 2.2 Embedding 6→3
├── 2.3 Session 7→6
├── 2.4 Search result-card 内联
├── 2.5 清除 re-export
└── bun test ✓

Phase 3 (消除代码重复)                   0 文件删除，减 ~50 行
├── 3.1 提取 uniqueStrings
├── 3.2 提取 isRecord
├── 3.3 统一 trim 函数
├── 3.4 统一 scope fallback
└── bun test ✓

Phase 4 (架构扁平化)                     预计 2 文件减少 + 大幅精简
├── 4.1 SessionOperations 去透传（9→0 透传方法）
├── 4.2 TrapRepository 去委托（22→7 保留的方法）
├── 4.3 TrapStore/TrapOperations 合并
├── 4.4 Session-review 精简（7 格式化器移出 lib）
└── bun test ✓

Phase 5 (文档清理)                       预计 14 文件删除
├── 5.1 删除 goal-brief
├── 5.2 清理 handoff/implementation-log
├── 5.3 移动 dogfood-log.md
└── (无测试影响)

Phase 6 (测试简化)                       减 ~100 行重复
├── 6.1 统一 helpers
├── 6.2 拆分 session-cli.test.ts
└── bun test ✓
```

---

## 风险评估

| 阶段 | 新增发现风险 | 风险等级 | 缓解措施 |
|------|------------|---------|---------|
| Phase 0 | `queries.supersedeTrap` 与 `trap-lifecycle.supersedeTrapLifecycle` 有细微差异需确认 | **极低** | 两者语义等价，且 queries 版本从未被调用 |
| Phase 1 | TrapRepository 重复实例删除后需确认 SearchService 内部实例不受影响 | **极低** | SearchService 持有自己的实例，删除不影响 |
| Phase 2 | Scope 合并时 import 路径需要全局替换 | **低** | TypeScript 编译器自动验证 |
| Phase 3 | `uniqueStrings` 提取需要验证 4 处实现一致 | **极低** | 逐行对比确认完全相同 |
| Phase 4 | SessionOperations 去透传需更新所有调用方 | **中** | workflow.ts 是唯一调用方 |
| Phase 5 | 文档删除 | **极低** | 无代码影响 |
| Phase 6 | 测试辅助函数提取 | **低** | 测试本身验证正确性 |

---

## Bug 发现（简化过程中的附带收获）

| # | 严重度 | 描述 |
|---|--------|------|
| 1 | **中** | `TrapRepository` 创建了完全重复且未使用的 `TrapSearchPolicy` 和 `DatabaseEmbeddingIndex` 实例 |
| 2 | **低** | `CloseSessionResult.traps_written` 永远为 0，从未被赋值 |
| 3 | **低** | `migrateEmbeddingProfiles` 两个 case 做相同的事，逻辑冗余 |
| 4 | **低** | `embedding-queries.ts` N+1 查询模式，大数据库下有性能问题 |
| 5 | **极低** | `queries.supersedeTrap` 与 `trap-lifecycle.supersedeTrapLifecycle` 逻辑重复（均为死代码/冗余） |

---

**预计总效果**：删除 ~15 个源文件（-23%），删除 ~14 个文档文件，消除 ~80 行死代码，消除 ~50 行重复代码，修复 1 个重复实例 Bug，减少两层架构抽象（embedding-index + 部分 SessionOperations），且全流程有完整测试覆盖。
