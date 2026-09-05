import type { ObservationOverviewWebPayload, ObservationRunWebPayload, ObservationWebRun } from "./observation-view";
import type { ObservationEvalsWebPayload } from "./evals-view";
import type { GovernedEvalPreviewFile } from "../lib/governed-eval-operations";
export interface ImpactState {
  observationAvailability: ObservationOverviewWebPayload["availability"];
  observationOverview: ObservationOverviewWebPayload["overview"];
  observationHookHealth: ObservationOverviewWebPayload["hook_health"] | null;
  observationConnection: ObservationOverviewWebPayload["connection"] | null;
  observationRuns: ObservationWebRun[];
  observationRunId: string | null;
  observationRunDetail: ObservationRunWebPayload | null;
  observationDemoRun: { run: ObservationWebRun; timeline: ObservationRunWebPayload["timeline"] } | null;
  observationGuideOpen: boolean;
  observationEvals: ObservationEvalsWebPayload | null;
  observationEvalsProjectRoot: string | null;
  observationLoading: boolean; observationError: string;
  impactEventFilter: string; impactView: "overview" | "runs" | "evals";
  evalCandidateFilter: string; evalReviewCandidateId: string | null;
  evalReviewDraft: { candidateId: string; case: { query: string; mode: string; judgment: string; goldTrapIds: number[]; note: string }; rejectionReason: string } | null;
  evalReviewPreview: GovernedEvalPreviewFile[] | null; evalReviewBusy: boolean; evalReviewError: string; evalExternalChangesDeferred: boolean;
  controlledEvalProfile: string; controlledEvalTrials: number; controlledEvalSeed: string;
  controlledEvalExperimentId: string | null; controlledEvalCaseFilter: string; controlledEvalBusy: boolean; controlledEvalError: string;
}
export function createImpactState(): ImpactState {
  return { observationAvailability: "not_configured", observationOverview: null, observationHookHealth: null, observationConnection: null,
    observationRuns: [], observationRunId: null, observationRunDetail: null, observationDemoRun: null, observationGuideOpen: false,
    observationEvals: null, observationEvalsProjectRoot: null, observationLoading: false, observationError: "", impactEventFilter: "all", impactView: "overview",
    evalCandidateFilter: "all", evalReviewCandidateId: null, evalReviewDraft: null, evalReviewPreview: null, evalReviewBusy: false, evalReviewError: "", evalExternalChangesDeferred: false,
    controlledEvalProfile: "memory_contribution_v1", controlledEvalTrials: 2, controlledEvalSeed: "codetrap-controlled-v1", controlledEvalExperimentId: null, controlledEvalCaseFilter: "attention", controlledEvalBusy: false, controlledEvalError: "" };
}
