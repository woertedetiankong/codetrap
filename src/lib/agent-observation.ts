import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { withAdvisoryLock } from "./advisory-lock";
import { readJsonFile, writeFileAtomic } from "./fs-json";
import {
  ObservationRunRecorder,
  fingerprint,
  type ObservationCallContext,
  type ObservationRunCompleteInput,
  type ObservationRunStartInput,
  type ObservationWriteResult,
} from "./observation-recorder";
import type { RunCompleteness, RunStatus, SourceClient } from "../domain/observation";

export type AgentObservationClient = "codex" | "claude";

export type AgentHookResult = {
  handled: boolean;
  recorded: boolean;
  run_id: string | null;
};

export type AgentObservationRecorder = {
  start(input: ObservationRunStartInput): ObservationWriteResult;
  complete(input: ObservationRunCompleteInput): ObservationWriteResult;
};

export type AgentObservationHealthStatus = "healthy" | "attention" | "blocked" | "unavailable";

export type AgentObservationHealth = {
  status: AgentObservationHealthStatus;
  active_count: number | null;
  capacity: number;
  available_slots: number | null;
  stale_after_days: number;
  stale_count: number | null;
  pending_start_count: number | null;
  oldest_started_at: string | null;
  warning_codes: Array<"capacity_reached" | "capacity_near_limit" | "stale_runs" | "pending_start_writes" | "state_unreadable">;
  error_code?: "state_unreadable";
  state_file?: string;
};

export type AgentObservationRecoveryCandidate = {
  run_id: string;
  client: AgentObservationClient;
  started_at: string;
  start_recorded: boolean;
};

export type AgentObservationRecoveryResult = {
  success: boolean;
  applied: boolean;
  older_than_days: number;
  eligible_count: number;
  recovered_count: number;
  failed_count: number;
  candidates: AgentObservationRecoveryCandidate[];
  recovered_run_ids: string[];
  failed_run_ids: string[];
  health: AgentObservationHealth;
};

type ActiveHookRun = {
  run_id: string;
  client: AgentObservationClient;
  session_key: string;
  source_session_ref: string;
  turn_key: string | null;
  started_at: string;
  model_name: string | null;
  start_recorded: boolean;
  start_event_id: string;
  complete_event_id: string;
};

type HookState = {
  version: 1;
  active_runs: ActiveHookRun[];
};

const STATE_VERSION = 1;
const MAX_ACTIVE_RUNS = 64;
const OBSERVATION_DIR = join(".codetrap", "observations");
const STATE_FILE = "agent-hook-state.json";
const STATE_DISPLAY_PATH = ".codetrap/observations/agent-hook-state.json";
const LOCK_DIR = ".agent-hook-state.lock";
const DEFAULT_STALE_AFTER_DAYS = 7;
const CAPACITY_WARNING_COUNT = Math.ceil(MAX_ACTIVE_RUNS * 0.75);

/**
 * Normalize lifecycle input supplied by Codex or Claude Code into the existing
 * metadata-only Run contract. Client payloads are deliberately treated as an
 * allowlist source: prompt, response, transcript, tool, and reasoning fields
 * may be present, but this adapter never reads or serializes them.
 */
