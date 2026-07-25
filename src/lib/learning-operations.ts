import { existsSync } from "node:fs";
import { basename } from "node:path";
import { TURN_NORMALIZER_VERSION, type LearningSourceId, type SourceManifest } from "../domain/learning-source";
import { readJsonFile } from "./fs-json";
import {
  buildEvidencePack,
  createReviewId,
  discoveryPrompt,
  deleteReview,
  isDeletedReview,
  listReviewIds,
  reviewDir,
  writeReviewDir,
  type EvidencePack,
  type ReviewTombstone,
  type WrittenReview,
} from "./learning-review-dir";
import {
  allSourceAdapters,
  collectSessions,
  inventorySource,
  sourceAdapter,
  type SourceInventory,
} from "./learning-sources";
import {
  draftToTrapInput,
  readReviewArtifacts,
  validateStagedCandidates,
  type StageRejection,
  type StageValidation,
} from "./learning-stage";
import type { SessionOperations } from "./session-operations";
import type { CandidateTrap } from "../domain/session";
import { candidateContentHash } from "./candidate-envelope";
import {
  clusterId,
  consolidateProvenance,
  findCommittedDuplicate,
  findExactDuplicate,
  findSemanticMatches,
  type SimilarityMatch,
} from "./candidate-dedup";
import { verifyCoverage } from "./coverage-verify";
import type { TrapOperations } from "./trap-operations";
import type { TurnLens } from "./learning-source-adapter";

export type LearnSourcesRequest = {
  source?: LearningSourceId;
  since?: Date;
  projectOnly?: boolean;
};

export type LearnReviewRequest = {
  source: LearningSourceId;
  since?: Date;
  limit?: number;
  projectOnly?: boolean;
  sessionLimit?: number;
  lens?: TurnLens;
  focus?: "failures" | "spread";
};

/**
 * §7.2's default range. Without a bound, a bare `learn review` would read the
 * user's entire client history across every project on the machine and write
 * excerpts of unrelated work into *this* repo's working tree.
 */
export const DEFAULT_REVIEW_SINCE_DAYS = 30;
export const DEFAULT_REVIEW_SESSION_CAP = 20;

export type LearnReviewResult = WrittenReview & {
  success: true;
  source: LearningSourceId;
  scope: {
    since: string;
    session_cap: number;
    project_only: boolean;
    lens: { reasoning: boolean; tools: boolean };
  };
  session_count: number;
  evidence_count: number;
  budget: EvidencePack["budget"];
  manifest_totals: SourceManifest["totals"];
  durable_writes: 0;
  next_action: { command: string };
};

export type StagedEntry = {
  candidate_id: string;
  session_id: string;
  title: string;
  review_cluster?: string;
  similar_to?: SimilarityMatch[];
  coverage_verified?: boolean;
};

export type ConsolidatedEntry = {
  candidate_id: string;
  session_id: string;
  title: string;
  content_hash: string;
  contributing_sources: string[];
};

export type LearnStageResult = {
  success: true;
  review_id: string;
  source: LearningSourceId;
  staged: StagedEntry[];
  /** Exact-hash duplicates merged into an existing candidate (§13.4). */
  consolidated: ConsolidatedEntry[];
  /** Exact-hash matches that are already committed; reported, never modified. */
  already_committed: {
    candidate_id: string;
    session_id: string;
    title: string;
    trap_id: number | null;
    note: string;
  }[];
  rejected: StageRejection[];
  suppressed: { title: string; fingerprint: string; reason: string | null }[];
  /** Candidates whose agent coverage claims did not verify (§9.3). */
  coverage_flagged: { candidate_id: string; title: string; failed_refs: string[] }[];
  applied: boolean;
  durable_trap_writes: 0;
  lock_wait_ms?: number;
  next_action?: { command: string };
};

