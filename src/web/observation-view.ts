import type {
  CandidateStatusPayload,
  EvalExperimentPayload,
  LearningCandidatePayload,
  LearningFeedbackPayload,
  LearningInsightPayload,
  LearningRunLinkPayload,
  LearningStatusPayload,
  ObservationEvent,
  ObservationOverviewProjection,
  RunCompletedPayload,
  RunObservationProjection,
  RunStartedPayload,
  SearchReceipt,
  SharePayload,
  TrapExposurePayload,
  TrapFeedbackPayload,
  TrapMissedPayload,
  ValidationReceipt,
} from "../domain/observation";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import { agentObservationHealth, type AgentObservationHealth } from "../lib/agent-observation";

export type ObservationWebAvailability = "not_configured" | "ready";

export type ObservationWebRun = Pick<RunObservationProjection,
  | "id"
  | "source_client"
  | "started_at"
  | "completed_at"
  | "status"
  | "completeness"
  | "duration_ms"
  | "input_tokens"
  | "output_tokens"
  | "event_count"
  | "search_count"
  | "exposure_count"
  | "validation_count"
  | "feedback_count"
  | "latest_validation_status"
  | "contains_sensitive_body"
  | "evidence"
>;

export interface ObservationWebTimelineEvent {
  seq: number;
  occurred_at: string;
  type: ObservationEvent["type"];
  evidence_class: ObservationEvent["evidence_class"];
  sensitivity: ObservationEvent["sensitivity"];
  facts: Record<string, string | number | null>;
}

export interface ObservationOverviewWebPayload {
  project_root: string;
  availability: ObservationWebAvailability;
  overview: ObservationOverviewProjection | null;
  recent_runs: ObservationWebRun[];
  hook_health: AgentObservationHealth;
}

export interface ObservationRunsWebPayload {
  project_root: string;
  availability: ObservationWebAvailability;
  runs: ObservationWebRun[];
}

export interface ObservationRunWebPayload {
  project_root: string;
  availability: ObservationWebAvailability;
  run: ObservationWebRun | null;
  timeline: ObservationWebTimelineEvent[];
}

export function observationOverviewWebPayload(projectRoot: string, limit = 50): ObservationOverviewWebPayload {
  const ledger = openObservationLedgerReadOnly(projectRoot);
  if (!ledger) {
    return {
      project_root: projectRoot,
      availability: "not_configured",
      overview: null,
      recent_runs: [],
      hook_health: agentObservationHealth(projectRoot),
    };
  }
  try {
    return {
      project_root: projectRoot,
      availability: "ready",
      overview: ledger.overview(),
      recent_runs: ledger.listRuns(limit).map(observationWebRun),
      hook_health: agentObservationHealth(projectRoot),
    };
  } finally {
    ledger.close();
  }
}

export function observationRunsWebPayload(projectRoot: string, limit = 100): ObservationRunsWebPayload {
  const ledger = openObservationLedgerReadOnly(projectRoot);
  if (!ledger) return { project_root: projectRoot, availability: "not_configured", runs: [] };
  try {
    return {
      project_root: projectRoot,
      availability: "ready",
      runs: ledger.listRuns(limit).map(observationWebRun),
    };
  } finally {
    ledger.close();
  }
}

export function observationRunWebPayload(projectRoot: string, runId: string): ObservationRunWebPayload {
  const ledger = openObservationLedgerReadOnly(projectRoot);
  if (!ledger) {
    return { project_root: projectRoot, availability: "not_configured", run: null, timeline: [] };
  }
  try {
    const run = ledger.getRun(runId);
    return {
      project_root: projectRoot,
      availability: "ready",
      run: run ? observationWebRun(run) : null,
      timeline: run ? ledger.listRunEvents(runId).map(observationTimelineEvent) : [],
    };
  } finally {
    ledger.close();
  }
}