export function handleAgentObservationHook(
  projectRoot: string,
  client: AgentObservationClient,
  payload: Record<string, unknown>,
  now = new Date(),
  recorderFactory: (root: string) => AgentObservationRecorder = (root) => new ObservationRunRecorder(root)
): AgentHookResult {
  const event = stringField(payload.hook_event_name);
  const sessionId = stringField(payload.session_id);
  if (!event || !sessionId || !["UserPromptSubmit", "Stop", "SessionEnd"].includes(event)) {
    return { handled: false, recorded: false, run_id: null };
  }

  const sessionKey = fingerprint(`agent-hook:${client}:session:${sessionId}`);
  const sourceSessionRef = fingerprint(`${sourceClient(client)}:${sessionId}`);
  const occurredAt = now.toISOString();

  if (event === "UserPromptSubmit") {
    const turnId = client === "codex" ? stringField(payload.turn_id) : null;
    if (client === "codex" && !turnId) return { handled: false, recorded: false, run_id: null };
    const turnKey = turnId ? fingerprint(`agent-hook:${client}:turn:${turnId}`) : null;
    const active = mutateState(projectRoot, (state): ActiveHookRun | null => {
      const existing = client === "codex"
        ? state.active_runs.find((run) => run.session_key === sessionKey && run.turn_key === turnKey)
        : state.active_runs.find((run) => run.session_key === sessionKey && run.client === client);
      if (existing) return existing;

      // Do not evict a recorded Run merely to admit a newer one. Eviction would
      // leave the append-only ledger permanently active with no retry state.
      if (state.active_runs.length >= MAX_ACTIVE_RUNS) return null;

      const runId = client === "codex"
        ? stableRunId(`${client}:${sessionId}:${turnId}`)
        : `run-${randomUUID()}`;
      const created: ActiveHookRun = {
        run_id: runId,
        client,
        session_key: sessionKey,
        source_session_ref: sourceSessionRef,
        turn_key: turnKey,
        started_at: occurredAt,
        model_name: stringField(payload.model),
        start_recorded: false,
        start_event_id: stableEventId(runId, "started"),
        complete_event_id: stableEventId(runId, "completed"),
      };
      state.active_runs.push(created);
      state.active_runs.sort((left, right) => left.started_at.localeCompare(right.started_at));
      return created;
    });
    if (!active) return { handled: true, recorded: false, run_id: null };
    const result = recorderFactory(projectRoot).start({
      ...hookContext(active, occurredAt),
      source_client: sourceClient(client),
      source_session_ref: active.source_session_ref,
      repository_revision: null,
      branch: null,
      model_provider: client === "codex" ? "openai" : "anthropic",
      model_name: active.model_name,
      completeness: "partial",
    });
    if (result.success) {
      mutateState(projectRoot, (state) => {
        const current = state.active_runs.find((run) => run.run_id === active.run_id);
        if (current) current.start_recorded = true;
        return null;
      });
    }
    return { handled: true, recorded: result.success, run_id: active.run_id };
  }

  const matching = readState(projectRoot).active_runs.filter((run) => {
    if (run.session_key !== sessionKey || run.client !== client) return false;
    if (client !== "codex" || event === "SessionEnd") return true;
    const turnId = stringField(payload.turn_id);
    return turnId !== null && run.turn_key === fingerprint(`agent-hook:${client}:turn:${turnId}`);
  });
  if (matching.length === 0) return { handled: true, recorded: false, run_id: null };

  let recorded = true;
  const startedRunIds = new Set<string>();
  const completedRunIds = new Set<string>();
  const recorder = recorderFactory(projectRoot);
  for (const active of matching) {
    if (!active.start_recorded) {
      const started = recorder.start({
        ...hookContext(active, active.started_at),
        source_client: sourceClient(client),
        source_session_ref: active.source_session_ref,
        repository_revision: null,
        branch: null,
        model_provider: client === "codex" ? "openai" : "anthropic",
        model_name: active.model_name,
        completeness: "partial",
      });
      if (!started.success) {
        recorded = false;
        continue;
      }
      startedRunIds.add(active.run_id);
    }
    const completion = event === "Stop"
      ? { status: "completed" as RunStatus, completeness: "complete" as RunCompleteness }
      : { status: "cancelled" as RunStatus, completeness: "partial" as RunCompleteness };
    const result = recorder.complete({
      run_id: active.run_id,
      device_id: deviceId(client),
      event_id: active.complete_event_id,
      actor_ref: null,
      source_ref: null,
      occurred_at: occurredAt,
      ...completion,
      duration_ms: elapsedMs(active.started_at, occurredAt),
      input_tokens: null,
      output_tokens: null,
    });
    recorded = recorded && result.success;
    if (result.success) completedRunIds.add(active.run_id);
  }
  mutateState(projectRoot, (state) => {
    for (const run of state.active_runs) {
      if (startedRunIds.has(run.run_id)) run.start_recorded = true;
    }
    state.active_runs = state.active_runs.filter((run) => !completedRunIds.has(run.run_id));
    return null;
  });
  return { handled: true, recorded, run_id: matching[0]?.run_id ?? null };
}

/** Return an implicit context only when exactly one Agent turn is active. */
export function activeAgentObservationContext(projectRoot: string): ObservationCallContext | undefined {
  try {
    const active = readState(projectRoot).active_runs.filter((run) => run.start_recorded);
    if (active.length !== 1) return undefined;
    return {
      run_id: active[0].run_id,
      device_id: deviceId(active[0].client),
      actor_ref: null,
      source_ref: "agent-hook",
    };
  } catch {
    return undefined;
  }
}

export function listActiveAgentObservationRuns(projectRoot: string): Array<{
  run_id: string;
  client: AgentObservationClient;
  started_at: string;
}> {
  return readState(projectRoot).active_runs.map(({ run_id, client, started_at }) => ({
    run_id,
    client,
    started_at,
  }));
}