/**
 * The pull-mode half of §9.4. Everything here is read-only against client
 * history and writes only into `.codetrap/learning/reviews/`; no durable
 * destination is touched, which is what lets `learn` run before any
 * authorization exists.
 */
export class LearningOperations {
  constructor(
    private readonly projectRoot: string,
    private readonly home: string,
    private readonly sessions: SessionOperations,
    private readonly traps: TrapOperations
  ) {}

  listSources(request: LearnSourcesRequest = {}): SourceInventory[] {
    const adapters = request.source ? [sourceAdapter(request.source)] : allSourceAdapters();
    return adapters.map((adapter) =>
      inventorySource(adapter, this.home, {
        since: request.since,
        projectRoot: request.projectOnly ? this.projectRoot : undefined,
      })
    );
  }

  /**
   * Builds a review directory: redacted evidence pack, source manifest, and the
   * §7.3 discovery prompt. It deliberately does not mine lessons — §1.4 keeps
   * semantic judgment with the agent and determinism with the compiler.
   */
  createReview(request: LearnReviewRequest, now = new Date()): LearnReviewResult {
    const adapter = sourceAdapter(request.source);
    const since = request.since
      ?? new Date(now.getTime() - DEFAULT_REVIEW_SINCE_DAYS * 24 * 60 * 60 * 1000);
    const sessionLimit = request.sessionLimit ?? DEFAULT_REVIEW_SESSION_CAP;
    const collected = collectSessions(
      adapter,
      this.home,
      {
        since,
        projectRoot: request.projectOnly ? this.projectRoot : undefined,
        limit: sessionLimit,
      },
      now,
      request.lens
    );

    if (collected.sessions.length === 0) {
      throw new Error(
        `No ${request.source} history found under ${adapter.roots(this.home).join(", ")} ` +
        `since ${since.toISOString().slice(0, 10)}${request.projectOnly ? " for this project" : ""}. ` +
        `Run 'codetrap learn sources --json' to see what is available, or widen --since.`
      );
    }

    const reviewId = createReviewId(request.source, now, (id) =>
      existsSync(reviewDir(this.projectRoot, id))
    );
    const limit = request.limit ?? 10;
    const pack = buildEvidencePack({
      reviewId,
      source: request.source,
      sessions: collected.sessions,
      now,
      focus: request.focus,
    });

    const written = writeReviewDir({
      projectRoot: this.projectRoot,
      reviewId,
      manifest: collected.manifest,
      pack,
      prompt: discoveryPrompt({
        reviewId,
        source: request.source,
        sessionCount: collected.sessions.length,
        limit,
      }),
    });

    return {
      success: true,
      ...written,
      source: request.source,
      // The scope actually used, so the user is never guessing what was read.
      scope: {
        since: since.toISOString(),
        session_cap: sessionLimit,
        project_only: request.projectOnly === true,
        // Recorded because it changes what the pack can possibly contain.
        lens: {
          reasoning: request.lens?.reasoning === true,
          tools: request.lens?.tools === true,
        },
      },
      session_count: collected.sessions.length,
      evidence_count: pack.evidence_count,
      budget: pack.budget,
      manifest_totals: collected.manifest.totals,
      durable_writes: 0,
      next_action: { command: `codetrap learn stage --review-dir ${written.review_dir} --json` },
    };
  }

  listReviews(): { review_id: string; deleted: boolean }[] {
    return listReviewIds(this.projectRoot).map((review_id) => ({
      review_id,
      deleted: isDeletedReview(this.projectRoot, review_id),
    }));
  }

  /** §3.2 retention: excerpts go, non-sensitive audit metadata stays. */
  deleteReview(reviewId: string, now = new Date()): ReviewTombstone {
    return deleteReview(this.projectRoot, reviewId, now);
  }

