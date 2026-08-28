import { createHash } from "node:crypto";
import type { CandidateKind } from "../domain/candidate";
import {
  FEEDBACK_DETAILS,
  FEEDBACK_OUTCOMES,
  FEEDBACK_SHAPES,
  IMPROVER_VERSION,
  METRIC_DIRECTIONS,
  REVIEWER_ROLES,
  candidateKindForFeedbackShape,
  type BehaviorOutcome,
  type FeedbackDetail,
  type FeedbackEvent,
  type FeedbackLesson,
  type FeedbackResolution,
  type FeedbackShape,
  type MetricDirection,
  type ReviewerRole,
} from "../domain/improver";
import type { CandidateTrap } from "../domain/session";
import type { TrapOperations } from "./trap-operations";
import { candidateContentHash } from "./candidate-identity";
import { excerpt, redact } from "./learning-redaction";
import { capturedTrapInput } from "./session-capture";
import { SessionOperations } from "./session-operations";
import { SessionStore } from "./session-store";
import { ImproverStore, type FeedbackResolutionBatch } from "./improver-store";
import { sanitizeSourceRef } from "./source-ref";
import { parseSkillName } from "./skill-artifact";
import { uniqueStrings } from "./string-list";

const DEFAULT_MIN_SIGNAL_WEIGHT = 3;
const WORKFLOW_MIN_EVENTS = 2;
const WORKFLOW_MIN_DISTINCT_REFS = 2;
const WORKFLOW_MIN_SIGNAL_WEIGHT = 4;
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const METRIC = /^[a-z0-9][a-z0-9_.:-]{0,79}$/;

type CandidateDraft = {
  trap: CandidateTrap["trap"];
  candidate_kind: CandidateKind;
  source_agent: string;
  rationale: string;
  source_manifest_refs: string[];
  destination_payload?: Record<string, unknown>;
};

export type ImproverGroup = {
  pattern_key: string;
  event_ids: string[];
  event_count: number;
  signal_weight: number;
  distinct_source_refs: number;
  source_refs: string[];
  shapes: FeedbackShape[];
  variant_count: number;
  candidate_kind: CandidateKind | null;
  eligible: boolean;
  blockers: string[];
  candidate_preview: CandidateDraft | null;
};

export class ImproverOperations {
  private readonly state: ImproverStore;
  private readonly sessions: SessionOperations;

  constructor(private readonly projectRoot: string, traps: TrapOperations) {
    this.state = new ImproverStore(projectRoot);
    this.sessions = new SessionOperations(new SessionStore(projectRoot), traps);
  }

  capture(input: Record<string, unknown>, now = new Date()) {
    const event = feedbackEventFromInput(input, now);
    const recorded = this.state.recordFeedback(event);
    return {
      success: true,
      duplicate: recorded.duplicate,
      deleted: recorded.deleted,
      event: recorded.event,
      tombstone: recorded.tombstone,
      durable_destination_writes: 0,
      next_action: recorded.deleted ? undefined : { command: "codetrap improver run --json" },
    };
  }

  events(status: "pending" | "handled" | "all" = "pending") {
    const events = this.state.listFeedback().filter((event) => {
      if (status === "all") return true;
      return status === "pending" ? event.resolution === null : event.resolution !== null;
    });
    return { success: true, status, count: events.length, events };
  }

  delete(eventId: string, apply = false) {
    const id = requiredText(eventId, "feedback event id", 100);
    const result = this.state.deleteFeedback(id, apply);
    const event = result.event;
    return {
      success: true,
      applied: result.applied,
      duplicate: result.duplicate,
      event: event ? {
        id: event.id,
        pattern_key: event.lesson.key,
        source: event.source,
        captured_at: event.captured_at,
        resolution: event.resolution,
      } : null,
      tombstone: result.tombstone,
      deleted_excerpts: result.applied && !result.duplicate
        ? ["agent_output", "human_feedback", "final_change", "lesson details"]
        : [],
      durable_destination_writes: 0,
      next_action: apply ? undefined : { command: `codetrap improver delete ${id} --apply --json` },
    };
  }

