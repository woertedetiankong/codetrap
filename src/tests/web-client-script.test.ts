import { describe, expect, test } from "bun:test";
import { webClientScript } from "../web/client-script";
import { WEB_REVIEW_CLIENT_SCRIPT } from "../web/client-review";
import { WEB_IMPACT_CLIENT_SCRIPT } from "../web/client-impact";
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

  test("the serialized Impact block parses and keeps its privacy-safe real-data flow", () => {
    expect(WEB_IMPACT_CLIENT_SCRIPT.length).toBeGreaterThan(1000);
    for (const name of ["renderImpactOverview", "renderImpactRunDetail", "renderImpactEvals", "renderControlledEvals", "renderControlledExperiment", "runControlledEval", "filteredEvalCandidates", "renderEvalReviewPanel", "runEvalReviewAction", "renderImpactEvent", "createImpactDemoRun", "bindImpactOnboarding", "impactAutoClient"]) {
      expect(WEB_IMPACT_CLIENT_SCRIPT).toContain(`function ${name}`);
    }
    expect(() => new Function(`(async () => {\n${WEB_IMPACT_CLIENT_SCRIPT}\n})`)).not.toThrow();
    const script = webClientScript();
    expect(script).toContain('api("/api/observations/overview?project="');
    expect(script).toContain('api("/api/observations/runs?project="');
    expect(script).toContain('api("/api/observations/run?project="');
    expect(script).toContain('api("/api/observations/evals?project="');
    expect(script).toContain('data-impact-tab="evals"');
    expect(script).toContain('data-eval-filter="${value}"');
    expect(script).toContain("evals.groundTruthCopy");
    expect(script).toContain("/api/observations/eval-candidate/${action}");
    expect(script).toContain('api("/api/observations/controlled-evals/run"');
    expect(script).toContain('data-controlled-eval-form');
    expect(script).toContain('data-controlled-case-filter');
    expect(script).toContain('state.controlledEvalExperimentId = result.experiment.id');
    expect(script).toContain('evals.fixtureUnchanged');
    expect(script).toContain('data-eval-review-save');
    expect(script).toContain('data-eval-review-accept');
    expect(script).toContain('data-eval-review-rollback');
    expect(script).toContain('body.draft = submittedDraft');
    expect(script).toContain('const submittedDraft = form ? evalReviewDraftFromForm(form) : null');
    expect(script).toContain('state.evalReviewDraft = { candidateId: candidate.id, case: submittedDraft, rejectionReason }');
    expect(script).toContain("function snapshotEvalReviewDraftFromDom()");
    expect(script).toMatch(/case: evalReviewDraftFromForm\(form, (?:false|!1)\)/);
    expect(script).toContain('document.querySelector("[data-eval-review-form]")');
    expect(script).toContain("state.evalExternalChangesDeferred = true");
    expect(script).toContain("syncEvalDeferredNotice()");
    expect(script).toContain("data-eval-deferred-update");
    expect(script).toContain("renderAgentObservationHealthNotice()");
    expect(script).toContain("codetrap observe recover --older-than-days");
    expect(script).toContain("impact.privacyCopy");
    expect(WEB_IMPACT_CLIENT_SCRIPT).not.toContain("event.attributes");
    expect(WEB_IMPACT_CLIENT_SCRIPT).not.toContain("query_fingerprint");
    const overviewBlock = WEB_IMPACT_CLIENT_SCRIPT.slice(
      WEB_IMPACT_CLIENT_SCRIPT.indexOf("function renderImpactOverview"),
      WEB_IMPACT_CLIENT_SCRIPT.indexOf("function renderImpactRunDetail")
    );
    expect(overviewBlock).toContain('const tabs = impactTabs("overview")');
    expect(overviewBlock).toContain('state.observationAvailability === "not_configured"');
    expect(overviewBlock).toContain("bindImpactTabs()");
    const tabBindingBlock = WEB_IMPACT_CLIENT_SCRIPT.slice(
      WEB_IMPACT_CLIENT_SCRIPT.indexOf("function bindImpactTabs"),
      WEB_IMPACT_CLIENT_SCRIPT.indexOf("function renderRetrievalEval")
    );
    expect(tabBindingBlock.match(/bindImpactOnboarding\(\)/g)).toHaveLength(1);
  });

  test("keeps the first-run example in browser memory and outside the evidence APIs", () => {
    const script = webClientScript();
    expect(script).toContain("observationDemoRun: null");
    expect(script).toContain("state.observationDemoRun = createImpactDemoRun()");
    expect(script).toContain('data-impact-demo-preview');
    expect(script).toContain('data-impact-copy-prompt');
    expect(script).toContain("codetrap observe enable codex --apply");
    expect(script).toContain("codetrap observe enable claude --apply");
    expect(script).toContain("codetrap observe disable <codex|claude> --apply");
    expect(script).toContain('navigator.clipboard.writeText(t("impact.agentPrompt"))');
    expect(script).not.toContain("/api/observations/demo");
    expect(WEB_IMPACT_CLIENT_SCRIPT).toContain('sensitivity: "metadata_only"');
    expect(WEB_IMPACT_CLIENT_SCRIPT).toContain('t("impact.demoNoticeCopy")');
  });

  test("the served HTML embeds the assembled script verbatim", () => {
    const script = webClientScript();
    expect(WEB_INDEX_HTML).toContain(script);
  });

  test("loads Learning separately and keeps personal progress plus Agent promotion explicit", () => {
    const script = webClientScript();
    expect(script).toContain('api("/api/insights?project="');
    expect(script).toContain('"&scope=" + encodeURIComponent(state.learningScope)');
    expect(script).toContain('data-learning-insight');
    expect(script).toContain('data-learning-status');
    expect(script).toContain('data-learning-feedback');
    expect(script).toContain('id="learning-run-link"');
    expect(script).toContain('api("/api/learning/progress/status"');
    expect(script).toContain('api("/api/learning/feedback"');
    expect(script).toContain('api("/api/learning/run-link"');
    expect(script).toContain('api("/api/learning/candidate/preview"');
    expect(script).toContain('api("/api/learning/candidate/create"');
    expect(script).toContain('id="learning-agent-candidate-form"');
    expect(script).toContain('function snapshotLearningDraftFromDom()');
    expect(script).toContain('learningImpact.inboxOnly');
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
    expect(script).toContain("function renderBootstrapFailure(error)");
    expect(script).toContain("appShell.classList.add");
    expect(script).toContain("appShell.remove()");
    expect(WEB_INDEX_HTML).toContain('id="bootstrap-failure"');
    expect(WEB_INDEX_HTML).toContain('aria-live="assertive" hidden');
    expect(WEB_INDEX_HTML).toContain("bootstrap-failure-card");
    expect(WEB_INDEX_HTML).toContain('id="bootstrap-command"');
  });

  test("keeps workspace and selected evidence addressable across refresh and history navigation", () => {
    const script = webClientScript();
    expect(script).toContain("const initialRoute = parseWorkspaceRoute(location.hash)");
    expect(script).toContain("function syncWorkspaceRoute(replace = false)");
    expect(script).toContain("function applyWorkspaceRouteFromLocation()");
    expect(script).toContain('window.addEventListener("popstate", applyWorkspaceRouteFromLocation)');
    expect(script).toContain('window.addEventListener("hashchange", applyWorkspaceRouteFromLocation)');
    expect(script).toContain("const detail = await api");
    expect(script).toContain("state.observationRunDetail = detail");
    expect(script).toContain('routedCandidate.status === "proposed" ? "inbox" : "reviewed"');
    expect(script).toContain('document.title = "codetrap · " + view');
    expect(script).toContain("function setCandidateTabsHidden(hidden)");
  });

  test("keeps conflict overrides out of the normal candidate action row", () => {
    const script = webClientScript();
    expect(script).toContain('const conflictActions = state.conflicts.length ?');
    expect(script).toContain('class="candidate-more-actions"');
    expect(script).toContain('id="accept" class="primary"');
    expect(script).toContain("effectiveCandidateSuggestedAction(candidate)");
  });

  test("polls for external session changes without overwriting a dirty candidate draft", () => {
    const script = webClientScript();
    expect(script).toContain("async function refreshExternalChanges()");
    expect(script).toContain("if (state.candidateDirty)");
    expect(script).toContain("status.externalChangesDeferred");
    expect(script).toContain("setInterval(refreshExternalChanges, 5000)");
  });

  test("refreshes Impact in the background without resetting reading position", () => {
    const script = webClientScript();
    expect(script).toContain("await loadImpact(true)");
    expect(script).toContain("function impactContentSignature()");
    expect(script).toContain("function captureImpactScrollPosition()");
    expect(script).toContain("function restoreImpactScrollPosition(position)");
    expect(script).toContain('document.querySelector(".impact-shell")?.scrollTop || 0');
    expect(script).toContain("!backgroundRefresh || contentChanged");
    expect(script).toContain("renderImpactAfterRefresh(scrollPosition, backgroundRefresh)");
    expect(script).toContain("state.observationHookHealth = overview.hook_health || null");
    expect(script).toContain('health.status === "unavailable"');
    expect(script).toContain("impact.hookHealthUnavailableTitle");
    expect(script).toContain("if (!backgroundRefresh) state.evalExternalChangesDeferred = false");
    expect(script).toContain("const requestedProjectRoot = state.projectRoot");
    expect(script).toContain("if (state.projectRoot !== requestedProjectRoot) return");
    expect(script).not.toContain("state.observationRuns.some((run) => run.id === state.observationRunId)");
  });
});
