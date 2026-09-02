import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { openObservationLedger } from "../lib/observation-ledger";
import {
  ObservationRunRecorder,
  adaptNormalizedSessionToObservationRun,
  fingerprint,
} from "../lib/observation-recorder";

const temporaryRoots: string[] = [];

afterAll(() => {
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(tmpdir()) || !basename(root).startsWith("codetrap-observation-recorder-")) {
      throw new Error(`Refusing to remove unexpected test directory: ${root}`);
    }
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

describe("Observation Run recorder", () => {
  test("adapts Codex and Claude metadata symmetrically without transcript bodies or paths", () => {
    const common = {
      transcript_id: "transcript-1",
      session_id: "session-1",
      path: "D:/secret/customer/repository/transcript.jsonl",
      cwd: "D:/secret/customer/repository",
      branch: null,
      client_version: "9.9.9",
      started_at: "2026-08-30T10:00:00.000Z",
      ended_at: "2026-08-30T10:01:00.000Z",
      turn_count: 2,
      turns: [
        { index: 0, role: "user" as const, timestamp: null, text: "RAW PROMPT SECRET" },
        { index: 1, role: "assistant" as const, timestamp: null, text: "RAW REASONING SECRET" },
      ],
    };
    const codex = adaptNormalizedSessionToObservationRun(
      { ...common, source: "codex-sessions" },
      "device-1"
    );
    const claude = adaptNormalizedSessionToObservationRun(
      { ...common, source: "claude-code-sessions" },
      "device-1"
    );

    expect(commonStartFields(codex.start)).toEqual(commonStartFields(claude.start));
    expect(codex.start.source_client).toBe("codex");
    expect(claude.start.source_client).toBe("claude-code");
    expect(JSON.stringify({ codex, claude })).not.toContain("secret/customer");
    expect(JSON.stringify({ codex, claude })).not.toContain("RAW PROMPT");
    expect(JSON.stringify({ codex, claude })).not.toContain("RAW REASONING");
    expect(codex.start.source_session_ref).toBe(fingerprint("codex-sessions:session-1"));
  });

  test("records a complete metadata-only search to feedback path with monotonic seq", () => {
    const root = tempProject();
    let generated = 0;
    const recorder = new ObservationRunRecorder(
      root,
      () => new Date("2026-08-30T12:00:00.000Z"),
      () => `generated-${++generated}`
    );
    const context = { run_id: "run-real", device_id: "device-1", actor_ref: null, source_ref: "cli" };

    expect(recorder.start({
      ...context,
      event_id: "start-1",
      occurred_at: "2026-08-30T11:59:00.000Z",
      source_client: "codex",
      source_session_ref: fingerprint("source-session-secret"),
      repository_revision: "abc123",
      branch: "feature/observation",
      model_provider: "openai",
      model_name: "gpt-test",
      completeness: "complete",
    }).success).toBe(true);

    const search = recorder.search(
      { ...context, event_id: "search-1" },
      {
        query: "customer API key secret query",
        mode: "hybrid",
        path: "D:/customer/private/src/token.ts",
        module: "secret-auth-module",
        results: [{ trap_id: 42, revision: "project:2026-08-30T10:00:00Z", rank: 1 }],
        diagnostics: ["partial_index", "partial_index"],
        duration_ms: 12.5,
      }
    );
    expect(search).toMatchObject({ success: true, inserted: 2, duplicates: 0 });
    expect(recorder.validation({
      ...context,
      event_id: "validation-1",
      kind: "test",
      command: "bun test --token SECRET_VALUE",
      status: "passed",
      passed: 9,
      failed: 0,
      duration_ms: 500,
    }).success).toBe(true);
    expect(recorder.feedback({
      ...context,
      event_id: "feedback-1",
      trap_id: 42,
      revision: "project:2026-08-30T10:00:00Z",
      feedback: "helpful",
      note: "This note contains SECRET_VALUE",
    }).success).toBe(true);
    expect(recorder.complete({
      ...context,
      event_id: "complete-1",
      status: "completed",
      completeness: "complete",
      duration_ms: 60_000,
      input_tokens: null,
      output_tokens: null,
    }).success).toBe(true);

    const ledger = openObservationLedger(root);
    const events = ledger.listEvents({ runId: "run-real" });
    expect(events.map((event) => event.seq)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(events.map((event) => event.type)).toEqual([
      "run/started",
      "trap/search-completed",
      "trap/exposed",
      "validation/completed",
      "trap/feedback-recorded",
      "run/completed",
    ]);
    const stored = JSON.stringify(events);
    for (const forbidden of [
      "customer API key",
      "D:/customer/private",
      "secret-auth-module",
      "bun test --token",
      "This note contains",
      "SECRET_VALUE",
    ]) expect(stored).not.toContain(forbidden);
    expect(stored).toContain(fingerprint("customer API key secret query"));
    expect(ledger.listRuns()[0]).toMatchObject({
      id: "run-real",
      source_client: "codex",
      status: "completed",
      search_count: 1,
      exposure_count: 1,
      validation_count: 1,
      feedback_count: 1,
      latest_validation_status: "passed",
    });
    ledger.close();
  });

  test("deduplicates a retried search and its deterministic exposure children", () => {
    const root = tempProject();
    const recorder = new ObservationRunRecorder(root, () => new Date("2026-08-30T12:00:00.000Z"));
    const context = { run_id: "run-retry", device_id: "device-1", event_id: "stable-search-id" };
    const input = {
      query: "retry query",
      mode: "fts" as const,
      path: null,
      module: null,
      results: [{ trap_id: 1, revision: "project:r1", rank: 1 }],
      diagnostics: [],
      duration_ms: 2,
    };

    expect(recorder.search(context, input)).toMatchObject({ inserted: 2, duplicates: 0 });
    expect(recorder.search(context, input)).toMatchObject({ inserted: 0, duplicates: 2 });
    const ledger = openObservationLedger(root);
    expect(ledger.listEvents({ runId: "run-retry" })).toHaveLength(2);
    ledger.close();
  });

  test("returns a visible warning for storage failure but rejects invalid input", () => {
    const root = tempProject();
    const file = join(root, "not-a-project-directory");
    writeFileSync(file, "occupied");
    const recorder = new ObservationRunRecorder(file);
    const valid = recorder.feedback({
      run_id: "run-1",
      device_id: "device-1",
      trap_id: 1,
      revision: "project:r1",
      feedback: "helpful",
      note: null,
    });
    expect(valid).toMatchObject({ success: false, inserted: 0, duplicates: 0 });
    expect(valid.warning).toContain("primary Codetrap operation is unchanged");

    const healthy = new ObservationRunRecorder(tempProject());
    expect(() => healthy.feedback({
      run_id: "run-1",
      device_id: "device-1",
      trap_id: 1,
      revision: "project:r1",
      feedback: "helpful",
      note: null,
      raw_prompt: "must fail closed",
    } as never)).toThrow("field raw_prompt is not allowed");
  });
});

function tempProject(): string {
  const root = mkdtempSync(join(tmpdir(), "codetrap-observation-recorder-"));
  temporaryRoots.push(root);
  return root;
}

function commonStartFields(input: ReturnType<typeof adaptNormalizedSessionToObservationRun>["start"]) {
  const {
    run_id: _runId,
    event_id: _eventId,
    source_client: _sourceClient,
    source_session_ref: _sourceSessionRef,
    ...common
  } = input;
  return common;
}
