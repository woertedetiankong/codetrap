import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { GovernedEvalOperations } from "../lib/governed-eval-operations";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import { ObservationRunRecorder } from "../lib/observation-recorder";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { tempHome, tempProjectDir } from "./helpers";

describe("governed Observation Eval candidates", () => {
  test("keeps a draft out of the fixture, commits only explicit ground truth, and rolls back exactly", () => {
    const fixture = governedFixture("codetrap-governed-eval-lifecycle-");
    const original = readFileSync(fixture.fixturePath, "utf-8");

    expect(fixture.operations.reviewState(fixture.observationCandidateId)).toMatchObject({
      review_status: "review_required",
      ground_truth: "unconfirmed",
    });
    expect(fixture.operations.fixtureTraps()).toEqual([{ id: 1, title: "Run migrations with rollback coverage" }]);

    const draft = fixture.operations.draft(fixture.observationCandidateId, evalInput());
    expect(draft.preview).toEqual([expect.objectContaining({
      path: "src/tests/fixtures/search-eval.json",
      changed: true,
      before_query_count: 0,
      after_query_count: 1,
      appended_case: expect.objectContaining({
        query: "sqlite migration rollback",
        goldTrapIds: [1],
        phaseGate: "dogfood",
        source: `observation:${fixture.observationCandidateId}`,
      }),
    })]);
    expect(readFileSync(fixture.fixturePath, "utf-8")).toBe(original);
    expect(fixture.operations.reviewState(fixture.observationCandidateId).review_status).toBe("draft");

    const accepted = fixture.operations.accept(fixture.observationCandidateId, evalInput());
    expect(accepted.already_committed).toBe(false);
    expect(JSON.parse(readFileSync(fixture.fixturePath, "utf-8")).queries).toEqual([
      expect.objectContaining({ query: "sqlite migration rollback", goldTrapIds: [1], judgment: "miss" }),
    ]);
    expect(fixture.operations.reviewState(fixture.observationCandidateId)).toMatchObject({
      review_status: "accepted",
      ground_truth: "confirmed",
    });

    const acceptedAgain = fixture.operations.accept(fixture.observationCandidateId, evalInput());
    expect(acceptedAgain.already_committed).toBe(true);
    expect(JSON.parse(readFileSync(fixture.fixturePath, "utf-8")).queries).toHaveLength(1);

    fixture.operations.rollback(fixture.observationCandidateId);
    expect(readFileSync(fixture.fixturePath, "utf-8")).toBe(original);
    expect(fixture.operations.reviewState(fixture.observationCandidateId)).toMatchObject({
      review_status: "rolled_back",
      ground_truth: "unconfirmed",
    });
  });

  test("rejects from evidence alone without requiring or writing the private query", () => {
    const fixture = governedFixture("codetrap-governed-eval-reject-");
    const original = readFileSync(fixture.fixturePath, "utf-8");

    const rejected = fixture.operations.reject(fixture.observationCandidateId, "Not a stable retrieval expectation");
    expect(rejected.already_rejected).toBe(false);
    expect(fixture.operations.reject(fixture.observationCandidateId).already_rejected).toBe(true);
    expect(fixture.operations.reviewState(fixture.observationCandidateId)).toMatchObject({
      review_status: "rejected",
      ground_truth: "unconfirmed",
      review_ref: { rejection_reason: "Not a stable retrieval expectation" },
    });
    expect(readFileSync(fixture.fixturePath, "utf-8")).toBe(original);

    const serialized = JSON.stringify(fixture.operations.reviewState(fixture.observationCandidateId));
    expect(serialized).not.toContain("private missed query SECRET");
  });

  test("fails closed on invalid fixture ids before creating review state", () => {
    const fixture = governedFixture("codetrap-governed-eval-invalid-");
    const original = readFileSync(fixture.fixturePath, "utf-8");

    expect(() => fixture.operations.draft(fixture.observationCandidateId, {
      ...evalInput(),
      goldTrapIds: [99],
    })).toThrow("unknown trap id: 99");
    expect(fixture.operations.reviewState(fixture.observationCandidateId).review_status).toBe("review_required");
    expect(readFileSync(fixture.fixturePath, "utf-8")).toBe(original);
  });
});

function governedFixture(prefix: string) {
  const project = tempProjectDir(`${prefix}project-`, { realpath: true });
  const home = tempHome(`${prefix}home-`, { realpath: true, initCodetrap: true });
  const fixturePath = join(project, "src", "tests", "fixtures", "search-eval.json");
  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, `${JSON.stringify({
    traps: [{
      title: "Run migrations with rollback coverage",
      category: "database",
      tags: ["migration"],
      scope: "project",
      context: "When changing a database schema.",
      mistake: "Ship a migration without rollback coverage.",
      fix: "Exercise migration and rollback together.",
      severity: "error",
    }],
    queries: [],
  }, null, 2)}\n`);

  const recorder = new ObservationRunRecorder(project, () => new Date("2026-08-31T02:00:00.000Z"));
  const context = { run_id: "run-governed", device_id: "device-governed", actor_ref: null, source_ref: "test" };
  expect(recorder.start({
    ...context,
    event_id: "start-governed",
    source_client: "codex",
    source_session_ref: null,
    repository_revision: null,
    branch: null,
    model_provider: null,
    model_name: null,
    completeness: "complete",
  }).success).toBe(true);
  expect(recorder.missed({
    ...context,
    event_id: "miss-governed",
    source_ref: "private-ref",
    query: "private missed query SECRET",
    expected_trap_id: 1,
  }).success).toBe(true);

  const ledger = openObservationLedgerReadOnly(project);
  if (!ledger) throw new Error("Expected test Observation ledger.");
  const observationCandidateId = ledger.evals().candidates[0]?.id;
  ledger.close();
  if (!observationCandidateId) throw new Error("Expected test Observation Eval candidate.");

  return {
    project,
    fixturePath,
    observationCandidateId,
    operations: new GovernedEvalOperations(
      project,
      new TrapOperations(new TrapStore(project, undefined, home))
    ),
  };
}

function evalInput(): Record<string, unknown> {
  return {
    query: "sqlite migration rollback",
    mode: "fts",
    judgment: "miss",
    goldTrapIds: [1],
    note: "Observed miss confirmed by a human reviewer.",
  };
}