  run(options: { apply?: boolean; minSignalWeight?: number; now?: Date } = {}) {
    const minSignalWeight = positiveInteger(
      options.minSignalWeight ?? DEFAULT_MIN_SIGNAL_WEIGHT,
      "min signal weight"
    );
    const pending = this.state.listFeedback().filter((event) => event.resolution === null);
    const groups = analyzeFeedbackGroups(pending, minSignalWeight);
    const base = {
      success: true,
      applied: options.apply === true,
      min_signal_weight: minSignalWeight,
      pending_event_count: pending.length,
      groups: groups.map(publicGroup),
      durable_destination_writes: 0,
    };
    if (!options.apply) {
      return {
        ...base,
        staged: [],
        existing: [],
        suppressed: [],
        next_action: groups.some((group) => group.eligible)
          ? { command: `codetrap improver run --min-signal-weight ${minSignalWeight} --apply --json` }
          : undefined,
      };
    }

    const eligible = groups.filter((group) => group.eligible && group.candidate_preview);
    const staged: Array<Record<string, unknown>> = [];
    const existing: Array<Record<string, unknown>> = [];
    const suppressed: Array<Record<string, unknown>> = [];
    const resolutions: FeedbackResolutionBatch[] = [];

    this.sessions.withCandidateCorpus((corpus) => {
      let batchSession: ReturnType<SessionOperations["startBatchSession"]> = null;
      try {
        for (const group of eligible) {
          const draft = group.candidate_preview!;
          const hash = candidateContentHash({
            trap: draft.trap,
            candidate_kind: draft.candidate_kind,
            destination_payload: draft.destination_payload,
          });
          const duplicate = findExistingCandidate(corpus, hash);
          if (duplicate) {
            const committed = duplicate.candidate.delivery_state === "committed"
              || duplicate.candidate.status === "accepted";
            const status = committed ? "already_committed" : "existing";
            existing.push({
              pattern_key: group.pattern_key,
              status,
              session_id: duplicate.session_id,
              candidate_id: duplicate.candidate.id,
              candidate_kind: draft.candidate_kind,
            });
            resolutions.push(resolutionBatch(group, {
              status,
              session_id: duplicate.session_id,
              candidate_id: duplicate.candidate.id,
              candidate_kind: draft.candidate_kind,
              note: committed
                ? "An identical candidate is already committed; no destination was modified."
                : "An identical candidate already exists in the review inbox.",
            }));
            continue;
          }

          const groupEvents = eventsForGroup(pending, group);
          // Create the batch lazily. A concurrent Improver may have staged the
          // same hash while this process waited for the session lock; duplicate
          // groups should not leave an empty review session behind.
          batchSession ??= this.sessions.startBatchSession(
            `feedback improver ${options.now?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)}`
          );
          const captured = this.sessions.captureCandidate({
            goal: `feedback improver: ${group.pattern_key}`,
            trap: draft.trap as unknown as Record<string, unknown>,
            kind: "review",
            relatedFiles: uniqueStrings(groupEvents.flatMap((event) => event.lesson.related_files)),
            sourceRef: `improver:${group.pattern_key}`,
            evidenceNote: feedbackEvidenceNote(groupEvents),
            candidateKind: draft.candidate_kind,
            sourceAgent: draft.source_agent,
            destinationHint: draft.candidate_kind,
            rationale: draft.rationale,
            sourceManifestRefs: draft.source_manifest_refs,
            destinationPayload: draft.destination_payload,
          });
          if (captured.suppressed) {
            suppressed.push({
              pattern_key: group.pattern_key,
              fingerprint: captured.fingerprint,
              reason: captured.suppression.reason,
            });
            resolutions.push(resolutionBatch(group, {
              status: "suppressed",
              session_id: null,
              candidate_id: null,
              candidate_kind: draft.candidate_kind,
              note: "The user previously suppressed this lesson; no candidate was staged.",
            }));
            continue;
          }
          corpus.push({ session_id: captured.session.id, candidate: captured.candidate });
          staged.push({
            pattern_key: group.pattern_key,
            session_id: captured.session.id,
            candidate_id: captured.candidate.id,
            candidate_kind: captured.candidate.candidate_kind,
            content_hash: captured.candidate.content_hash,
          });
          resolutions.push(resolutionBatch(group, {
            status: "staged",
            session_id: captured.session.id,
            candidate_id: captured.candidate.id,
            candidate_kind: draft.candidate_kind,
            note: "Staged in the Candidate Inbox; human approval is still required.",
          }));
        }
      } finally {
        if (batchSession) this.sessions.closeSession(batchSession.id, false);
      }
    });

    const resolution = this.state.resolveFeedback(resolutions, options.now ?? new Date());
    const first = staged[0] ?? existing[0];
    return {
      ...base,
      staged,
      existing,
      suppressed,
      concurrently_deleted_event_ids: resolution.tombstoned_event_ids,
      next_action: first && typeof first.session_id === "string"
        ? { command: `codetrap session candidates ${first.session_id} --json` }
        : undefined,
    };
  }

