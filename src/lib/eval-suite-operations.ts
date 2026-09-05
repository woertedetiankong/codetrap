import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { TrapOperations } from "./trap-operations";
import { ProjectEvalSuite, PROJECT_EVAL_SUITE, evalSuiteHash, readProjectSuite } from "./project-eval-suite";
import { normalizeDogfoodCase } from "./search-eval";
import { Phase2Operations } from "./phase2-operations";
import { SessionOperations } from "./session-operations";
import { SessionStore } from "./session-store";
import { withAdvisoryLock } from "./advisory-lock";

export class EvalSuiteOperations {
  readonly suite: ProjectEvalSuite;
  private readonly phase2: Phase2Operations;
  private readonly sessions: SessionOperations;
  constructor(private readonly project: string, traps: TrapOperations) {
    this.suite = new ProjectEvalSuite(project, traps);
    this.phase2 = new Phase2Operations(project, traps);
    this.sessions = new SessionOperations(new SessionStore(project), traps);
  }
  previewCase(input: Record<string, unknown>) {
    const source = readProjectSuite(this.project, PROJECT_EVAL_SUITE);
    if (input.corpus_sha256 !== undefined && input.corpus_sha256 !== source.corpus_sha256) throw new Error("The displayed corpus changed. Close the editor and refresh before choosing expected lessons again.");
    if (typeof input.query !== "string" || input.query.length > 500) throw new Error("The example query must contain at most 500 characters.");
    const query = normalizeDogfoodCase({ ...input, mode: "fts", minRecallAt3: 0, minRecallAt5: input.judgment === "no_relevant_trap" ? 0 : 1, source: "manual-review" }, source.fixture);
    if (source.fixture.queries.some(q => JSON.stringify(q) === JSON.stringify(query))) throw new Error("This exact example already exists.");
    return { case: query, digest: evalSuiteHash(JSON.stringify([source.sha256, input])), suite_sha256: source.sha256,
      corpus_sha256: source.corpus_sha256, before_count: source.fixture.queries.length, after_count: source.fixture.queries.length + 1 };
  }
  acceptCase(input: Record<string, unknown>, digest: string, requestId: string) {
    if (!/^[a-zA-Z0-9_-]{8,72}$/.test(requestId)) throw new Error("Invalid request ID.");
    mkdirSync(join(this.project, ".codetrap/evals"), { recursive: true });
    return withAdvisoryLock(join(this.project, ".codetrap/evals/.case-review.lock"), () => {
      let linked = this.sessions.allCandidates().find(item => item.candidate.candidate_kind === "search_eval_case" && item.candidate.destination_payload?.suite_request_id === requestId);
      if (linked) {
        const payload = linked.candidate.destination_payload!;
        if (payload.input_sha256 !== evalSuiteHash(JSON.stringify(input)) || payload.review_digest !== digest) throw new Error("The request ID belongs to another reviewed example.");
        if (linked.candidate.delivery_state === "committed") {
          const commit = this.phase2.commits().find(c => c.id === linked!.candidate.destination_commit_id);
          if (!commit) throw new Error("The example's commit receipt is missing.");
          return { commit_id: commit.id, session_id: linked.session_id, candidate_id: linked.candidate.id, already_committed: true };
        }
        if (linked.candidate.delivery_state === "rolled_back" || linked.candidate.status !== "proposed") throw new Error("This example review is finalized. Start a new review.");
      }
      const preview = this.previewCase(input);
      if (preview.digest !== digest) throw new Error("The suite or example changed after preview. Preview again.");
      if (!linked) {
        const result = this.phase2.propose({ kind: "search_eval_case", title: "Reviewed project evaluation example", goal: "Review a local retrieval expectation",
          rationale: "The user previewed and explicitly confirmed this example.", context: "Check when an experience belongs in retrieval results.",
          mistake: "Treat unreviewed guesses as evaluation ground truth.", fix: "Keep the authored expectation and reversible receipt.", tags: ["eval"], source_agent: "user", source_refs: ["manual-review"],
          payload: { case: preview.case, fixture_path: PROJECT_EVAL_SUITE, corpus_sha256: preview.corpus_sha256,
            fixture_sha256: preview.suite_sha256, suite_request_id: requestId, review_digest: digest, input_sha256: evalSuiteHash(JSON.stringify(input)) } });
        if (result.suppressed) throw new Error("This example was previously rejected. Review its existing decision.");
        linked = { session_id: result.session.id, candidate: result.candidate };
      }
      const accepted = this.phase2.apply(linked.session_id, linked.candidate.id, "user");
      return { commit_id: accepted.commit.id, session_id: linked.session_id, candidate_id: linked.candidate.id, already_committed: false };
    }).value;
  }
}
