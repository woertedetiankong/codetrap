import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { openObservationLedger } from "../lib/observation-ledger";
import { runCli, tempHome, tempProjectDir } from "./helpers";

describe("Observation CLI vertical path", () => {
  test("records start, real search/exposure, useful feedback, validation, and completion", () => {
    const cwd = tempProjectDir("codetrap-observe-cli-");
    const home = tempHome();
    const trap = runJson(["add", "--input-json", JSON.stringify({
      title: "Use bounded retries",
      category: "other",
      scope: "project",
      context: "Network retry loops.",
      mistake: "Retry forever.",
      fix: "Use a bounded retry budget.",
    }), "--json"], cwd, home);

    const common = { run_id: "run-cli-1", device_id: "device-cli", actor_ref: null, source_ref: "cli-test" };
    expect(runJson(["observe", "start", "--input-json", JSON.stringify({
      ...common,
      event_id: "event-start",
      source_client: "claude-code",
      source_session_ref: "opaque-session",
      repository_revision: null,
      branch: null,
      model_provider: "anthropic",
      model_name: "claude-test",
      completeness: "complete",
    }), "--json"], cwd, home)).toMatchObject({ success: true, inserted: 1 });

    const search = runJson([
      "search", "bounded retries SECRET_QUERY", "--mode", "fts", "--scope", "project",
      "--run-id", common.run_id, "--device-id", common.device_id, "--event-id", "event-search", "--json",
    ], cwd, home);
    expect(search.results).toHaveLength(1);
    expect(search.diagnostics).toEqual([]);

    const useful = runJson([
      "useful", String(trap.id), "--scope", "project",
      "--run-id", common.run_id, "--device-id", common.device_id, "--event-id", "event-useful", "--json",
    ], cwd, home);
    expect(useful).toMatchObject({ success: true, useful_count: 1 });
    expect(useful.observation_warning).toBeUndefined();

    expect(runJson(["observe", "validation", "--input-json", JSON.stringify({
      ...common,
      event_id: "event-validation",
      kind: "test",
      command: "bun test SECRET_COMMAND",
      status: "passed",
      passed: 1,
      failed: 0,
      duration_ms: 25,
    }), "--json"], cwd, home)).toMatchObject({ success: true, inserted: 1 });
    expect(runJson(["observe", "complete", "--input-json", JSON.stringify({
      ...common,
      event_id: "event-complete",
      status: "completed",
      completeness: "complete",
      duration_ms: 100,
      input_tokens: null,
      output_tokens: null,
    }), "--json"], cwd, home)).toMatchObject({ success: true, inserted: 1 });

    const ledger = openObservationLedger(cwd);
    const events = ledger.listEvents({ runId: common.run_id });
    expect(events.map((event) => event.type)).toEqual([
      "run/started",
      "trap/search-completed",
      "trap/exposed",
      "trap/feedback-recorded",
      "validation/completed",
      "run/completed",
    ]);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("SECRET_QUERY");
    expect(serialized).not.toContain("SECRET_COMMAND");
    ledger.close();
  });

  test("keeps search successful and returns a diagnostic when its observation sidecar fails", () => {
    const cwd = tempProjectDir("codetrap-observe-sidecar-fail-");
    const home = tempHome();
    runJson(["add", "--input-json", JSON.stringify({
      title: "Keep the primary path alive",
      category: "other",
      scope: "project",
      context: "Optional telemetry writes.",
      mistake: "Fail the user operation when telemetry storage is unavailable.",
      fix: "Return the primary result and a visible telemetry warning.",
    }), "--json"], cwd, home);
    writeFileSync(join(cwd, ".codetrap", "observations"), "blocks the observation directory");

    const result = runCli([
      "search", "primary path", "--mode", "fts", "--scope", "project",
      "--run-id", "run-failure", "--device-id", "device-1", "--json",
    ], cwd, home);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.results).toHaveLength(1);
    expect(payload.diagnostics).toContainEqual(expect.objectContaining({ code: "observation_write_failed" }));
  });

  test("fails closed on unknown observe input fields", () => {
    const cwd = tempProjectDir("codetrap-observe-invalid-");
    const home = tempHome();
    const result = runCli(["observe", "feedback", "--input-json", JSON.stringify({
      run_id: "run-1",
      device_id: "device-1",
      trap_id: null,
      revision: null,
      feedback: "helpful",
      note: null,
      raw_prompt: "must not be silently dropped",
    }), "--json"], cwd, home);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).error).toContain("field raw_prompt is not allowed");
  });
});

function runJson(args: string[], cwd: string, home: string): Record<string, any> {
  const result = runCli(args, cwd, home);
  if (result.exitCode !== 0) {
    throw new Error(`CLI failed (${result.exitCode}): ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}
