import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  LEARNING_FEEDBACK_VALUES,
  LEARNING_STATUSES,
  type LearningFeedback,
  type LearningStatus,
  type ObservationEvent,
} from "../domain/observation";
import type { CandidateTrap } from "../domain/session";
import { CODETRAP_DIR } from "./constants";
import { withAdvisoryLock } from "./advisory-lock";
import { readJsonFile, writeFileAtomic } from "./fs-json";
import { observationLedgerPath, openObservationLedger, openObservationLedgerReadOnly } from "./observation-ledger";
import { Phase2Store, type InsightCollectionRecord, type InsightRecord } from "./phase2-store";
import { capturedTrapInput, trapFingerprint } from "./session-capture";
import type { SessionOperations } from "./session-operations";
import { uniqueStrings } from "./string-list";
import { isRecord } from "./value-types";

import { LEARNING_IMPACT_VERSION, type LearningProgressRecord, type LearningPromotionRecord, type LearningImpactDocument, type LearningAgentCandidateDraft, type LearningPromotionState, type LearningImpactState } from "../domain/learning-impact";
export { LEARNING_IMPACT_VERSION, type LearningProgressRecord, type LearningPromotionRecord, type LearningImpactDocument, type LearningAgentCandidateDraft, type LearningPromotionState, type LearningImpactState } from "../domain/learning-impact";

export const LOCAL_LEARNING_ACTOR = "local-user";

type InsightContext = {
  insight: InsightRecord;
  collection: InsightCollectionRecord | null;
};

const PHASE2_DIR = "phase2";
const LEARNING_IMPACT_FILE = "learning-impact.json";
const LEARNING_IMPACT_LOCK = ".learning-impact.lock";

export class LearningImpactStore {
  constructor(private readonly projectRoot: string) {}

  path(): string {
    return join(resolve(this.projectRoot), CODETRAP_DIR, PHASE2_DIR, LEARNING_IMPACT_FILE);
  }

  progress(insight: InsightRecord, actorRef = LOCAL_LEARNING_ACTOR): LearningProgressRecord & { legacy_derived: boolean } {
    const explicit = this.read().progress.find((item) => item.actor_ref === actorRef && item.insight_id === insight.id);
    if (explicit) return { ...explicit, legacy_derived: false };
    return {
      actor_ref: actorRef,
      insight_id: insight.id,
      status: insight.consulted_count > 0 ? "learned" : "not_started",
      feedback: null,
      linked_run_id: null,
      practice_note: null,
      updated_at: insight.last_consulted_at ?? insight.shelved_at,
      legacy_derived: insight.consulted_count > 0,
    };
  }

  promotion(insightId: string, actorRef = LOCAL_LEARNING_ACTOR): LearningPromotionRecord | null {
    return this.read().promotions.find((item) => item.actor_ref === actorRef && item.insight_id === insightId) ?? null;
  }

  listPromotions(actorRef = LOCAL_LEARNING_ACTOR): LearningPromotionRecord[] {
    return this.read().promotions.filter((item) => item.actor_ref === actorRef);
  }

  updateProgress(
    insight: InsightRecord,
    updates: Partial<Pick<LearningProgressRecord, "status" | "feedback" | "linked_run_id" | "practice_note">>,
    now = new Date(),
    actorRef = LOCAL_LEARNING_ACTOR
  ): LearningProgressRecord {
    return this.mutate((document) => {
      const current = document.progress.find((item) => item.actor_ref === actorRef && item.insight_id === insight.id)
        ?? this.progressFromDocument(document, insight, actorRef);
      const next: LearningProgressRecord = {
        ...current,
        ...(updates.status !== undefined ? { status: learningStatus(updates.status) } : {}),
        ...(updates.feedback !== undefined ? { feedback: learningFeedback(updates.feedback) } : {}),
        ...(updates.linked_run_id !== undefined ? { linked_run_id: nullableId(updates.linked_run_id, "linked_run_id") } : {}),
        ...(updates.practice_note !== undefined ? { practice_note: practiceNote(updates.practice_note) } : {}),
        updated_at: now.toISOString(),
      };
      document.progress = [
        ...document.progress.filter((item) => item.actor_ref !== actorRef || item.insight_id !== insight.id),
        next,
      ];
      return next;
    });
  }

