import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { observationLedgerPath } from "../lib/observation-ledger";
import { configureObservationIntegration, observationIntegrationStatus } from "../lib/observation-integration";
import { ObservationRunRecorder } from "../lib/observation-recorder";
import { readProjectIdentity } from "../lib/project-identity";
import { addWebProject } from "../web/project-registry";
import { createWebHandler } from "../web/server";
import { tempHome, tempProjectDir } from "./helpers";

const TOKEN = "observation-web-token";

describe("Observation Web API", () => {
  test("distinguishes configured clients awaiting a task without creating observation data", async () => {
    const { project, handler } = webFixture("codetrap-observation-awaiting-");
    const configured = configureObservationIntegration(project, "codex", "enable", true);
    const before = readFileSync(configured.config_path, "utf8");
    const result = await (await api(handler, `/api/observations/overview?project=${encodeURIComponent(project)}`)).json();
    expect(result.connection).toEqual({ state: "awaiting_run", run_count: 0, clients: [
      { client: "codex", status: "configured" }, { client: "claude", status: "not_configured" },
    ] });
    expect(JSON.stringify(result.connection)).not.toContain("config_path");
    expect(readFileSync(configured.config_path, "utf8")).toBe(before);
    expect(readProjectIdentity(project)).toBeNull();
    expect(existsSync(observationLedgerPath(project))).toBe(false);
  });

  test("isolates unreadable client configuration from another client and real records", async () => {
    const { project, handler } = webFixture("codetrap-observation-client-unavailable-");
    const config = observationIntegrationStatus(project, "codex").config_path;
    mkdirSync(dirname(config), { recursive: true });
    writeFileSync(config, "{broken");
    const overview = async () => (await api(handler, `/api/observations/overview?project=${encodeURIComponent(project)}`)).json();
    expect((await overview()).connection).toMatchObject({ state: "unavailable", run_count: 0, clients: [{ client: "codex", status: "unavailable" }, { client: "claude", status: "not_configured" }] });
    configureObservationIntegration(project, "claude", "enable", true);
    expect((await overview()).connection.state).toBe("awaiting_run");
    seedObservationRun(project);
    expect((await overview()).connection).toMatchObject({ state: "has_records", run_count: 1 });
    expect(readFileSync(config, "utf8")).toBe("{broken");
  });

  test("reports an unreadable ledger without presenting zero tasks or modifying the file", async () => {
    const { project, handler } = webFixture("codetrap-observation-ledger-unavailable-");
    const ledger = observationLedgerPath(project);
    mkdirSync(dirname(ledger), { recursive: true });
    writeFileSync(ledger, "not a SQLite database");
    const response = await api(handler, `/api/observations/overview?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ availability: "unavailable", overview: null, connection: { state: "unavailable", run_count: null } });
    expect(readFileSync(ledger, "utf8")).toBe("not a SQLite database");
    expect(readProjectIdentity(project)).toBeNull();
  });

  test("returns a useful not-configured state without creating identity or ledger files", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-empty-");
    expect(readProjectIdentity(project)).toBeNull();
    expect(existsSync(dirname(observationLedgerPath(project)))).toBe(false);

    const evalResponse = await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`);
    expect(evalResponse.status).toBe(200);
    expect(await evalResponse.json()).toMatchObject({
      observation_availability: "not_configured",
      retrieval: { availability: "not_configured", total_cases: 0 },
      controlled: { availability: "not_configured", experiments: [] },
      observed: null,
      candidates: [],
    });
    expect(readProjectIdentity(project)).toBeNull();
    expect(existsSync(dirname(observationLedgerPath(project)))).toBe(false);

    const response = await api(handler, `/api/observations/overview?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      project_root: project,
      availability: "not_configured",
      overview: null,
      recent_runs: [],
      connection: { state: "not_configured", run_count: 0, clients: [
        { client: "codex", status: "not_configured" }, { client: "claude", status: "not_configured" }
      ] },
      hook_health: {
        status: "healthy",
        active_count: 0,
        capacity: 64,
        available_slots: 64,
        stale_after_days: 7,
        stale_count: 0,
        pending_start_count: 0,
        oldest_started_at: null,
        warning_codes: [],
      },
    });
    expect(readProjectIdentity(project)).toBeNull();
    expect(existsSync(dirname(observationLedgerPath(project)))).toBe(false);
  });

  test("serves complete projection totals and a privacy-allowlisted Run timeline", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-data-");
    seedObservationRun(project);

    const overviewResponse = await api(handler, `/api/observations/overview?project=${encodeURIComponent(project)}`);
    expect(overviewResponse.status).toBe(200);
    const overview = await overviewResponse.json();
    expect(overview).toMatchObject({
      availability: "ready",
      connection: { state: "has_records", run_count: 1 },
      overview: {
        total_events: 6,
        total_runs: 1,
        completed_runs: 1,
        search_count: 1,
        exposure_count: 1,
        validation_passed: 1,
        helpful_feedback: 1,
      },
      recent_runs: [{
        id: "run-web",
        source_client: "codex",
        status: "completed",
        latest_validation_status: "passed",
        event_count: 6,
      }],
    });

    const runResponse = await api(handler, `/api/observations/run?project=${encodeURIComponent(project)}&id=run-web`);
    expect(runResponse.status).toBe(200);
    const run = await runResponse.json();
    expect(run.timeline.map((event: { type: string }) => event.type)).toEqual([
      "run/started",
      "trap/search-completed",
      "trap/exposed",
      "validation/completed",
      "trap/feedback-recorded",
      "run/completed",
    ]);
    expect(run.timeline[1].facts).toEqual({ mode: "hybrid", result_count: 1, diagnostic_count: 1, duration_ms: 14 });
    expect(run.timeline[3].facts).toEqual({ kind: "test", status: "passed", passed: 7, failed: 0, duration_ms: 410 });
    const serialized = JSON.stringify(run);
    for (const forbidden of [
      "raw customer query",
      "private/path",
      "secret-module",
      "bun test --token",
      "helpful because SECRET",
      "query_fingerprint",
      "command_fingerprint",
      "note_fingerprint",
      "source_session_ref",
      "repository_revision",
      "branch",
      "model_name",
      "source_ref",
      "body_ref",
      "attributes",
    ]) expect(serialized).not.toContain(forbidden);
  });

  test("returns 404 for a missing Run and preserves registered-project isolation", async () => {
    const { home, project, handler } = webFixture("codetrap-observation-web-missing-");
    seedObservationRun(project);
    const missing = await api(handler, `/api/observations/run?project=${encodeURIComponent(project)}&id=missing`);
    expect(missing.status).toBe(404);

    const outsider = tempProjectDir("codetrap-observation-web-outsider-", { realpath: true });
    const blocked = await api(handler, `/api/observations/overview?project=${encodeURIComponent(outsider)}`);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toContain("not open in this codetrap web session");
    expect(existsSync(observationLedgerPath(outsider))).toBe(false);
    expect(home).not.toBe(outsider);
  });

  test("keeps a directly addressed Run available when it is absent from the bounded recent list", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-old-run-");
    seedObservationRun(project);
    seedSimpleObservationRun(project, "run-newer", "2026-08-30T13:00:00.000Z");

    const recent = await (await api(handler, `/api/observations/runs?project=${encodeURIComponent(project)}&limit=1`)).json();
    expect(recent.runs.map((run: { id: string }) => run.id)).toEqual(["run-newer"]);
    expect(recent.runs.some((run: { id: string }) => run.id === "run-web")).toBe(false);

    const addressed = await api(handler, `/api/observations/run?project=${encodeURIComponent(project)}&id=run-web`);
    expect(addressed.status).toBe(200);
    const addressedPayload = await addressed.json();
    expect(addressedPayload.run).toMatchObject({ id: "run-web", status: "completed" });
    expect(addressedPayload.timeline[0]).toMatchObject({ type: "run/started" });
    expect(addressedPayload.timeline).toHaveLength(6);
  });

  test("surfaces stale Hook capacity health without mutating the state file", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-hook-health-");
    seedObservationRun(project);
    const observationDirectory = join(project, ".codetrap", "observations");
    const statePath = join(observationDirectory, "agent-hook-state.json");
    const state = `${JSON.stringify({
      version: 1,
      active_runs: [{
        run_id: "run-stale-hook",
        client: "claude",
        session_key: "session-key",
        source_session_ref: "source-session-ref",
        turn_key: null,
        started_at: "2020-01-01T00:00:00.000Z",
        model_name: null,
        start_recorded: true,
        start_event_id: "event-stale-start",
        complete_event_id: "event-stale-complete",
      }],
    }, null, 2)}\n`;
    writeFileSync(statePath, state);

    const response = await api(handler, `/api/observations/overview?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      hook_health: {
        status: "attention",
        active_count: 1,
        stale_count: 1,
        warning_codes: ["stale_runs"],
      },
    });
    expect(readFileSync(statePath, "utf-8")).toBe(state);
  });

  test("keeps a healthy Ledger available when Hook state is unreadable", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-corrupt-hook-state-");
    seedObservationRun(project);
    const statePath = join(project, ".codetrap", "observations", "agent-hook-state.json");
    const corruptState = '{"version":99,"active_runs":[]}\n';
    writeFileSync(statePath, corruptState);

    const response = await api(handler, `/api/observations/overview?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.availability).toBe("ready");
    expect(payload.overview).toMatchObject({ total_runs: 1, completed_runs: 1, total_events: 6 });
    expect(payload.recent_runs.map((run: { id: string }) => run.id)).toEqual(["run-web"]);
    expect(payload.hook_health).toMatchObject({
      status: "unavailable",
      active_count: null,
      warning_codes: ["state_unreadable"],
      error_code: "state_unreadable",
      state_file: ".codetrap/observations/agent-hook-state.json",
    });
    expect(readFileSync(statePath, "utf-8")).toBe(corruptState);
  });

  test("serves separate observational metrics and unconfirmed candidates without private evidence bodies", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-evals-");
    seedObservationRun(project);
    const recorder = new ObservationRunRecorder(project, () => new Date("2026-08-30T12:01:00.000Z"));
    expect(recorder.missed({
      run_id: "run-web",
      device_id: "device-web",
      event_id: "web-miss",
      actor_ref: null,
      source_ref: "private-evidence-ref",
      query: "raw missed query SECRET",
      expected_trap_id: 77,
    }).success).toBe(true);

    const response = await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      observation_availability: "ready",
      retrieval: { availability: "not_configured", source: ".codetrap/evals/suite.json" },
      observed: {
        total_runs: 1,
        evaluable_runs: 1,
        rated_exposures: 1,
        helpful_feedback: 1,
        miss_reports: 1,
        rates: {
          helpful: { numerator: 1, denominator: 1, value: 1 },
          noise: { numerator: 0, denominator: 1, value: 0 },
          miss_report: { numerator: 1, denominator: 1, value: 1 },
          validation_pass: { numerator: 1, denominator: 1, value: 1 },
        },
      },
      candidates: [{
        id: "run-web:6:reported_miss",
        run_id: "run-web",
        event_seq: 6,
        reason: "reported_miss",
        trap_id: 77,
        review_status: "review_required",
        ground_truth: "unconfirmed",
      }],
    });
    const serialized = JSON.stringify(payload);
    for (const forbidden of [
      "raw missed query",
      "private-evidence-ref",
      "query_fingerprint",
      "command_fingerprint",
      "note_fingerprint",
      "attributes",
    ]) expect(serialized).not.toContain(forbidden);
  });

  test("evaluates the registered fixture and runs a source-safe controlled comparison", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-retrieval-eval-");
    const fixturePath = join(project, "src", "tests", "fixtures", "search-eval.json");
    mkdirSync(dirname(fixturePath), { recursive: true });
    const fixture = `${JSON.stringify({
      traps: [{
        title: "Run SQLite migrations through schema",
        category: "database",
        tags: ["sqlite", "migration", "schema"],
        scope: "project",
        context: "When changing a SQLite database schema",
        mistake: "Editing queries without a migration",
        fix: "Add an idempotent schema migration",
        severity: "error",
      }],
      queries: [{
        query: "sqlite database schema migration",
        mode: "fts",
        goldTrapIds: [1],
        phaseGate: "phase0",
        minRecallAt3: 1,
        minRecallAt5: 1,
      }],
    }, null, 2)}\n`;
    writeFileSync(fixturePath, fixture);
    expect(readProjectIdentity(project)).toBeNull();

    const response = await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      observation_availability: "not_configured",
      retrieval: {
        availability: "ready",
        source: "src/tests/fixtures/search-eval.json",
        mode: "deterministic",
        total_cases: 1,
        recall_at_3: 1,
        recall_at_5: 1,
        mrr: 1,
        failed_cases: 0,
      },
      observed: null,
      candidates: [],
      controlled: { availability: "ready", experiments: [] },
    });
    expect(readProjectIdentity(project)).toBeNull();
    expect(existsSync(observationLedgerPath(project))).toBe(false);

    const runResponse = await postApi(handler, "/api/observations/controlled-evals/run", {
      projectRoot: project,
      profile: "memory_contribution_v1",
      trials: 2,
      seed: "web-api-test",
    });
    expect(runResponse.status).toBe(200);
    expect(await runResponse.json()).toMatchObject({
      success: true,
      experiment: {
        profile: "memory_contribution_v1",
        reproducible: true,
        isolation: { source_writes: false },
        budget: { model_calls: 0 },
        summary: { total_cases: 1, improvements: 1, regressions: 0 },
      },
    });
    expect(readFileSync(fixturePath, "utf8")).toBe(fixture);

    const after = await (await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`)).json();
    expect(after.controlled.experiments).toHaveLength(1);
    expect(after.controlled.experiments[0]).toMatchObject({ profile: "memory_contribution_v1" });

    const corruptPath = join(project, ".codetrap", "evals", "experiments", "broken-result.json");
    writeFileSync(corruptPath, "{ truncated");
    const partial = await (await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`)).json();
    expect(partial.controlled).toMatchObject({
      availability: "partial",
      issue: "controlled_result_store_partial",
      corrupt_results: [{ file: "broken-result.json", issue: "invalid_experiment" }],
    });
    expect(partial.controlled.experiments).toHaveLength(1);
    expect(readFileSync(corruptPath, "utf8")).toBe("{ truncated");
    expect(readProjectIdentity(project)).toBeNull();
    expect(existsSync(observationLedgerPath(project))).toBe(false);
  });

  test("isolates an invalid retrieval fixture from valid observed evidence", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-invalid-eval-");
    seedObservationRun(project);
    const fixturePath = join(project, "src", "tests", "fixtures", "search-eval.json");
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, "{ invalid fixture");

    const response = await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      observation_availability: "ready",
      retrieval: {
        availability: "invalid",
        issue: "fixture_evaluation_failed",
        total_cases: 0,
      },
      controlled: { availability: "invalid", issue: "fixture_evaluation_failed" },
      observed: {
        total_runs: 1,
        helpful_feedback: 1,
        validation_passed: 1,
      },
    });
  });

  test("governs an observed signal through draft, accept, and exact rollback APIs", async () => {
    const { project, handler } = webFixture("codetrap-observation-web-governed-");
    seedObservationRun(project);
    const recorder = new ObservationRunRecorder(project, () => new Date("2026-08-31T04:00:00.000Z"));
    expect(recorder.missed({
      run_id: "run-web",
      device_id: "device-web",
      event_id: "web-governed-miss",
      actor_ref: null,
      source_ref: "private-governed-ref",
      query: "private governed query SECRET",
      expected_trap_id: 1,
    }).success).toBe(true);
    const fixturePath = join(project, "src", "tests", "fixtures", "search-eval.json");
    mkdirSync(dirname(fixturePath), { recursive: true });
    const original = `${JSON.stringify({
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
    }, null, 2)}\n`;
    writeFileSync(fixturePath, original);

    const initial = await (await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`)).json();
    const candidateId = initial.candidates[0].id;
    expect(initial.fixture_traps).toEqual([{ id: 1, title: "Run migrations with rollback coverage" }]);
    const draft = {
      query: "sqlite migration rollback",
      mode: "fts",
      judgment: "miss",
      goldTrapIds: [1],
      note: "Reviewer confirmed the expected result.",
    };

    const draftedResponse = await postApi(handler, "/api/observations/eval-candidate/draft", {
      projectRoot: project,
      observationCandidateId: candidateId,
      draft,
    });
    expect(draftedResponse.status).toBe(200);
    expect(await draftedResponse.json()).toMatchObject({
      success: true,
      observation_candidate_id: candidateId,
      preview: [{ before_query_count: 0, after_query_count: 1, changed: true }],
    });
    expect(readFileSync(fixturePath, "utf-8")).toBe(original);

    const draftedView = await (await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`)).json();
    expect(draftedView.candidates[0]).toMatchObject({
      review_status: "draft",
      ground_truth: "unconfirmed",
      draft_case: { query: "sqlite migration rollback", goldTrapIds: [1] },
    });
    expect(JSON.stringify(draftedView)).not.toContain("private governed query SECRET");

    const accepted = await postApi(handler, "/api/observations/eval-candidate/accept", {
      projectRoot: project,
      observationCandidateId: candidateId,
      draft,
    });
    expect(accepted.status).toBe(200);
    expect(JSON.parse(readFileSync(fixturePath, "utf-8")).queries).toHaveLength(1);
    const acceptedView = await (await api(handler, `/api/observations/evals?project=${encodeURIComponent(project)}`)).json();
    expect(acceptedView.candidates[0]).toMatchObject({ review_status: "accepted", ground_truth: "confirmed" });

    const rolledBack = await postApi(handler, "/api/observations/eval-candidate/rollback", {
      projectRoot: project,
      observationCandidateId: candidateId,
    });
    expect(rolledBack.status).toBe(200);
    expect(readFileSync(fixturePath, "utf-8")).toBe(original);
  });
});

function webFixture(prefix: string) {
  const home = tempHome(`${prefix}home-`, { realpath: true, initCodetrap: true });
  const project = tempProjectDir(`${prefix}project-`, { realpath: true });
  addWebProject(project, home);
  return {
    home,
    project,
    handler: createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project }),
  };
}

function seedObservationRun(project: string): void {
  const recorder = new ObservationRunRecorder(project, () => new Date("2026-08-30T12:00:00.000Z"));
  const context = { run_id: "run-web", device_id: "device-web", actor_ref: null, source_ref: "browser-test" };
  expect(recorder.start({
    ...context,
    event_id: "web-start",
    occurred_at: "2026-08-30T11:59:00.000Z",
    source_client: "codex",
    source_session_ref: "opaque-session",
    repository_revision: "private-revision",
    branch: "private/branch",
    model_provider: "openai",
    model_name: "private-model",
    completeness: "complete",
  }).success).toBe(true);
  expect(recorder.search({ ...context, event_id: "web-search" }, {
    query: "raw customer query",
    mode: "hybrid",
    path: "D:/private/path/file.ts",
    module: "secret-module",
    results: [{ trap_id: 3, revision: "project:revision", rank: 1 }],
    diagnostics: ["partial_index"],
    duration_ms: 14,
  }).success).toBe(true);
  expect(recorder.validation({
    ...context,
    event_id: "web-validation",
    kind: "test",
    command: "bun test --token SECRET",
    status: "passed",
    passed: 7,
    failed: 0,
    duration_ms: 410,
  }).success).toBe(true);
  expect(recorder.feedback({
    ...context,
    event_id: "web-feedback",
    trap_id: 3,
    revision: "project:revision",
    feedback: "helpful",
    note: "helpful because SECRET",
  }).success).toBe(true);
  expect(recorder.complete({
    ...context,
    event_id: "web-complete",
    status: "completed",
    completeness: "complete",
    duration_ms: 4_200,
    input_tokens: 800,
    output_tokens: 240,
  }).success).toBe(true);
}

function seedSimpleObservationRun(project: string, runId: string, startedAt: string): void {
  const recorder = new ObservationRunRecorder(project, () => new Date(startedAt));
  const context = { run_id: runId, device_id: "device-web", actor_ref: null, source_ref: "browser-test" };
  expect(recorder.start({
    ...context,
    event_id: `${runId}-start`,
    occurred_at: startedAt,
    source_client: "codex",
    source_session_ref: null,
    repository_revision: null,
    branch: null,
    model_provider: "openai",
    model_name: null,
    completeness: "complete",
  }).success).toBe(true);
  expect(recorder.complete({
    ...context,
    event_id: `${runId}-complete`,
    occurred_at: new Date(Date.parse(startedAt) + 1_000).toISOString(),
    status: "completed",
    completeness: "complete",
    duration_ms: 1_000,
    input_tokens: null,
    output_tokens: null,
  }).success).toBe(true);
}

function api(handler: (request: Request) => Promise<Response>, path: string): Promise<Response> {
  return handler(new Request(`http://codetrap.local${path}`, {
    headers: { "X-Codetrap-Token": TOKEN },
  }));
}

function postApi(
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  return handler(new Request(`http://codetrap.local${path}`, {
    method: "POST",
    headers: { "X-Codetrap-Token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}
