import { LEGACY_EVAL_SUITE, projectEvalPath, readProjectSuite, requireEvalPath, type EvalSuitePath } from "./project-eval-suite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CandidateTrap } from "../domain/session";
import type {
  ObservationEvalCandidateProjection,
  ObservationEvalCandidateReason,
} from "../domain/observation";
import type { TrapOperations } from "./trap-operations";
import { CODETRAP_DIR } from "./constants";
import { withAdvisoryLock } from "./advisory-lock";
import { openObservationLedgerReadOnly } from "./observation-ledger";
import { Phase2Operations } from "./phase2-operations";
import { SessionOperations } from "./session-operations";
import { SessionStore } from "./session-store";
import {
  normalizeDogfoodCase,
  readEvalFixture,
  type EvalQuery,
} from "./search-eval";

const EVAL_REVIEW_LOCK = ".eval-review.lock";
export const GOVERNED_EVAL_FIXTURE = LEGACY_EVAL_SUITE; // Compatibility export for historical callers.

export type GovernedEvalReviewStatus =
  | "review_required"
  | "draft"
  | "accepted"
  | "rejected"
  | "rolled_back"
  | "conflict";

export interface GovernedEvalReviewRef {
  session_id: string;
  candidate_id: string;
  revision: number;
  content_hash: string;
  commit_id: string | null;
  rejection_reason: string | null;
}

export interface GovernedEvalReviewState {
  review_status: GovernedEvalReviewStatus;
  ground_truth: "unconfirmed" | "confirmed";
  review_ref: GovernedEvalReviewRef | null;
  review_issue: "multiple_linked_candidates" | null;
  draft_case: EvalQuery | null;
  fixture_path: EvalSuitePath | null;
}

export interface GovernedEvalFixtureTrap {
  id: number;
  title: string;
  source_ref?: { scope: string | null; trap_id: number | null; revision: string | null };
}

export interface GovernedEvalPreviewFile {
  path: string;
  created: boolean;
  changed: boolean;
  before_query_count: number;
  after_query_count: number;
  appended_case: EvalQuery;
}

type LinkedCandidate = { session_id: string; candidate: CandidateTrap };

export class GovernedEvalOperations {
  private readonly sessions: SessionOperations;
  private readonly phase2: Phase2Operations;

  constructor(private readonly projectRoot: string, traps: TrapOperations) {
    this.sessions = new SessionOperations(new SessionStore(projectRoot), traps);
    this.phase2 = new Phase2Operations(projectRoot, traps);
  }

  fixtureTraps(target: EvalSuitePath = projectEvalPath(this.projectRoot)): GovernedEvalFixtureTrap[] {
    const path = join(this.projectRoot, target);
    if (!existsSync(path)) return [];
    try {
      const fixture = readProjectSuite(this.projectRoot, target).fixture;
      return fixture.traps.map((trap, index) => ({ id: index + 1, title: trap.title,
        ...(fixture.codetrap_suite ? { source_ref: fixture.codetrap_suite.refs[index] } : {}) }));
    } catch {
      return [];
    }
  }

  reviewState(observationCandidateId: string): GovernedEvalReviewState {
    const linked = this.linkedCandidates(observationCandidateId);
    if (linked.length === 0) return emptyReviewState();
    if (linked.length > 1) {
      return {
        review_status: "conflict",
        ground_truth: "unconfirmed",
        review_ref: null,
        review_issue: "multiple_linked_candidates",
        draft_case: null,
        fixture_path: null,
      };
    }
    return reviewStateFrom(linked[0]);
  }

  draft(observationCandidateId: string, input: Record<string, unknown>) {
    return this.withLock(() => {
      const source = this.requireObservationCandidate(observationCandidateId);
      const payload = this.payloadFor(source, input);
      const linked = this.saveDraft(source, payload);
      return {
        success: true,
        observation_candidate_id: source.id,
        session_id: linked.session_id,
        candidate: linked.candidate,
        preview: this.preview(linked),
      };
    });
  }

  accept(observationCandidateId: string, input: Record<string, unknown>) {
    return this.withLock(() => {
      const source = this.requireObservationCandidate(observationCandidateId);
      const payload = this.payloadFor(source, input);
      const existing = this.requireAtMostOneLinked(source.id);
      if (existing?.candidate.delivery_state === "committed") {
        if (!sameMaterialPayload(existing.candidate.destination_payload, payload)) {
          throw new Error("This Eval candidate is already committed with different content; roll it back before editing.");
        }
        const commit = this.phase2.commits().find((item) => item.id === existing.candidate.destination_commit_id);
        if (!commit) throw new Error(`Committed Eval candidate ${existing.candidate.id} has no Phase 2 commit.`);
        return {
          success: true,
          already_committed: true,
          observation_candidate_id: source.id,
          session_id: existing.session_id,
          candidate: existing.candidate,
          commit,
        };
      }

      const linked = this.saveDraft(source, payload);
      const preview = this.preview(linked);
      if (!preview.some((file) => file.changed)) {
        throw new Error("This exact Eval case already exists in the project fixture.");
      }
      const applied = this.phase2.apply(linked.session_id, linked.candidate.id, "user");
      return {
        ...applied,
        already_committed: false,
        observation_candidate_id: source.id,
        session_id: linked.session_id,
        preview,
      };
    });
  }

