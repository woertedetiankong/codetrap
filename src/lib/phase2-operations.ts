import { parseCandidateKind, type CandidateKind } from "../domain/candidate";
import { parseExecutor, type Executor } from "../domain/learning";
import type { CandidateTrap } from "../domain/session";
import type { TrapOperations } from "./trap-operations";
import { SessionOperations } from "./session-operations";
import { SessionStore } from "./session-store";
import { LearningStore } from "./learning-store";
import { Phase2Store } from "./phase2-store";

export class Phase2Operations {
  private readonly sessions: SessionOperations;
  private readonly learning: LearningStore;
  private readonly phase2: Phase2Store;

  constructor(private readonly projectRoot: string, private readonly traps: TrapOperations) {
    this.sessions = new SessionOperations(new SessionStore(projectRoot), traps);
    this.learning = new LearningStore(projectRoot);
    this.phase2 = new Phase2Store(projectRoot);
  }

  propose(input: Record<string, unknown>) {
    const kind = parseCandidateKind(requiredText(input.kind, "kind"));
    if (!isPhase2Kind(kind)) {
      throw new Error("phase2 propose requires project_convention, docs_guidance, search_eval_case, or insight.");
    }
    const title = requiredText(input.title, "title");
    const rationale = optionalText(input.rationale) ?? `Proposed ${kind} destination.`;
    const payload = recordValue(input.payload, "payload");
    return this.sessions.captureCandidate({
      goal: optionalText(input.goal) ?? `Phase 2 proposal: ${title}`,
      trap: {
        title,
        category: kind === "project_convention" ? "convention" : "other",
        scope: "project",
        context: optionalText(input.context) ?? rationale,
        mistake: optionalText(input.mistake) ?? "Leaving this reviewed knowledge only in session history makes it non-durable.",
        fix: optionalText(input.fix) ?? "Commit the authorized payload to its purpose-specific Phase 2 destination.",
        severity: optionalText(input.severity) ?? "warning",
        tags: stringArray(input.tags),
      },
      candidateKind: kind,
      sourceAgent: optionalText(input.source_agent) ?? "unknown",
      rationale,
      sourceManifestRefs: stringArray(input.source_refs),
      destinationPayload: payload,
    });
  }

  edit(sessionId: string, candidateId: string, payload: Record<string, unknown>) {
    const before = this.sessions.getCandidate(candidateId, sessionId).candidate;
    const edited = this.sessions.editDestinationCandidate(sessionId, candidateId, payload);
    if (before.authorization && !edited.authorization) {
      this.phase2.appendEvent({ type: "authorization_invalidated", candidate_id: candidateId });
    }
    return edited;
  }

  preview(sessionId: string, candidateId: string) {
    const { candidate } = this.sessions.getCandidate(candidateId, sessionId);
    phase2Kind(candidate);
    return { candidate_id: candidateId, session_id: sessionId, files: this.phase2.preview(candidate) };
  }

  apply(sessionId: string, candidateId: string, executorInput?: string) {
    const executor = parseExecutor(executorInput);
    const { candidate } = this.sessions.getCandidate(candidateId, sessionId);
    const kind = phase2Kind(candidate);
    this.sessions.assertDestinationCommitAuthorized(sessionId, candidateId, executor);
    const commit = this.phase2.apply(sessionId, candidate);
    let committed: CandidateTrap;
    try {
      committed = this.sessions.commitDestinationCandidate(sessionId, candidateId, commit.id, executor);
    } catch (error) {
      this.phase2.revert(commit.id);
      throw error;
    }
    const receipt = this.learning.appendReceipt({
      action: "commit",
      executor,
      authorizedScope: candidate.authorization?.authorized_scope ?? `candidate ${candidateId} only`,
      destination: kind,
      fingerprint: committed.content_hash ?? "",
      title: committed.trap.title,
      sessionId,
      candidateId,
      reason: `Phase 2 commit ${commit.id}`,
    });
    return { success: true, candidate: committed, commit, receipt };
  }

  revert(commitId: string, executorInput?: string) {
    const executor = parseExecutor(executorInput);
    const commit = this.phase2.revert(commitId);
    const candidate = this.sessions.rollbackDestinationCandidate(commit.session_id, commit.candidate_id);
    const receipt = this.learning.appendReceipt({
      action: "rollback",
      executor,
      authorizedScope: `Phase 2 commit ${commitId} only`,
      destination: phase2Kind(candidate),
      fingerprint: candidate.content_hash ?? "",
      title: candidate.trap.title,
      sessionId: commit.session_id,
      candidateId: commit.candidate_id,
      reason: `Reverted ${commitId}`,
    });
    return { success: true, commit, candidate, receipt };
  }