  /**
   * Validates agent-drafted candidates and, with `--apply`, stages them into the
   * existing session candidate inbox. Staging is not committing: every staged
   * candidate still needs `session approve` and `session accept` (§3.2).
   */
  stage(request: { reviewDir: string; apply: boolean }): LearnStageResult {
    const dir = request.reviewDir;
    if (!existsSync(dir)) throw new Error(`Review directory not found: ${dir}`);
    const { pack, candidatesPath } = readReviewArtifacts(dir);
    // 1C risk 1: turn indices are position-after-filtering, so a pack minted
    // under a different normalizer would resolve refs to different excerpts.
    if ((pack.normalizer_version ?? 1) !== TURN_NORMALIZER_VERSION) {
      throw new Error(
        `Review ${pack.review_id} was built with turn normalizer v${pack.normalizer_version ?? 1}, ` +
        `but this codetrap uses v${TURN_NORMALIZER_VERSION}. Its evidence refs would point at different turns. ` +
        `Rebuild it: codetrap learn review --source ${pack.source}`
      );
    }
    const validation = validateStagedCandidates({
      reviewDir: dir,
      raw: readJsonFile<unknown>(candidatesPath, "lesson candidates"),
      pack,
    });

    if (!request.apply) {
      // §13.1: dry-run paths take no locks, because they take no writes. The
      // report still previews the dedup and coverage outcome.
      const preview = this.previewStage(validation);
      return {
        success: true,
        review_id: validation.review_id,
        source: validation.source,
        staged: [],
        consolidated: preview.consolidated,
        already_committed: [],
        rejected: validation.rejected,
        suppressed: [],
        coverage_flagged: preview.coverage_flagged,
        applied: false,
        durable_trap_writes: 0,
        next_action: { command: `codetrap learn stage --review-dir ${dir} --apply --json` },
      };
    }

    return { ...this.applyStage(dir, validation), review_id: validation.review_id };
  }

  private previewStage(validation: StageValidation): {
    consolidated: ConsolidatedEntry[];
    coverage_flagged: LearnStageResult["coverage_flagged"];
  } {
    const existing = this.sessions.allCandidates();
    const consolidated: ConsolidatedEntry[] = [];
    const flagged: LearnStageResult["coverage_flagged"] = [];

    for (const draft of validation.accepted) {
      const trap = draftToTrapInput(draft);
      const hash = candidateContentHash({ trap });
      const duplicate = findExactDuplicate(existing, hash);
      if (duplicate) {
        consolidated.push({
          candidate_id: duplicate.candidate.id,
          session_id: duplicate.session_id,
          title: duplicate.candidate.trap.title,
          content_hash: hash,
          contributing_sources: [duplicate.candidate.source_agent ?? "unknown", validation.source_agent],
        });
      }
      const coverage = this.verifyDraftCoverage(draft, existing);
      if (coverage && !coverage.verified_all) {
        flagged.push({
          candidate_id: "(not yet staged)",
          title: draft.title,
          failed_refs: coverage.refs.filter((ref) => !ref.verified).map((ref) => ref.ref),
        });
      }
    }
    return { consolidated, coverage_flagged: flagged };
  }

  private verifyDraftCoverage(
    draft: StageValidation["accepted"][number],
    existing: { session_id: string; candidate: CandidateTrap }[]
  ) {
    return verifyCoverage(draft.coverage, {
      projectRoot: this.projectRoot,
      traps: this.traps,
      knownCandidateIds: new Set(
        existing.map((entry) => `${entry.session_id}/${entry.candidate.id.toLowerCase()}`)
      ),
    });
  }

  private applyStage(dir: string, validation: StageValidation): LearnStageResult {
    const staged: StagedEntry[] = [];
    const consolidated: ConsolidatedEntry[] = [];
    const suppressed: LearnStageResult["suppressed"] = [];
    const coverageFlagged: LearnStageResult["coverage_flagged"] = [];
    const alreadyCommitted: LearnStageResult["already_committed"] = [];

    return this.sessions.withCandidateCorpus((corpus) =>
      this.stageUnderLock(validation, corpus, staged, consolidated, suppressed, coverageFlagged, alreadyCommitted)
    );
  }

