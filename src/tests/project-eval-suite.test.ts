import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ProjectEvalSuite, PROJECT_EVAL_SUITE, LEGACY_EVAL_SUITE, readProjectSuite } from "../lib/project-eval-suite";
import { EvalSuiteOperations } from "../lib/eval-suite-operations";
import { TrapOperations } from "../lib/trap-operations";
import { Phase2Operations } from "../lib/phase2-operations";
import { GovernedEvalOperations } from "../lib/governed-eval-operations";
import { ControlledEvalOperations } from "../lib/controlled-eval";
import { observationEvalsWebPayload } from "../web/evals-view";
import { TrapStore } from "../lib/store";
import { revisionFixture } from "./experience-revision-fixture";
import { tempHome, tempProjectDir, trap } from "./helpers";

const example = { query: "transaction rollback", mode: "fts", judgment: "useful_hit", goldTrapIds: [1] };
export function suiteFixture(legacy = false) {
  const project = tempProjectDir("project-suite-", { realpath: true });
  const home = tempHome("project-suite-home-", { realpath: true, initCodetrap: true });
  const store = new TrapStore(project, undefined, home);
  store.add(trap({ scope: "project", title: "Transaction rollback", context: "Database transactions", mistake: "Ignoring rollback", fix: "Use transaction rollback" }));
  store.add(trap({ scope: "global", title: "Animation timing" }));
  const traps = new TrapOperations(store);
  const suite = new ProjectEvalSuite(project, traps);
  const operations = new EvalSuiteOperations(project, traps);
  const phase2 = new Phase2Operations(project, traps);
  const oldPath = join(project, LEGACY_EVAL_SUITE);
  if (legacy) { mkdirSync(dirname(oldPath), { recursive: true }); writeFileSync(oldPath, JSON.stringify({ traps: [trap({ title: "Legacy corpus item" })], queries: [] }) + "\n"); }
  const initialize = () => { const p = suite.preview(legacy ? "legacy" : "library"); suite.create(p.origin, p.digest); return p; };
  return { project, home, store, traps, suite, operations, phase2, oldPath, initialize };
}