  withPromotion<T>(action: (document: LearningImpactDocument) => T): T {
    return this.mutate(action);
  }

  upsertPromotion(
    document: LearningImpactDocument,
    record: LearningPromotionRecord
  ): void {
    document.promotions = [
      ...document.promotions.filter((item) => item.actor_ref !== record.actor_ref || item.insight_id !== record.insight_id),
      record,
    ];
  }

  private progressFromDocument(
    document: LearningImpactDocument,
    insight: InsightRecord,
    actorRef: string
  ): LearningProgressRecord {
    return document.progress.find((item) => item.actor_ref === actorRef && item.insight_id === insight.id) ?? {
      actor_ref: actorRef,
      insight_id: insight.id,
      status: insight.consulted_count > 0 ? "learned" : "not_started",
      feedback: null,
      linked_run_id: null,
      practice_note: null,
      updated_at: insight.last_consulted_at ?? insight.shelved_at,
    };
  }

  private mutate<T>(action: (document: LearningImpactDocument) => T): T {
    mkdirSync(dirname(this.path()), { recursive: true });
    return withAdvisoryLock(
      join(resolve(this.projectRoot), CODETRAP_DIR, LEARNING_IMPACT_LOCK),
      () => {
        const document = this.read();
        const result = action(document);
        writeFileAtomic(this.path(), `${JSON.stringify(document, null, 2)}\n`);
        return result;
      }
    ).value;
  }

  private read(): LearningImpactDocument {
    const path = this.path();
    if (!existsSync(path)) return emptyLearningImpactDocument();
    const value = readJsonFile<unknown>(path, "Learning Impact state");
    if (!isRecord(value) || value.version !== LEARNING_IMPACT_VERSION) {
      throw new Error(`Corrupt Learning Impact state ${path}: expected version ${LEARNING_IMPACT_VERSION}.`);
    }
    if (!Array.isArray(value.progress) || !Array.isArray(value.promotions)) {
      throw new Error(`Corrupt Learning Impact state ${path}: expected progress and promotions arrays.`);
    }
    return {
      version: LEARNING_IMPACT_VERSION,
      progress: value.progress.map(parseProgressRecord),
      promotions: value.promotions.map(parsePromotionRecord),
    };
  }
}

export class LearningImpactOperations {
  private readonly phase2: Phase2Store;
  private readonly store: LearningImpactStore;

  constructor(
    private readonly projectRoot: string,
    private readonly sessions: SessionOperations,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => randomUUID()
  ) {
    this.phase2 = new Phase2Store(projectRoot);
    this.store = new LearningImpactStore(projectRoot);
  }

  state(insight: InsightRecord): LearningImpactState {
    return {
      progress: this.store.progress(insight),
      promotion: this.resolvePromotion(this.store.promotion(insight.id)),
    };
  }

  updatePracticeNote(insightId: string, value: unknown): LearningImpactState {
    const context = this.insightContext(insightId);
    const note = practiceNote(value);
    this.store.updateProgress(context.insight, { practice_note: note }, this.now());
    // Personal writing never enters shared Insight content, candidates or telemetry.
    return this.state(context.insight);
  }

  sourcesForTrap(id: number, scope: "project" | "global") {
    const library = this.phase2.learningLibrary();
    const insights = new Map(library.insights.map((insight) => [insight.id, insight]));
    return this.store.listPromotions().flatMap((record) => {
      const insight = insights.get(record.insight_id);
      const promotion = this.resolvePromotion(record);
      if (!insight || promotion?.status !== "accepted" || promotion.accepted_trap_id !== id || promotion.accepted_scope !== scope) return [];
      return [{ insight_id: insight.id, title: insight.title, session_id: promotion.session_id, candidate_id: promotion.candidate_id }];
    });
  }

  updateStatus(insightId: string, status: unknown): LearningImpactState {
    const context = this.insightContext(insightId);
    const normalizedStatus = learningStatus(status);
    const current = this.store.progress(context.insight);
    if (current.status === normalizedStatus) return this.state(context.insight);
    const next = this.store.updateProgress(context.insight, { status: normalizedStatus }, this.now());
    this.recordObservation("learning/status-changed", context, next.linked_run_id, { status: next.status }, "human_label");
    return this.state(context.insight);
  }