/** Read-only health projection for CLI and Web operator surfaces. */
export function agentObservationHealth(
  projectRoot: string,
  now = new Date(),
  staleAfterDays = DEFAULT_STALE_AFTER_DAYS
): AgentObservationHealth {
  const days = validatedStaleAfterDays(staleAfterDays);
  let activeRuns: ActiveHookRun[];
  try {
    activeRuns = readState(projectRoot).active_runs;
  } catch {
    return {
      status: "unavailable",
      active_count: null,
      capacity: MAX_ACTIVE_RUNS,
      available_slots: null,
      stale_after_days: days,
      stale_count: null,
      pending_start_count: null,
      oldest_started_at: null,
      warning_codes: ["state_unreadable"],
      error_code: "state_unreadable",
      state_file: STATE_DISPLAY_PATH,
    };
  }
  const staleRuns = staleActiveRuns(activeRuns, now, days);
  const warningCodes: AgentObservationHealth["warning_codes"] = [];
  if (activeRuns.length >= MAX_ACTIVE_RUNS) warningCodes.push("capacity_reached");
  else if (activeRuns.length >= CAPACITY_WARNING_COUNT) warningCodes.push("capacity_near_limit");
  if (staleRuns.length) warningCodes.push("stale_runs");
  if (activeRuns.some((run) => !run.start_recorded)) warningCodes.push("pending_start_writes");
  return {
    status: activeRuns.length >= MAX_ACTIVE_RUNS ? "blocked" : warningCodes.length ? "attention" : "healthy",
    active_count: activeRuns.length,
    capacity: MAX_ACTIVE_RUNS,
    available_slots: Math.max(0, MAX_ACTIVE_RUNS - activeRuns.length),
    stale_after_days: days,
    stale_count: staleRuns.length,
    pending_start_count: activeRuns.filter((run) => !run.start_recorded).length,
    oldest_started_at: activeRuns[0]?.started_at ?? null,
    warning_codes: warningCodes,
  };
}

/**
 * Preview or explicitly recover abandoned Hook Runs. Preview is read-only.
 * Apply records cancelled/partial evidence before removing retry state.
 */
export function recoverStaleAgentObservationRuns(
  projectRoot: string,
  options: {
    olderThanDays?: number;
    apply?: boolean;
    now?: Date;
    recorderFactory?: (root: string) => AgentObservationRecorder;
  } = {}
): AgentObservationRecoveryResult {
  const now = options.now ?? new Date();
  const olderThanDays = validatedStaleAfterDays(options.olderThanDays ?? DEFAULT_STALE_AFTER_DAYS);
  const candidates = staleActiveRuns(readState(projectRoot).active_runs, now, olderThanDays);
  const safeCandidates = candidates.map(recoveryCandidate);
  if (!options.apply || candidates.length === 0) {
    return {
      success: true,
      applied: false,
      older_than_days: olderThanDays,
      eligible_count: candidates.length,
      recovered_count: 0,
      failed_count: 0,
      candidates: safeCandidates,
      recovered_run_ids: [],
      failed_run_ids: [],
      health: agentObservationHealth(projectRoot, now, olderThanDays),
    };
  }

  const recorder = (options.recorderFactory ?? ((root) => new ObservationRunRecorder(root)))(projectRoot);
  const startedRunIds = new Set<string>();
  const recoveredRunIds = new Set<string>();
  const failedRunIds = new Set<string>();
  const occurredAt = now.toISOString();
  for (const active of candidates) {
    if (!active.start_recorded) {
      const started = recorder.start({
        ...hookContext(active, active.started_at),
        source_client: sourceClient(active.client),
        source_session_ref: active.source_session_ref,
        repository_revision: null,
        branch: null,
        model_provider: active.client === "codex" ? "openai" : "anthropic",
        model_name: active.model_name,
        completeness: "partial",
      });
      if (!started.success) {
        failedRunIds.add(active.run_id);
        continue;
      }
      startedRunIds.add(active.run_id);
    }
    const completed = recorder.complete({
      run_id: active.run_id,
      device_id: deviceId(active.client),
      event_id: active.complete_event_id,
      actor_ref: null,
      source_ref: "agent-hook-recovery",
      occurred_at: occurredAt,
      status: "cancelled",
      completeness: "partial",
      duration_ms: elapsedMs(active.started_at, occurredAt),
      input_tokens: null,
      output_tokens: null,
    });
    if (completed.success) recoveredRunIds.add(active.run_id);
    else failedRunIds.add(active.run_id);
  }
  mutateState(projectRoot, (state) => {
    for (const run of state.active_runs) {
      if (startedRunIds.has(run.run_id)) run.start_recorded = true;
    }
    state.active_runs = state.active_runs.filter((run) => !recoveredRunIds.has(run.run_id));
    return null;
  });
  return {
    success: failedRunIds.size === 0,
    applied: true,
    older_than_days: olderThanDays,
    eligible_count: candidates.length,
    recovered_count: recoveredRunIds.size,
    failed_count: failedRunIds.size,
    candidates: safeCandidates,
    recovered_run_ids: [...recoveredRunIds],
    failed_run_ids: [...failedRunIds],
    health: agentObservationHealth(projectRoot, now, olderThanDays),
  };
}