  outcome(input: Record<string, unknown>, now = new Date()) {
    const outcome = behaviorOutcomeFromInput(input, now);
    const recorded = this.state.recordOutcome(outcome);
    return { success: true, duplicate: recorded.duplicate, outcome: recorded.outcome };
  }

  metrics(minSignalWeight = DEFAULT_MIN_SIGNAL_WEIGHT) {
    const events = this.state.listFeedback();
    const pending = events.filter((event) => event.resolution === null);
    const groups = analyzeFeedbackGroups(pending, positiveInteger(minSignalWeight, "min signal weight"));
    const outcomes = this.state.listOutcomes();
    const tombstones = this.state.listTombstones();
    return {
      success: true,
      feedback: {
        total: events.length,
        pending: pending.length,
        handled: events.length - pending.length,
        redactions: events.reduce((sum, event) => sum + event.redactions.total, 0),
        by_source: counts(events.map((event) => event.source)),
        deleted: tombstones.length,
      },
      improver: {
        pending_groups: groups.length,
        eligible_groups: groups.filter((group) => group.eligible).length,
        blocked_groups: groups.filter((group) => !group.eligible).length,
        staged_candidates: new Set(events
          .filter((event) => event.resolution?.status === "staged")
          .map((event) => `${event.resolution?.session_id}/${event.resolution?.candidate_id}`)).size,
        by_destination: counts(events
          .map((event) => event.resolution?.candidate_kind)
          .filter((kind): kind is CandidateKind => Boolean(kind))),
      },
      behavior_outcomes: {
        total: outcomes.length,
        improved: outcomes.filter((outcome) => outcome.result === "improved").length,
        unchanged: outcomes.filter((outcome) => outcome.result === "unchanged").length,
        regressed: outcomes.filter((outcome) => outcome.result === "regressed").length,
        records: outcomes,
      },
    };
  }
}

export function analyzeFeedbackGroups(
  events: FeedbackEvent[],
  minSignalWeight = DEFAULT_MIN_SIGNAL_WEIGHT
): ImproverGroup[] {
  const grouped = new Map<string, FeedbackEvent[]>();
  for (const event of events) {
    const group = grouped.get(event.lesson.key) ?? [];
    group.push(event);
    grouped.set(event.lesson.key, group);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, groupEvents]) => analyzeGroup(key, groupEvents, minSignalWeight));
}