  updateFeedback(insightId: string, feedback: unknown): LearningImpactState {
    const context = this.insightContext(insightId);
    const normalizedFeedback = learningFeedback(feedback);
    const current = this.store.progress(context.insight);
    if (current.feedback === normalizedFeedback) return this.state(context.insight);
    const next = this.store.updateProgress(context.insight, { feedback: normalizedFeedback }, this.now());
    this.recordObservation("learning/feedback-recorded", context, next.linked_run_id, { feedback: next.feedback }, "human_label");
    return this.state(context.insight);
  }

  linkRun(insightId: string, runId: unknown): LearningImpactState {
    const context = this.insightContext(insightId);
    const linkedRunId = nullableId(runId, "linked_run_id");
    if (linkedRunId) this.assertRun(linkedRunId);
    const current = this.store.progress(context.insight);
    if (current.linked_run_id === linkedRunId) return this.state(context.insight);
    this.store.updateProgress(context.insight, { linked_run_id: linkedRunId }, this.now());
    if (linkedRunId) {
      this.recordObservation("learning/linked-to-run", context, linkedRunId, { linked_run_id: linkedRunId }, "observed_fact");
    }
    return this.state(context.insight);
  }

  preview(insightId: string, input?: Record<string, unknown>) {
    const context = this.insightContext(insightId);
    const draft = learningAgentCandidateDraft(context.insight, context.collection, input);
    return {
      success: true,
      project_root: resolve(this.projectRoot),
      insight_id: context.insight.id,
      collection_id: context.collection?.id ?? null,
      destination: "candidate_inbox",
      model_calls: 0,
      confirmed_memory_writes: 0,
      draft,
      source: {
        insight_title: context.insight.title,
        source_refs: [...context.insight.source_refs],
      },
      existing_promotion: this.state(context.insight).promotion,
    };
  }

  createCandidate(insightId: string, input: Record<string, unknown>) {
    const context = this.insightContext(insightId);
    const draft = learningAgentCandidateDraft(context.insight, context.collection, input);
    const trap = capturedTrapInput(draft);
    const sourceRef = `learning-insight:${context.insight.id}`;
    const fingerprint = trapFingerprint(trap);

    return this.store.withPromotion((document) => {
      const existing = this.findExistingCandidate(sourceRef, fingerprint);
      if (existing) {
        const promotion = promotionRecord(context.insight.id, existing.session_id, existing.candidate, fingerprint, this.now());
        this.store.upsertPromotion(document, promotion);
        return this.creationResult(context, existing.session_id, existing.candidate, true);
      }

      const captured = this.sessions.captureCandidate({
        trap: { ...trap },
        goal: `learning impact: ${context.insight.title}`,
        kind: "review",
        sourceRef,
        evidenceNote: `Created from reviewed Learning Insight ${context.insight.id}.`,
        relatedFiles: [],
        candidateKind: "pitfall_trap",
        sourceAgent: "unknown",
        destinationHint: "pitfall_trap",
        rationale: "User-created deterministic Learning Impact draft. No model was called and confirmed Agent memory remains unchanged until explicit Candidate Inbox review.",
        sourceManifestRefs: context.insight.source_refs,
      });
      if (captured.suppressed) {
        throw new Error(`This exact Agent experience draft was previously rejected: ${captured.suppression.reason ?? "no reason recorded"}. Edit the draft before sending it again.`);
      }
      const promotion = promotionRecord(context.insight.id, captured.session.id, captured.candidate, fingerprint, this.now());
      this.store.upsertPromotion(document, promotion);
      const progress = document.progress.find((item) => item.actor_ref === LOCAL_LEARNING_ACTOR && item.insight_id === insightId);
      this.recordObservation(
        "learning/promoted-to-candidate",
        context,
        progress?.linked_run_id ?? null,
        { candidate_id: captured.candidate.id },
        "observed_fact"
      );
      return this.creationResult(context, captured.session.id, captured.candidate, captured.duplicate);
    });
  }

