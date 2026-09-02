import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  agentObservationHealth,
  handleAgentObservationHook,
  listActiveAgentObservationRuns,
  recoverStaleAgentObservationRuns,
  type AgentObservationRecorder,
} from "../lib/agent-observation";
import { openObservationLedger } from "../lib/observation-ledger";
import { runCli, tempHome, tempProjectDir } from "./helpers";

describe("opt-in Agent observation", () => {
  test("records a retry-safe Codex turn and automatically attaches normal trap search", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-codex-");
    const home = tempHome();
    runJson(["add", "--input-json", JSON.stringify({
      title: "Keep retries bounded",
      category: "other",
      scope: "project",
      context: "Retry loops.",
      mistake: "Retry forever.",
      fix: "Use a bounded retry budget.",
    }), "--json"], cwd, home);

    const start = {
      hook_event_name: "UserPromptSubmit",
      session_id: "codex-secret-session",
      turn_id: "turn-1",
      cwd: "D:/customer/private",
      transcript_path: "D:/customer/private/transcript.jsonl",
      prompt: "SECRET_PROMPT_DO_NOT_STORE",
      model: "gpt-test",
    };
    expect(runHook("codex", start, cwd, home)).toMatchObject({ exitCode: 0, stdout: "{}\n", stderr: "" });
    expect(runHook("codex", start, cwd, home)).toMatchObject({ exitCode: 0, stdout: "{}\n", stderr: "" });

    const search = runJson(["search", "bounded retries", "--mode", "fts", "--scope", "project", "--json"], cwd, home);
    expect(search.results).toHaveLength(1);

    const stop = {
      hook_event_name: "Stop",
      session_id: "codex-secret-session",
      turn_id: "turn-1",
      transcript_path: "D:/customer/private/transcript.jsonl",
      last_assistant_message: "SECRET_RESPONSE_DO_NOT_STORE",
    };
    expect(runHook("codex", stop, cwd, home).exitCode).toBe(0);
    expect(runHook("codex", stop, cwd, home).exitCode).toBe(0);

    const ledger = openObservationLedger(cwd);
    const runs = ledger.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      source_client: "codex",
      model_provider: "openai",
      model_name: "gpt-test",
      status: "completed",
      completeness: "complete",
      search_count: 1,
      exposure_count: 1,
    });
    const serialized = JSON.stringify(ledger.listEvents({ runId: runs[0].id }));
    for (const forbidden of ["codex-secret-session", "customer/private", "SECRET_PROMPT", "SECRET_RESPONSE", "transcript.jsonl"]) {
      expect(serialized).not.toContain(forbidden);
    }
    ledger.close();
  });

  test("uses bounded local state to correlate consecutive Claude Code turns without reading transcripts", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-claude-");
    const home = tempHome();
    const start = {
      hook_event_name: "UserPromptSubmit",
      session_id: "claude-session-secret",
      transcript_path: "D:/private/claude.jsonl",
      prompt: "PRIVATE CLAUDE PROMPT",
    };
    const stop = {
      hook_event_name: "Stop",
      session_id: "claude-session-secret",
      transcript_path: "D:/private/claude.jsonl",
      last_assistant_message: "PRIVATE CLAUDE RESPONSE",
    };

    runHook("claude", start, cwd, home);
    const firstCurrent = runJson(["observe", "current", "--json"], cwd, home);
    expect(firstCurrent).toMatchObject({ ambiguous: false });
    expect(firstCurrent.active_runs).toHaveLength(1);
    runHook("claude", stop, cwd, home);
    runHook("claude", start, cwd, home);
    const secondCurrent = runJson(["observe", "current", "--json"], cwd, home);
    expect(secondCurrent.active_runs).toHaveLength(1);
    expect(secondCurrent.active_runs[0].run_id).not.toBe(firstCurrent.active_runs[0].run_id);
    runHook("claude", stop, cwd, home);

    const ledger = openObservationLedger(cwd);
    expect(ledger.listRuns()).toHaveLength(2);
    const serialized = JSON.stringify(ledger.listEvents());
    for (const forbidden of ["claude-session-secret", "private/claude", "PRIVATE CLAUDE", "transcript_path", "prompt"]) {
      expect(serialized).not.toContain(forbidden);
    }
    ledger.close();
  });

  test("keeps hook failures neutral and does not block the Agent", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-failure-");
    const home = tempHome();
    writeFileSync(join(cwd, ".codetrap", "observations"), "blocks the observation directory");
    const result = runHook("codex", {
      hook_event_name: "UserPromptSubmit",
      session_id: "session-1",
      turn_id: "turn-1",
      prompt: "must not leak",
    }, cwd, home);
    expect(result).toMatchObject({ exitCode: 0, stdout: "{}\n", stderr: "" });
  });

  test("retains lifecycle state until both fallback start and completion are recorded", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-retry-state-");
    let startAvailable = false;
    let completionAvailable = false;
    const recorder: AgentObservationRecorder = {
      start: () => startAvailable ? observationWrite(true) : observationWrite(false),
      complete: () => completionAvailable ? observationWrite(true) : observationWrite(false),
    };
    const factory = () => recorder;
    const started = handleAgentObservationHook(cwd, "codex", {
      hook_event_name: "UserPromptSubmit",
      session_id: "retry-session",
      turn_id: "retry-turn",
    }, new Date("2026-09-02T02:00:00.000Z"), factory);
    expect(started.recorded).toBe(false);
    expect(listActiveAgentObservationRuns(cwd)).toHaveLength(1);

    const failedStop = handleAgentObservationHook(cwd, "codex", {
      hook_event_name: "Stop",
      session_id: "retry-session",
      turn_id: "retry-turn",
    }, new Date("2026-09-02T02:01:00.000Z"), factory);
    expect(failedStop.recorded).toBe(false);
    expect(listActiveAgentObservationRuns(cwd)).toHaveLength(1);

    startAvailable = true;
    const failedCompletion = handleAgentObservationHook(cwd, "codex", {
      hook_event_name: "Stop",
      session_id: "retry-session",
      turn_id: "retry-turn",
    }, new Date("2026-09-02T02:02:00.000Z"), factory);
    expect(failedCompletion.recorded).toBe(false);
    expect(listActiveAgentObservationRuns(cwd)).toHaveLength(1);

    completionAvailable = true;
    const recovered = handleAgentObservationHook(cwd, "codex", {
      hook_event_name: "SessionEnd",
      session_id: "retry-session",
    }, new Date("2026-09-02T02:03:00.000Z"), factory);
    expect(recovered.recorded).toBe(true);
    expect(listActiveAgentObservationRuns(cwd)).toEqual([]);
  });

  test("fails closed at the active Run bound instead of evicting retry state", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-bound-");
    const observationDirectory = join(cwd, ".codetrap", "observations");
    mkdirSync(observationDirectory, { recursive: true });
    const activeRuns = Array.from({ length: 64 }, (_, index) => agentStateRun(index, {
      started_at: `2026-09-02T03:${String(index % 60).padStart(2, "0")}:00.000Z`,
    }));
    writeFileSync(join(observationDirectory, "agent-hook-state.json"), `${JSON.stringify({
      version: 1,
      active_runs: activeRuns,
    }, null, 2)}\n`);

    let startCalls = 0;
    const recorder: AgentObservationRecorder = {
      start: () => {
        startCalls += 1;
        return observationWrite(true);
      },
      complete: () => observationWrite(true),
    };
    const factory = () => recorder;
    const before = listActiveAgentObservationRuns(cwd);
    expect(before).toHaveLength(64);

    const refused = handleAgentObservationHook(cwd, "codex", {
      hook_event_name: "UserPromptSubmit",
      session_id: "bound-session-overflow",
      turn_id: "bound-turn-overflow",
    }, new Date("2026-09-02T04:30:00.000Z"), factory);
    expect(refused).toEqual({ handled: true, recorded: false, run_id: null });
    expect(startCalls).toBe(0);
    expect(listActiveAgentObservationRuns(cwd)).toEqual(before);
    expect(agentObservationHealth(cwd, new Date("2026-09-02T04:30:00.000Z"))).toMatchObject({
      status: "blocked",
      active_count: 64,
      available_slots: 0,
      warning_codes: ["capacity_reached"],
    });
  });

  test("previews stale Hook recovery without mutation and removes only successfully cancelled Runs", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-recovery-");
    const observationDirectory = join(cwd, ".codetrap", "observations");
    mkdirSync(observationDirectory, { recursive: true });
    const statePath = join(observationDirectory, "agent-hook-state.json");
    writeFileSync(statePath, `${JSON.stringify({
      version: 1,
      active_runs: [
        agentStateRun(1, { started_at: "2026-08-20T00:00:00.000Z" }),
        agentStateRun(2, { started_at: "2026-08-21T00:00:00.000Z", start_recorded: false }),
        agentStateRun(3, { started_at: "2026-09-01T00:00:00.000Z" }),
      ],
    }, null, 2)}\n`);
    const before = readFileSync(statePath, "utf-8");
    const now = new Date("2026-09-02T12:00:00.000Z");
    let recorderCreated = 0;
    const preview = recoverStaleAgentObservationRuns(cwd, {
      olderThanDays: 7,
      now,
      recorderFactory: () => {
        recorderCreated += 1;
        return { start: () => observationWrite(true), complete: () => observationWrite(true) };
      },
    });
    expect(preview).toMatchObject({
      success: true,
      applied: false,
      eligible_count: 2,
      recovered_count: 0,
      health: { status: "attention", active_count: 3, stale_count: 2, pending_start_count: 1 },
    });
    expect(preview.candidates.map((run) => run.run_id)).toEqual(["run-bound-1", "run-bound-2"]);
    expect(recorderCreated).toBe(0);
    expect(readFileSync(statePath, "utf-8")).toBe(before);

    const starts: string[] = [];
    let failSecondCompletion = true;
    const recorder: AgentObservationRecorder = {
      start: (input) => {
        starts.push(input.run_id);
        return observationWrite(true);
      },
      complete: (input) => input.run_id === "run-bound-2" && failSecondCompletion
        ? observationWrite(false)
        : observationWrite(true),
    };
    const firstApply = recoverStaleAgentObservationRuns(cwd, {
      olderThanDays: 7,
      apply: true,
      now,
      recorderFactory: () => recorder,
    });
    expect(firstApply).toMatchObject({
      success: false,
      applied: true,
      recovered_count: 1,
      failed_count: 1,
      recovered_run_ids: ["run-bound-1"],
      failed_run_ids: ["run-bound-2"],
    });
    expect(starts).toEqual(["run-bound-2"]);
    expect(listActiveAgentObservationRuns(cwd).map((run) => run.run_id)).toEqual(["run-bound-2", "run-bound-3"]);

    failSecondCompletion = false;
    const secondApply = recoverStaleAgentObservationRuns(cwd, {
      olderThanDays: 7,
      apply: true,
      now,
      recorderFactory: () => recorder,
    });
    expect(secondApply).toMatchObject({ success: true, recovered_count: 1, failed_count: 0 });
    expect(starts).toEqual(["run-bound-2"]);
    expect(listActiveAgentObservationRuns(cwd).map((run) => run.run_id)).toEqual(["run-bound-3"]);
  });

  test("surfaces Hook health and requires explicit apply for CLI recovery", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-recovery-cli-");
    const home = tempHome();
    const observationDirectory = join(cwd, ".codetrap", "observations");
    mkdirSync(observationDirectory, { recursive: true });
    const statePath = join(observationDirectory, "agent-hook-state.json");
    writeFileSync(statePath, `${JSON.stringify({
      version: 1,
      active_runs: [agentStateRun(7, { started_at: "2026-08-01T00:00:00.000Z", start_recorded: false })],
    }, null, 2)}\n`);

    expect(runJson(["observe", "current", "--json"], cwd, home)).toMatchObject({
      active_runs: [{ run_id: "run-bound-7" }],
      health: { status: "attention", stale_count: 1, pending_start_count: 1 },
    });
    const before = readFileSync(statePath, "utf-8");
    expect(runJson(["observe", "recover", "--older-than-days", "7", "--json"], cwd, home)).toMatchObject({
      applied: false,
      eligible_count: 1,
      candidates: [{ run_id: "run-bound-7", start_recorded: false }],
    });
    expect(readFileSync(statePath, "utf-8")).toBe(before);

    expect(runJson(["observe", "recover", "--older-than-days", "7", "--apply", "--json"], cwd, home)).toMatchObject({
      success: true,
      applied: true,
      recovered_count: 1,
      health: { active_count: 0, status: "healthy" },
    });
    expect(listActiveAgentObservationRuns(cwd)).toEqual([]);
    const ledger = openObservationLedger(cwd);
    expect(ledger.getRun("run-bound-7")).toMatchObject({ status: "cancelled", completeness: "partial" });
    ledger.close();
  });

  test("isolates unreadable Hook state from status and refuses recovery without mutation", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-corrupt-state-");
    const home = tempHome();
    const observationDirectory = join(cwd, ".codetrap", "observations");
    mkdirSync(observationDirectory, { recursive: true });
    const statePath = join(observationDirectory, "agent-hook-state.json");
    const corruptState = '{"version":99,"active_runs":[]}\n';
    writeFileSync(statePath, corruptState);

    expect(agentObservationHealth(cwd)).toEqual({
      status: "unavailable",
      active_count: null,
      capacity: 64,
      available_slots: null,
      stale_after_days: 7,
      stale_count: null,
      pending_start_count: null,
      oldest_started_at: null,
      warning_codes: ["state_unreadable"],
      error_code: "state_unreadable",
      state_file: ".codetrap/observations/agent-hook-state.json",
    });

    const current = runCli(["observe", "current", "--json"], cwd, home);
    expect(current.exitCode).toBe(0);
    expect(JSON.parse(current.stdout)).toMatchObject({
      active_runs: null,
      ambiguous: null,
      health: { status: "unavailable", error_code: "state_unreadable" },
    });

    const status = runCli(["observe", "status", "--json"], cwd, home);
    expect(status.exitCode).toBe(0);
    const statusPayload = JSON.parse(status.stdout);
    expect(statusPayload.integrations.map((integration: { client: string }) => integration.client)).toEqual(["codex", "claude"]);
    expect(statusPayload.health).toMatchObject({ status: "unavailable", error_code: "state_unreadable" });

    const recovery = runCli(["observe", "recover", "--apply", "--json"], cwd, home);
    expect(recovery.exitCode).toBe(1);
    expect(JSON.parse(recovery.stdout)).toMatchObject({
      success: false,
      applied: false,
      health: { status: "unavailable", error_code: "state_unreadable" },
    });
    expect(JSON.parse(recovery.stdout).error).toContain("will not reset unknown Run state automatically");
    expect(readFileSync(statePath, "utf-8")).toBe(corruptState);
  });

  test("fails closed instead of guessing when more than one Agent Run is active", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-ambiguous-");
    const home = tempHome();
    runJson(["add", "--input-json", JSON.stringify({
      title: "Do not guess concurrent ownership",
      category: "other",
      scope: "project",
      context: "Two agents share a project.",
      mistake: "Attach evidence to whichever Run was seen last.",
      fix: "Require an unambiguous active Run or explicit context.",
    }), "--json"], cwd, home);
    runHook("codex", { hook_event_name: "UserPromptSubmit", session_id: "c1", turn_id: "t1" }, cwd, home);
    runHook("claude", { hook_event_name: "UserPromptSubmit", session_id: "c2" }, cwd, home);
    expect(runJson(["observe", "current", "--json"], cwd, home)).toMatchObject({ ambiguous: true });

    expect(runJson(["search", "concurrent ownership", "--mode", "fts", "--scope", "project", "--json"], cwd, home).results).toHaveLength(1);
    const ledger = openObservationLedger(cwd);
    expect(ledger.listRuns()).toHaveLength(2);
    expect(ledger.listRuns().every((run) => run.search_count === 0)).toBe(true);
    ledger.close();
  });

  test("previews, applies, reports, and disables project-local hooks without replacing unrelated config", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-config-");
    const home = tempHome();
    const codexConfig = join(cwd, ".codex", "hooks.json");
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    writeFileSync(codexConfig, JSON.stringify({
      description: "user hooks",
      hooks: { Stop: [{ hooks: [{ type: "command", command: "user-stop-hook" }] }] },
    }, null, 2));
    const before = readFileSync(codexConfig, "utf-8");

    const preview = runJson(["observe", "enable", "codex", "--json"], cwd, home);
    expect(preview).toMatchObject({
      applied: false,
      enabled: false,
      resulting_enabled: true,
      client_trust_required: true,
      privacy: "metadata-only",
    });
    expect(preview.changed_events).toEqual(["UserPromptSubmit", "Stop", "SessionEnd"]);
    expect(readFileSync(codexConfig, "utf-8")).toBe(before);

    const enabled = runJson(["observe", "enable", "codex", "--apply", "--json"], cwd, home);
    expect(enabled).toMatchObject({ applied: true, enabled: true });
    expect(enabled.backup_path).toBeString();
    expect(existsSync(enabled.backup_path)).toBe(true);
    expect(readFileSync(codexConfig, "utf-8")).toContain("user-stop-hook");
    expect(runJson(["observe", "status", "codex", "--json"], cwd, home)).toMatchObject({ enabled: true });
    expect(runJson(["observe", "enable", "codex", "--apply", "--json"], cwd, home)).toMatchObject({
      enabled: true,
      changed_events: [],
      backup_path: null,
    });

    const disabled = runJson(["observe", "disable", "codex", "--apply", "--json"], cwd, home);
    expect(disabled).toMatchObject({ applied: true, enabled: false });
    const final = readFileSync(codexConfig, "utf-8");
    expect(final).toContain("user-stop-hook");
    expect(final).not.toContain("codetrap observe hook --client codex");

    const claudePreview = runJson(["observe", "enable", "claude", "--json"], cwd, home);
    expect(claudePreview.config_path).toBe(join(cwd, ".claude", "settings.json"));
    expect(existsSync(claudePreview.config_path)).toBe(false);
  });

  test("recognizes and removes a compiled Codetrap absolute hook command", () => {
    const cwd = tempProjectDir("codetrap-agent-observation-absolute-command-");
    const home = tempHome();
    const codexConfig = join(cwd, ".codex", "hooks.json");
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const command = '"C:\\Program Files\\Codetrap\\codetrap.exe" observe hook --client codex';
    const group = { hooks: [{ type: "command", command, timeout: 3 }] };
    writeFileSync(codexConfig, JSON.stringify({
      hooks: {
        UserPromptSubmit: [group],
        Stop: [group],
        SessionEnd: [group],
      },
    }, null, 2));

    expect(runJson(["observe", "status", "codex", "--json"], cwd, home)).toMatchObject({ enabled: true });
    expect(runJson(["observe", "disable", "codex", "--apply", "--json"], cwd, home)).toMatchObject({
      enabled: false,
      changed_events: ["UserPromptSubmit", "Stop", "SessionEnd"],
    });
    expect(readFileSync(codexConfig, "utf-8")).not.toContain("observe hook --client codex");
  });
});

function observationWrite(success: boolean) {
  return {
    success,
    event_ids: [],
    inserted: success ? 1 : 0,
    duplicates: 0,
    ...(success ? {} : { warning: "simulated write failure" }),
  };
}

function agentStateRun(index: number, overrides: Record<string, unknown> = {}) {
  return {
    run_id: `run-bound-${index}`,
    client: "codex",
    session_key: `session-key-${index}`,
    source_session_ref: `source-session-ref-${index}`,
    turn_key: `turn-key-${index}`,
    started_at: `2026-09-02T03:${String(index % 60).padStart(2, "0")}:00.000Z`,
    model_name: null,
    start_recorded: true,
    start_event_id: `event-bound-start-${index}`,
    complete_event_id: `event-bound-complete-${index}`,
    ...overrides,
  };
}

function runHook(client: "codex" | "claude", payload: Record<string, unknown>, cwd: string, home: string) {
  return runCli(["observe", "hook", "--client", client], cwd, home, JSON.stringify(payload));
}

function runJson(args: string[], cwd: string, home: string): Record<string, any> {
  const result = runCli(args, cwd, home);
  if (result.exitCode !== 0) throw new Error(`CLI failed (${result.exitCode}): ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}