describe("project evaluation suite", () => {
  test("preview is read-only, maps scoped collisions, detects a changed corpus and preserves creation on retry", () => {
    const f = suiteFixture();
    expect(f.suite.status().state).toBe("missing");
    const p = f.suite.preview("library");
    expect(p.traps).toMatchObject([{ fixture_id: 1, scope: "project", trap_id: 1 }, { fixture_id: 2, scope: "global", trap_id: 1 }]);
    expect(existsSync(join(f.project, ".codetrap/evals"))).toBe(false);
    f.store.update(1, { fix: "Updated transaction fix" }, "project");
    expect(() => f.suite.create("library", p.digest)).toThrow("source changed");
    const fresh = f.suite.preview("library");
    expect(f.suite.create("library", fresh.digest)).toMatchObject({ state: "local", count: 2, cases: 0 });
    expect(f.suite.create("library", fresh.digest).state).toBe("local");
    expect(() => f.suite.preview("library")).toThrow("already exists");
    expect(existsSync(join(f.project, "src"))).toBe(false);
    expect(readProjectSuite(f.project).fixture.codetrap_suite?.refs).toHaveLength(2);
  });
  test("manually reviewed positive and negative examples run from project data with receipts and safe rollback", async () => {
    const f = suiteFixture(); f.initialize();
    const displayed = f.operations.suite.status();
    expect(displayed.traps[0]).toMatchObject({ id: 1, source_ref: { scope: "project", trap_id: 1 } });
    expect(() => f.operations.previewCase({ ...example, corpus_sha256: "outdated-picker" })).toThrow("displayed corpus changed");
    expect(f.operations.previewCase({ ...example, corpus_sha256: displayed.corpus_sha256 }).case.goldTrapIds).toEqual([1]);
    const before = readProjectSuite(f.project).bytes;
    const preview = f.operations.previewCase(example);
    expect(readProjectSuite(f.project).bytes).toBe(before);
    const receipt = f.operations.acceptCase(example, preview.digest, "request-positive-1");
    expect(new EvalSuiteOperations(f.project, f.traps).acceptCase(example, preview.digest, "request-positive-1")).toMatchObject({ ...receipt, already_committed: true });
    expect(() => f.operations.acceptCase({ ...example, query: "changed" }, preview.digest, "request-positive-1")).toThrow("another reviewed");
    const negative = { query: "absentuniquetopic", judgment: "no_relevant_trap", mode: "fts", goldTrapIds: [] };
    const pn = f.operations.previewCase(negative);
    const rn = f.operations.acceptCase(negative, pn.digest, "request-negative-1");
    const snapshot = readProjectSuite(f.project);
    const report = await new ControlledEvalOperations(f.project).run({ profile: "retrieval_policy_v1", trials: 1 });
    expect(report.suite.path).toBe(PROJECT_EVAL_SUITE);
    expect(report.cases.map(c => c.evidence.fixture)).toEqual([PROJECT_EVAL_SUITE, PROJECT_EVAL_SUITE]);
    expect(report.summary.candidate_failed_cases).toBe(0);
    expect(report.budget.model_calls).toBe(0);
    expect(readProjectSuite(f.project).bytes).toBe(snapshot.bytes);
    expect(() => f.phase2.revert(receipt.commit_id, "user")).toThrow();
    f.phase2.revert(rn.commit_id, "user"); f.phase2.revert(receipt.commit_id, "user");
    expect(readProjectSuite(f.project).bytes).toBe(before);
    expect(() => f.operations.acceptCase(example, preview.digest, "request-positive-1")).toThrow("finalized");
    expect(existsSync(join(f.project, "src"))).toBe(false);
  });
  test("rejects stale previews, bad IDs and foreign paths without writing cases", () => {
    const f = suiteFixture(); f.initialize();
    expect(() => f.operations.previewCase({ ...example, goldTrapIds: [999] })).toThrow("unknown trap id");
    const p = f.operations.previewCase(example);
    const input = { ...example, query: "another transaction" };
    const newer = f.operations.previewCase(input);
    f.operations.acceptCase(input, newer.digest, "request-newer-123");
    expect(() => f.operations.acceptCase(example, p.digest, "request-stale-123")).toThrow("changed after preview");
    expect(readProjectSuite(f.project).fixture.queries).toHaveLength(1);
    expect(() => f.phase2.propose({ kind: "search_eval_case", payload: { fixture_path: "../secret" } })).toThrow("Unsupported evaluation");
  });
  test("copies legacy fixture order without guessing live IDs and leaves old accepted rollback destinations intact", () => {
    const f = suiteFixture(true);
    const before = readFileSync(f.oldPath, "utf8");
    const candidate = f.phase2.propose({ kind: "search_eval_case", title: "Legacy reviewed example", context: "Legacy eval", mistake: "Wrong result", fix: "Calibrate it", tags: ["eval"], source_agent: "user", payload: { case: example } });
    if (candidate.suppressed) throw new Error("unexpected suppression");
    const accepted = f.phase2.apply(candidate.session.id, candidate.candidate.id, "user");
    f.initialize();
    const local = readProjectSuite(f.project);
    expect(local.fixture.queries).toHaveLength(1);
    expect(local.fixture.codetrap_suite?.refs).toEqual([{ fixture_id: 1, scope: null, trap_id: null, revision: null }]);
    f.phase2.revert(accepted.commit.id, "user");
    expect(readFileSync(f.oldPath, "utf8")).toBe(before);
    expect(readProjectSuite(f.project).bytes).toBe(local.bytes);
    const fresh = f.operations.previewCase({ ...example, query: "new local case" });
    f.operations.acceptCase({ ...example, query: "new local case" }, fresh.digest, "request-local-123");
    expect(readFileSync(f.oldPath, "utf8")).toBe(before);
  });
  test("keeps a pre-migration observation draft bound to its original corpus", () => {
    const f = revisionFixture();
    const traps = new TrapOperations(f.store);
    const path = join(f.project, LEGACY_EVAL_SUITE);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ traps: [trap()], queries: [] }));
    f.feedback();
    const governed = new GovernedEvalOperations(f.project, traps);
    const ledgerCandidate = f.ops.context(f.feedback());
    // The observation API provides the canonical candidate ID.
    const ledger = openObservationLedgerReadOnly(f.project)!;
    const id = ledger.evals().candidates[0]!.id; ledger.close();
    const draft = governed.draft(id, { ...example, judgment: "noisy_hit" });
    // Simulate an actual pre-migration draft, which has neither destination nor corpus binding.
    const { fixture_path, corpus_sha256, ...oldPayload } = draft.candidate.destination_payload!;
    new SessionOperations(new SessionStore(f.project), traps).editDestinationCandidate(draft.session_id, draft.candidate.id, oldPayload);
    const suite = new ProjectEvalSuite(f.project, traps); const preview = suite.preview("legacy"); suite.create("legacy", preview.digest);
    const local = readProjectSuite(f.project).bytes;
    expect(governed.accept(id, { ...example, judgment: "noisy_hit" }).commit.snapshots[0]?.path).toBe(LEGACY_EVAL_SUITE);
    expect(readProjectSuite(f.project).bytes).toBe(local);
    governed.rollback(id);
    expect(governed.reviewState(id).fixture_path).toBe(LEGACY_EVAL_SUITE);
    expect(draft.candidate.destination_payload?.corpus_sha256).toBeDefined();
    expect(ledgerCandidate.source.scope).toBe("project");
  });
  test("does not hide a corrupt local suite behind healthy legacy data; exports exact portable bytes", async () => {
    const f = suiteFixture(true); f.initialize();
    const suite = readProjectSuite(f.project);
    const exported = f.suite.export(suite.sha256);
    expect(exported.content).toBe(suite.bytes);
    expect(JSON.parse(exported.content).traps).toEqual(suite.fixture.traps);
    const path = join(f.project, PROJECT_EVAL_SUITE);
    writeFileSync(path, "invalid json");
    expect(f.suite.status().state).toBe("invalid");
    expect((await observationEvalsWebPayload(f.project)).retrieval).toMatchObject({ availability: "invalid", source: PROJECT_EVAL_SUITE });
    expect(() => f.suite.create("legacy", suite.sha256)).toThrow();
    expect(readFileSync(path, "utf8")).toBe("invalid json");
    expect(() => f.suite.export(suite.sha256)).toThrow();
  });
  test("a pending review cannot silently remap fixture IDs after a corpus edit", () => {
    const f = suiteFixture(); f.initialize();
    const proposed = f.phase2.propose({ kind: "search_eval_case", title: "Pinned corpus example", context: "Frozen corpus", mistake: "ID drift", fix: "Pin identities", tags: ["eval"], source_agent: "user", payload: { case: example } });
    if (proposed.suppressed) throw new Error("unexpected suppression");
    const original = readProjectSuite(f.project);
    const changed = JSON.parse(original.bytes); changed.traps.reverse();
    const path = join(f.project, PROJECT_EVAL_SUITE);
    writeFileSync(path, JSON.stringify(changed));
    expect(() => f.phase2.apply(proposed.session.id, proposed.candidate.id, "user")).toThrow("corpus changed");
    expect(f.suite.status().state).toBe("invalid");
    expect(() => readProjectSuite(f.project)).toThrow("source identities");
    expect(JSON.parse(readFileSync(path, "utf8")).queries).toHaveLength(0);
  });

  test("keeps historical comparisons readable when the active suite becomes invalid", async () => {
    const f = suiteFixture(); f.initialize();
    const preview = f.operations.previewCase(example);
    f.operations.acceptCase(example, preview.digest, "request-history-123");
    const result = await new ControlledEvalOperations(f.project).run({ profile: "retrieval_policy_v1", trials: 1 });
    writeFileSync(join(f.project, PROJECT_EVAL_SUITE), "broken active corpus");
    const payload = await observationEvalsWebPayload(f.project);
    expect(payload.retrieval.availability).toBe("invalid");
    expect(payload.controlled).toMatchObject({ availability: "partial", can_run: false, experiments: [{ id: result.id }] });
  });

});