function analyzeGroup(key: string, events: FeedbackEvent[], minSignalWeight: number): ImproverGroup {
  const ordered = [...events].sort((left, right) =>
    right.signal_weight - left.signal_weight
      || right.occurred_at.localeCompare(left.occurred_at)
      || left.id.localeCompare(right.id)
  );
  const canonical = ordered[0];
  const shapes = uniqueStrings(events.map((event) => event.lesson.shape)) as FeedbackShape[];
  const refs = uniqueStrings(events.map((event) => event.source_ref));
  const signalWeight = events.reduce((sum, event) => sum + event.signal_weight, 0);
  const blockers: string[] = [];
  if (signalWeight < minSignalWeight) {
    blockers.push(`signal_weight ${signalWeight} is below the required ${minSignalWeight}`);
  }
  if (shapes.length !== 1) {
    blockers.push(`incompatible feedback shapes share pattern key ${key}: ${shapes.join(", ")}`);
  }
  const shape = shapes.length === 1 ? shapes[0] : null;
  if (shape === "workflow") {
    if (events.length < WORKFLOW_MIN_EVENTS) blockers.push(`workflow skills require at least ${WORKFLOW_MIN_EVENTS} feedback events`);
    if (refs.length < WORKFLOW_MIN_DISTINCT_REFS) blockers.push(`workflow skills require at least ${WORKFLOW_MIN_DISTINCT_REFS} distinct source refs`);
    if (signalWeight < WORKFLOW_MIN_SIGNAL_WEIGHT) blockers.push(`workflow skills require signal_weight ${WORKFLOW_MIN_SIGNAL_WEIGHT}`);
    if (!canonical.lesson.why) blockers.push("workflow skills require lesson.why");
    if (canonical.lesson.steps.length === 0) blockers.push("workflow skills require at least one lesson.steps item");
  }
  if ((shape === "docs" || shape === "evaluation") && payloadVariants(events) > 1) {
    blockers.push(`${shape} feedback has incompatible destination payloads`);
  }

  let draft: CandidateDraft | null = null;
  if (shape) {
    try {
      draft = candidateDraftForGroup(canonical, events, signalWeight, refs);
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : String(error));
    }
  }
  return {
    pattern_key: key,
    event_ids: events.map((event) => event.id).sort(),
    event_count: events.length,
    signal_weight: signalWeight,
    distinct_source_refs: refs.length,
    source_refs: refs,
    shapes,
    variant_count: lessonVariants(events),
    candidate_kind: shape ? candidateKindForFeedbackShape(shape) : null,
    eligible: blockers.length === 0 && draft !== null,
    blockers,
    candidate_preview: draft,
  };
}

function candidateDraftForGroup(
  canonical: FeedbackEvent,
  events: FeedbackEvent[],
  signalWeight: number,
  refs: string[]
): CandidateDraft {
  const lesson = canonical.lesson;
  const kind = candidateKindForFeedbackShape(lesson.shape);
  const destinationPayload = destinationPayloadForLesson(lesson, canonical, refs);
  const trap = capturedTrapInput({
    title: lesson.title,
    category: lesson.category,
    scope: "project",
    context: lesson.trigger,
    mistake: lesson.mistake,
    fix: lesson.fix,
    severity: lesson.severity,
    tags: uniqueStrings([...lesson.tags, "feedback-improver", lesson.shape]),
    path_globs: lesson.path_globs,
    module: lesson.module,
    owner: lesson.owner,
  });
  const agents = uniqueStrings(events.map((event) => event.source_agent));
  const why = lesson.why ? ` Why: ${lesson.why}` : "";
  return {
    trap,
    candidate_kind: kind,
    source_agent: agents.length === 1 ? agents[0] : "multiple",
    rationale: `${events.length} correlated feedback event(s) contributed signal_weight ${signalWeight} across ${refs.length} source ref(s).${why}`,
    source_manifest_refs: refs,
    ...(destinationPayload ? { destination_payload: destinationPayload } : {}),
  };
}

