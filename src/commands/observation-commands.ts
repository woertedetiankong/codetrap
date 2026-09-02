import { readFileSync } from "node:fs";
import type { TrapStore } from "../lib/store";
import {
  activeAgentObservationContext,
  agentObservationHealth,
  handleAgentObservationHook,
  listActiveAgentObservationRuns,
  recoverStaleAgentObservationRuns,
  type AgentObservationClient,
  type AgentObservationHealth,
} from "../lib/agent-observation";
import {
  configureObservationIntegration,
  formatObservationIntegration,
  observationIntegrationStatus,
} from "../lib/observation-integration";
import {
  OBSERVATION_RECORD_KINDS,
  ObservationRunRecorder,
  recordObservation,
  type ObservationRecordKind,
} from "../lib/observation-recorder";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { errorFrom, jsonObjectInput, parseArgs, wantsJson } from "./command-args";

export function cmdObserve(args: string[], store: TrapStore): CommandResult {
  const sub = args[0];
  if (sub === "hook") return runHook(args.slice(1), store);

  if (sub === "recover") return runRecovery(args.slice(1), store);

  if (sub === "enable" || sub === "disable" || sub === "status") {
    return runIntegrationCommand(sub, args.slice(1), store);
  }

  if (sub === "current") {
    const projectRoot = store.getProjectRoot();
    if (!projectRoot) return errorResult("observe current requires an initialized project. Run 'codetrap init' first.");
    const { opts } = parseArgs(args.slice(1));
    const health = agentObservationHealth(projectRoot);
    if (health.status === "unavailable") {
      return wantsJson(opts)
        ? jsonResult({ active_runs: null, ambiguous: null, health })
        : textResult(formatAgentObservationHealth(health));
    }
    const runs = listActiveAgentObservationRuns(projectRoot);
    return wantsJson(opts)
      ? jsonResult({ active_runs: runs, ambiguous: runs.length > 1, health })
      : textResult(`${runs.length === 0
        ? "No automatic Observation Run is active."
        : runs.map((run) => `${run.run_id} (${run.client}, started ${run.started_at})`).join("\n")}\n\n${formatAgentObservationHealth(health)}`);
  }

  if (!(OBSERVATION_RECORD_KINDS as readonly string[]).includes(sub)) {
    return errorResult(
      "Usage: codetrap observe <start|validation|feedback|missed|complete> --input-json <json|-> [--json]\n" +
      "       codetrap observe <enable|disable|status> [codex|claude] [--apply] [--json]\n" +
      "       codetrap observe current [--json]\n" +
      "       codetrap observe recover [--older-than-days 7] [--apply] [--json]"
    );
  }
  const projectRoot = store.getProjectRoot();
  if (!projectRoot) return errorResult("observe requires an initialized project. Run 'codetrap init' first.");

  const rawArgs = args.slice(1);
  const { opts } = parseArgs(rawArgs);
  try {
    let input = jsonObjectInput(opts);
    if (["validation", "feedback", "missed"].includes(sub) && input.run_id === undefined && input.device_id === undefined) {
      const active = activeAgentObservationContext(projectRoot);
      if (active) input = { ...active, ...input };
    }
    const recorder = new ObservationRunRecorder(projectRoot);
    const result = recordObservation(recorder, sub as ObservationRecordKind, input);
    if (wantsJson(opts)) return jsonResult(result, result.success ? 0 : 1);
    return result.success
      ? textResult(`Recorded ${result.inserted} observation event(s); ${result.duplicates} duplicate(s).`)
      : errorResult(result.warning ?? "Observation event was not recorded.");
  } catch (error) {
    return errorFrom(error, rawArgs);
  }
}

