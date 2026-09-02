import { afterAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  OBSERVATION_LEDGER_SCHEMA_VERSION,
  observationLedgerPath,
  openObservationLedger,
} from "../lib/observation-ledger";

const temporaryRoots: string[] = [];

afterAll(() => {
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(tmpdir()) || !basename(root).startsWith("codetrap-observation-ledger-")) {
      throw new Error(`Refusing to remove unexpected test directory: ${root}`);
    }
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

describe("Observation Ledger v1", () => {
  test("resolves paths without side effects and creates an independent database only when opened", () => {
    const root = tempProject();
    const path = observationLedgerPath(root);

    expect(path).toBe(join(root, ".codetrap", "observations", "ledger.sqlite"));
    expect(existsSync(join(root, ".codetrap"))).toBe(false);

    const ledger = openObservationLedger(root);
    expect(existsSync(path)).toBe(true);
    expect(existsSync(join(root, ".codetrap", "project.json"))).toBe(true);
    expect(existsSync(join(root, ".codetrap", "traps.db"))).toBe(false);
    ledger.close();

    const db = new Database(path, { readonly: true });
    try {
      const statement = db.prepare("SELECT version FROM observation_schema_version");
      try {
        const version = statement.get() as { version: number };
        expect(version.version).toBe(OBSERVATION_LEDGER_SCHEMA_VERSION);
      } finally {
        statement.finalize();
      }
    } finally {
      db.close(true);
    }
  });

  test("appends a complete run and rebuilds Run and Overview projections", () => {
    const ledger = openObservationLedger(tempProject());
    const projectId = ledger.projectId;
    const events = completeRun(projectId);

    expect(ledger.appendMany(events)).toEqual({ inserted: 6, duplicates: 0 });
    expect(ledger.listEvents({ runId: "run-1" }).map((event) => event.seq)).toEqual([0, 1, 2, 3, 4, 5]);

    const run = ledger.listRuns()[0];
    expect(run).toMatchObject({
      id: "run-1",
      source_client: "codex",
      repository_revision: "abc123",
      status: "completed",
      completeness: "complete",
      duration_ms: 4300,
      input_tokens: 1200,
      output_tokens: 320,
      event_count: 6,
      search_count: 1,
      exposure_count: 1,
      validation_count: 1,
      feedback_count: 1,
      latest_validation_status: "passed",
      contains_sensitive_body: false,
      evidence: { observed_fact: 5, human_label: 1, derived_inference: 0, controlled_eval: 0 },
    });

    expect(ledger.overview()).toMatchObject({
      project_id: projectId,
      total_events: 6,
      total_runs: 1,
      completed_runs: 1,
      partial_or_unknown_runs: 0,
      search_count: 1,
      exposure_count: 1,
      validation_passed: 1,
      validation_failed: 0,
      helpful_feedback: 1,
      harmful_feedback: 0,
      last_event_at: "2026-08-30T10:00:05.000Z",
    });
    ledger.close();
  });

  test("deduplicates exact retries and rejects conflicting ids or run sequence numbers", () => {
    const ledger = openObservationLedger(tempProject());
    const event = completeRun(ledger.projectId)[0];

    expect(ledger.append(event)).toBe("inserted");
    expect(ledger.append(structuredClone(event))).toBe("duplicate");
    expect(() => ledger.append({ ...event, occurred_at: "2026-08-30T10:00:09.000Z" }))
      .toThrow("already exists with different content");
    expect(() => ledger.append({ ...event, id: "event-conflicting-seq" }))
      .toThrow(/UNIQUE constraint failed/u);
    ledger.close();
  });

  test("rolls back an entire appendMany batch when one event conflicts", () => {
    const ledger = openObservationLedger(tempProject());
    const first = completeRun(ledger.projectId)[0];
    const conflict = { ...completeRun(ledger.projectId)[1], seq: first.seq };

    expect(() => ledger.appendMany([first, conflict])).toThrow(/UNIQUE constraint failed/u);
    expect(ledger.listEvents()).toEqual([]);
    ledger.close();
  });

  test("database triggers reject mutation and deletion of historical facts", () => {
    const ledger = openObservationLedger(tempProject());
    ledger.append(completeRun(ledger.projectId)[0]);
    const raw = new Database(ledger.path);
    raw.exec("PRAGMA busy_timeout=5000");
    try {
      expect(() => raw.exec("UPDATE observation_events SET seq = 9"))
        .toThrow("observation events are append-only");
      expect(() => raw.exec("DELETE FROM observation_events"))
        .toThrow("observation events are append-only");
    } finally {
      raw.close(true);
      ledger.close();
    }
  });

  test("fails closed for unknown versions, unknown event types, and invalid evidence boundaries", () => {
    const ledger = openObservationLedger(tempProject());
    const event = completeRun(ledger.projectId)[0];

    expect(() => ledger.append({ ...event, version: 2 })).toThrow("unknown observation versions fail closed");
    expect(() => ledger.append({ ...event, type: "run/magic" })).toThrow("type must be one of");
    expect(() => ledger.append({ ...event, body_ref: "sha256:secret" })).toThrow("Metadata observation events cannot reference");
    expect(() => ledger.append({ ...event, occurred_at: "August 30, 2026" }))
      .toThrow("must be an ISO-8601 timestamp with a timezone");
    expect(() => ledger.append({ ...event, raw_prompt: "do not silently drop me" }))
      .toThrow("Observation event field raw_prompt is not allowed");
    expect(() => ledger.append({
      ...event,
      attributes: { ...(event.attributes as Record<string, unknown>), raw_prompt: "do not persist me" },
    })).toThrow("structured metadata must not contain arbitrary body content");
    expect(() => ledger.append({ ...event, evidence_class: "derived_inference" }))
      .toThrow("derived_inference attributes require non-empty basis_event_ids");

    const feedback = completeRun(ledger.projectId)[4];
    expect(() => ledger.append({ ...feedback, evidence_class: "observed_fact" }))
      .toThrow("must use evidence_class human_label");
    expect(() => ledger.append({ ...event, project_id: "another-project" }))
      .toThrow("does not match ledger project");
    ledger.close();
  });

  test("preserves unknown values for a partial run when body capture is disabled", () => {
    const ledger = openObservationLedger(tempProject());
    const projectId = ledger.projectId;
    ledger.append(event(projectId, "partial-validation", "run-partial", 4, "validation/completed", {
      kind: "test",
      command_fingerprint: null,
      status: "unknown",
      passed: null,
      failed: null,
      duration_ms: null,
    }));

    const run = ledger.listRuns()[0];
    expect(run).toMatchObject({
      id: "run-partial",
      source_client: null,
      started_at: null,
      completed_at: null,
      status: null,
      completeness: "unknown",
      duration_ms: null,
      input_tokens: null,
      output_tokens: null,
      contains_sensitive_body: false,
      latest_validation_status: "unknown",
    });
    ledger.close();
  });

  test("rejects a ledger created by a newer observation schema", () => {
    const root = tempProject();
    const path = observationLedgerPath(root);
    mkdirSync(dirname(path), { recursive: true });
    const future = new Database(path);
    future.exec("CREATE TABLE observation_schema_version (version INTEGER NOT NULL)");
    future.run("INSERT INTO observation_schema_version (version) VALUES (?)", [99]);
    future.close(true);

    expect(() => openObservationLedger(root)).toThrow("newer than this codetrap build");
  });

  test("overview rebuilds from the complete ledger instead of the bounded event-list view", () => {
    const ledger = openObservationLedger(tempProject());
    const events = Array.from({ length: 1_001 }, (_, index) => event(
      ledger.projectId,
      `share-${index}`,
      "unused-run",
      index,
      "share/created",
      { share_id: `share-${index}`, target_kind: "run", target_id: `run-${index}` },
      {
        run_id: null,
        occurred_at: "2026-08-30T10:00:00.000Z",
        recorded_at: "2026-08-30T10:00:00.000Z",
      }
    ));

    expect(ledger.appendMany(events)).toEqual({ inserted: 1_001, duplicates: 0 });
    expect(ledger.listEvents()).toHaveLength(1_000);
    expect(ledger.overview()).toMatchObject({ total_events: 1_001, total_runs: 0 });
    ledger.close();
  });

  test("projects observational Eval rates and review-required candidates without creating ground truth", () => {
    const ledger = openObservationLedger(tempProject());
    const firstRun = completeRun(ledger.projectId);
    const secondRun = completeRun(ledger.projectId).map((item, index) => {
      const value = structuredClone(item);
      value.id = `second-${index}`;
      value.run_id = "run-2";
      if (value.type === "validation/completed") {
        value.attributes = {
          ...(value.attributes as Record<string, unknown>),
          status: "failed",
          passed: 0,
          failed: 1,
        };
      }
      if (value.type === "trap/feedback-recorded") {
        value.attributes = {
          ...(value.attributes as Record<string, unknown>),
          feedback: "harmful",
        };
      }
      if (value.type === "run/completed") {
        value.attributes = {
          ...(value.attributes as Record<string, unknown>),
          status: "failed",
          completeness: "partial",
        };
      }
      return value;
    });
    const missed = event(ledger.projectId, "second-miss", "run-2", 6, "trap/missed-reported", {
      query_fingerprint: "sha256:private-query",
      expected_trap_id: 99,
    }, { evidence_class: "human_label" });

    expect(ledger.appendMany([...firstRun, ...secondRun, missed])).toEqual({ inserted: 13, duplicates: 0 });
    const evals = ledger.evals();
    expect(evals).toMatchObject({
      total_runs: 2,
      complete_runs: 1,
      partial_or_unknown_runs: 1,
      evaluable_runs: 2,
      rated_exposures: 2,
      helpful_feedback: 1,
      irrelevant_feedback: 0,
      harmful_feedback: 1,
      miss_reports: 1,
      runs_with_explicit_feedback: 2,
      runs_with_miss_report: 1,
      validation_passed: 1,
      validation_failed: 1,
      failed_after_exposure_runs: 1,
      rates: {
        helpful: { numerator: 1, denominator: 2, value: 0.5 },
        noise: { numerator: 1, denominator: 2, value: 0.5 },
        miss_report: { numerator: 1, denominator: 2, value: 0.5 },
        validation_pass: { numerator: 1, denominator: 2, value: 0.5 },
      },
    });
    expect(evals.candidates.map((candidate) => candidate.reason)).toEqual([
      "reported_miss",
      "harmful_guidance",
      "validation_failed_after_exposure",
    ]);
    expect(evals.candidates[0]).toMatchObject({
      id: "run-2:6:reported_miss",
      run_id: "run-2",
      trap_id: 99,
      review_status: "review_required",
      ground_truth: "unconfirmed",
      completeness: "partial",
    });
    ledger.close();
  });

  test("does not label a failed validation as post-exposure when exposure happened later", () => {
    const ledger = openObservationLedger(tempProject());
    expect(ledger.appendMany([
      event(ledger.projectId, "ordered-validation", "run-ordered", 0, "validation/completed", {
        kind: "test",
        command_fingerprint: null,
        status: "failed",
        passed: 0,
        failed: 1,
        duration_ms: 20,
      }),
      event(ledger.projectId, "ordered-exposure", "run-ordered", 1, "trap/exposed", {
        trap_id: 7,
        revision: "project:r1",
        rank: 1,
        query_fingerprint: null,
      }),
    ])).toEqual({ inserted: 2, duplicates: 0 });

    expect(ledger.evals()).toMatchObject({
      validation_failed: 1,
      failed_after_exposure_runs: 0,
      candidates: [],
    });
    ledger.close();
  });
});

function tempProject(): string {
  const root = mkdtempSync(join(tmpdir(), "codetrap-observation-ledger-"));
  temporaryRoots.push(root);
  return root;
}

function completeRun(projectId: string): Record<string, unknown>[] {
  return [
    event(projectId, "event-start", "run-1", 0, "run/started", {
      source_client: "codex",
      source_session_ref: "session-1",
      repository_revision: "abc123",
      branch: "main",
      model_provider: "openai",
      model_name: "gpt-5.x",
      completeness: "complete",
    }),
    event(projectId, "event-search", "run-1", 1, "trap/search-completed", {
      query_fingerprint: "sha256:query",
      mode: "hybrid",
      path_hint: null,
      module_hint: "http",
      results: [{ trap_id: 42, revision: "rev.3", rank: 1 }],
      diagnostics: [],
      duration_ms: 18.2,
    }),
    event(projectId, "event-exposure", "run-1", 2, "trap/exposed", {
      trap_id: 42,
      revision: "rev.3",
      rank: 1,
      query_fingerprint: "sha256:query",
    }),
    event(projectId, "event-validation", "run-1", 3, "validation/completed", {
      kind: "test",
      command_fingerprint: "sha256:command",
      status: "passed",
      passed: 4,
      failed: 0,
      duration_ms: 980,
    }),
    event(projectId, "event-feedback", "run-1", 4, "trap/feedback-recorded", {
      trap_id: 42,
      revision: "rev.3",
      feedback: "helpful",
      note_fingerprint: null,
    }, { evidence_class: "human_label", actor_ref: "local-user" }),
    event(projectId, "event-complete", "run-1", 5, "run/completed", {
      status: "completed",
      completeness: "complete",
      duration_ms: 4300,
      input_tokens: 1200,
      output_tokens: 320,
    }),
  ];
}

function event(
  projectId: string,
  id: string,
  runId: string,
  seq: number,
  type: string,
  attributes: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const time = `2026-08-30T10:00:0${seq}.000Z`;
  return {
    version: 1,
    id,
    project_id: projectId,
    run_id: runId,
    actor_ref: null,
    device_id: "device-local",
    seq,
    occurred_at: time,
    recorded_at: time,
    type,
    evidence_class: "observed_fact",
    sensitivity: "metadata",
    attributes,
    body_ref: null,
    source_ref: null,
    ...overrides,
  };
}
