import { createHash, randomUUID } from "node:crypto";
import type { NormalizedSession } from "../domain/learning-source";
import {
  RUN_COMPLETENESS,
  RUN_STATUSES,
  SOURCE_CLIENTS,
  TRAP_FEEDBACK_VALUES,
  VALIDATION_KINDS,
  VALIDATION_STATUSES,
  type ObservationEvent,
  type RunCompleteness,
  type RunStatus,
  type SourceClient,
  type TrapFeedback,
  type ValidationKind,
  type ValidationStatus,
} from "../domain/observation";
import {
  openObservationLedger,
  validateUnsequencedObservationEvent,
  type UnsequencedObservationEvent,
} from "./observation-ledger";

export interface ObservationCallContext {
  run_id: string;
  device_id: string;
  event_id?: string;
  actor_ref?: string | null;
  source_ref?: string | null;
  occurred_at?: string;
}

export interface ObservationRunStartInput extends ObservationCallContext {
  source_client: SourceClient;
  source_session_ref: string | null;
  repository_revision: string | null;
  branch: string | null;
  model_provider: string | null;
  model_name: string | null;
  completeness: RunCompleteness;
}

export interface ObservationRunCompleteInput extends ObservationCallContext {
  status: RunStatus;
  completeness: RunCompleteness;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

export interface ObservationValidationInput extends ObservationCallContext {
  kind: ValidationKind;
  command: string | null;
  status: ValidationStatus;
  passed: number | null;
  failed: number | null;
  duration_ms: number | null;
}

export interface ObservationFeedbackInput extends ObservationCallContext {
  trap_id: number | null;
  revision: string | null;
  feedback: TrapFeedback;
  note: string | null;
}

export interface ObservationMissedInput extends ObservationCallContext {
  query: string | null;
  expected_trap_id: number | null;
}

export interface ObservationSearchInput {
  query: string;
  mode: "fts" | "semantic" | "hybrid";
  path: string | null;
  module: string | null;
  results: Array<{ trap_id: number; revision: string; rank: number }>;
  diagnostics: string[];
  duration_ms: number | null;
}

export interface ObservationWriteResult {
  success: boolean;
  event_ids: string[];
  inserted: number;
  duplicates: number;
  warning?: string;
}

export interface AdaptedObservationRun {
  run_id: string;
  start: ObservationRunStartInput;
  complete: ObservationRunCompleteInput;
}

export const OBSERVATION_RECORD_KINDS = ["start", "validation", "feedback", "missed", "complete"] as const;
export type ObservationRecordKind = (typeof OBSERVATION_RECORD_KINDS)[number];

export class ObservationRunRecorder {
  constructor(
    private readonly projectRoot: string,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => randomUUID()
  ) {}

  start(input: ObservationRunStartInput): ObservationWriteResult {
    validateInputKeys(input, START_KEYS, "observe start input");
    return this.write([this.event(input, "run/started", "observed_fact", {
      source_client: enumInput(input.source_client, SOURCE_CLIENTS, "source_client"),
      source_session_ref: nullableString(input.source_session_ref, "source_session_ref"),
      repository_revision: nullableString(input.repository_revision, "repository_revision"),
      branch: nullableString(input.branch, "branch"),
      model_provider: nullableString(input.model_provider, "model_provider"),
      model_name: nullableString(input.model_name, "model_name"),
      completeness: enumInput(input.completeness, RUN_COMPLETENESS, "completeness"),
    })]);
  }

  complete(input: ObservationRunCompleteInput): ObservationWriteResult {
    validateInputKeys(input, COMPLETE_KEYS, "observe complete input");
    return this.write([this.event(input, "run/completed", "observed_fact", {
      status: enumInput(input.status, RUN_STATUSES, "status"),
      completeness: enumInput(input.completeness, RUN_COMPLETENESS, "completeness"),
      duration_ms: nullableNonNegativeNumber(input.duration_ms, "duration_ms"),
      input_tokens: nullableNonNegativeInteger(input.input_tokens, "input_tokens"),
      output_tokens: nullableNonNegativeInteger(input.output_tokens, "output_tokens"),
    })]);
  }

  validation(input: ObservationValidationInput): ObservationWriteResult {
    validateInputKeys(input, VALIDATION_KEYS, "observe validation input");
    return this.write([this.event(input, "validation/completed", "observed_fact", {
      kind: enumInput(input.kind, VALIDATION_KINDS, "kind"),
      command_fingerprint: fingerprintNullable(input.command),
      status: enumInput(input.status, VALIDATION_STATUSES, "status"),
      passed: nullableNonNegativeInteger(input.passed, "passed"),
      failed: nullableNonNegativeInteger(input.failed, "failed"),
      duration_ms: nullableNonNegativeNumber(input.duration_ms, "duration_ms"),
    })]);
  }

