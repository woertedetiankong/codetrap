import type { RunObservationProjection, TrapFeedback } from "./observation";

export interface TrapExperienceRun {
  id: string;
  source_client: RunObservationProjection["source_client"];
  started_at: string | null;
  status: RunObservationProjection["status"];
  completeness: RunObservationProjection["completeness"];
  latest_validation_status: RunObservationProjection["latest_validation_status"];
  exposure_count: number;
  current_revision_exposures: number;
  other_revision_exposures: number;
  feedback: TrapFeedback | null;
  miss_reports: number;
}

export interface TrapExperienceObservations {
  availability: "ready" | "not_configured" | "unavailable";
  exposure_count: number;
  current_revision_exposures: number;
  other_revision_exposures: number;
  run_count: number;
  helpful: number;
  irrelevant: number;
  harmful: number;
  miss_reports: number;
  superseded_feedback: number;
  runs: TrapExperienceRun[];
  offset: number;
  limit: number;
  has_more: boolean;
}
