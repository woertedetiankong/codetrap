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
    expect(WEB_INDEX_HTML).toContain('id="embedding-form"');
    expect(WEB_INDEX_HTML).toContain('id="embedding-reindex-project"');
    expect(WEB_INDEX_HTML).toContain("JINA_API_KEY");
    expect(WEB_INDEX_HTML).toContain('data-main-view="learning"');
    expect(WEB_INDEX_HTML).not.toContain('data-main-view="insights"');
    expect(WEB_TEXT.zh["nav.learning"]).toBe("学习");
    expect(WEB_TEXT.zh["empty.noLearningInsights"]).toContain("陷阱不会自动复制到这里");
    expect(WEB_TEXT.zh["action.markLearned"]).toBe("标记已学习");
    expect(WEB_TEXT.zh["value.allProjects"]).toBe("全部项目");
    expect(WEB_TEXT.zh["action.previousChapter"]).toBe("上一篇");
    expect(WEB_TEXT.zh["meta.collectionProgress"]).toContain("已学习");
    expect(WEB_TEXT.zh["coverageBrief.complete"]).toBe("原文已核对");
    expect(WEB_TEXT.zh["title.sourceContext"]).toBe("文章来源背景");
    expect(WEB_TEXT.zh["action.collapseCollection"]).toContain("收起合集");
    expect(WEB_TEXT.zh["action.approveAndAddLearning"]).toBe("批准并加入学习架");
    expect(WEB_TEXT.zh["error.sessionExpired"]).toContain("新打开");
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
    expect(WEB_INDEX_HTML).toContain(".rail .project-form,");
    expect(WEB_INDEX_HTML).toContain(".rail.compact-open .project-form");
    expect(WEB_INDEX_HTML).toContain(".rail.compact-open > .scroll");
    expect(WEB_INDEX_HTML).toContain('window.matchMedia("(max-width: 1060px)")');
    expect(WEB_INDEX_HTML).toContain("revealCompactDetail");
  });

  test("places the detail pane before the queue pane in the web shell", () => {
    const detailIndex = WEB_INDEX_HTML.indexOf('<section class="detail">');
    const queueIndex = WEB_INDEX_HTML.indexOf('<section class="queue">');

    expect(detailIndex).toBeGreaterThan(-1);
    expect(queueIndex).toBeGreaterThan(-1);
    expect(detailIndex).toBeLessThan(queueIndex);
    expect(WEB_INDEX_HTML).toContain("minmax(250px, 0.82fr) 8px minmax(460px, 1.48fr) 8px minmax(320px, 1fr)");
  });
});
