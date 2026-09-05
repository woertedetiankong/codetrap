import type { LearningFeedback, LearningStatus } from "./observation";
import type { CandidateTrap } from "./session";

export const LEARNING_IMPACT_VERSION = 1 as const;

export type LearningProgressRecord = {
  actor_ref: string;
  insight_id: string;
  status: LearningStatus;
  feedback: LearningFeedback | null;
  linked_run_id: string | null;
  practice_note: string | null;
  updated_at: string;
};

export type LearningPromotionRecord = {
  actor_ref: string;
  insight_id: string;
  session_id: string;
  candidate_id: string;
  candidate_fingerprint: string;
  created_at: string;
};

export type LearningImpactDocument = {
  version: typeof LEARNING_IMPACT_VERSION;
  progress: LearningProgressRecord[];
  promotions: LearningPromotionRecord[];
};

export type LearningAgentCandidateDraft = {
  title: string;
  context: string;
  mistake: string;
  fix: string;
  scope: "project" | "global";
  tags: string[];
  path_globs: string[];
  module: string | null;
};

export type LearningPromotionState = {
  session_id: string;
  candidate_id: string;
  status: CandidateTrap["status"] | "missing";
  review_decision: CandidateTrap["review_decision"] | null;
  delivery_state: CandidateTrap["delivery_state"] | null;
  revision: number | null;
  accepted_trap_id: number | null;
  accepted_scope: "project" | "global" | null;
  title: string | null;
};

export type LearningImpactState = {
  progress: LearningProgressRecord & { legacy_derived: boolean };
  promotion: LearningPromotionState | null;
};
