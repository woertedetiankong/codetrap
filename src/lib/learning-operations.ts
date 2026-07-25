import { existsSync } from "node:fs";
import { basename } from "node:path";
import type { LearningSourceId, SourceManifest } from "../domain/learning-source";
import { readJsonFile } from "./fs-json";
import {
  buildEvidencePack,
  createReviewId,
  discoveryPrompt,
  listReviewIds,
  reviewDir,
  writeReviewDir,
  type EvidencePack,
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
  scope: { since: string; session_cap: number; project_only: boolean };
  session_count: number;
  evidence_count: number;
  manifest_totals: SourceManifest["totals"];
  durable_writes: 0;
  next_action: { command: string };
};

export type LearnStageResult = {
  success: true;
  review_id: string;
  source: LearningSourceId;
  staged: { candidate_id: string; session_id: string; title: string }[];
  rejected: StageRejection[];
  suppressed: { title: string; fingerprint: string; reason: string | null }[];
  applied: boolean;
  durable_trap_writes: 0;
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
    private readonly sessions: SessionOperations
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
      now
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
      },
      session_count: collected.sessions.length,
      evidence_count: pack.evidence_count,
      manifest_totals: collected.manifest.totals,
      durable_writes: 0,
      next_action: { command: `codetrap learn stage --review-dir ${written.review_dir} --json` },
    };
  }

  listReviews(): string[] {
    return listReviewIds(this.projectRoot);
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
    const validation = validateStagedCandidates({
      reviewDir: dir,
      raw: readJsonFile<unknown>(candidatesPath, "lesson candidates"),
      pack,
    });

    if (!request.apply) {
      return {
        success: true,
        review_id: validation.review_id,
        source: validation.source,
        staged: [],
        rejected: validation.rejected,
        suppressed: [],
        applied: false,
        durable_trap_writes: 0,
        next_action: { command: `codetrap learn stage --review-dir ${dir} --apply --json` },
      };
    }

    return { ...this.applyStage(dir, validation), review_id: validation.review_id };
  }

  private applyStage(dir: string, validation: StageValidation): LearnStageResult {
    const staged: LearnStageResult["staged"] = [];
    const suppressed: LearnStageResult["suppressed"] = [];

    for (const draft of validation.accepted) {
      const captured = this.sessions.captureCandidate({
        trap: draftToTrapInput(draft),
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
        sourceManifestRefs: draft.evidence.map((item) => item.ref),
      });

      // A lesson the user already skipped must not come back through a new
      // review either — the Phase 1A suppression index is project-wide.
      if (captured.suppressed) {
        suppressed.push({
          title: captured.title,
          fingerprint: captured.fingerprint,
          reason: captured.suppression.reason,
        });
        continue;
      }

      staged.push({
        candidate_id: captured.candidate.id,
        session_id: captured.session.id,
        title: draft.title,
      });
    }

    return {
      success: true,
      review_id: validation.review_id,
      source: validation.source,
      staged,
      rejected: validation.rejected,
      suppressed,
      applied: true,
      durable_trap_writes: 0,
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
