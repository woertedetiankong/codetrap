import { describe, expect, test } from "bun:test";
import { WEB_TEXT, WEB_TEXT_JSON } from "../web/client-text";
import { WEB_INDEX_HTML } from "../web/static";

describe("web client text", () => {
  test("keeps locale dictionaries aligned and embeds them into the web shell", () => {
    expect(Object.keys(WEB_TEXT.zh).sort()).toEqual(Object.keys(WEB_TEXT.en).sort());
    expect(JSON.parse(WEB_TEXT_JSON)).toEqual(WEB_TEXT);
    expect(WEB_INDEX_HTML).toContain("\"action.deleteSession\"");
    expect(WEB_INDEX_HTML).toContain('id="delete-session"');
    expect(WEB_INDEX_HTML.match(/id="delete-session"/g)).toHaveLength(1);
    expect(WEB_INDEX_HTML).not.toContain("data-delete-session");
    expect(WEB_INDEX_HTML).not.toContain('class="row-action danger"');
    expect(WEB_TEXT.zh["session.status.closed"]).toBe("已关闭");
    expect(WEB_TEXT.zh["qualityWarning.actionableFix"]).toBe("修复方案还不够可执行。");
    expect(WEB_INDEX_HTML).toContain('id="review-summary"');
    expect(WEB_INDEX_HTML).toContain("reviewSummary.pending");
    expect(WEB_INDEX_HTML).toContain("\"nav.embeddings\"");
    expect(WEB_INDEX_HTML).toContain('data-main-view="embeddings"');
    expect(WEB_INDEX_HTML).toContain('data-main-view="impact"');
    expect(WEB_INDEX_HTML).toContain("impact.privacyCopy");
    expect(WEB_TEXT.zh["nav.impact"]).toBe("成效");
    expect(WEB_TEXT.zh["impact.intro"]).toContain("不把关联包装成因果结论");
    expect(WEB_TEXT.zh["impact.notConfiguredCopy"]).toContain("尚未生成本地观测记录");
    expect(WEB_TEXT.zh["impact.notConfiguredHint"]).toContain("不会改变真实概览或评测数据");
    expect(WEB_TEXT.zh["impact.previewDemo"]).toBe("预览一条示例轨迹");
    expect(WEB_TEXT.zh["impact.demoBadge"]).toContain("不会保存");
    expect(WEB_TEXT.zh["impact.connectionCopy"]).toContain("按项目开启");
    expect(WEB_TEXT.zh["impact.automaticCopy"]).toContain("只预览三个项目 Hook");
    expect(WEB_TEXT.zh["impact.automaticTrust"]).toContain("不会读取提示词");
    expect(WEB_TEXT.zh["impact.hookHealthBlockedTitle"]).toContain("容量上限");
    expect(WEB_TEXT.zh["impact.hookHealthRecovery"]).toContain("--apply");
    expect(WEB_TEXT.en["impact.hookHealthUnavailableCopy"]).toContain("Ledger is still available");
    expect(WEB_TEXT.en["impact.hookHealthUnavailableAction"]).toContain("will not delete or reset");
    expect(WEB_TEXT.zh["evals.intro"]).toContain("评测通过和实际有帮助，需要分别看证据");
    expect(WEB_TEXT.zh["evals.groundTruthCopy"]).toContain("确认后才会加入评测例子");
    expect(WEB_TEXT.zh["evals.externalChangesDeferredCopy"]).toContain("未保存文字保持不变");
    expect(WEB_TEXT.zh["evals.controlledTitle"]).toContain("基线版本");
    expect(WEB_TEXT.zh["evals.controlledBoundary"]).toContain("分开计算");
    expect(WEB_TEXT.zh["evals.profile.memory_contribution_v1.question"]).toContain("已确认");
    expect(WEB_TEXT.zh["evals.fixtureUnchanged"]).toContain("保持不变");
    expect(WEB_INDEX_HTML).toContain('id="embedding-form"');
    expect(WEB_INDEX_HTML).toContain('id="embedding-reindex-project"');
    expect(WEB_INDEX_HTML).toContain("JINA_API_KEY");
    expect(WEB_INDEX_HTML).toContain('data-embedding-provider="huggingface"');
    expect(WEB_TEXT.en["embedding.model.default.name"]).toContain("Default");
    expect(WEB_TEXT.en["embedding.model.quality.name"]).toContain("High quality");
    expect(WEB_TEXT.en["hint.localModelDownload"]).toContain("No Ollama is required");
    expect(WEB_INDEX_HTML).toContain('data-main-view="learning"');
    expect(WEB_INDEX_HTML).not.toContain('data-main-view="insights"');
    expect(WEB_TEXT.zh["nav.learning"]).toBe("学习");
    expect(WEB_TEXT.zh["empty.noLearningInsights"]).toContain("实践和保存经验都由你选择");
    expect(WEB_TEXT.zh["action.markLearned"]).toBe("标记已学习");
    expect(WEB_TEXT.zh["value.allProjects"]).toBe("全部项目");
    expect(WEB_TEXT.zh["action.previousChapter"]).toBe("上一篇");
    expect(WEB_TEXT.zh["meta.collectionProgress"]).toContain("已学习");
    expect(WEB_TEXT.zh["coverageBrief.complete"]).toBe("原文已核对");
    expect(WEB_TEXT.zh["title.sourceContext"]).toBe("文章来源背景");
    expect(WEB_TEXT.zh["action.collapseCollection"]).toContain("收起合集");
    expect(WEB_TEXT.zh["action.approveAndAddLearning"]).toBe("批准并加入学习架");
    expect(WEB_TEXT.zh["error.sessionExpired"]).toContain("重新连接");
    expect(WEB_TEXT.zh["auth.invalidTitle"]).toBe("重新连接工作台");
    expect(WEB_TEXT.zh["impact.viewOfflineEvals"]).toBe("查看离线评测");
    expect(WEB_TEXT.zh["evals.queueEmptyTitle"]).toBe("暂时没有待检查的问题");
    expect(WEB_TEXT.zh["value.proposed"]).toBe("待审核");
    expect(WEB_TEXT.zh["value.pitfall_trap"]).toBe("避坑规则");
    expect(WEB_TEXT.zh["action.accept"]).toBe("接受并写入");
    expect(WEB_TEXT.zh["action.approve"]).toContain("授权 Agent");
    expect(WEB_TEXT.zh["pill.learned"]).toBe("已学习");
    expect(WEB_TEXT.zh["prompt.learningGeneration"]).toContain("用ASCII流程图结合通俗易懂的例子讲解");
    expect(WEB_TEXT.en["prompt.learningGeneration"]).toContain("ASCII flow diagram");
    expect(WEB_INDEX_HTML).toContain("learning-prompt-card");
    expect(WEB_INDEX_HTML).toContain("learning-collection");
    expect(WEB_INDEX_HTML).toContain("collection-progress");
    expect(WEB_INDEX_HTML).toContain("collection-toggle");
    expect(WEB_INDEX_HTML).toContain("prompt.learningGeneration");
    expect(WEB_TEXT.zh["dialog.rejectScope"]).toContain("当前项目");
    expect(WEB_TEXT.zh["action.undoSuppression"]).toBe("允许今后再次提出");
    expect(WEB_INDEX_HTML).toContain('id="reject-dialog"');
    expect(WEB_INDEX_HTML).toContain('id="rename-session"');
  });

  test("embeds desktop pane splitters in the web shell", () => {
    expect(WEB_INDEX_HTML).toContain('data-splitter="left"');
    expect(WEB_INDEX_HTML).toContain('data-splitter="right"');
    expect(WEB_INDEX_HTML).toContain('class="edge-reveal edge-reveal-left"');
    expect(WEB_INDEX_HTML).toContain('class="edge-reveal edge-reveal-right"');
    expect(WEB_INDEX_HTML).toContain('id="sidebar-toggle"');
    expect(WEB_INDEX_HTML).toContain("shell-toggle-left");
    expect(WEB_INDEX_HTML).toContain('id="queue-toggle"');
    expect(WEB_INDEX_HTML).toContain("shell-toggle-right");
    expect(WEB_INDEX_HTML).toContain("codetrap-shell-layout");
    expect(WEB_INDEX_HTML).toContain("codetrap-sidebar-collapsed");
    expect(WEB_INDEX_HTML).toContain("codetrap-queue-collapsed");
    expect(WEB_INDEX_HTML).not.toContain("codetrap-detail-collapsed");
    expect(WEB_INDEX_HTML).toContain("Hide queue pane");
    expect(WEB_INDEX_HTML).not.toContain("Hide detail pane");
    expect(WEB_INDEX_HTML).toContain("SHELL_COLLAPSE_THRESHOLD");
    expect(WEB_INDEX_HTML).toContain("rail-peeking");
    expect(WEB_INDEX_HTML).toContain("queue-peeking");
  });

  test("keeps project navigation compact and content-first on narrow screens", () => {
    expect(WEB_INDEX_HTML).toContain('id="compact-workspace-toggle"');
    expect(WEB_INDEX_HTML).toContain('aria-controls="project-form workspace-list"');
    expect(WEB_INDEX_HTML).toContain(".queue .project-form,");
    expect(WEB_INDEX_HTML).toContain(".queue.compact-open .project-form");
    expect(WEB_INDEX_HTML).toContain(".queue.compact-open > .scroll");
    expect(WEB_INDEX_HTML).toContain('window.matchMedia("(max-width: 1060px)")');
    expect(WEB_INDEX_HTML).toContain("revealCompactDetail");
  });

  test("orders the shell as list, detail, then workspace", () => {
    const listIndex = WEB_INDEX_HTML.indexOf('<aside class="rail">');
    const detailIndex = WEB_INDEX_HTML.indexOf('<section class="detail">');
    const workspaceIndex = WEB_INDEX_HTML.indexOf('<section class="queue" id="workspace-pane">');

    expect(listIndex).toBeGreaterThan(-1);
    expect(detailIndex).toBeGreaterThan(-1);
    expect(workspaceIndex).toBeGreaterThan(-1);
    // The active view's list leads, the detail follows it, and project/session
    // switching sits last so it can be collapsed out of the way.
    expect(listIndex).toBeLessThan(detailIndex);
    expect(detailIndex).toBeLessThan(workspaceIndex);
    expect(WEB_INDEX_HTML).toContain('<div class="stack" id="candidates">');
    expect(WEB_INDEX_HTML).toContain("minmax(320px, 0.62fr) 8px minmax(460px, 1.7fr) 8px minmax(250px, 0.68fr)");
    // Default pane preferences are exercised by the browser platform tests.
  });

  test("keeps every colour in the token layer", () => {
    const rootStart = WEB_INDEX_HTML.indexOf(":root {");
    const rootEnd = WEB_INDEX_HTML.indexOf("}", rootStart);
    const outsideRoot = WEB_INDEX_HTML.slice(rootEnd);
    // Themeable colour belongs to :root. A literal anywhere else cannot follow a
    // palette change, which is how the console drifted to 277 loose colours.
    const literals = outsideRoot.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    expect(literals).toEqual([]);
  });

  test("ships the responsive Impact flight-recorder visual system on shared tokens", () => {
    expect(WEB_INDEX_HTML).toContain(".impact-hero");
    // Colour lives in the token layer now, so a hardcoded hex outside :root is
    // the regression this guards against.
    expect(WEB_INDEX_HTML).toContain("--accent: #0e5a6b");
    expect(WEB_INDEX_HTML).toContain("--warn: #8f5f16");
    expect(WEB_INDEX_HTML).toContain(".impact-timeline::before");
    expect(WEB_INDEX_HTML).toContain(".impact-event.human_label::before");
    expect(WEB_INDEX_HTML).toContain(".impact-metrics { grid-template-columns: repeat(2");
    expect(WEB_INDEX_HTML).toContain("prefers-reduced-motion: reduce");
    expect(WEB_INDEX_HTML).toContain(".evals-hero");
    expect(WEB_INDEX_HTML).toContain(".evals-lanes");
    expect(WEB_INDEX_HTML).toContain("conic-gradient(var(--accent)");
    expect(WEB_INDEX_HTML).toContain(".eval-metric-grid, .eval-rate-grid { grid-template-columns: 1fr;");
    expect(WEB_INDEX_HTML).toContain(".impact-empty-actions");
    expect(WEB_INDEX_HTML).toContain(".impact-onboarding-flow");
    expect(WEB_INDEX_HTML).toContain(".impact-connection-guide");
    expect(WEB_INDEX_HTML).toContain(".impact-auto-grid");
    expect(WEB_INDEX_HTML).toContain(".impact-demo-banner");
    expect(WEB_INDEX_HTML).toContain(".candidate-more-actions");
    expect(WEB_INDEX_HTML).toContain(".eval-review-workbench");
    expect(WEB_INDEX_HTML).toContain(".eval-review-flow");
    expect(WEB_INDEX_HTML).toContain(".eval-trap-option:has(input:checked)");
    expect(WEB_INDEX_HTML).toContain(".controlled-blueprint");
    expect(WEB_INDEX_HTML).toContain(".controlled-sides");
    expect(WEB_INDEX_HTML).toContain(".controlled-case.regressed");
  });
});