  reject(observationCandidateId: string, reason?: string) {
    return this.withLock(() => {
      const source = this.requireObservationCandidate(observationCandidateId);
      let linked = this.requireAtMostOneLinked(source.id);
      if (linked?.candidate.review_decision === "rejected" || linked?.candidate.review_decision === "suppressed") {
        return {
          success: true,
          already_rejected: true,
          observation_candidate_id: source.id,
          session_id: linked.session_id,
          candidate: linked.candidate,
        };
      }
      if (linked?.candidate.delivery_state === "committed") {
        throw new Error("A committed Eval case must be rolled back before it can be rejected.");
      }
      linked ??= this.createDecisionCandidate(source);
      const rejected = this.sessions.rejectCandidate({
        candidateId: linked.candidate.id,
        sessionId: linked.session_id,
        reason,
        executor: "user",
        authorizedScope: `observation Eval candidate ${source.id} only`,
      });
      return {
        ...rejected,
        already_rejected: false,
        observation_candidate_id: source.id,
        session_id: linked.session_id,
      };
    });
  }

  rollback(observationCandidateId: string) {
    return this.withLock(() => {
      this.requireObservationCandidate(observationCandidateId);
      const linked = this.requireAtMostOneLinked(observationCandidateId);
      if (!linked?.candidate.destination_commit_id || linked.candidate.delivery_state !== "committed") {
        throw new Error("This Observation candidate has no committed Eval case to roll back.");
      }
      const result = this.phase2.revert(linked.candidate.destination_commit_id, "user");
      return {
        ...result,
        observation_candidate_id: observationCandidateId,
        session_id: linked.session_id,
      };
    });
  }

  private saveDraft(
    source: ObservationEvalCandidateProjection,
    payload: Record<string, unknown>
  ): LinkedCandidate {
    const existing = this.requireAtMostOneLinked(source.id);
    if (existing) {
      if (existing.candidate.status !== "proposed") {
        throw new Error(`Eval candidate ${existing.candidate.id} is ${existing.candidate.status}, not editable.`);
      }
      if (!sameMaterialPayload(existing.candidate.destination_payload, payload)) {
        this.phase2.edit(existing.session_id, existing.candidate.id, payload);
      }
      return {
        session_id: existing.session_id,
        candidate: this.sessions.getCandidate(existing.candidate.id, existing.session_id).candidate,
      };
    }

    const captured = this.phase2.propose(this.proposalFor(source, payload));
    if (captured.suppressed) {
      throw new Error("This Observation Eval candidate was previously rejected and is suppressed.");
    }
    return { session_id: captured.session.id, candidate: captured.candidate };
  }

  private createDecisionCandidate(source: ObservationEvalCandidateProjection): LinkedCandidate {
    const captured = this.phase2.propose(this.proposalFor(source, this.sourcePayload(source)));
    if (captured.suppressed) {
      throw new Error("This Observation Eval candidate was previously rejected and is suppressed.");
    }
    return { session_id: captured.session.id, candidate: captured.candidate };
  }

  private proposalFor(source: ObservationEvalCandidateProjection, payload: Record<string, unknown>) {
    const reason = readableReason(source.reason);
    return {
      kind: "search_eval_case",
      title: `Review observed Eval signal: ${reason}`,
      goal: `Govern Observation Eval candidate ${source.id}`,
      rationale: "Observed evidence is only a review trigger; a user must author and confirm the exact Eval ground truth.",
      context: `When Observation Run ${source.run_id} produces a ${reason} signal.`,
      mistake: "Treat the observed association as confirmed ground truth without an explicit query, expected fixture ids, and preview.",
      fix: "Review the Run, author the exact Eval case, preview the fixture change, then explicitly accept or reject it.",
      tags: ["eval", "observation", source.reason],
      source_agent: source.source_client ?? "unknown",
      source_refs: [`observation:${source.id}`, `run:${source.run_id}`],
      payload,
    };
  }

