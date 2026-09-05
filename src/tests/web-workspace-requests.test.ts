import { expect, test } from "bun:test";
import { createImpactState } from "../web/client-impact-state";
import { createImpactRequests } from "../web/client-impact-requests";
import { parseRun, parseEvals, parseOverview } from "../web/client-impact-data";
import { createLearningCatalog, createLearningCatalogState } from "../web/client-learning-catalog";
import { learningFixture } from "./web-learning-fixture";
import { webSuiteFixture } from "./project-eval-suite-fixture";
function deferred() { let resolve!: (v: unknown) => void, reject!: (e: unknown) => void; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { resolve, reject, promise }; }
const overview = (project: string) => ({ project_root: project, availability: "not_configured", overview: null, recent_runs: [], hook_health: null, connection: null });
test("Impact only the newest read may install data or clear a later request's loading state", async () => {
  const a = deferred(), b = deferred(), state = { ...createImpactState(), projectRoot: "/a", mainView: "impact" }; let calls = 0;
  const model = createImpactRequests({ state, api: () => ++calls === 1 ? a.promise : b.promise, changed() {}, route() {} });
  const first = model.read("overview"), second = model.read("overview");
  a.reject(new Error("old failure")); await first; expect(state.observationLoading).toBe(true); expect(state.observationError).toBe("");
  b.resolve(overview("/a")); await second; expect(state.observationLoading).toBe(false); expect(state.observationAvailability).toBe("not_configured");
});
test("Impact A/B/A reset and an abandoned Run response cannot replace the new context", async () => {
  const pending = deferred(), state = { ...createImpactState(), projectRoot: "/a", mainView: "impact" };
  const model = createImpactRequests({ state, api: () => pending.promise, changed() {}, route() {} });
  const first = model.read("overview"); state.projectRoot = "/b"; model.reset(); state.projectRoot = "/a";
  state.observationError = "keep current"; pending.resolve(overview("/a")); await first; expect(state.observationError).toBe("keep current");
  const run = deferred(); state.impactView = "runs"; state.observationRunId = "one";
  const other = createImpactRequests({ state, api: () => run.promise, changed() {}, route() {} });
  const read = other.read("run"); state.impactView = "evals"; run.reject(new Error("abandoned failure")); await read;
  expect(state.observationError).toBe(""); expect(state.observationRunDetail).toBeNull();
});
test("malformed or wrong-source observation data is rejected and explicit retry recovers", async () => {
  for (const raw of [overview("/b"), { ...overview("/a"), recent_runs: [{}] }]) expect(() => parseOverview(raw, "/a")).toThrow();
  expect(() => parseRun({ project_root: "/a", availability: "ready", run: { id: "two", status: null, completeness: "partial", event_count: 1 }, timeline: [] }, "/a", "one")).toThrow("identity mismatch");
  const state = { ...createImpactState(), projectRoot: "/a", mainView: "impact" }; let valid = false;
  const model = createImpactRequests({ state, api: async () => valid ? overview("/a") : {}, changed() {}, route() {} });
  await model.read("overview"); expect(state.observationError).not.toBe(""); valid = true; await model.read("overview"); expect(state.observationError).toBe("");
});
test("background Evals reads defer changed context while an actual editor draft exists", async () => {
  const f = webSuiteFixture(), url = "http://localhost/api/observations/evals?project=" + encodeURIComponent(f.project);
  const payload = await (await f.handler(new Request(url, { headers: { "X-Codetrap-Token": "suite-token" } }))).json();
  const original = parseEvals(payload, f.project);
  const state = { ...createImpactState(), projectRoot: f.project, mainView: "impact" };
  state.impactView = "evals"; state.observationEvals = original; state.evalReviewDraft = { candidateId: "one", case: { query: "local", mode: "fts", judgment: "miss", goldTrapIds: [], note: "" }, rejectionReason: "" };
  const changed = { ...payload, retrieval: { ...payload.retrieval, sha256: "changed" } };
  const model = createImpactRequests({ state, api: async () => changed, changed() {}, route() {} });
  await model.read("evals", true); expect(state.observationEvals).toBe(original); expect(state.evalExternalChangesDeferred).toBe(true); expect(state.evalReviewDraft.case.query).toBe("local");
  state.evalReviewDraft = null; await model.read("evals", true); expect(state.observationEvals?.retrieval.sha256).toBe("changed");
});
test("Learning catalog protects A/B/A navigation, retries failures, and rejects cross-source collection membership", async () => {
  const f = learningFixture(), payload = await (await f.handler(new Request("http://localhost/api/insights?" + new URLSearchParams({ project: f.a.root, scope: "project" }), { headers: { "X-Codetrap-Token": "learning-token" } }))).json();
  const state = { ...createLearningCatalogState(), projectRoot: f.a.root, routeInsightKey: null, mainView: "learning" }; state.learningScope = "project";
  const pending = deferred(); let delayed = true, fail = false;
  const model = createLearningCatalog({ state, api: async () => { if (delayed) return pending.promise; if (fail) throw new Error("unavailable"); return payload; }, current: () => null, revision: () => 0, render() {}, runsChanged() {} });
  const first = model.load(); state.projectRoot = f.b.root; model.reset(); state.projectRoot = f.a.root;
  pending.resolve(payload); await first; expect(state.learningInsights).toEqual([]);
  delayed = false; fail = true; await model.load(); expect(state.learningLoad).toBe("error"); fail = false; await model.load(); expect(state.learningLoad).toBe("ready"); expect(state.learningInsights.length).toBeGreaterThan(0);
});

test("unchanged background reads do not rerender or announce external changes", async () => {
  const state = { ...createImpactState(), projectRoot: "/a", mainView: "impact" }; let renders = 0;
  const model = createImpactRequests({ state, api: async () => overview("/a"), changed() { renders++; }, route() {} });
  await model.read("overview"); renders = 0;
  await model.read("overview", true); expect(renders).toBe(0); expect(state.evalExternalChangesDeferred).toBe(false);
});