function destinationPayloadForLesson(
  lesson: FeedbackLesson,
  canonical: FeedbackEvent,
  refs: string[]
): Record<string, unknown> | undefined {
  switch (lesson.shape) {
    case "pitfall":
      return undefined;
    case "convention":
      return {
        section_id: lesson.key,
        title: lesson.title,
        content: principleText(lesson),
      };
    case "workflow":
      return generatedSkillPayload(lesson);
    case "evaluation": {
      const payload = requiredRecord(lesson.destination_payload, "lesson.destination_payload");
      return { case: requiredRecord(payload.case, "lesson.destination_payload.case") };
    }
    case "docs": {
      const payload = requiredRecord(lesson.destination_payload, "lesson.destination_payload");
      return {
        path: requiredText(payload.path, "lesson.destination_payload.path", 300),
        section_id: lesson.key,
        title: lesson.title,
        content: principleText(lesson),
      };
    }
    case "insight":
      return {
        title: lesson.title,
        summary: lesson.why ?? lesson.trigger,
        body: [
          `${lesson.trigger} -> ${lesson.mistake} -> ${lesson.fix}`,
          "",
          `Why: ${lesson.why ?? canonical.human_feedback}`,
          "",
          `Example: ${canonical.final_change ?? canonical.human_feedback}`,
        ].join("\n"),
        tags: lesson.tags,
        source_refs: refs,
      };
  }
}

function generatedSkillPayload(lesson: FeedbackLesson): Record<string, unknown> {
  const name = parseSkillName(lesson.skill_name ?? lesson.key, "workflow lesson.skill_name");
  const steps = lesson.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const skillMd = [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(`Use when ${lesson.trigger}`)}`,
    "---",
    "",
    `# ${lesson.title}`,
    "",
    "## Principle",
    "",
    lesson.fix,
    "",
    "## Why",
    "",
    lesson.why ?? "",
    "",
    "## Workflow",
    "",
    steps,
    "",
    "## Avoid",
    "",
    lesson.mistake,
    "",
  ].join("\n");
  const openaiYaml = [
    "interface:",
    `  display_name: ${JSON.stringify(lesson.title)}`,
    `  short_description: ${JSON.stringify(shortText(lesson.fix, 100))}`,
    `  default_prompt: ${JSON.stringify(`Use $${name} to apply this reviewed workflow.`)}`,
    "",
  ].join("\n");
  return { name, files: { "SKILL.md": skillMd, "agents/openai.yaml": openaiYaml } };
}

function feedbackEventFromInput(input: Record<string, unknown>, now: Date): FeedbackEvent {
  const redactions = redactionAccumulator();
  const source = slug(input.source, "source", SOURCE, 64);
  const sourceRef = safeSourceRef(input.source_ref, redactions);
  const externalId = optionalRedactedText(input.external_id, "external_id", redactions, 256, false);
  const occurredAt = isoDate(input.occurred_at, now, "occurred_at");
  const reviewerRole = enumValue(input.reviewer_role, REVIEWER_ROLES, "unknown", "reviewer_role") as ReviewerRole;
  const detail = enumValue(input.feedback_detail, FEEDBACK_DETAILS, "reasoned", "feedback_detail") as FeedbackDetail;
  const outcome = enumValue(input.outcome, FEEDBACK_OUTCOMES, "unknown", "outcome") as FeedbackEvent["outcome"];
  const agentOutput = redactedText(input.agent_output, "agent_output", redactions, 500, true);
  const humanFeedback = redactedText(input.human_feedback, "human_feedback", redactions, 500, true);
  const finalChange = optionalRedactedText(input.final_change, "final_change", redactions, 500, true);
  const lesson = feedbackLesson(input.lesson, redactions);
  const normalized = {
    external_id: externalId,
    occurred_at: occurredAt,
    source,
    source_ref: sourceRef,
    run_id: optionalRedactedText(input.run_id, "run_id", redactions, 200, false),
    source_agent: optionalRedactedText(input.source_agent, "source_agent", redactions, 80, false) ?? "unknown",
    reviewer_role: reviewerRole,
    feedback_detail: detail,
    outcome,
    agent_output: agentOutput,
    human_feedback: humanFeedback,
    final_change: finalChange,
    lesson,
  };
  // When a caller omits occurred_at, retries should stay idempotent even
  // though the first capture time and the retry time differ. An explicit
  // occurred_at remains material because it identifies a different event.
  const contentHash = digest(stableJson({
    ...normalized,
    occurred_at: input.occurred_at === undefined || input.occurred_at === null
      || String(input.occurred_at).trim() === ""
      ? null
      : occurredAt,
  }));
  const id = `fb-${digest(externalId ? `${source}\0${externalId}` : contentHash).slice(0, 16)}`;
  return {
    version: IMPROVER_VERSION,
    id,
    content_hash: contentHash,
    captured_at: now.toISOString(),
    ...normalized,
    signal_weight: feedbackSignalWeight(detail, reviewerRole, finalChange),
    redactions: { total: redactions.total, counts: redactions.counts },
    resolution: null,
  };
}

