import type { CandidateKind } from "./candidate";

export const IMPROVER_VERSION = 1;

export const FEEDBACK_SHAPES = [
  "pitfall",
  "convention",
  "workflow",
  "evaluation",
  "docs",
  "insight",
] as const;
export type FeedbackShape = (typeof FEEDBACK_SHAPES)[number];

export const FEEDBACK_DETAILS = ["binary", "reasoned"] as const;
export type FeedbackDetail = (typeof FEEDBACK_DETAILS)[number];

export const REVIEWER_ROLES = ["unknown", "contributor", "maintainer", "domain_expert"] as const;
export type ReviewerRole = (typeof REVIEWER_ROLES)[number];

export const FEEDBACK_OUTCOMES = ["accepted", "corrected", "rejected", "unknown"] as const;
export type FeedbackOutcome = (typeof FEEDBACK_OUTCOMES)[number];

export type FeedbackLesson = {
  key: string;
  shape: FeedbackShape;
  title: string;
  trigger: string;
  mistake: string;
  fix: string;
  why: string | null;
  steps: string[];
  category: string;
  severity: string;
  tags: string[];
  path_globs: string[];
  related_files: string[];
  module: string | null;
  owner: string | null;
  skill_name: string | null;
  destination_payload: Record<string, unknown> | null;
};

export type FeedbackResolution = {
  status: "staged" | "existing" | "already_committed" | "suppressed";
  resolved_at: string;
  session_id: string | null;
  candidate_id: string | null;
  candidate_kind: CandidateKind;
  note: string;
};

export type FeedbackEvent = {
  version: typeof IMPROVER_VERSION;
  id: string;
  content_hash: string;
  external_id: string | null;
  captured_at: string;
  occurred_at: string;
  source: string;
  source_ref: string;
  run_id: string | null;
  source_agent: string;
  reviewer_role: ReviewerRole;
  feedback_detail: FeedbackDetail;
  outcome: FeedbackOutcome;
  agent_output: string;
  human_feedback: string;
  final_change: string | null;
  lesson: FeedbackLesson;
  signal_weight: number;
  redactions: {
    total: number;
    counts: Record<string, number>;
  };
  resolution: FeedbackResolution | null;
};

export type FeedbackTombstone = {
  version: typeof IMPROVER_VERSION;
  event_id: string;
  content_hash: string;
  pattern_key: string;
  source: string;
  captured_at: string;
  deleted_at: string;
  resolution: FeedbackResolution | null;
};

export const METRIC_DIRECTIONS = ["higher_is_better", "lower_is_better"] as const;
export type MetricDirection = (typeof METRIC_DIRECTIONS)[number];

export type BehaviorOutcome = {
  version: typeof IMPROVER_VERSION;
  id: string;
  content_hash: string;
  recorded_at: string;
  pattern_key: string;
  metric: string;
  direction: MetricDirection;
  before_value: number;
  after_value: number;
  before_samples: number;
  after_samples: number;
  result: "improved" | "unchanged" | "regressed";
  source_ref: string;
  session_id: string | null;
  candidate_id: string | null;
  note: string | null;
};

export type ImproverDocument = {
  version: typeof IMPROVER_VERSION;
  feedback: FeedbackEvent[];
  outcomes: BehaviorOutcome[];
  tombstones: FeedbackTombstone[];
};

export function candidateKindForFeedbackShape(shape: FeedbackShape): CandidateKind {
  switch (shape) {
    case "pitfall": return "pitfall_trap";
    case "convention": return "project_convention";
    case "workflow": return "skill_candidate";
    case "evaluation": return "search_eval_case";
    case "docs": return "docs_guidance";
    case "insight": return "insight";
  }
}