  feedback(input: ObservationFeedbackInput): ObservationWriteResult {
    validateInputKeys(input, FEEDBACK_KEYS, "observe feedback input");
    return this.write([this.event(input, "trap/feedback-recorded", "human_label", {
      trap_id: nullableNonNegativeInteger(input.trap_id, "trap_id"),
      revision: nullableString(input.revision, "revision"),
      feedback: enumInput(input.feedback, TRAP_FEEDBACK_VALUES, "feedback"),
      note_fingerprint: fingerprintNullable(input.note),
    })]);
  }

  missed(input: ObservationMissedInput): ObservationWriteResult {
    validateInputKeys(input, MISSED_KEYS, "observe missed input");
    return this.write([this.event(input, "trap/missed-reported", "human_label", {
      query_fingerprint: fingerprintNullable(input.query),
      expected_trap_id: nullableNonNegativeInteger(input.expected_trap_id, "expected_trap_id"),
    })]);
  }

  search(context: ObservationCallContext, input: ObservationSearchInput): ObservationWriteResult {
    validateInputKeys(context, CONTEXT_KEYS, "search observation context");
    validateInputKeys(input, SEARCH_KEYS, "search observation input");
    const queryFingerprint = fingerprint(nonEmptyString(input.query, "query"));
    const searchId = context.event_id ?? this.newId();
    const searchContext = { ...context, event_id: searchId };
    const events: UnsequencedObservationEvent[] = [this.event(
      searchContext,
      "trap/search-completed",
      "observed_fact",
      {
        query_fingerprint: queryFingerprint,
        mode: enumInput(input.mode, ["fts", "semantic", "hybrid"] as const, "mode"),
        path_hint: fingerprintNullable(input.path),
        module_hint: fingerprintNullable(input.module),
        results: input.results,
        diagnostics: uniqueStrings(input.diagnostics),
        duration_ms: nullableNonNegativeNumber(input.duration_ms, "duration_ms"),
      }
    )];
    for (const [index, result] of input.results.entries()) {
      events.push(this.event(
        { ...context, event_id: childEventId(searchId, result, index) },
        "trap/exposed",
        "observed_fact",
        {
          trap_id: result.trap_id,
          revision: result.revision,
          rank: result.rank,
          query_fingerprint: queryFingerprint,
        }
      ));
    }
    return this.write(events);
  }

  private event(
    context: ObservationCallContext,
    type: ObservationEvent["type"],
    evidenceClass: ObservationEvent["evidence_class"],
    attributes: ObservationEvent["attributes"]
  ): UnsequencedObservationEvent {
    const recordedAt = this.now().toISOString();
    return {
      version: 1,
      id: context.event_id ?? this.newId(),
      project_id: "pending-project-id",
      run_id: nonEmptyString(context.run_id, "run_id"),
      actor_ref: context.actor_ref === undefined ? null : nullableString(context.actor_ref, "actor_ref"),
      device_id: nonEmptyString(context.device_id, "device_id"),
      occurred_at: context.occurred_at ?? recordedAt,
      recorded_at: recordedAt,
      type,
      evidence_class: evidenceClass,
      sensitivity: "metadata",
      attributes,
      body_ref: null,
      source_ref: context.source_ref === undefined ? null : nullableString(context.source_ref, "source_ref"),
    };
  }

