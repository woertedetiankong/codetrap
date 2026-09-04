export const OBSERVATION_EVENT_VERSION = 1 as const;

export const OBSERVATION_EVENT_TYPES = [
  "run/started",
  "run/completed",
  "trap/search-completed",
  "trap/exposed",
  "trap/feedback-recorded",
  "trap/missed-reported",
  "validation/completed",
  "learning/insight-shelved",
  "learning/status-changed",
  "learning/feedback-recorded",
  "learning/promoted-to-candidate",
  "learning/linked-to-run",
  "candidate/status-changed",
  "share/created",
  "share/revoked",
  "share/expired",
  "eval/experiment-completed",
] as const;

export const EVIDENCE_CLASSES = [
  "observed_fact",
  "human_label",
  "derived_inference",
  "controlled_eval",
] as const;

export const OBSERVATION_SENSITIVITIES = ["metadata", "sensitive", "restricted"] as const;
export const SOURCE_CLIENTS = ["codex", "claude-code", "other"] as const;
export const RUN_COMPLETENESS = ["complete", "partial", "unknown"] as const;
export const RUN_STATUSES = ["completed", "failed", "cancelled", "unknown"] as const;
export const VALIDATION_KINDS = ["test", "typecheck", "lint", "build", "manual"] as const;
export const VALIDATION_STATUSES = ["passed", "failed", "cancelled", "unknown"] as const;
export const TRAP_FEEDBACK_VALUES = ["helpful", "irrelevant", "harmful", "should_have_matched"] as const;
export const LEARNING_STATUSES = ["not_started", "in_progress", "learned"] as const;
export const LEARNING_FEEDBACK_VALUES = ["helpful", "unclear", "outdated"] as const;