  private payloadFor(
    source: ObservationEvalCandidateProjection,
    input: Record<string, unknown>
  ): Record<string, unknown> {
    const existing = this.requireAtMostOneLinked(source.id)?.candidate.destination_payload;
    const target = existing ? existing.fixture_path === undefined ? LEGACY_EVAL_SUITE : requireEvalPath(existing.fixture_path) : projectEvalPath(this.projectRoot);
    const { fixture, corpus_sha256 } = readProjectSuite(this.projectRoot, target);
    if (existing?.corpus_sha256 && existing.corpus_sha256 !== corpus_sha256) throw new Error("The evaluation corpus changed. Start a new review.");
    const query = normalizeDogfoodCase({
      ...input,
      source: `observation:${source.id}`,
    }, fixture);
    return { ...this.sourcePayload(source), ...(existing && existing.fixture_path === undefined ? {} : { fixture_path: target, corpus_sha256 }), case: query };
  }

  private sourcePayload(source: ObservationEvalCandidateProjection): Record<string, unknown> {
    return {
      observation_candidate_id: source.id,
      run_id: source.run_id,
      event_seq: source.event_seq,
      reason: source.reason,
    };
  }

  private preview(linked: LinkedCandidate): GovernedEvalPreviewFile[] {
    const candidateCase = linked.candidate.destination_payload?.case as EvalQuery | undefined;
    if (!candidateCase) throw new Error("A complete payload.case is required before preview.");
    return this.phase2.preview(linked.session_id, linked.candidate.id).files.map((file) => ({
      path: file.path,
      created: file.created,
      changed: file.changed,
      before_query_count: evalQueryCount(file.before),
      after_query_count: evalQueryCount(file.after),
      appended_case: candidateCase,
    }));
  }

  private requireObservationCandidate(id: string): ObservationEvalCandidateProjection {
    const ledger = openObservationLedgerReadOnly(this.projectRoot);
    if (!ledger) throw new Error("Observation is not configured for this project.");
    try {
      const candidate = ledger.evals().candidates.find((item) => item.id === id);
      if (!candidate) throw new Error(`Observation Eval candidate ${id} was not found.`);
      return candidate;
    } finally {
      ledger.close();
    }
  }

  private linkedCandidates(observationCandidateId: string): LinkedCandidate[] {
    return this.sessions.allCandidates().filter(({ candidate }) =>
      candidate.candidate_kind === "search_eval_case"
      && candidate.destination_payload?.observation_candidate_id === observationCandidateId
    );
  }

  private requireAtMostOneLinked(observationCandidateId: string): LinkedCandidate | null {
    const linked = this.linkedCandidates(observationCandidateId);
    if (linked.length > 1) {
      throw new Error(`Observation Eval candidate ${observationCandidateId} has multiple linked review candidates.`);
    }
    return linked[0] ?? null;
  }

  private withLock<T>(fn: () => T): T {
    const codetrapDir = join(this.projectRoot, CODETRAP_DIR);
    mkdirSync(codetrapDir, { recursive: true });
    return withAdvisoryLock(join(codetrapDir, EVAL_REVIEW_LOCK), fn).value;
  }
}

function emptyReviewState(): GovernedEvalReviewState {
  return {
    review_status: "review_required",
    ground_truth: "unconfirmed",
    review_ref: null,
    review_issue: null,
    draft_case: null,
    fixture_path: null,
  };
}

function reviewStateFrom(linked: LinkedCandidate): GovernedEvalReviewState {
  const candidate = linked.candidate;
  let reviewStatus: GovernedEvalReviewStatus = "draft";
  let groundTruth: GovernedEvalReviewState["ground_truth"] = "unconfirmed";
  if (candidate.review_decision === "rejected" || candidate.review_decision === "suppressed") {
    reviewStatus = "rejected";
  } else if (candidate.delivery_state === "committed") {
    reviewStatus = "accepted";
    groundTruth = "confirmed";
  } else if (candidate.delivery_state === "rolled_back") {
    reviewStatus = "rolled_back";
  }
  return {
    review_status: reviewStatus,
    ground_truth: groundTruth,
    review_ref: {
      session_id: linked.session_id,
      candidate_id: candidate.id,
      revision: candidate.revision ?? 1,
      content_hash: candidate.content_hash ?? "",
      commit_id: candidate.destination_commit_id ?? null,
      rejection_reason: candidate.rejection_reason ?? null,
    },
    review_issue: null,
    draft_case: (candidate.destination_payload?.case as EvalQuery | undefined) ?? null,
    fixture_path: candidate.destination_payload?.fixture_path === undefined ? LEGACY_EVAL_SUITE : requireEvalPath(candidate.destination_payload.fixture_path),
  };
}

function evalQueryCount(text: string | null): number {
  if (text === null) return 0;
  try {
    const value = JSON.parse(text) as { queries?: unknown[] };
    return Array.isArray(value.queries) ? value.queries.length : 0;
  } catch {
    return 0;
  }
}

function sameMaterialPayload(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown>
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right);
}

function readableReason(reason: ObservationEvalCandidateReason): string {
  return reason.replace(/_/g, " ");
}
