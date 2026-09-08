import { test, expect } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tempProjectDir } from "./helpers";
import { ControlledEvalOperations } from "../lib/controlled-eval";
import { observationEvalsWebPayload } from "../web/evals-view";
import { evalCaseDetail, evalExperimentResult } from "../web/client-eval-workbench";
import { WEB_TEXT } from "../web/client-text";
import { parseEvals } from "../web/client-impact-data";
import { revisionFixture } from "./experience-revision-fixture";
import { observationOverviewWebPayload } from "../web/observation-view";
import { impactOverviewContent } from "../web/client-impact-overview";

function fixture() {
  const project = tempProjectDir("eval-workbench-", { realpath: true });
  const suite = JSON.parse(readFileSync(new URL("./fixtures/search-eval.json", import.meta.url), "utf8"));
  const path = join(project, ".codetrap/evals/suite.json");
  mkdirSync(join(project, ".codetrap/evals"), { recursive: true });
  const save = () => writeFileSync(path, JSON.stringify(suite)); save();
  return { project, suite, path, save };
}
const t = (key: string, params: Record<string, unknown> = {}) => String(WEB_TEXT.en[key as keyof typeof WEB_TEXT.en] || key).replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const ui = { t, escapeHtml: escape, escapeAttr: escape, formatDisplayDate: String };

test("coverage uses the evaluated bytes and digest, refreshes after edits and excludes negatives from recall denominators", async () => {
  const f = fixture();
  const initial = await observationEvalsWebPayload(f.project);
  expect(initial.retrieval).toMatchObject({ total_cases: 24, positive_cases: 24, negative_cases: 0, engine: "keyword_vector_v1", modes: { fts: 6, hybrid: 13, semantic: 5 } });
  const [a, b] = await Promise.all([observationEvalsWebPayload(f.project), observationEvalsWebPayload(f.project)]);
  expect(a.retrieval).toEqual(initial.retrieval); expect(b.retrieval).toEqual(initial.retrieval);
  f.suite.queries = [{ query: "unrelatedxyz", mode: "fts", goldTrapIds: [], judgment: "no_relevant_trap" }]; f.save();
  const next = await observationEvalsWebPayload(f.project);
  expect(next.retrieval).toMatchObject({ total_cases: 1, positive_cases: 0, negative_cases: 1, recall_at_3: null, recall_at_5: null, mrr: null, modes: { fts: 1, hybrid: 0, semantic: 0 } });
  expect(next.retrieval.sha256).not.toBe(initial.retrieval.sha256);
  expect(parseEvals(next, f.project)).toBe(next);
  expect(() => parseEvals({ ...next, retrieval: { ...next.retrieval, positive_cases: 3 } }, f.project)).toThrow("Inconsistent evaluation coverage");
  writeFileSync(f.path, "broken");
  expect((await observationEvalsWebPayload(f.project)).retrieval.availability).toBe("invalid");
});

test("expected titles follow verified historical snapshots, never the edited current suite", async () => {
  const f = fixture(), ops = new ControlledEvalOperations(f.project);
  const originalTitle = f.suite.traps[0].title;
  const saved = await ops.run({ profile: "memory_contribution_v1", trials: 2, seed: "workbench" });
  f.suite.traps[0].title = "NEW TITLE MUST NOT REPLACE HISTORY"; f.save();
  const payload = await observationEvalsWebPayload(f.project), experiment = payload.controlled.experiments[0]!;
  expect(experiment.snapshot_evidence.availability).toBe("ready");
  expect(experiment.snapshot_evidence.expected_traps.find(trap => trap.id === 1)?.title).toBe(originalTitle);
  expect(JSON.stringify(experiment.snapshot_evidence)).not.toContain("NEW TITLE");
  expect(ops.history().experiments[0]).toEqual(saved);
  const html = evalExperimentResult(experiment, experiment.cases, "", payload.retrieval.sha256, ui);
  expect(html).toContain("older evaluation set");
  expect(html).toContain("24 examples · 2 repeats");
  expect(html).not.toContain("48 examples");
});

test("missing or tampered snapshots preserve healthy results with an explicit evidence warning", async () => {
  const f = fixture(), saved = await new ControlledEvalOperations(f.project).run({ profile: "retrieval_policy_v1", trials: 1, seed: "snapshot" });
  const snapshot = join(f.project, saved.suite.snapshot);
  const originalBytes = readFileSync(snapshot, "utf8");
  const tampered = JSON.parse(originalBytes); tampered.traps[0].title = "TAMPERED"; writeFileSync(snapshot, JSON.stringify(tampered));
  for (const missing of [false, true]) {
    if (missing) unlinkSync(snapshot);
    const payload = await observationEvalsWebPayload(f.project);
    expect(payload.controlled.experiments).toHaveLength(1);
    const experiment = payload.controlled.experiments[0]!;
    expect(experiment.snapshot_evidence).toEqual({ availability: "unavailable", expected_traps: [] });
    const html = evalCaseDetail(experiment, experiment.cases[0]!, ui);
    expect(html).toContain("snapshot is missing or invalid"); expect(html).not.toContain("TAMPERED");
  }
  writeFileSync(snapshot, originalBytes);
  expect((await observationEvalsWebPayload(f.project)).controlled.experiments[0]!.snapshot_evidence.availability).toBe("ready");
});

test("case detail contains all saved ranks and safely renders query and frozen title markup", async () => {
  const f = fixture(); await new ControlledEvalOperations(f.project).run({ profile: "retrieval_policy_v1", trials: 1, seed: "details" });
  const experiment = (await observationEvalsWebPayload(f.project)).controlled.experiments[0]!;
  const item = experiment.cases.find(item => item.candidate.top_results.length > 1)!;
  item.query = '<img src=x onerror="alert(1)">';
  experiment.snapshot_evidence.expected_traps[0]!.title = "<script>bad</script>";
  const html = evalCaseDetail(experiment, item, ui);
  for (const rank of item.candidate.top_results) expect(html).toContain(escape(rank.title));
  expect(html).not.toContain("<img"); expect(html).toContain("&lt;img"); expect(html).not.toContain("<script>");
});

test("the verdict reports remaining failures even without regressions", async () => {
  const f = fixture();
  f.suite.queries = [{ query: "unrelatedxyz", mode: "fts", goldTrapIds: [1], minRecallAt5: 1 }]; f.save();
  await new ControlledEvalOperations(f.project).run({ profile: "retrieval_policy_v1", trials: 1, seed: "failure" });
  const payload = await observationEvalsWebPayload(f.project), experiment = payload.controlled.experiments[0]!;
  const html = evalExperimentResult(experiment, experiment.cases, "", payload.retrieval.sha256, ui);
  expect(html).toContain("1 candidate examples still fail");
  expect(html).not.toContain("No regressions found");
});

test("Overview targets an unrated exposed task, then falls back to real task history", () => {
  const f = revisionFixture();
  const payload = observationOverviewWebPayload(f.project);
  const presentation = { text: t, escape, relativeTime: String, duration: String, valueLabel: String };
  const html = impactOverviewContent(payload.overview!, payload.recent_runs, presentation);
  expect(html).toContain(`class="primary" data-overview-run="${f.call.run_id}"`);
  expect(html).toContain("Rate a recent task");
  const noEligible = impactOverviewContent(payload.overview!, [], presentation);
  expect(noEligible).toContain('class="primary" data-impact-tab="runs"');
  f.feedback();
  const negative = observationOverviewWebPayload(f.project);
  expect(impactOverviewContent(negative.overview!, negative.recent_runs, presentation)).toContain('class="primary" data-impact-tab="evals"');
});