  private stageUnderLock(
    validation: StageValidation,
    corpus: { session_id: string; candidate: CandidateTrap }[],
    staged: StagedEntry[],
    consolidated: ConsolidatedEntry[],
    suppressed: LearnStageResult["suppressed"],
    coverageFlagged: LearnStageResult["coverage_flagged"],
    alreadyCommitted: LearnStageResult["already_committed"]
  ): LearnStageResult {
    let lockWait = 0;
    // The corpus is read once under the lock and kept current in-memory, so a
    // duplicate inside one batch is caught too.
    const existing = [...corpus];

    // One session for the whole batch. `captureCandidate` creates and closes an
    // auto-session per call when none is active, so a five-candidate stage
    // produced five single-candidate sessions and a reviewer had to walk all of
    // them. Holding one open makes the batch reviewable in one place.
    const batchSession = this.sessions.startBatchSession(
      `learning review ${validation.review_id}`
    );

    for (const draft of validation.accepted) {
      const trapInput = draftToTrapInput(draft);
      const hash = candidateContentHash({ trap: trapInput });
      const refs = draft.evidence.map((item) => item.ref);

      // An identical lesson that is already committed is reported, never
      // modified: its durable trap is unchanged, and changing that is an
      // authorized write rather than a staging side effect (§3.2).
      const committed = findCommittedDuplicate(existing, hash);
      if (committed) {
        alreadyCommitted.push({
          candidate_id: committed.candidate.id,
          session_id: committed.session_id,
          title: committed.candidate.trap.title,
          trap_id: committed.candidate.accepted_trap_id ?? null,
          note: "Already committed. To record this client as additional provenance, run codetrap add_trap_evidence.",
        });
        continue;
      }

      // §13.4: an identical revision hash consolidates rather than duplicating,
      // and both provenances survive. This is what makes a lesson mined from
      // Codex and again from Claude Code become one candidate with two sources.
      const duplicate = findExactDuplicate(existing, hash);
      if (duplicate) {
        const merged = this.sessions.mergeCandidateProvenance(
          duplicate.session_id,
          duplicate.candidate.id,
          (candidate) => consolidateProvenance(candidate, {
            source_agent: validation.source_agent,
            source_manifest_refs: refs,
            evidence: [{
              source_type: "conversation",
              source_ref: `learning-review:${validation.review_id}`,
              related_files: [],
              note: `Re-observed via ${validation.source_agent}: ${refs.join(", ")}`,
            }],
          })
        );
        consolidated.push({
          candidate_id: merged.id,
          session_id: duplicate.session_id,
          title: merged.trap.title,
          content_hash: hash,
          contributing_sources: merged.contributing_sources ?? [merged.source_agent ?? "unknown"],
        });
        replaceInCorpus(existing, duplicate.session_id, merged);
        lockWait = Math.max(lockWait, this.sessions.lockWaitMs());
        continue;
      }

      const captured = this.sessions.captureCandidate({
        trap: { ...trapInput },
        goal: `learning review ${validation.review_id}`,
        kind: "review",
        sourceRef: `learning-review:${validation.review_id}`,
        evidenceNote: draft.evidence
          .map((item) => `${item.ref}${item.note ? ` — ${item.note}` : ""}`)
          .join("; "),
        relatedFiles: [],
        // §8.2 provenance: which client produced it, which evidence backs it,
        // and the destination hypothesis the agent proposed.
        candidateKind: draft.candidate_kind,
        sourceAgent: validation.source_agent,
        destinationHint: draft.destination_hint,
        rationale: draft.rationale,
        sourceManifestRefs: refs,
      });

      // A lesson the user already skipped must not come back through a new
      // review either — the Phase 1A suppression index is project-wide.
      if (captured.suppressed) {
        suppressed.push({
          title: captured.title,
          fingerprint: captured.fingerprint,
          reason: captured.suppression.reason,
        });
        lockWait = Math.max(lockWait, this.sessions.lockWaitMs());
        continue;
      }

      // §9.3: semantic neighbours are grouped, never merged. Both candidates
      // stay; the reviewer decides merge, supersede, or separate.
      const matches = findSemanticMatches(existing, captured.candidate.trap, hash);
      const cluster = matches.length > 0
        ? clusterId(hash, matches.map((match) => match.content_hash))
        : null;
      const coverage = this.verifyDraftCoverage(draft, existing);

      if (cluster || coverage) {
        const updated = this.sessions.mergeCandidateProvenance(
          captured.session.id,
          captured.candidate.id,
          (candidate) => ({
            ...candidate,
            ...(cluster ? { review_cluster: cluster, similar_to: matches } : {}),
            ...(coverage ? { coverage } : {}),
          })
        );
        replaceInCorpus(existing, captured.session.id, updated);
      }

      // A cluster with only one labelled member is not a cluster: a reviewer
      // opening the older candidate must also see it has a neighbour (§9.3).
      if (cluster) {
        for (const match of matches) {
          const back = this.sessions.mergeCandidateProvenance(
            match.session_id,
            match.candidate_id,
            (candidate) => ({
              ...candidate,
              review_cluster: cluster,
              similar_to: mergeSimilar(candidate.similar_to, {
                session_id: captured.session.id,
                candidate_id: captured.candidate.id,
                title: captured.candidate.trap.title,
                content_hash: hash,
                score: match.score,
                reason: match.reason,
              }),
            })
          );
          replaceInCorpus(existing, match.session_id, back);
        }
      }
      if (coverage && !coverage.verified_all) {
        coverageFlagged.push({
          candidate_id: captured.candidate.id,
          title: draft.title,
          failed_refs: coverage.refs.filter((ref) => !ref.verified).map((ref) => ref.ref),
        });
      }

      lockWait = Math.max(lockWait, this.sessions.lockWaitMs());
      existing.push({ session_id: captured.session.id, candidate: captured.candidate });
      staged.push({
        candidate_id: captured.candidate.id,
        session_id: captured.session.id,
        title: draft.title,
        ...(cluster ? { review_cluster: cluster, similar_to: matches } : {}),
        ...(coverage ? { coverage_verified: coverage.verified_all } : {}),
      });
    }

    if (batchSession) this.sessions.closeSession(batchSession.id, false);

    return {
      success: true,
      review_id: validation.review_id,
      source: validation.source,
      staged,
      consolidated,
      already_committed: alreadyCommitted,
      rejected: validation.rejected,
      suppressed,
      coverage_flagged: coverageFlagged,
      applied: true,
      durable_trap_writes: 0,
      lock_wait_ms: lockWait,
      next_action: staged.length > 0
        ? { command: `codetrap session candidates ${staged[0].session_id} --json` }
        : undefined,
    };
  }
}

export function reviewDirLabel(dir: string): string {
  return basename(dir);
}

export type { EvidencePack };

function replaceInCorpus(
  corpus: { session_id: string; candidate: CandidateTrap }[],
  sessionId: string,
  candidate: CandidateTrap
): void {
  const index = corpus.findIndex(
    (entry) => entry.session_id === sessionId && entry.candidate.id === candidate.id
  );
  if (index === -1) corpus.push({ session_id: sessionId, candidate });
  else corpus[index] = { session_id: sessionId, candidate };
}

function mergeSimilar(
  existing: SimilarityMatch[] | undefined,
  addition: SimilarityMatch
): SimilarityMatch[] {
  const kept = (existing ?? []).filter(
    (match) => !(match.session_id === addition.session_id && match.candidate_id === addition.candidate_id)
  );
  return [...kept, addition].sort((a, b) => b.score - a.score);
}