  private creationResult(context: InsightContext, sessionId: string, candidate: CandidateTrap, duplicate: boolean) {
    return {
      success: true,
      project_root: resolve(this.projectRoot),
      insight_id: context.insight.id,
      destination: "candidate_inbox",
      model_calls: 0,
      confirmed_memory_writes: 0,
      duplicate,
      session_id: sessionId,
      candidate: {
        id: candidate.id,
        title: candidate.trap.title,
        status: candidate.status,
        revision: candidate.revision ?? null,
        content_hash: candidate.content_hash ?? null,
      },
    };
  }

  private insightContext(insightId: string): InsightContext {
    const library = this.phase2.learningLibrary();
    const insight = library.insights.find((item) => item.id === insightId);
    if (!insight) throw new Error(`Insight ${insightId} not found.`);
    const membership = library.collection_items.find((item) => item.insight_id === insightId);
    const collection = membership
      ? library.collections.find((item) => item.id === membership.collection_id) ?? null
      : null;
    return { insight, collection };
  }

  private findExistingCandidate(sourceRef: string, fingerprint: string) {
    return this.sessions.allCandidates().find((entry) =>
      trapFingerprint(entry.candidate.trap) === fingerprint
      && entry.candidate.evidence.some((evidence) => evidence.source_ref === sourceRef)
    ) ?? null;
  }

  private resolvePromotion(record: LearningPromotionRecord | null): LearningPromotionState | null {
    if (!record) return null;
    try {
      const { candidate } = this.sessions.getCandidate(record.candidate_id, record.session_id);
      return {
        session_id: record.session_id,
        candidate_id: record.candidate_id,
        status: candidate.status,
        review_decision: candidate.review_decision ?? null,
        delivery_state: candidate.delivery_state ?? null,
        revision: candidate.revision ?? null,
        accepted_trap_id: candidate.accepted_trap_id ?? null,
        accepted_scope: candidate.accepted_scope === "project" || candidate.accepted_scope === "global" ? candidate.accepted_scope : null,
        title: candidate.trap.title,
      };
    } catch {
      return {
        session_id: record.session_id,
        candidate_id: record.candidate_id,
        status: "missing",
        review_decision: null,
        delivery_state: null,
        revision: null,
        accepted_trap_id: null,
        accepted_scope: null,
        title: null,
      };
    }
  }

  private assertRun(runId: string): void {
    const ledger = openObservationLedgerReadOnly(this.projectRoot);
    if (!ledger) throw new Error("Observation is not configured for this project, so there are no Runs to link.");
    try {
      if (!ledger.getRun(runId)) throw new Error(`Observation Run ${runId} not found.`);
    } finally {
      ledger.close();
    }
  }

  private recordObservation(
    type: "learning/status-changed" | "learning/feedback-recorded" | "learning/promoted-to-candidate" | "learning/linked-to-run",
    context: InsightContext,
    runId: string | null,
    detail: Record<string, string | null>,
    evidenceClass: "human_label" | "observed_fact"
  ): void {
    if (!existsSync(observationLedgerPath(this.projectRoot))) return;
    let ledger: ReturnType<typeof openObservationLedger> | null = null;
    try {
      ledger = openObservationLedger(this.projectRoot);
      const recordedAt = this.now().toISOString();
      const attributes = {
        insight_id: context.insight.id,
        collection_id: context.collection?.id ?? null,
        ...detail,
      } as ObservationEvent["attributes"];
      const base = {
        version: 1 as const,
        id: this.newId(),
        project_id: ledger.projectId,
        run_id: runId,
        actor_ref: LOCAL_LEARNING_ACTOR,
        device_id: "codetrap-web-local",
        occurred_at: recordedAt,
        recorded_at: recordedAt,
        type,
        evidence_class: evidenceClass,
        sensitivity: "metadata" as const,
        attributes,
        body_ref: null,
        source_ref: `learning-insight:${context.insight.id}`,
      };
      if (runId) ledger.appendNext(base);
      else ledger.append({ ...base, seq: 0 });
    } catch {
      // Observation is a failure-isolated sidecar. Personal progress and Inbox
      // staging remain the primary source of truth.
    } finally {
      try {
        ledger?.close();
      } catch {
        // The primary Learning operation has already completed.
      }
    }
  }
}