function feedbackLesson(value: unknown, redactions: RedactionAccumulator): FeedbackLesson {
  const input = requiredRecord(value, "lesson");
  const shape = enumValue(input.shape, FEEDBACK_SHAPES, undefined, "lesson.shape") as FeedbackShape;
  const key = slug(input.key, "lesson.key", KEY, 80);
  const trap = capturedTrapInput({
    title: redactedText(input.title, "lesson.title", redactions, 200, false),
    category: optionalRedactedText(input.category, "lesson.category", redactions, 40, false) ?? (shape === "convention" ? "convention" : "other"),
    scope: "project",
    context: redactedText(input.trigger, "lesson.trigger", redactions, 1_000, false),
    mistake: redactedText(input.mistake, "lesson.mistake", redactions, 1_000, false),
    fix: redactedText(input.fix, "lesson.fix", redactions, 2_000, false),
    severity: optionalRedactedText(input.severity, "lesson.severity", redactions, 40, false) ?? "warning",
    tags: redactedStringArray(input.tags, "lesson.tags", redactions, 40),
    path_globs: redactedStringArray(input.path_globs, "lesson.path_globs", redactions, 300),
    module: optionalRedactedText(input.module, "lesson.module", redactions, 120, false),
    owner: optionalRedactedText(input.owner, "lesson.owner", redactions, 120, false),
  });
  return {
    key,
    shape,
    title: trap.title,
    trigger: trap.context,
    mistake: trap.mistake,
    fix: trap.fix,
    why: optionalRedactedText(input.why, "lesson.why", redactions, 1_500, false),
    steps: redactedStringArray(input.steps, "lesson.steps", redactions, 1_000),
    category: trap.category,
    severity: trap.severity ?? "warning",
    tags: trap.tags ?? [],
    path_globs: trap.path_globs ?? [],
    related_files: redactedStringArray(input.related_files, "lesson.related_files", redactions, 300),
    module: trap.module ?? null,
    owner: trap.owner ?? null,
    skill_name: optionalSlug(input.skill_name, "lesson.skill_name", KEY, 64),
    destination_payload: destinationPayloadInput(shape, input.destination_payload, redactions),
  };
}

function destinationPayloadInput(
  shape: FeedbackShape,
  value: unknown,
  redactions: RedactionAccumulator
): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  const payload = requiredRecord(value, "lesson.destination_payload");
  if (shape === "docs") {
    return { path: redactedText(payload.path, "lesson.destination_payload.path", redactions, 300, false) };
  }
  if (shape === "evaluation") {
    return { case: sanitizedJson(requiredRecord(payload.case, "lesson.destination_payload.case"), redactions, 0) };
  }
  throw new Error("lesson.destination_payload is supported only for docs and evaluation feedback shapes");
}