function observationWebRun(run: RunObservationProjection): ObservationWebRun {
  return {
    id: run.id,
    source_client: run.source_client,
    started_at: run.started_at,
    completed_at: run.completed_at,
    status: run.status,
    completeness: run.completeness,
    duration_ms: run.duration_ms,
    input_tokens: run.input_tokens,
    output_tokens: run.output_tokens,
    event_count: run.event_count,
    search_count: run.search_count,
    exposure_count: run.exposure_count,
    validation_count: run.validation_count,
    feedback_count: run.feedback_count,
    latest_validation_status: run.latest_validation_status,
    contains_sensitive_body: run.contains_sensitive_body,
    evidence: run.evidence,
  };
}

function observationTimelineEvent(event: ObservationEvent): ObservationWebTimelineEvent {
  return {
    seq: event.seq,
    occurred_at: event.occurred_at,
    type: event.type,
    evidence_class: event.evidence_class,
    sensitivity: event.sensitivity,
    facts: safeTimelineFacts(event),
  };
}

/**
 * This is an explicit privacy allowlist. Never return arbitrary event
 * attributes from the Web API: future schema additions must make a deliberate
 * UI disclosure decision here first.
 */
function safeTimelineFacts(event: ObservationEvent): Record<string, string | number | null> {
  switch (event.type) {
    case "run/started": {
      const value = event.attributes as RunStartedPayload;
      return { source_client: value.source_client, completeness: value.completeness };
    }
    case "run/completed": {
      const value = event.attributes as RunCompletedPayload;
      return {
        status: value.status,
        completeness: value.completeness,
        duration_ms: value.duration_ms,
        input_tokens: value.input_tokens,
        output_tokens: value.output_tokens,
      };
    }
    case "trap/search-completed": {
      const value = event.attributes as SearchReceipt;
      return { mode: value.mode, result_count: value.results.length, diagnostic_count: value.diagnostics.length, duration_ms: value.duration_ms };
    }
    case "trap/exposed": {
      const value = event.attributes as TrapExposurePayload;
      return { trap_id: value.trap_id, rank: value.rank };
    }
    case "trap/feedback-recorded": {
      const value = event.attributes as TrapFeedbackPayload;
      return { trap_id: value.trap_id, feedback: value.feedback };
    }
    case "trap/missed-reported": {
      const value = event.attributes as TrapMissedPayload;
      return { expected_trap_id: value.expected_trap_id };
    }
    case "validation/completed": {
      const value = event.attributes as ValidationReceipt;
      return { kind: value.kind, status: value.status, passed: value.passed, failed: value.failed, duration_ms: value.duration_ms };
    }
    case "learning/insight-shelved": {
      const value = event.attributes as LearningInsightPayload;
      return { insight_id: value.insight_id, collection_id: value.collection_id };
    }
    case "learning/status-changed": {
      const value = event.attributes as LearningStatusPayload;
      return { insight_id: value.insight_id, status: value.status };
    }
    case "learning/feedback-recorded": {
      const value = event.attributes as LearningFeedbackPayload;
      return { insight_id: value.insight_id, feedback: value.feedback };
    }
    case "learning/promoted-to-candidate": {
      const value = event.attributes as LearningCandidatePayload;
      return { insight_id: value.insight_id, candidate_id: value.candidate_id };
    }
    case "learning/linked-to-run": {
      const value = event.attributes as LearningRunLinkPayload;
      return { insight_id: value.insight_id, linked_run_id: value.linked_run_id };
    }
    case "candidate/status-changed": {
      const value = event.attributes as CandidateStatusPayload;
      return { candidate_id: value.candidate_id, status: value.status, revision: value.revision };
    }
    case "share/created":
    case "share/revoked":
    case "share/expired": {
      const value = event.attributes as SharePayload;
      return { target_kind: value.target_kind };
    }
    case "eval/experiment-completed": {
      const value = event.attributes as EvalExperimentPayload;
      return { baseline_passed: value.baseline_passed, candidate_passed: value.candidate_passed, total_cases: value.total_cases };
    }
  }
}