  insights() { return this.phase2.listInsights(); }
  consultInsight(id: string) { return this.phase2.consultInsight(id); }
  commits() { return this.phase2.listCommits(); }
  migrateInsightCandidates(sessionId?: string, apply = false) {
    return this.sessions.migrateCandidateDocuments({ sessionId, direction: "up", apply });
  }

  validateTrap(id: number, scope?: string) {
    const result = this.traps.validateTrap(id, scope);
    if (result.success) this.phase2.appendEvent({ type: "validated", trap_id: id, scope: result.scope });
    return result;
  }

  graduateTrap(id: number, target: string, scope?: string) {
    const result = this.traps.graduateTrap(id, target, scope);
    if (result.success) this.phase2.appendEvent({ type: "graduated", trap_id: id, scope: result.scope });
    return result;
  }

  recordOutcome(channel: "preflight" | "curated", trapId: number, useful: boolean, scope?: string) {
    return this.phase2.appendEvent({ type: "recall_outcome", channel, trap_id: trapId, useful, scope });
  }

  metrics() {
    const events = this.phase2.listEvents();
    const outcomes = events.filter((event) => event.type === "recall_outcome");
    const candidates = this.sessions.allCandidates();
    const allTraps = this.traps.listTraps({ status: "all", limit: 100000 }).flatMap((group) => group.traps);
    const usefulLessons = allTraps.filter((trap) => trap.useful_count > 0);
    const inbox = this.sessions.inboxHealth();
    return {
      repeated_review_suppression: {
        active_fingerprints: this.learning.listSuppressions().length,
        suppression_receipts: this.learning.listReceipts().filter((receipt) => receipt.action === "suppress").length,
      },
      useful_recall: {
        committed_lessons_marked_useful: usefulLessons.length,
        useful_marks: usefulLessons.reduce((sum, trap) => sum + trap.useful_count, 0),
        preflight_useful: outcomes.filter((event) => event.channel === "preflight" && event.useful).length,
        curated_useful: outcomes.filter((event) => event.channel === "curated" && event.useful).length,
      },
      authorization_invalidations: events.filter((event) => event.type === "authorization_invalidated").length,
      inbox_growth: inbox,
      cross_client_dedup: {
        consolidated_candidates: candidates.filter(({ candidate }) => (candidate.contributing_sources?.length ?? 0) > 1).length,
        contributing_sources: [...new Set(candidates.flatMap(({ candidate }) => candidate.contributing_sources ?? []))],
      },
      insight_shelf: {
        shelved: this.phase2.listInsights().length,
        consulted: this.phase2.listInsights().filter((insight) => insight.consulted_count > 0).length,
      },
      currency: {
        validated: events.filter((event) => event.type === "validated").length,
        graduated: events.filter((event) => event.type === "graduated").length,
      },
    };
  }

  retrieveVsCurateDecision() {
    const outcomes = this.phase2.listEvents().filter((event) => event.type === "recall_outcome" && event.useful);
    const curated = new Set(outcomes.filter((event) => event.channel === "curated").map((event) => `${event.scope ?? "project"}:${event.trap_id}`));
    const preflight = new Set(outcomes.filter((event) => event.channel === "preflight").map((event) => `${event.scope ?? "project"}:${event.trap_id}`));
    const uniquePreflight = [...preflight].filter((key) => !curated.has(key));
    return uniquePreflight.length > 0
      ? { decision: "defend_preflight_budget", unique_useful_preflight: uniquePreflight.length, rationale: "Preflight recalled useful lessons that curated review did not." }
      : { decision: "reduce_default_preflight_prominence", unique_useful_preflight: 0, rationale: "Recorded preflight outcomes contributed no unique useful recall." };
  }
}

type Phase2Kind = Extract<CandidateKind, "project_convention" | "docs_guidance" | "search_eval_case" | "insight">;

function isPhase2Kind(kind: CandidateKind | undefined): kind is Phase2Kind {
  return kind === "project_convention" || kind === "docs_guidance" || kind === "search_eval_case" || kind === "insight";
}

function phase2Kind(candidate: CandidateTrap): Phase2Kind {
  const kind = candidate.candidate_kind;
  if (!isPhase2Kind(kind)) {
    throw new Error(`Candidate ${candidate.id} is not a committable Phase 2 destination.`);
  }
  return kind;
}

function requiredText(value: unknown, field: string): string {
  const text = optionalText(value);
  if (!text) throw new Error(`${field} is required.`);
  return text;
}
function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function recordValue(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  return value as Record<string, unknown>;
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}