function behaviorOutcomeFromInput(input: Record<string, unknown>, now: Date): BehaviorOutcome {
  const redactions = redactionAccumulator();
  const patternKey = slug(input.pattern_key, "pattern_key", KEY, 80);
  const metric = slug(input.metric, "metric", METRIC, 80);
  const direction = enumValue(input.direction, METRIC_DIRECTIONS, undefined, "direction") as MetricDirection;
  const beforeValue = finiteNumber(input.before_value, "before_value");
  const afterValue = finiteNumber(input.after_value, "after_value");
  const beforeSamples = positiveInteger(input.before_samples, "before_samples");
  const afterSamples = positiveInteger(input.after_samples, "after_samples");
  const sourceRef = safeSourceRef(input.source_ref, redactions);
  const normalized = {
    pattern_key: patternKey,
    metric,
    direction,
    before_value: beforeValue,
    after_value: afterValue,
    before_samples: beforeSamples,
    after_samples: afterSamples,
    source_ref: sourceRef,
    session_id: optionalText(input.session_id, "session_id", 200),
    candidate_id: optionalText(input.candidate_id, "candidate_id", 100),
    note: optionalRedactedText(input.note, "note", redactions, 500, true),
  };
  const contentHash = digest(stableJson(normalized));
  const improved = direction === "higher_is_better" ? afterValue > beforeValue : afterValue < beforeValue;
  const regressed = direction === "higher_is_better" ? afterValue < beforeValue : afterValue > beforeValue;
  return {
    version: IMPROVER_VERSION,
    id: `out-${contentHash.slice(0, 16)}`,
    content_hash: contentHash,
    recorded_at: now.toISOString(),
    ...normalized,
    result: improved ? "improved" : regressed ? "regressed" : "unchanged",
  };
}

function publicGroup(group: ImproverGroup) {
  return {
    pattern_key: group.pattern_key,
    event_count: group.event_count,
    signal_weight: group.signal_weight,
    distinct_source_refs: group.distinct_source_refs,
    source_refs: group.source_refs,
    shapes: group.shapes,
    variant_count: group.variant_count,
    candidate_kind: group.candidate_kind,
    eligible: group.eligible,
    blockers: group.blockers,
    candidate_preview: group.candidate_preview,
  };
}

function resolutionBatch(
  group: ImproverGroup,
  resolution: Omit<FeedbackResolution, "resolved_at">
): FeedbackResolutionBatch {
  return { event_ids: group.event_ids, resolution };
}

function findExistingCandidate(
  corpus: { session_id: string; candidate: CandidateTrap }[],
  contentHash: string
) {
  return corpus.find(({ candidate }) => {
    if (candidate.review_decision === "rejected" || candidate.review_decision === "suppressed") return false;
    return candidateContentHash(candidate) === contentHash;
  });
}

function eventsForGroup(events: FeedbackEvent[], group: ImproverGroup): FeedbackEvent[] {
  const ids = new Set(group.event_ids);
  return events.filter((event) => ids.has(event.id));
}

function feedbackEvidenceNote(events: FeedbackEvent[]): string {
  return excerpt(events.map((event) =>
    `${event.source_ref}: ${event.human_feedback}${event.final_change ? ` Final change: ${event.final_change}` : ""}`
  ).join(" | "), 500);
}

function principleText(lesson: FeedbackLesson): string {
  return [
    `Principle: ${lesson.fix}`,
    `Applies when: ${lesson.trigger}`,
    `Why: ${lesson.why ?? lesson.mistake}`,
  ].join("\n\n");
}

function feedbackSignalWeight(
  detail: FeedbackDetail,
  reviewerRole: ReviewerRole,
  finalChange: string | null
): number {
  return (detail === "reasoned" ? 2 : 1)
    + (reviewerRole === "maintainer" || reviewerRole === "domain_expert" ? 1 : 0)
    + (finalChange ? 1 : 0);
}

function lessonVariants(events: FeedbackEvent[]): number {
  return new Set(events.map((event) => stableJson({
    title: event.lesson.title,
    trigger: event.lesson.trigger,
    mistake: event.lesson.mistake,
    fix: event.lesson.fix,
    why: event.lesson.why,
    steps: event.lesson.steps,
  }))).size;
}

function payloadVariants(events: FeedbackEvent[]): number {
  return new Set(events.map((event) => stableJson(event.lesson.destination_payload))).size;
}