function mutateState<T>(projectRoot: string, mutate: (state: HookState) => T): T {
  const directory = join(projectRoot, OBSERVATION_DIR);
  mkdirSync(directory, { recursive: true });
  return withAdvisoryLock(join(directory, LOCK_DIR), () => {
    const state = readState(projectRoot);
    const result = mutate(state);
    writeFileAtomic(join(directory, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
    return result;
  }).value;
}

function readState(projectRoot: string): HookState {
  const path = join(projectRoot, OBSERVATION_DIR, STATE_FILE);
  if (!existsSync(path)) return { version: STATE_VERSION, active_runs: [] };
  const value = readJsonFile<unknown>(path, "Agent observation hook state");
  if (!plainObject(value) || value.version !== STATE_VERSION || !Array.isArray(value.active_runs)) {
    throw new Error(`Unsupported Agent observation hook state at ${path}.`);
  }
  const activeRuns = value.active_runs.map((entry) => validateActiveRun(entry, path));
  if (activeRuns.length > MAX_ACTIVE_RUNS) throw new Error(`Agent observation hook state at ${path} exceeds its bound.`);
  return { version: STATE_VERSION, active_runs: activeRuns };
}

function validateActiveRun(value: unknown, path: string): ActiveHookRun {
  if (!plainObject(value)) throw new Error(`Invalid Agent observation hook state at ${path}.`);
  const client = value.client;
  if (client !== "codex" && client !== "claude") throw new Error(`Invalid Agent observation client at ${path}.`);
  const required = ["run_id", "session_key", "source_session_ref", "started_at", "start_event_id", "complete_event_id"];
  if (required.some((key) => !stringField(value[key]))) throw new Error(`Invalid Agent observation hook state at ${path}.`);
  if (value.turn_key !== null && !stringField(value.turn_key)) throw new Error(`Invalid Agent observation turn state at ${path}.`);
  if (value.model_name !== null && !stringField(value.model_name)) throw new Error(`Invalid Agent observation model state at ${path}.`);
  if (typeof value.start_recorded !== "boolean") throw new Error(`Invalid Agent observation start state at ${path}.`);
  return value as unknown as ActiveHookRun;
}

function staleActiveRuns(activeRuns: ActiveHookRun[], now: Date, staleAfterDays: number): ActiveHookRun[] {
  const cutoff = now.getTime() - staleAfterDays * 24 * 60 * 60 * 1000;
  return activeRuns.filter((run) => {
    const startedAt = Date.parse(run.started_at);
    return Number.isFinite(startedAt) && startedAt <= cutoff;
  });
}

function recoveryCandidate(run: ActiveHookRun): AgentObservationRecoveryCandidate {
  return {
    run_id: run.run_id,
    client: run.client,
    started_at: run.started_at,
    start_recorded: run.start_recorded,
  };
}

function validatedStaleAfterDays(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 3650) {
    throw new Error("older-than-days must be an integer between 1 and 3650.");
  }
  return value;
}

function hookContext(active: ActiveHookRun, occurredAt: string): ObservationCallContext {
  return {
    run_id: active.run_id,
    device_id: deviceId(active.client),
    event_id: active.start_event_id,
    actor_ref: null,
    source_ref: null,
    occurred_at: occurredAt,
  };
}

function sourceClient(client: AgentObservationClient): SourceClient {
  return client === "codex" ? "codex" : "claude-code";
}

function deviceId(client: AgentObservationClient): string {
  return `agent-hook-${client}`;
}

function stableRunId(seed: string): string {
  return `run-${fingerprint(`agent-hook:v1:${seed}`).slice("sha256:".length, "sha256:".length + 32)}`;
}

function stableEventId(runId: string, phase: string): string {
  return `event-${fingerprint(`${runId}:${phase}`).slice("sha256:".length, "sha256:".length + 32)}`;
}

function elapsedMs(start: string, end: string): number | null {
  const value = Date.parse(end) - Date.parse(start);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