function runRecovery(args: string[], store: TrapStore): CommandResult {
  const projectRoot = store.getProjectRoot();
  if (!projectRoot) return errorResult("observe recover requires an initialized project. Run 'codetrap init' first.");
  const { opts } = parseArgs(args);
  try {
    const olderThanDays = opts["older-than-days"] === undefined
      ? undefined
      : Number(opts["older-than-days"]);
    const health = agentObservationHealth(projectRoot, new Date(), olderThanDays);
    if (health.status === "unavailable") {
      const message = observationStateUnavailableMessage(health);
      return wantsJson(opts)
        ? jsonResult({ success: false, applied: false, error: message, health }, 1)
        : errorResult(message);
    }
    const result = recoverStaleAgentObservationRuns(projectRoot, {
      ...(olderThanDays === undefined ? {} : { olderThanDays }),
      apply: opts.apply !== undefined,
    });
    if (wantsJson(opts)) return jsonResult(result, result.success ? 0 : 1);
    if (!result.applied) {
      return textResult(result.eligible_count === 0
        ? `No automatic Observation Run is older than ${result.older_than_days} day(s).\n\n${formatAgentObservationHealth(result.health)}`
        : `Recovery preview: ${result.eligible_count} Run(s) are older than ${result.older_than_days} day(s). No state changed.\nRun again with --apply after reviewing the JSON preview.\n\n${formatAgentObservationHealth(result.health)}`);
    }
    return result.success
      ? textResult(`Recovered ${result.recovered_count} stale Observation Run(s) as cancelled/partial.\n\n${formatAgentObservationHealth(result.health)}`)
      : errorResult(`Recovered ${result.recovered_count} stale Run(s), but ${result.failed_count} remain retryable.`);
  } catch (error) {
    return errorFrom(error, args);
  }
}

function runHook(args: string[], store: TrapStore): CommandResult {
  // Hook processes must be observational sidecars: malformed input, missing
  // projects, and storage failures all return neutral JSON and never steer or
  // block the Agent that invoked them.
  try {
    const { opts } = parseArgs(args);
    const client = agentClient(opts.client);
    const projectRoot = store.getProjectRoot();
    const payload = JSON.parse(readFileSync(0, "utf-8")) as unknown;
    if (client && projectRoot && payload && typeof payload === "object" && !Array.isArray(payload)) {
      handleAgentObservationHook(projectRoot, client, payload as Record<string, unknown>);
    }
  } catch {
    // Neutral hook output below is intentional failure isolation.
  }
  return textResult("{}");
}

function runIntegrationCommand(
  action: "enable" | "disable" | "status",
  args: string[],
  store: TrapStore
): CommandResult {
  const projectRoot = store.getProjectRoot();
  if (!projectRoot) return errorResult(`observe ${action} requires an initialized project. Run 'codetrap init' first.`);
  const { opts, positionals } = parseArgs(args);
  try {
    if (action === "status" && positionals.length === 0) {
      const results = (["codex", "claude"] as const).map((client) => observationIntegrationStatus(projectRoot, client));
      const health = agentObservationHealth(projectRoot);
      return wantsJson(opts)
        ? jsonResult({ integrations: results, health })
        : textResult(`${results.map(formatObservationIntegration).join("\n\n")}\n\n${formatAgentObservationHealth(health)}`);
    }
    const client = agentClient(positionals[0]);
    if (!client) return errorResult(`Usage: codetrap observe ${action} <codex|claude> [--apply] [--json]`);
    const result = action === "status"
      ? observationIntegrationStatus(projectRoot, client)
      : configureObservationIntegration(projectRoot, client, action, opts.apply !== undefined);
    return wantsJson(opts) ? jsonResult(result) : textResult(formatObservationIntegration(result));
  } catch (error) {
    return errorFrom(error, args);
  }
}

function formatAgentObservationHealth(health: AgentObservationHealth): string {
  if (health.status === "unavailable") return observationStateUnavailableMessage(health);
  const summary = `Observation Hook health: ${health.status} (${health.active_count}/${health.capacity} active, ${health.stale_count} stale).`;
  if (health.status === "healthy") return summary;
  const preview = `Preview recovery with: codetrap observe recover --older-than-days ${health.stale_after_days} --json`;
  return `${summary}\n${preview}`;
}

function observationStateUnavailableMessage(health: AgentObservationHealth): string {
  const file = health.state_file ?? ".codetrap/observations/agent-hook-state.json";
  return `Observation Hook state is unavailable at ${file}. Integration and Ledger data remain readable, but active Run counts and recovery are disabled. No state changed. Restore a valid backup or inspect the file before retrying; Codetrap will not reset unknown Run state automatically.`;
}

function agentClient(value: unknown): AgentObservationClient | null {
  return value === "codex" || value === "claude" ? value : null;
}