function counts(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

type RedactionAccumulator = { counts: Record<string, number>; total: number };

function redactionAccumulator(): RedactionAccumulator {
  return { counts: {}, total: 0 };
}

function addRedactions(accumulator: RedactionAccumulator, result: ReturnType<typeof redact>): void {
  accumulator.total += result.total;
  for (const [label, count] of Object.entries(result.counts)) {
    accumulator.counts[label] = (accumulator.counts[label] ?? 0) + count;
  }
}

function redactedText(
  value: unknown,
  field: string,
  accumulator: RedactionAccumulator,
  limit: number,
  collapse: boolean
): string {
  const text = requiredText(value, field, 100_000);
  const result = redact(text);
  addRedactions(accumulator, result);
  const bounded = collapse ? excerpt(result.text, limit) : shortText(result.text.trim(), limit);
  if (!bounded) throw new Error(`${field} is required.`);
  return bounded;
}

function optionalRedactedText(
  value: unknown,
  field: string,
  accumulator: RedactionAccumulator,
  limit: number,
  collapse: boolean
): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return redactedText(value, field, accumulator, limit, collapse);
}

function redactedStringArray(
  value: unknown,
  field: string,
  accumulator: RedactionAccumulator,
  itemLimit: number
): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  if (value.length > 100) throw new Error(`${field} may contain at most 100 items.`);
  return uniqueStrings(value.map((item, index) =>
    redactedText(item, `${field}[${index}]`, accumulator, itemLimit, false)
  ));
}

function safeSourceRef(value: unknown, accumulator: RedactionAccumulator): string {
  const text = requiredText(value, "source_ref", 1_000);
  const result = sanitizeSourceRef(text);
  addRedactions(accumulator, result);
  return result.text;
}

function sanitizedJson(value: unknown, accumulator: RedactionAccumulator, depth: number): unknown {
  if (depth > 6) throw new Error("lesson.destination_payload.case is nested too deeply.");
  if (typeof value === "string") return redactedText(value, "lesson.destination_payload.case", accumulator, 500, false);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    if (value.length > 100) throw new Error("lesson.destination_payload.case arrays may contain at most 100 items.");
    return value.map((item) => sanitizedJson(item, accumulator, depth + 1));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 100) throw new Error("lesson.destination_payload.case objects may contain at most 100 fields.");
    return Object.fromEntries(entries.map(([key, item]) => [
      redactedText(key, "lesson.destination_payload.case key", accumulator, 100, false),
      sanitizedJson(item, accumulator, depth + 1),
    ]));
  }
  throw new Error("lesson.destination_payload.case contains an unsupported value.");
}

function enumValue(
  value: unknown,
  allowed: readonly string[],
  fallback: string | undefined,
  field: string
): string {
  const normalized = value === undefined || value === null || String(value).trim() === ""
    ? fallback
    : String(value).trim().toLowerCase();
  if (!normalized || !allowed.includes(normalized)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}.`);
  }
  return normalized;
}

function slug(value: unknown, field: string, pattern: RegExp, limit: number): string {
  const text = requiredText(value, field, limit).toLowerCase();
  if (!pattern.test(text)) throw new Error(`${field} has an unsupported format.`);
  return text;
}

function optionalSlug(value: unknown, field: string, pattern: RegExp, limit: number): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return slug(value, field, pattern, limit);
}

function requiredText(value: unknown, field: string, limit = 10_000): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${field} is required.`);
  if (text.length > limit) throw new Error(`${field} exceeds ${limit} characters.`);
  return text;
}

function optionalText(value: unknown, field: string, limit = 10_000): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return requiredText(value, field, limit);
}

function requiredRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive JSON integer.`);
  }
  return value;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite JSON number.`);
  }
  return value;
}

function isoDate(value: unknown, fallback: Date, field: string): string {
  if (value === undefined || value === null || String(value).trim() === "") return fallback.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} must be an ISO-like date.`);
  return parsed.toISOString();
}

function shortText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