export function learningAgentCandidateDraft(
  insight: InsightRecord,
  collection: InsightCollectionRecord | null,
  input?: Record<string, unknown>
): LearningAgentCandidateDraft {
  const topics = uniqueStrings([...(insight.topics ?? []), ...(collection?.topics ?? [])]);
  const defaultDraft: LearningAgentCandidateDraft = {
    title: clipped(insight.title, 160),
    context: clipped([
      `When work relates to ${topics.length > 0 ? topics.join(", ") : "this Insight's subject"} and the reviewed guidance in \"${insight.title}\" applies.`,
      insight.summary,
    ].filter(Boolean).join(" "), 1_500),
    mistake: clipped(`Proceeding without checking or applying the reviewed guidance from \"${insight.title}\" can repeat the problem this Insight is meant to prevent.`, 1_000),
    fix: clipped(`Apply the reviewed Learning guidance before implementation or review:\n\n${insight.body || insight.summary}`, 4_000),
    scope: "project",
    tags: uniqueStrings([...(insight.tags ?? []), "learning-impact"]),
    path_globs: [],
    module: null,
  };
  const merged = { ...defaultDraft, ...(input ?? {}) };
  const normalized = capturedTrapInput({
    ...merged,
    category: "other",
    severity: "warning",
  });
  return {
    title: normalized.title,
    context: normalized.context,
    mistake: normalized.mistake,
    fix: normalized.fix,
    scope: normalized.scope as "project" | "global",
    tags: normalized.tags ?? [],
    path_globs: normalized.path_globs ?? [],
    module: normalized.module ?? null,
  };
}

function emptyLearningImpactDocument(): LearningImpactDocument {
  return { version: LEARNING_IMPACT_VERSION, progress: [], promotions: [] };
}

function parseProgressRecord(value: unknown): LearningProgressRecord {
  if (!isRecord(value)) throw new Error("Invalid Learning progress record.");
  return {
    actor_ref: requiredId(value.actor_ref, "actor_ref"),
    insight_id: requiredId(value.insight_id, "insight_id"),
    status: learningStatus(value.status),
    feedback: value.feedback === null ? null : learningFeedback(value.feedback),
    linked_run_id: nullableId(value.linked_run_id, "linked_run_id"),
    practice_note: practiceNote(value.practice_note ?? null),
    updated_at: isoTimestamp(value.updated_at, "updated_at"),
  };
}

function parsePromotionRecord(value: unknown): LearningPromotionRecord {
  if (!isRecord(value)) throw new Error("Invalid Learning promotion record.");
  return {
    actor_ref: requiredId(value.actor_ref, "actor_ref"),
    insight_id: requiredId(value.insight_id, "insight_id"),
    session_id: requiredId(value.session_id, "session_id"),
    candidate_id: requiredId(value.candidate_id, "candidate_id"),
    candidate_fingerprint: requiredId(value.candidate_fingerprint, "candidate_fingerprint"),
    created_at: isoTimestamp(value.created_at, "created_at"),
  };
}

function promotionRecord(
  insightId: string,
  sessionId: string,
  candidate: CandidateTrap,
  fingerprint: string,
  now: Date
): LearningPromotionRecord {
  return {
    actor_ref: LOCAL_LEARNING_ACTOR,
    insight_id: insightId,
    session_id: sessionId,
    candidate_id: candidate.id,
    candidate_fingerprint: fingerprint,
    created_at: now.toISOString(),
  };
}

function learningStatus(value: unknown): LearningStatus {
  if ((LEARNING_STATUSES as readonly unknown[]).includes(value)) return value as LearningStatus;
  throw new Error(`status must be one of: ${LEARNING_STATUSES.join(", ")}.`);
}

function learningFeedback(value: unknown): LearningFeedback {
  if ((LEARNING_FEEDBACK_VALUES as readonly unknown[]).includes(value)) return value as LearningFeedback;
  throw new Error(`feedback must be one of: ${LEARNING_FEEDBACK_VALUES.join(", ")}.`);
}

function requiredId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string.`);
  return value.trim();
}

function nullableId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredId(value, field);
}

function isoTimestamp(value: unknown, field: string): string {
  const text = requiredId(value, field);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`${field} must be an ISO timestamp.`);
  return new Date(text).toISOString();
}

function clipped(value: string, max: number): string {
  const text = value.trim().replace(/\r\n/g, "\n");
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function practiceNote(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 1000) throw new Error("practiceNote must be a string of at most 1000 characters or null.");
  return value.trim() || null;
}