export type ObservationEventType = (typeof OBSERVATION_EVENT_TYPES)[number];
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];
export type Sensitivity = (typeof OBSERVATION_SENSITIVITIES)[number];
export type SourceClient = (typeof SOURCE_CLIENTS)[number];
export type RunCompleteness = (typeof RUN_COMPLETENESS)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type ValidationKind = (typeof VALIDATION_KINDS)[number];
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];
export type TrapFeedback = (typeof TRAP_FEEDBACK_VALUES)[number];
export type LearningStatus = (typeof LEARNING_STATUSES)[number];
export type LearningFeedback = (typeof LEARNING_FEEDBACK_VALUES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface RunStartedPayload extends JsonObject {
  source_client: SourceClient;
  source_session_ref: string | null;
  repository_revision: string | null;
  branch: string | null;
  model_provider: string | null;
  model_name: string | null;
  completeness: RunCompleteness;
}

export interface RunCompletedPayload extends JsonObject {
  status: RunStatus;
  completeness: RunCompleteness;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

export interface SearchResultReference extends JsonObject {
  trap_id: number;
  revision: string;
  rank: number;
}

export interface SearchReceipt extends JsonObject {
  query_fingerprint: string;
  mode: "fts" | "semantic" | "hybrid";
  path_hint: string | null;
  module_hint: string | null;
  results: SearchResultReference[];
  diagnostics: string[];
  duration_ms: number | null;
}

export interface TrapExposurePayload extends JsonObject {
  trap_id: number;
  revision: string;
  rank: number | null;
  query_fingerprint: string | null;
}

export interface TrapFeedbackPayload extends JsonObject {
  trap_id: number | null;
  revision: string | null;
  feedback: TrapFeedback;
  note_fingerprint: string | null;
}

export interface TrapMissedPayload extends JsonObject {
  query_fingerprint: string | null;
  expected_trap_id: number | null;
}

export interface ValidationReceipt extends JsonObject {
  kind: ValidationKind;
  command_fingerprint: string | null;
  status: ValidationStatus;
  passed: number | null;
  failed: number | null;
  duration_ms: number | null;
}

export interface LearningInsightPayload extends JsonObject {
  insight_id: string;
  collection_id: string | null;
}

export interface LearningStatusPayload extends LearningInsightPayload {
  status: LearningStatus;
}

export interface LearningFeedbackPayload extends LearningInsightPayload {
  feedback: LearningFeedback;
}

export interface LearningCandidatePayload extends LearningInsightPayload {
  candidate_id: string;
}

export interface LearningRunLinkPayload extends LearningInsightPayload {
  linked_run_id: string;
}

export interface CandidateStatusPayload extends JsonObject {
  candidate_id: string;
  status: string;
  revision: number | null;
}

export interface SharePayload extends JsonObject {
  share_id: string;
  target_kind: string;
  target_id: string;
}

export interface EvalExperimentPayload extends JsonObject {
  experiment_id: string;
  suite_id: string;
  baseline_passed: number | null;
  candidate_passed: number | null;
  total_cases: number | null;
}

export interface ObservationPayloadMap {
  "run/started": RunStartedPayload;
  "run/completed": RunCompletedPayload;
  "trap/search-completed": SearchReceipt;
  "trap/exposed": TrapExposurePayload;
  "trap/feedback-recorded": TrapFeedbackPayload;
  "trap/missed-reported": TrapMissedPayload;
  "validation/completed": ValidationReceipt;
  "learning/insight-shelved": LearningInsightPayload;
  "learning/status-changed": LearningStatusPayload;
  "learning/feedback-recorded": LearningFeedbackPayload;
  "learning/promoted-to-candidate": LearningCandidatePayload;
  "learning/linked-to-run": LearningRunLinkPayload;
  "candidate/status-changed": CandidateStatusPayload;
  "share/created": SharePayload;
  "share/revoked": SharePayload;
  "share/expired": SharePayload;
  "eval/experiment-completed": EvalExperimentPayload;
}

export interface ObservationEvent<TType extends ObservationEventType = ObservationEventType> {
  version: typeof OBSERVATION_EVENT_VERSION;
  id: string;
  project_id: string;
  run_id: string | null;
  actor_ref: string | null;
  device_id: string;
  seq: number;
  occurred_at: string;
  recorded_at: string;
  type: TType;
  evidence_class: EvidenceClass;
  sensitivity: Sensitivity;
  attributes: ObservationPayloadMap[TType];
  body_ref: string | null;
  source_ref: string | null;
}

export interface ObservationEvidenceCounts {
  observed_fact: number;
  human_label: number;
  derived_inference: number;
  controlled_eval: number;
}

export interface RunObservationProjection {
  id: string;
  project_id: string;
  source_client: SourceClient | null;
  source_session_ref: string | null;
  repository_revision: string | null;
  branch: string | null;
  model_provider: string | null;
  model_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: RunStatus | null;
  completeness: RunCompleteness;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  event_count: number;
  search_count: number;
  exposure_count: number;
  validation_count: number;
  feedback_count: number;
  latest_validation_status: ValidationStatus | null;
  contains_sensitive_body: boolean;
  evidence: ObservationEvidenceCounts;
}

export interface ObservationOverviewProjection {
  project_id: string;
  total_events: number;
  total_runs: number;
  completed_runs: number;
  partial_or_unknown_runs: number;
  search_count: number;
  exposure_count: number;
  validation_passed: number;
  validation_failed: number;
  helpful_feedback: number;
  harmful_feedback: number;
  last_event_at: string | null;
  evidence: ObservationEvidenceCounts;
}

export const OBSERVATION_EVAL_CANDIDATE_REASONS = [
  "reported_miss",
  "irrelevant_guidance",
  "harmful_guidance",
  "validation_failed_after_exposure",
] as const;

export type ObservationEvalCandidateReason = (typeof OBSERVATION_EVAL_CANDIDATE_REASONS)[number];

export interface ObservationRateProjection {
  numerator: number;
  denominator: number;
  value: number | null;
}

export interface ObservationEvalCandidateProjection {
  id: string;
  run_id: string;
  event_seq: number;
  occurred_at: string;
  reason: ObservationEvalCandidateReason;
  trap_id: number | null;
  validation_kind: ValidationKind | null;
  evidence_class: EvidenceClass;
  source_client: SourceClient | null;
  completeness: RunCompleteness;
  review_status: "review_required";
  ground_truth: "unconfirmed";
}

/**
 * One reviewable finding, collapsed across every occurrence that shares its
 * structural signature. Occurrences differ only in instance-specific values
 * (which Run, which event, when), so a recurring failure is one queue row with
 * a count instead of one row per event.
 */
export interface ObservationEvalCandidateGroupProjection {
  /** Normalized signature: reason, trap, and validation kind only. */
  group_key: string;
  reason: ObservationEvalCandidateReason;
  trap_id: number | null;
  validation_kind: ValidationKind | null;
  /** How many candidate events collapsed into this finding. */
  occurrence_count: number;
  /** Distinct Runs the finding was observed in, oldest first. */
  run_ids: string[];
  first_occurred_at: string;
  last_occurred_at: string;
  /**
   * The earliest occurrence's candidate id. Stable as later occurrences
   * accrue, so a review linked to this id survives new observations.
   */
  representative_id: string;
  /** Every candidate id in the group, oldest first, including the representative. */
  member_ids: string[];
}

export interface ObservationEvalsProjection {
  project_id: string;
  total_runs: number;
  complete_runs: number;
  partial_or_unknown_runs: number;
  evaluable_runs: number;
  rated_exposures: number;
  helpful_feedback: number;
  irrelevant_feedback: number;
  harmful_feedback: number;
  /**
   * Exposure ratings replaced by a later rating of the same (Run, trap).
   * The feedback counts above are current judgments, not event totals; this
   * is the difference between the two.
   */
  superseded_feedback: number;
  miss_reports: number;
  runs_with_explicit_feedback: number;
  runs_with_miss_report: number;
  validation_passed: number;
  validation_failed: number;
  failed_after_exposure_runs: number;
  rates: {
    helpful: ObservationRateProjection;
    noise: ObservationRateProjection;
    miss_report: ObservationRateProjection;
    validation_pass: ObservationRateProjection;
  };
  candidates: ObservationEvalCandidateProjection[];
  candidate_groups: ObservationEvalCandidateGroupProjection[];
}
