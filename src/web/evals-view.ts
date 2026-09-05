import { PROJECT_EVAL_SUITE, LEGACY_EVAL_SUITE, projectEvalPath, readProjectSuite, type EvalSuitePath } from "../lib/project-eval-suite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  ObservationEvalCandidateGroupProjection,
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

export const PROJECT_SEARCH_EVAL_FIXTURE = PROJECT_EVAL_SUITE;

export type RetrievalEvalAvailability = "not_configured" | "ready" | "invalid";
export type ControlledEvalAvailability = RetrievalEvalAvailability | "partial";

export interface RetrievalEvalWebSummary {
  availability: RetrievalEvalAvailability;
  source: EvalSuitePath;
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
  | "trap_scope"
  | "validation_kind"
  | "evidence_class"
  | "source_client"
  | "completeness"
  | "review_status"
  | "ground_truth"
>, "review_status" | "ground_truth"> & GovernedEvalReviewState;

/**
 * One review row: a finding collapsed across its occurrences, carrying the
 * review state of whichever occurrence a human actually reviewed.
 */
export type ObservationEvalWebCandidateGroup = ObservationEvalCandidateGroupProjection & GovernedEvalReviewState & {
  /**
   * The candidate id review actions target. The representative unless an
   * occurrence was already reviewed, so reviews recorded before grouping stay
   * reachable.
   */
  review_target_id: string;
  /** Alias of {@link review_target_id} so review surfaces address a group exactly like a single candidate. */
  id: string;
};

export interface ObservationEvalsWebPayload {
  project_root: string;
  observation_availability: ObservationWebAvailability;
  retrieval: RetrievalEvalWebSummary;
  observed: Omit<ObservationEvalsProjection, "project_id" | "candidates" | "candidate_groups"> | null;
  candidates: ObservationEvalWebCandidate[];
  candidate_groups: ObservationEvalWebCandidateGroup[];
  fixture_traps: GovernedEvalFixtureTrap[];
  legacy_fixture_traps: GovernedEvalFixtureTrap[];
  controlled: {
    can_run: boolean;
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
  const legacyTraps = governed?.fixtureTraps(LEGACY_EVAL_SUITE) ?? [];
  const controlled = controlledEvalWebPayload(projectRoot, retrieval.availability, retrieval.total_cases > 0);
  const ledger = openObservationLedgerReadOnly(projectRoot);
  if (!ledger) {
    return {
      project_root: projectRoot,
      observation_availability: "not_configured",
      retrieval,
      observed: null,
      candidates: [],
      candidate_groups: [],
      fixture_traps: fixtureTraps,
      legacy_fixture_traps: legacyTraps,
      controlled,
    };
  }
  try {
    const { project_id: _projectId, candidates, candidate_groups: groups, ...observed } = ledger.evals();
    const webCandidates = candidates.map((candidate) => observationEvalWebCandidate(candidate, governed));
    return {
      project_root: projectRoot,
      observation_availability: "ready",
      retrieval,
      observed,
      candidates: webCandidates,
      candidate_groups: groups.map((group) => observationEvalWebCandidateGroup(group, webCandidates)),
      fixture_traps: fixtureTraps,
      legacy_fixture_traps: legacyTraps,
      controlled,
    };
  } finally {
    ledger.close();
  }
}

function controlledEvalWebPayload(
  projectRoot: string,
  fixtureAvailability: RetrievalEvalAvailability,
  hasCases: boolean,
): ObservationEvalsWebPayload["controlled"] {
  const operations = new ControlledEvalOperations(projectRoot);
  try {
    const history = operations.history();
    return {
      can_run: fixtureAvailability === "ready" && hasCases,
      availability: history.corrupt_results.length ? "partial" : fixtureAvailability === "ready" ? "ready" : history.experiments.length ? "partial" : fixtureAvailability,
      profiles: operations.profiles(),
      experiments: history.experiments,
      corrupt_results: history.corrupt_results,
      issue: history.corrupt_results.length ? "controlled_result_store_partial" : fixtureAvailability === "invalid" ? "fixture_evaluation_failed" : null,
    };
  } catch {
    return {
      can_run: false,
      availability: "invalid",
      profiles: operations.profiles(),
      experiments: [],
      corrupt_results: [],
      issue: "controlled_result_store_invalid",
    };
  }
}

async function retrievalEvalWebSummary(projectRoot: string): Promise<RetrievalEvalWebSummary> {
  const source = projectEvalPath(projectRoot);
  const fixture = join(projectRoot, source);
  if (!existsSync(fixture)) return emptyRetrievalSummary("not_configured", null, source);
  try {
    readProjectSuite(projectRoot, source);
    const report = await reportDogfood(fixture, false);
    return {
      availability: "ready",
      source,
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
    return emptyRetrievalSummary("invalid", "fixture_evaluation_failed", source);
  }
}

function emptyRetrievalSummary(
  availability: Extract<RetrievalEvalAvailability, "not_configured" | "invalid">,
  issue: string | null,
  source: EvalSuitePath,
): RetrievalEvalWebSummary {
  return {
    availability,
    source,
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

/**
 * Resolve one group's review state. A review recorded against any occurrence
 * counts as a review of the finding, so grouping never orphans a decision a
 * human already made against a non-representative occurrence.
 */
function observationEvalWebCandidateGroup(
  group: ObservationEvalCandidateGroupProjection,
  candidates: ObservationEvalWebCandidate[]
): ObservationEvalWebCandidateGroup {
  const members = group.member_ids
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is ObservationEvalWebCandidate => candidate !== undefined);
  const reviewed = members.find((candidate) => candidate.review_status !== "review_required");
  const source = reviewed ?? members.find((candidate) => candidate.id === group.representative_id) ?? members[0];
  const targetId = source?.id ?? group.representative_id;
  return {
    ...group,
    review_target_id: targetId,
    id: targetId,
    review_status: source?.review_status ?? "review_required",
    ground_truth: source?.ground_truth ?? "unconfirmed",
    review_ref: source?.review_ref ?? null,
    review_issue: source?.review_issue ?? null,
    draft_case: source?.draft_case ?? null,
    fixture_path: source?.fixture_path ?? null,
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
    fixture_path: null,
  };
  return {
    id: candidate.id,
    run_id: candidate.run_id,
    event_seq: candidate.event_seq,
    occurred_at: candidate.occurred_at,
    reason: candidate.reason,
    trap_id: candidate.trap_id,
    trap_scope: candidate.trap_scope,
    validation_kind: candidate.validation_kind,
    evidence_class: candidate.evidence_class,
    source_client: candidate.source_client,
    completeness: candidate.completeness,
    ...review,
  };
}
