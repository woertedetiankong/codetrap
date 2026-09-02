import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  ObservationEvalCandidateProjection,
  ObservationEvalsProjection,
} from "../domain/observation";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import type {
  GovernedEvalFixtureTrap,
  GovernedEvalOperations,
  GovernedEvalReviewState,
} from "../lib/governed-eval-operations";
import {
  ControlledEvalOperations,
  type ControlledEvalExperiment,
  type ControlledEvalProfileInfo,
} from "../lib/controlled-eval";
import { reportDogfood } from "../lib/search-eval";
import type { ObservationWebAvailability } from "./observation-view";

export const PROJECT_SEARCH_EVAL_FIXTURE = "src/tests/fixtures/search-eval.json";

export type RetrievalEvalAvailability = "not_configured" | "ready" | "invalid";
export type ControlledEvalAvailability = RetrievalEvalAvailability | "partial";

export interface RetrievalEvalWebSummary {
  availability: RetrievalEvalAvailability;
  source: typeof PROJECT_SEARCH_EVAL_FIXTURE;
  mode: "deterministic";
  total_cases: number;
  recall_at_3: number | null;
  recall_at_5: number | null;
  mrr: number | null;
  failed_cases: number;
  miss_cases: number;
  noisy_hit_cases: number;
  issue: string | null;
}

export type ObservationEvalWebCandidate = Omit<Pick<ObservationEvalCandidateProjection,
  | "id"
  | "run_id"
  | "event_seq"
  | "occurred_at"
  | "reason"
  | "trap_id"
  | "validation_kind"
  | "evidence_class"
  | "source_client"
  | "completeness"
  | "review_status"
  | "ground_truth"
>, "review_status" | "ground_truth"> & GovernedEvalReviewState;

export interface ObservationEvalsWebPayload {
  project_root: string;
  observation_availability: ObservationWebAvailability;
  retrieval: RetrievalEvalWebSummary;
  observed: Omit<ObservationEvalsProjection, "project_id" | "candidates"> | null;
  candidates: ObservationEvalWebCandidate[];
  fixture_traps: GovernedEvalFixtureTrap[];
  controlled: {
    availability: ControlledEvalAvailability;
    profiles: ControlledEvalProfileInfo[];
    experiments: ControlledEvalExperiment[];
    corrupt_results: Array<{ file: string; issue: "invalid_experiment" }>;
    issue: string | null;
  };
}

export async function observationEvalsWebPayload(
  projectRoot: string,
  governed?: GovernedEvalOperations
): Promise<ObservationEvalsWebPayload> {
  const retrieval = await retrievalEvalWebSummary(projectRoot);
  const fixtureTraps = governed?.fixtureTraps() ?? [];
  const controlled = controlledEvalWebPayload(projectRoot, retrieval.availability);
  const ledger = openObservationLedgerReadOnly(projectRoot);
  if (!ledger) {
    return {
      project_root: projectRoot,
      observation_availability: "not_configured",
      retrieval,
      observed: null,
      candidates: [],
      fixture_traps: fixtureTraps,
      controlled,
    };
  }
  try {
    const { project_id: _projectId, candidates, ...observed } = ledger.evals();
    return {
      project_root: projectRoot,
      observation_availability: "ready",
      retrieval,
      observed,
      candidates: candidates.map((candidate) => observationEvalWebCandidate(candidate, governed)),
      fixture_traps: fixtureTraps,
      controlled,
    };
  } finally {
    ledger.close();
  }
}

function controlledEvalWebPayload(
  projectRoot: string,
  fixtureAvailability: RetrievalEvalAvailability
): ObservationEvalsWebPayload["controlled"] {
  const operations = new ControlledEvalOperations(projectRoot);
  if (fixtureAvailability !== "ready") {
    return {
      availability: fixtureAvailability,
      profiles: operations.profiles(),
      experiments: [],
      corrupt_results: [],
      issue: fixtureAvailability === "invalid" ? "fixture_evaluation_failed" : null,
    };
  }
  try {
    const history = operations.history();
    return {
      availability: history.corrupt_results.length ? "partial" : "ready",
      profiles: operations.profiles(),
      experiments: history.experiments,
      corrupt_results: history.corrupt_results,
      issue: history.corrupt_results.length ? "controlled_result_store_partial" : null,
    };
  } catch {
    return {
      availability: "invalid",
      profiles: operations.profiles(),
      experiments: [],
      corrupt_results: [],
      issue: "controlled_result_store_invalid",
    };
  }
}

async function retrievalEvalWebSummary(projectRoot: string): Promise<RetrievalEvalWebSummary> {
  const fixture = join(projectRoot, PROJECT_SEARCH_EVAL_FIXTURE);
  if (!existsSync(fixture)) return emptyRetrievalSummary("not_configured", null);
  try {
    const report = await reportDogfood(fixture, false);
    return {
      availability: "ready",
      source: PROJECT_SEARCH_EVAL_FIXTURE,
      mode: "deterministic",
      total_cases: report.total_cases,
      recall_at_3: report.metrics.recall_at_3,
      recall_at_5: report.metrics.recall_at_5,
      mrr: report.metrics.mrr,
      failed_cases: report.failures.length,
      miss_cases: report.misses.length,
      noisy_hit_cases: report.noisy_hits.length,
      issue: null,
    };
  } catch {
    return emptyRetrievalSummary("invalid", "fixture_evaluation_failed");
  }
}

function emptyRetrievalSummary(
  availability: Extract<RetrievalEvalAvailability, "not_configured" | "invalid">,
  issue: string | null
): RetrievalEvalWebSummary {
  return {
    availability,
    source: PROJECT_SEARCH_EVAL_FIXTURE,
    mode: "deterministic",
    total_cases: 0,
    recall_at_3: null,
    recall_at_5: null,
    mrr: null,
    failed_cases: 0,
    miss_cases: 0,
    noisy_hit_cases: 0,
    issue,
  };
}

function observationEvalWebCandidate(
  candidate: ObservationEvalCandidateProjection,
  governed?: GovernedEvalOperations
): ObservationEvalWebCandidate {
  const review = governed?.reviewState(candidate.id) ?? {
    review_status: candidate.review_status,
    ground_truth: candidate.ground_truth,
    review_ref: null,
    review_issue: null,
    draft_case: null,
  };
  return {
    id: candidate.id,
    run_id: candidate.run_id,
    event_seq: candidate.event_seq,
    occurred_at: candidate.occurred_at,
    reason: candidate.reason,
    trap_id: candidate.trap_id,
    validation_kind: candidate.validation_kind,
    evidence_class: candidate.evidence_class,
    source_client: candidate.source_client,
    completeness: candidate.completeness,
    ...review,
  };
}
