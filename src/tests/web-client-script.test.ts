import { describe, expect, test } from "bun:test";
import { webClientScript } from "../web/client-script";
import { WEB_REVIEW_CLIENT_SCRIPT } from "../web/client-review";
import { WEB_INDEX_HTML } from "../web/static";

/**
 * A5 regression guard. The web console ships its browser script as TypeScript
 * template strings, and `WEB_REVIEW_CLIENT_SCRIPT` is assembled by serializing
 * real functions with `Function.prototype.toString()`. That silently depends on
 * Bun (including `bun build --compile`) preserving function source. If a build
 * step ever mangles or strips a body, the assembled inline script becomes
 * invalid JavaScript and the entire UI breaks at runtime with no compile error.
 *
 * `new Function(source)` compiles the source as a function body without executing
 * it, so it fails loudly on a syntax regression while tolerating the browser
 * globals (document, window, location) that are absent under the test runtime.
 */
describe("web client script", () => {
  test("the assembled inline script is syntactically valid JavaScript", () => {
    const script = webClientScript();
    expect(script.length).toBeGreaterThan(1000);
    expect(() => new Function(script)).not.toThrow();
  });

  test("the toString()-serialized review block parses and retains its functions", () => {
    // Guards the fragile serialization path specifically: if `toString()` ever
    // returned "[native code]" or an empty/mangled body, this block would either
    // fail to parse or drop a named helper.
    expect(WEB_REVIEW_CLIENT_SCRIPT.length).toBeGreaterThan(200);
    expect(WEB_REVIEW_CLIENT_SCRIPT).not.toContain("[native code]");
    for (const name of [
      "reviewCandidateMutationPayload",
      "reviewCandidateTrapDraft",
      "sortedReviewCandidates",
    ]) {
      expect(WEB_REVIEW_CLIENT_SCRIPT).toContain(`function ${name}`);
    }
    // The block is spliced into an async IIFE in the real page; wrap it the same
    // way so a stray top-level statement can't produce a false positive here.
    expect(() => new Function(`(async () => {\n${WEB_REVIEW_CLIENT_SCRIPT}\n})`)).not.toThrow();
  });

  test("the served HTML embeds the assembled script verbatim", () => {
    const script = webClientScript();
    expect(WEB_INDEX_HTML).toContain(script);
  });

  test("loads the learning shelf separately and records consultation only through the explicit action", () => {
    const script = webClientScript();
    expect(script).toContain('api("/api/insights?project="');
    expect(script).toContain('"&scope=" + encodeURIComponent(state.learningScope)');
    expect(script).toContain('api("/api/insight/consult"');
    expect(script.match(/\/api\/insight\/consult/g)).toHaveLength(1);
    expect(script).toContain('data-learning-insight');
    expect(script).toContain('id="consult-insight"');
    expect(script).toContain('data-learning-scope="all"');
    expect(script).toContain('class="learning-collection ${collapsed ? "collapsed" : ""}"');
    expect(script).toContain("collapsedLearningCollections: new Set()");
    expect(script).toContain("data-collection-toggle");
    expect(script).toContain('aria-expanded="${!collapsed}"');
    expect(script).toContain('id="previous-learning"');
    expect(script).toContain('id="next-learning"');
    expect(script).toContain('api("/api/learning/collection/update"');
    expect(script).toContain('api("/api/learning/collection/reorder"');
    expect(script).toContain("projectRoot: insight.origin_project_root");
    expect(script).toContain("function renderLearningMarkup(value)");
    expect(script).toContain('class="code-block learning-code"');
    expect(script).toContain("Number(insight.consulted_count || 0) > 0");
    expect(script).toContain("function renderSourceCoveragePanel");
    expect(script).toContain("function renderCollectionContext");
    expect(script).toContain("collection.coverage_summary");
    expect(script).toContain("coverage-chip");
    expect(script).toContain("collection-audit-status");
    expect(script).toContain("coverageBrief.");
    expect(script).toContain("context_sections");
    expect(script).toContain("source_unit_refs");
    expect(WEB_INDEX_HTML).toContain("source-coverage-panel");
    expect(WEB_INDEX_HTML).toContain(".coverage-unit.unresolved");
    expect(script).not.toContain("loadInsightTraps");
    expect(script).not.toContain("insightTraps");
    expect(script).not.toContain("growthInsights");
  });

  test("routes insight candidates through their own payload and review actions", () => {
    const script = webClientScript();
    expect(script).toContain("function renderInsightCandidateDetail(candidate)");
    expect(script).toContain("destinationPayload: insightCandidateFormPayload(candidate)");
    expect(script).toContain("...(candidate?.destination_payload || {})");
    expect(script).toContain('api("/api/candidate/apply-insight"');
    expect(script).toContain('id="apply-insight"');
    expect(script).toContain("isInsightCandidate(candidate) ? \"\" :");
  });

  test("keeps actionable trap health in the library instead of a duplicate analytics page", () => {
    const script = webClientScript();
    expect(script).toContain('data-trap-health');
    expect(script).toContain('needs-validation');
    expect(script).toContain('never-useful');
    expect(script).not.toContain("renderInsightRankBlock");
    expect(script).not.toContain("renderInsightTrapRows");
  });

  test("removes the launch token from browser history after moving it to session storage", () => {
    const script = webClientScript();
    expect(script).toContain('sessionStorage.setItem("codetrap-token", token)');
    expect(script).toContain('qs.delete("token")');
    expect(script).toContain("history.replaceState");
  });

  test("turns a stale restart token into actionable localized guidance", () => {
    const script = webClientScript();
    expect(script).toContain('res.status === 401 ? t("error.sessionExpired")');
    expect(script).toContain("err.status = res.status");
  });

  test("polls for external session changes without overwriting a dirty candidate draft", () => {
    const script = webClientScript();
    expect(script).toContain("async function refreshExternalChanges()");
    expect(script).toContain("if (state.candidateDirty)");
    expect(script).toContain("status.externalChangesDeferred");
    expect(script).toContain("setInterval(refreshExternalChanges, 5000)");
  });
});