  private write(events: UnsequencedObservationEvent[]): ObservationWriteResult {
    const validated = events.map(validateUnsequencedObservationEvent);
    let ledger: ReturnType<typeof openObservationLedger> | null = null;
    let result: ObservationWriteResult;
    let closeFailed = false;
    try {
      ledger = openObservationLedger(this.projectRoot);
      const projectEvents = validated.map((event) => ({ ...event, project_id: ledger!.projectId }));
      const appended = ledger.appendNextMany(projectEvents);
      result = {
        success: true,
        event_ids: appended.events.map((event) => event.id),
        inserted: appended.inserted,
        duplicates: appended.duplicates,
      };
    } catch {
      result = {
        success: false,
        event_ids: [],
        inserted: 0,
        duplicates: 0,
        warning: "Observation sidecar could not record this event; the primary Codetrap operation is unchanged.",
      };
    } finally {
      try {
        ledger?.close();
      } catch {
        closeFailed = true;
      }
    }
    return closeFailed ? {
      success: false,
      event_ids: [],
      inserted: 0,
      duplicates: 0,
      warning: "Observation sidecar could not finish recording this event; the primary Codetrap operation is unchanged.",
    } : result;
  }
}

export function recordObservation(
  recorder: ObservationRunRecorder,
  kind: ObservationRecordKind,
  input: Record<string, unknown>
): ObservationWriteResult {
  switch (kind) {
    case "start":
      return recorder.start(input as unknown as ObservationRunStartInput);
    case "validation":
      return recorder.validation(input as unknown as ObservationValidationInput);
    case "feedback":
      return recorder.feedback(input as unknown as ObservationFeedbackInput);
    case "missed":
      return recorder.missed(input as unknown as ObservationMissedInput);
    case "complete":
      return recorder.complete(input as unknown as ObservationRunCompleteInput);
  }
}

export function adaptNormalizedSessionToObservationRun(
  session: NormalizedSession,
  deviceId: string,
  recordedAt = new Date()
): AdaptedObservationRun {
  const sourceClient = session.source === "codex-sessions" ? "codex" : "claude-code";
  const runHash = fingerprint(`${session.source}:${session.transcript_id}`).slice("sha256:".length, 30);
  const runId = `run-${runHash}`;
  const sourceSessionRef = fingerprint(`${session.source}:${session.session_id}`);
  const completeness: RunCompleteness = session.started_at && session.ended_at ? "complete" : "partial";
  const fallback = recordedAt.toISOString();
  return {
    run_id: runId,
    start: {
      run_id: runId,
      event_id: `event-${runHash}-started`,
      device_id: nonEmptyString(deviceId, "device_id"),
      actor_ref: null,
      source_ref: null,
      occurred_at: session.started_at ?? fallback,
      source_client: sourceClient,
      source_session_ref: sourceSessionRef,
      repository_revision: null,
      branch: session.branch,
      model_provider: null,
      model_name: null,
      completeness,
    },
    complete: {
      run_id: runId,
      event_id: `event-${runHash}-completed`,
      device_id: nonEmptyString(deviceId, "device_id"),
      actor_ref: null,
      source_ref: null,
      occurred_at: session.ended_at ?? fallback,
      status: session.ended_at ? "completed" : "unknown",
      completeness,
      duration_ms: durationMs(session.started_at, session.ended_at),
      input_tokens: null,
      output_tokens: null,
    },
  };
}

export function observationContextFromArgs(args: Record<string, unknown>): ObservationCallContext | undefined {
  const runId = option(args, "run_id", "run-id", "observation_run_id", "observation-run-id");
  const deviceId = option(args, "device_id", "device-id", "observation_device_id", "observation-device-id");
  if (!runId && !deviceId) return undefined;
  if (!runId || !deviceId) throw new Error("Observation context requires both run_id and device_id.");
  return {
    run_id: runId,
    device_id: deviceId,
    event_id: option(args, "event_id", "event-id", "observation_event_id", "observation-event-id"),
    actor_ref: option(args, "actor_ref", "actor-ref") ?? null,
    source_ref: option(args, "source_ref", "source-ref") ?? null,
    occurred_at: option(args, "occurred_at", "occurred-at"),
  };
}

export function fingerprint(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

const CONTEXT_KEYS = ["run_id", "device_id", "event_id", "actor_ref", "source_ref", "occurred_at"] as const;
const START_KEYS = [...CONTEXT_KEYS, "source_client", "source_session_ref", "repository_revision", "branch", "model_provider", "model_name", "completeness"] as const;
const COMPLETE_KEYS = [...CONTEXT_KEYS, "status", "completeness", "duration_ms", "input_tokens", "output_tokens"] as const;
const VALIDATION_KEYS = [...CONTEXT_KEYS, "kind", "command", "status", "passed", "failed", "duration_ms"] as const;
const FEEDBACK_KEYS = [...CONTEXT_KEYS, "trap_id", "revision", "feedback", "note"] as const;
const MISSED_KEYS = [...CONTEXT_KEYS, "query", "expected_trap_id"] as const;
const SEARCH_KEYS = ["query", "mode", "path", "module", "results", "diagnostics", "duration_ms"] as const;

function validateInputKeys(input: object, allowed: readonly string[], label: string): void {
  const permitted = new Set(allowed);
  for (const key of Object.keys(input)) {
    if (!permitted.has(key)) throw new Error(`${label} field ${key} is not allowed.`);
  }
}

function option(args: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim() !== "" && value !== "true") return value;
  }
  return undefined;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return nonEmptyString(value, label);
}

function enumInput<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

function nullableNonNegativeInteger(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer or null.`);
  }
  return value;
}

function nullableNonNegativeNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number or null.`);
  }
  return value;
}

function fingerprintNullable(value: string | null): string | null {
  return value === null ? null : fingerprint(nonEmptyString(value, "fingerprint input"));
}

function uniqueStrings(values: string[]): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error("diagnostics must be an array of strings.");
  }
  return [...new Set(values)];
}

function durationMs(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const value = Date.parse(end) - Date.parse(start);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function childEventId(
  parentId: string,
  result: { trap_id: number; revision: string; rank: number },
  index: number
): string {
  const hash = fingerprint(`${parentId}:${index}:${result.trap_id}:${result.revision}:${result.rank}`);
  return `event-${hash.slice("sha256:".length, "sha256:".length + 32)}`;
}
