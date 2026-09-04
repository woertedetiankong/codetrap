import { Database, type SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  EVIDENCE_CLASSES,
  LEARNING_FEEDBACK_VALUES,
  LEARNING_STATUSES,
  OBSERVATION_EVENT_TYPES,
  OBSERVATION_EVENT_VERSION,
  OBSERVATION_SENSITIVITIES,
  RUN_COMPLETENESS,
  RUN_STATUSES,
  SOURCE_CLIENTS,
  TRAP_FEEDBACK_VALUES,
  VALIDATION_KINDS,
  VALIDATION_STATUSES,
  type EvidenceClass,
  type JsonObject,
  type JsonValue,
  type ObservationEvent,
  type ObservationEventType,
  type ObservationEvalCandidateGroupProjection,
  type ObservationEvalCandidateProjection,
  type ObservationEvalsProjection,
  type ObservationEvidenceCounts,
  type ObservationOverviewProjection,
  type RunCompletedPayload,
  type RunObservationProjection,
  type RunStartedPayload,
  type SearchReceipt,
  type SourceClient,
  type TrapFeedback,
  type TrapFeedbackPayload,
  type TrapMissedPayload,
  type ValidationReceipt,
} from "../domain/observation";
import { CODETRAP_DIR } from "./constants";
import { ensureProjectIdentity, readProjectIdentity } from "./project-identity";

export const OBSERVATION_LEDGER_SCHEMA_VERSION = 1;
export const OBSERVATION_DIR = "observations";
export const OBSERVATION_LEDGER_FILE = "ledger.sqlite";

export type ObservationAppendResult = "inserted" | "duplicate";
export type UnsequencedObservationEvent = Omit<ObservationEvent, "seq">;

type ObservationRow = {
  version: number;
  id: string;
  project_id: string;
  run_id: string | null;
  actor_ref: string | null;
  device_id: string;
  seq: number;
  occurred_at: string;
  recorded_at: string;
  type: string;
  evidence_class: string;
  sensitivity: string;
  attributes_json: string;
  body_ref: string | null;
  source_ref: string | null;
};

function queryAll<T>(db: Database, sql: string, ...bindings: SQLQueryBindings[]): T[] {
  const statement = db.prepare(sql);
  try {
    return statement.all(...bindings) as T[];
  } finally {
    statement.finalize();
  }
}

function queryOne<T>(db: Database, sql: string, ...bindings: SQLQueryBindings[]): T | null {
  const statement = db.prepare(sql);
  try {
    return statement.get(...bindings) as T | null;
  } finally {
    statement.finalize();
  }
}

export function observationLedgerPath(projectRoot: string): string {
  return join(resolve(projectRoot), CODETRAP_DIR, OBSERVATION_DIR, OBSERVATION_LEDGER_FILE);
}

export function openObservationLedger(projectRoot: string): ObservationLedger {
  const root = resolve(projectRoot);
  const identity = ensureProjectIdentity(root);
  const path = observationLedgerPath(root);
  mkdirSync(dirname(path), { recursive: true });
  return new ObservationLedger(openLedgerDatabase(path), identity.id, path);
}

/**
 * Opens an existing Observation Ledger without creating project identity,
 * directories, schema, WAL files, or other persistent state. Web GET routes
 * use this boundary so merely viewing Impact never enables observation.
 */
export function openObservationLedgerReadOnly(projectRoot: string): ObservationLedger | null {
  const root = resolve(projectRoot);
  const path = observationLedgerPath(root);
  if (!existsSync(path)) return null;
  const identity = readProjectIdentity(root);
  if (!identity) {
    throw new Error(`Observation Ledger ${path} exists without a project identity.`);
  }
  return new ObservationLedger(openReadOnlyLedgerDatabase(path), identity.id, path);
}

export class ObservationLedger {
  constructor(
    private readonly db: Database,
    readonly projectId: string,
    readonly path: string
  ) {}

  close(): void {
    this.db.close(true);
  }

  append(input: unknown): ObservationAppendResult {
    const event = validateObservationEvent(input);
    this.assertProject(event);
    return this.appendValidated(event);
  }

  appendMany(inputs: readonly unknown[]): { inserted: number; duplicates: number } {
    const events = inputs.map((input) => validateObservationEvent(input));
    for (const event of events) this.assertProject(event);

    return this.db.transaction(() => {
      let inserted = 0;
      let duplicates = 0;
      for (const event of events) {
        if (this.appendValidated(event) === "inserted") inserted += 1;
        else duplicates += 1;
      }
      return { inserted, duplicates };
    }).immediate();
  }

  appendNext(input: unknown): { event: ObservationEvent; result: ObservationAppendResult } {
    const batch = this.appendNextMany([input]);
    return {
      event: batch.events[0],
      result: batch.inserted === 1 ? "inserted" : "duplicate",
    };
  }

  appendNextMany(inputs: readonly unknown[]): {
    events: ObservationEvent[];
    inserted: number;
    duplicates: number;
  } {
    const unsequenced = inputs.map(validateUnsequencedObservationEvent);
    for (const event of unsequenced) this.assertProject(event);

    return this.db.transaction(() => {
      const nextByRun = new Map<string, number>();
      const events: ObservationEvent[] = [];
      let inserted = 0;
      let duplicates = 0;

      for (const input of unsequenced) {
        const existing = this.getEvent(input.id);
        if (existing) {
          const retry = validateObservationEvent({ ...input, seq: existing.seq });
          if (canonicalJson(existing) !== canonicalJson(retry)) {
            throw new Error(`Observation event ${input.id} already exists with different content.`);
          }
          events.push(existing);
          duplicates += 1;
          continue;
        }

        const runId = input.run_id;
        if (runId === null) throw new Error("appendNext requires run_id so it can allocate a monotonic sequence.");
        let seq = nextByRun.get(runId);
        if (seq === undefined) seq = this.nextSequence(runId);
        const event = validateObservationEvent({ ...input, seq });
        const result = this.appendValidated(event);
        events.push(event);
        if (result === "inserted") inserted += 1;
        else duplicates += 1;
        nextByRun.set(runId, seq + 1);
      }

      return { events, inserted, duplicates };
    }).immediate();
  }

  listEvents(options: { runId?: string | null; limit?: number } = {}): ObservationEvent[] {
    const limit = normalizeLimit(options.limit);
    if (options.runId !== undefined) {
      const rows = options.runId === null
        ? queryAll<ObservationRow>(this.db, `SELECT ${EVENT_COLUMNS} FROM observation_events WHERE project_id = ? AND run_id IS NULL ORDER BY seq, occurred_at, id LIMIT ?`, this.projectId, limit)
        : queryAll<ObservationRow>(this.db, `SELECT ${EVENT_COLUMNS} FROM observation_events WHERE project_id = ? AND run_id = ? ORDER BY seq, occurred_at, id LIMIT ?`, this.projectId, options.runId, limit);
      return (rows as ObservationRow[]).map(eventFromRow);
    }

    const rows = queryAll<ObservationRow>(
      this.db,
      `SELECT ${EVENT_COLUMNS} FROM observation_events WHERE project_id = ? ORDER BY recorded_at, id LIMIT ?`,
      this.projectId,
      limit
    );
    return rows.map(eventFromRow);
  }

  getEvent(id: string): ObservationEvent | null {
    const row = queryOne<ObservationRow>(
      this.db,
      `SELECT ${EVENT_COLUMNS} FROM observation_events WHERE project_id = ? AND id = ?`,
      this.projectId,
      id
    );
    return row ? eventFromRow(row) : null;
  }

  listRuns(limit = 50): RunObservationProjection[] {
    const runRows = queryAll<{ run_id: string; last_recorded_at: string }>(this.db, `
      SELECT run_id, MAX(recorded_at) AS last_recorded_at
      FROM observation_events
      WHERE project_id = ? AND run_id IS NOT NULL
      GROUP BY run_id
      ORDER BY last_recorded_at DESC, run_id
      LIMIT ?
    `, this.projectId, normalizeLimit(limit));

    return runRows.map((row) => projectRun(this.eventsForRun(row.run_id)));
  }

  getRun(runId: string): RunObservationProjection | null {
    const events = this.eventsForRun(runId);
    return events.length === 0 ? null : projectRun(events);
  }

  listRunEvents(runId: string): ObservationEvent[] {
    return this.eventsForRun(runId);
  }

  overview(): ObservationOverviewProjection {
    const events = this.allEvents();
    const eventsByRun = new Map<string, ObservationEvent[]>();
    for (const event of events) {
      if (event.run_id === null) continue;
      const grouped = eventsByRun.get(event.run_id) ?? [];
      grouped.push(event);
      eventsByRun.set(event.run_id, grouped);
    }
    const runs = [...eventsByRun.values()].map(projectRun);
    const evidence = emptyEvidenceCounts();
    let searchCount = 0;
    let exposureCount = 0;
    let validationPassed = 0;
    let validationFailed = 0;
    let helpfulFeedback = 0;
    let harmfulFeedback = 0;
    let lastEventAt: string | null = null;

    for (const event of events) {
      evidence[event.evidence_class] += 1;
      if (event.type === "trap/search-completed") searchCount += 1;
      if (event.type === "trap/exposed") exposureCount += 1;
      if (event.type === "validation/completed") {
        const status = (event.attributes as ValidationReceipt).status;
        if (status === "passed") validationPassed += 1;
        if (status === "failed") validationFailed += 1;
      }
      if (event.type === "trap/feedback-recorded") {
        const feedback = (event.attributes as TrapFeedbackPayload).feedback;
        if (feedback === "helpful") helpfulFeedback += 1;
        if (feedback === "harmful") harmfulFeedback += 1;
      }
      if (lastEventAt === null || event.occurred_at > lastEventAt) lastEventAt = event.occurred_at;
    }

    return {
      project_id: this.projectId,
      total_events: events.length,
      total_runs: runs.length,
      completed_runs: runs.filter((run) => run.status === "completed").length,
      partial_or_unknown_runs: runs.filter((run) => run.completeness !== "complete").length,
      search_count: searchCount,
      exposure_count: exposureCount,
      validation_passed: validationPassed,
      validation_failed: validationFailed,
      helpful_feedback: helpfulFeedback,
      harmful_feedback: harmfulFeedback,
      last_event_at: lastEventAt,
      evidence,
    };
  }

  evals(): ObservationEvalsProjection {
    const eventsByRun = new Map<string, ObservationEvent[]>();
    for (const event of this.allEvents()) {
      if (event.run_id === null) continue;
      const grouped = eventsByRun.get(event.run_id) ?? [];
      grouped.push(event);
      eventsByRun.set(event.run_id, grouped);
    }

    // Exposure ratings fold to one current judgment per (Run, trap): a later
    // rating of the same exposure replaces the earlier one instead of being
    // counted beside it, so correcting a rating cannot inflate both the
    // numerator and the denominator of the observed rates.
    const currentExposureRating = new Map<string, {
      feedback: TrapFeedback;
      trapId: number;
      event: ObservationEvent;
      run: RunObservationProjection;
    }>();
    let supersededFeedback = 0;
    // Feedback with no trap_id cannot be folded (there is no exposure identity
    // to replace), so each one stands as its own judgment.
    let unattributedHelpfulFeedback = 0;
    let unattributedIrrelevantFeedback = 0;
    let unattributedHarmfulFeedback = 0;
    let missReports = 0;
    let validationPassed = 0;
    let validationFailed = 0;
    const evaluableRuns = new Set<string>();
    const explicitFeedbackRuns = new Set<string>();
    const missReportRuns = new Set<string>();
    const failedAfterExposureRuns = new Set<string>();
    const candidates: ObservationEvalCandidateProjection[] = [];
    const runs: RunObservationProjection[] = [];

    for (const [runId, unordered] of eventsByRun) {
      const events = [...unordered].sort(compareRunEvents);
      const run = projectRun(events);
      runs.push(run);
      let hasPriorExposure = false;

      for (const event of events) {
        if (event.type === "trap/exposed") {
          hasPriorExposure = true;
          continue;
        }
        if (event.type === "trap/feedback-recorded") {
          const value = event.attributes as TrapFeedbackPayload;
          evaluableRuns.add(runId);
          explicitFeedbackRuns.add(runId);
          if (value.feedback === "should_have_matched") {
            // A miss report names a trap that should have matched; it is not a
            // rating of an exposure, so it never joins the exposure fold.
            missReports += 1;
            missReportRuns.add(runId);
            candidates.push(observationEvalCandidate(event, run, "reported_miss", value.trap_id, null));
            continue;
          }
          if (value.trap_id === null) {
            // No exposure identity to fold on, so this judgment stands alone
            // and its finding, if any, is queued immediately.
            if (value.feedback === "helpful") {
              unattributedHelpfulFeedback += 1;
            } else if (value.feedback === "irrelevant") {
              unattributedIrrelevantFeedback += 1;
              candidates.push(observationEvalCandidate(event, run, "irrelevant_guidance", null, null));
            } else {
              unattributedHarmfulFeedback += 1;
              candidates.push(observationEvalCandidate(event, run, "harmful_guidance", null, null));
            }
            continue;
          }
          const key = exposureRatingKey(runId, value.trap_id);
          if (currentExposureRating.has(key)) supersededFeedback += 1;
          // Candidates for rated exposures are emitted from the folded value
          // after every event is seen, so a rating corrected to helpful leaves
          // the review queue instead of lingering as a stale finding.
          currentExposureRating.set(key, { feedback: value.feedback, trapId: value.trap_id, event, run });
          continue;
        }
        if (event.type === "trap/missed-reported") {
          const value = event.attributes as TrapMissedPayload;
          evaluableRuns.add(runId);
          explicitFeedbackRuns.add(runId);
          missReportRuns.add(runId);
          missReports += 1;
          candidates.push(observationEvalCandidate(event, run, "reported_miss", value.expected_trap_id, null));
          continue;
        }
        if (event.type === "validation/completed") {
          const value = event.attributes as ValidationReceipt;
          evaluableRuns.add(runId);
          if (value.status === "passed") validationPassed += 1;
          if (value.status === "failed") {
            validationFailed += 1;
            if (hasPriorExposure) {
              failedAfterExposureRuns.add(runId);
              candidates.push(observationEvalCandidate(
                event,
                run,
                "validation_failed_after_exposure",
                null,
                value.kind
              ));
            }
          }
        }
      }
    }

    let ratedHelpfulFeedback = 0;
    let ratedIrrelevantFeedback = 0;
    let ratedHarmfulFeedback = 0;
    for (const current of currentExposureRating.values()) {
      if (current.feedback === "helpful") {
        ratedHelpfulFeedback += 1;
      } else if (current.feedback === "irrelevant") {
        ratedIrrelevantFeedback += 1;
        candidates.push(observationEvalCandidate(current.event, current.run, "irrelevant_guidance", current.trapId, null));
      } else if (current.feedback === "harmful") {
        ratedHarmfulFeedback += 1;
        candidates.push(observationEvalCandidate(current.event, current.run, "harmful_guidance", current.trapId, null));
      }
    }
    const ratedExposures = currentExposureRating.size;
    const helpfulFeedback = ratedHelpfulFeedback + unattributedHelpfulFeedback;
    const irrelevantFeedback = ratedIrrelevantFeedback + unattributedIrrelevantFeedback;
    const harmfulFeedback = ratedHarmfulFeedback + unattributedHarmfulFeedback;

    candidates.sort((left, right) =>
      right.occurred_at.localeCompare(left.occurred_at) ||
      right.event_seq - left.event_seq ||
      left.id.localeCompare(right.id)
    );
    const candidateGroups = groupObservationEvalCandidates(candidates);
    const decidedValidations = validationPassed + validationFailed;
    return {
      project_id: this.projectId,
      total_runs: runs.length,
      complete_runs: runs.filter((run) => run.completeness === "complete").length,
      partial_or_unknown_runs: runs.filter((run) => run.completeness !== "complete").length,
      evaluable_runs: evaluableRuns.size,
      rated_exposures: ratedExposures,
      helpful_feedback: helpfulFeedback,
      irrelevant_feedback: irrelevantFeedback,
      harmful_feedback: harmfulFeedback,
      superseded_feedback: supersededFeedback,
      miss_reports: missReports,
      runs_with_explicit_feedback: explicitFeedbackRuns.size,
      runs_with_miss_report: missReportRuns.size,
      validation_passed: validationPassed,
      validation_failed: validationFailed,
      failed_after_exposure_runs: failedAfterExposureRuns.size,
      rates: {
        helpful: observationRate(ratedHelpfulFeedback, ratedExposures),
        noise: observationRate(ratedIrrelevantFeedback + ratedHarmfulFeedback, ratedExposures),
        miss_report: observationRate(missReportRuns.size, explicitFeedbackRuns.size),
        validation_pass: observationRate(validationPassed, decidedValidations),
      },
      candidates,
      candidate_groups: candidateGroups,
    };
  }

  private allEvents(): ObservationEvent[] {
    return queryAll<ObservationRow>(
      this.db,
      `SELECT ${EVENT_COLUMNS} FROM observation_events WHERE project_id = ? ORDER BY recorded_at, id`,
      this.projectId
    ).map(eventFromRow);
  }

  private eventsForRun(runId: string): ObservationEvent[] {
    return queryAll<ObservationRow>(
      this.db,
      `SELECT ${EVENT_COLUMNS} FROM observation_events WHERE project_id = ? AND run_id = ? ORDER BY seq, occurred_at, id`,
      this.projectId,
      runId
    ).map(eventFromRow);
  }

  private nextSequence(runId: string): number {
    const row = queryOne<{ next_seq: number }>(
      this.db,
      "SELECT COALESCE(MAX(seq), -1) + 1 AS next_seq FROM observation_events WHERE project_id = ? AND run_id = ?",
      this.projectId,
      runId
    );
    return row?.next_seq ?? 0;
  }

  private assertProject(event: { project_id: string }): void {
    if (event.project_id !== this.projectId) {
      throw new Error(`Observation project_id ${event.project_id} does not match ledger project ${this.projectId}.`);
    }
  }

  private appendValidated(event: ObservationEvent): ObservationAppendResult {
    const attributesJson = canonicalJson(event.attributes);
    const statement = this.db.prepare(`
      INSERT INTO observation_events (
        version, id, project_id, run_id, actor_ref, device_id, seq,
        occurred_at, recorded_at, type, evidence_class, sensitivity,
        attributes_json, body_ref, source_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, id) DO NOTHING
    `);
    const result = (() => {
      try {
        return statement.run(
          event.version,
          event.id,
          event.project_id,
          event.run_id,
          event.actor_ref,
          event.device_id,
          event.seq,
          event.occurred_at,
          event.recorded_at,
          event.type,
          event.evidence_class,
          event.sensitivity,
          attributesJson,
          event.body_ref,
          event.source_ref
        );
      } finally {
        statement.finalize();
      }
    })();

    if (result.changes === 1) return "inserted";
    const existing = this.getEvent(event.id);
    if (existing && canonicalJson(existing) === canonicalJson(event)) return "duplicate";
    throw new Error(`Observation event ${event.id} already exists with different content.`);
  }
}

function observationEvalCandidate(
  event: ObservationEvent,
  run: RunObservationProjection,
  reason: ObservationEvalCandidateProjection["reason"],
  trapId: number | null,
  validationKind: ObservationEvalCandidateProjection["validation_kind"]
): ObservationEvalCandidateProjection {
  return {
    id: `${run.id}:${event.seq}:${reason}`,
    run_id: run.id,
    event_seq: event.seq,
    occurred_at: event.occurred_at,
    reason,
    trap_id: trapId,
    validation_kind: validationKind,
    evidence_class: event.evidence_class,
    source_client: run.source_client,
    completeness: run.completeness,
    review_status: "review_required",
    ground_truth: "unconfirmed",
  };
}

function exposureRatingKey(runId: string, trapId: number): string {
  return `${runId}\u0000${trapId}`;
}

/**
 * Collapse candidates onto their normalized signature. Only the structural
 * identity of a finding takes part — the reason, the trap it concerns, and the
 * validation kind. Instance-specific values (Run, event seq, timestamp) are
 * deliberately excluded so the same failure recurring across many Runs is one
 * review row rather than one row per occurrence.
 */
function groupObservationEvalCandidates(
  candidates: ObservationEvalCandidateProjection[]
): ObservationEvalCandidateGroupProjection[] {
  const groups = new Map<string, ObservationEvalCandidateGroupProjection>();
  // Candidates arrive newest-first; walk oldest-first so the representative and
  // the member/run orders are stable as later occurrences accrue.
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index]!;
    const groupKey = observationEvalGroupKey(candidate);
    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, {
        group_key: groupKey,
        reason: candidate.reason,
        trap_id: candidate.trap_id,
        validation_kind: candidate.validation_kind,
        occurrence_count: 1,
        run_ids: [candidate.run_id],
        first_occurred_at: candidate.occurred_at,
        last_occurred_at: candidate.occurred_at,
        representative_id: candidate.id,
        member_ids: [candidate.id],
      });
      continue;
    }
    existing.occurrence_count += 1;
    existing.member_ids.push(candidate.id);
    existing.last_occurred_at = candidate.occurred_at;
    if (!existing.run_ids.includes(candidate.run_id)) existing.run_ids.push(candidate.run_id);
  }
  return [...groups.values()].sort((left, right) =>
    right.last_occurred_at.localeCompare(left.last_occurred_at) ||
    left.group_key.localeCompare(right.group_key)
  );
}

function observationEvalGroupKey(candidate: ObservationEvalCandidateProjection): string {
  return [
    candidate.reason,
    candidate.trap_id === null ? "-" : String(candidate.trap_id),
    candidate.validation_kind ?? "-",
  ].join("|");
}

function observationRate(numerator: number, denominator: number) {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : Math.round((numerator / denominator) * 10_000) / 10_000,
  };
}

function compareRunEvents(left: ObservationEvent, right: ObservationEvent): number {
  return left.seq - right.seq || left.occurred_at.localeCompare(right.occurred_at) || left.id.localeCompare(right.id);
}

export function validateObservationEvent(input: unknown): ObservationEvent {
  const event = plainObject(input, "Observation event");
  exactNumber(event.version, OBSERVATION_EVENT_VERSION, "version");
  validateObjectKeys(event, EVENT_KEYS, "Observation event");
  const id = nonEmptyString(event.id, "id");
  const projectId = nonEmptyString(event.project_id, "project_id");
  const runId = nullableString(event.run_id, "run_id");
  const actorRef = nullableString(event.actor_ref, "actor_ref");
  const deviceId = nonEmptyString(event.device_id, "device_id");
  const seq = nonNegativeInteger(event.seq, "seq");
  const occurredAt = isoTimestamp(event.occurred_at, "occurred_at");
  const recordedAt = isoTimestamp(event.recorded_at, "recorded_at");
  const type = enumValue(event.type, OBSERVATION_EVENT_TYPES, "type");
  const evidenceClass = enumValue(event.evidence_class, EVIDENCE_CLASSES, "evidence_class");
  const sensitivity = enumValue(event.sensitivity, OBSERVATION_SENSITIVITIES, "sensitivity");
  const attributes = validateAttributes(type, event.attributes);
  const bodyRef = nullableString(event.body_ref, "body_ref");
  const sourceRef = nullableString(event.source_ref, "source_ref");

  if (RUN_EVENT_TYPES.has(type) && runId === null) {
    throw new Error(`Observation event ${type} requires run_id.`);
  }
  if (sensitivity === "metadata" && bodyRef !== null) {
    throw new Error("Metadata observation events cannot reference sensitive body content.");
  }
  if (HUMAN_EVENT_TYPES.has(type) && evidenceClass !== "human_label") {
    throw new Error(`Observation event ${type} must use evidence_class human_label.`);
  }
  if (type === "eval/experiment-completed" && evidenceClass !== "controlled_eval") {
    throw new Error("eval/experiment-completed must use evidence_class controlled_eval.");
  }
  validateAttributeKeys(type, attributes, evidenceClass);
  if (evidenceClass === "derived_inference") validateInferenceBasis(attributes);

  return {
    version: OBSERVATION_EVENT_VERSION,
    id,
    project_id: projectId,
    run_id: runId,
    actor_ref: actorRef,
    device_id: deviceId,
    seq,
    occurred_at: occurredAt,
    recorded_at: recordedAt,
    type,
    evidence_class: evidenceClass,
    sensitivity,
    attributes: JSON.parse(canonicalJson(attributes)) as ObservationEvent["attributes"],
    body_ref: bodyRef,
    source_ref: sourceRef,
  };
}

export function validateUnsequencedObservationEvent(input: unknown): UnsequencedObservationEvent {
  const value = plainObject(input, "Unsequenced observation event");
  validateObjectKeys(value, UNSEQUENCED_EVENT_KEYS, "Unsequenced observation event");
  const validated = validateObservationEvent({ ...value, seq: 0 });
  const { seq: _seq, ...event } = validated;
  return event;
}

const EVENT_COLUMNS = [
  "version", "id", "project_id", "run_id", "actor_ref", "device_id", "seq",
  "occurred_at", "recorded_at", "type", "evidence_class", "sensitivity",
  "attributes_json", "body_ref", "source_ref",
].join(", ");

const EVENT_KEYS = new Set([
  "version", "id", "project_id", "run_id", "actor_ref", "device_id", "seq",
  "occurred_at", "recorded_at", "type", "evidence_class", "sensitivity",
  "attributes", "body_ref", "source_ref",
]);
const UNSEQUENCED_EVENT_KEYS = new Set([...EVENT_KEYS].filter((key) => key !== "seq"));

const RUN_EVENT_TYPES = new Set<ObservationEventType>([
  "run/started", "run/completed", "trap/search-completed", "trap/exposed",
  "trap/feedback-recorded", "trap/missed-reported", "validation/completed",
]);

const HUMAN_EVENT_TYPES = new Set<ObservationEventType>([
  "trap/feedback-recorded", "trap/missed-reported", "learning/status-changed",
  "learning/feedback-recorded",
]);

const ATTRIBUTE_KEYS = {
  "run/started": ["source_client", "source_session_ref", "repository_revision", "branch", "model_provider", "model_name", "completeness"],
  "run/completed": ["status", "completeness", "duration_ms", "input_tokens", "output_tokens"],
  "trap/search-completed": ["query_fingerprint", "mode", "path_hint", "module_hint", "results", "diagnostics", "duration_ms"],
  "trap/exposed": ["trap_id", "revision", "rank", "query_fingerprint"],
  "trap/feedback-recorded": ["trap_id", "revision", "feedback", "note_fingerprint"],
  "trap/missed-reported": ["query_fingerprint", "expected_trap_id"],
  "validation/completed": ["kind", "command_fingerprint", "status", "passed", "failed", "duration_ms"],
  "learning/insight-shelved": ["insight_id", "collection_id"],
  "learning/status-changed": ["insight_id", "collection_id", "status"],
  "learning/feedback-recorded": ["insight_id", "collection_id", "feedback"],
  "learning/promoted-to-candidate": ["insight_id", "collection_id", "candidate_id"],
  "learning/linked-to-run": ["insight_id", "collection_id", "linked_run_id"],
  "candidate/status-changed": ["candidate_id", "status", "revision"],
  "share/created": ["share_id", "target_kind", "target_id"],
  "share/revoked": ["share_id", "target_kind", "target_id"],
  "share/expired": ["share_id", "target_kind", "target_id"],
  "eval/experiment-completed": ["experiment_id", "suite_id", "baseline_passed", "candidate_passed", "total_cases"],
} as const satisfies Record<ObservationEventType, readonly string[]>;

function openLedgerDatabase(path: string): Database {
  const db = new Database(path);
  try {
    db.exec("PRAGMA busy_timeout=5000");
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("PRAGMA foreign_keys=ON");
    initObservationSchema(db);
    return db;
  } catch (error) {
    db.close(true);
    throw error;
  }
}

function openReadOnlyLedgerDatabase(path: string): Database {
  const db = new Database(path, { readonly: true });
  try {
    db.exec("PRAGMA busy_timeout=5000");
    const row = queryOne<{ version: number | null }>(
      db,
      "SELECT MAX(version) AS version FROM observation_schema_version"
    );
    const current = row?.version ?? 0;
    if (current !== OBSERVATION_LEDGER_SCHEMA_VERSION) {
      throw new Error(
        `Observation Ledger schema version ${current} cannot be read by this codetrap build (expects ${OBSERVATION_LEDGER_SCHEMA_VERSION}). Open it with a compatible codetrap version.`
      );
    }
    return db;
  } catch (error) {
    db.close(true);
    throw error;
  }
}

function initObservationSchema(db: Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS observation_schema_version (version INTEGER NOT NULL)");
  const row = queryOne<{ version: number | null }>(
    db,
    "SELECT MAX(version) AS version FROM observation_schema_version"
  );
  const current = row?.version ?? 0;
  if (current > OBSERVATION_LEDGER_SCHEMA_VERSION) {
    throw new Error(
      `Observation Ledger schema version ${current} is newer than this codetrap build (supports up to ${OBSERVATION_LEDGER_SCHEMA_VERSION}). Upgrade codetrap.`
    );
  }
  if (current === OBSERVATION_LEDGER_SCHEMA_VERSION) return;

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS observation_events (
        version INTEGER NOT NULL CHECK(version = ${OBSERVATION_EVENT_VERSION}),
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        run_id TEXT,
        actor_ref TEXT,
        device_id TEXT NOT NULL,
        seq INTEGER NOT NULL CHECK(seq >= 0),
        occurred_at TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('${OBSERVATION_EVENT_TYPES.join("','")}')),
        evidence_class TEXT NOT NULL CHECK(evidence_class IN ('${EVIDENCE_CLASSES.join("','")}')),
        sensitivity TEXT NOT NULL CHECK(sensitivity IN ('${OBSERVATION_SENSITIVITIES.join("','")}')),
        attributes_json TEXT NOT NULL CHECK(json_valid(attributes_json)),
        body_ref TEXT,
        source_ref TEXT,
        PRIMARY KEY (project_id, id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS observation_events_run_seq
        ON observation_events(project_id, run_id, seq)
        WHERE run_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS observation_events_run_order
        ON observation_events(project_id, run_id, seq, occurred_at);
      CREATE INDEX IF NOT EXISTS observation_events_type_time
        ON observation_events(project_id, type, occurred_at);

      CREATE TRIGGER IF NOT EXISTS observation_events_no_update
      BEFORE UPDATE ON observation_events
      BEGIN
        SELECT RAISE(ABORT, 'observation events are append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS observation_events_no_delete
      BEFORE DELETE ON observation_events
      BEGIN
        SELECT RAISE(ABORT, 'observation events are append-only');
      END;
    `);
    db.exec("DELETE FROM observation_schema_version");
    db.run(
      "INSERT INTO observation_schema_version (version) VALUES (?)",
      [OBSERVATION_LEDGER_SCHEMA_VERSION]
    );
  }).immediate();
}

function eventFromRow(row: ObservationRow): ObservationEvent {
  return validateObservationEvent({
    version: row.version,
    id: row.id,
    project_id: row.project_id,
    run_id: row.run_id,
    actor_ref: row.actor_ref,
    device_id: row.device_id,
    seq: row.seq,
    occurred_at: row.occurred_at,
    recorded_at: row.recorded_at,
    type: row.type,
    evidence_class: row.evidence_class,
    sensitivity: row.sensitivity,
    attributes: JSON.parse(row.attributes_json) as unknown,
    body_ref: row.body_ref,
    source_ref: row.source_ref,
  });
}

function projectRun(events: ObservationEvent[]): RunObservationProjection {
  const runId = events[0]?.run_id ?? null;
  if (runId === null) throw new Error("Cannot project an empty or runless event list.");
  if (events.some((event) => event.run_id !== runId)) {
    throw new Error("Cannot project events from multiple runs.");
  }
  const ordered = [...events].sort((left, right) =>
    left.seq - right.seq || left.occurred_at.localeCompare(right.occurred_at) || left.id.localeCompare(right.id)
  );
  const started = ordered.find((event) => event.type === "run/started");
  const completed = [...ordered].reverse().find((event) => event.type === "run/completed");
  const startedPayload = started?.attributes as RunStartedPayload | undefined;
  const completedPayload = completed?.attributes as RunCompletedPayload | undefined;
  const evidence = emptyEvidenceCounts();
  let latestValidationStatus: RunObservationProjection["latest_validation_status"] = null;

  for (const event of ordered) {
    evidence[event.evidence_class] += 1;
    if (event.type === "validation/completed") {
      latestValidationStatus = (event.attributes as ValidationReceipt).status;
    }
  }

  return {
    id: runId,
    project_id: ordered[0].project_id,
    source_client: startedPayload?.source_client ?? null,
    source_session_ref: startedPayload?.source_session_ref ?? null,
    repository_revision: startedPayload?.repository_revision ?? null,
    branch: startedPayload?.branch ?? null,
    model_provider: startedPayload?.model_provider ?? null,
    model_name: startedPayload?.model_name ?? null,
    started_at: started?.occurred_at ?? null,
    completed_at: completed?.occurred_at ?? null,
    status: completedPayload?.status ?? null,
    completeness: completedPayload?.completeness ?? startedPayload?.completeness ?? "unknown",
    duration_ms: completedPayload?.duration_ms ?? null,
    input_tokens: completedPayload?.input_tokens ?? null,
    output_tokens: completedPayload?.output_tokens ?? null,
    event_count: ordered.length,
    search_count: countType(ordered, "trap/search-completed"),
    exposure_count: countType(ordered, "trap/exposed"),
    validation_count: countType(ordered, "validation/completed"),
    feedback_count: countType(ordered, "trap/feedback-recorded"),
    latest_validation_status: latestValidationStatus,
    contains_sensitive_body: ordered.some((event) => event.body_ref !== null),
    evidence,
  };
}

function countType(events: ObservationEvent[], type: ObservationEventType): number {
  return events.filter((event) => event.type === type).length;
}

function emptyEvidenceCounts(): ObservationEvidenceCounts {
  return { observed_fact: 0, human_label: 0, derived_inference: 0, controlled_eval: 0 };
}

function validateAttributes(type: ObservationEventType, input: unknown): JsonObject {
  const attributes = jsonObject(input, "attributes");
  switch (type) {
    case "run/started":
      enumValue(attributes.source_client, SOURCE_CLIENTS, "attributes.source_client");
      nullableString(attributes.source_session_ref, "attributes.source_session_ref");
      nullableString(attributes.repository_revision, "attributes.repository_revision");
      nullableString(attributes.branch, "attributes.branch");
      nullableString(attributes.model_provider, "attributes.model_provider");
      nullableString(attributes.model_name, "attributes.model_name");
      enumValue(attributes.completeness, RUN_COMPLETENESS, "attributes.completeness");
      break;
    case "run/completed":
      enumValue(attributes.status, RUN_STATUSES, "attributes.status");
      enumValue(attributes.completeness, RUN_COMPLETENESS, "attributes.completeness");
      nullableNonNegativeNumber(attributes.duration_ms, "attributes.duration_ms");
      nullableNonNegativeInteger(attributes.input_tokens, "attributes.input_tokens");
      nullableNonNegativeInteger(attributes.output_tokens, "attributes.output_tokens");
      break;
    case "trap/search-completed":
      validateSearchReceipt(attributes);
      break;
    case "trap/exposed":
      nonNegativeInteger(attributes.trap_id, "attributes.trap_id");
      nonEmptyString(attributes.revision, "attributes.revision");
      nullableNonNegativeInteger(attributes.rank, "attributes.rank");
      nullableString(attributes.query_fingerprint, "attributes.query_fingerprint");
      break;
    case "trap/feedback-recorded":
      nullableNonNegativeInteger(attributes.trap_id, "attributes.trap_id");
      nullableString(attributes.revision, "attributes.revision");
      enumValue(attributes.feedback, TRAP_FEEDBACK_VALUES, "attributes.feedback");
      nullableString(attributes.note_fingerprint, "attributes.note_fingerprint");
      break;
    case "trap/missed-reported":
      nullableString(attributes.query_fingerprint, "attributes.query_fingerprint");
      nullableNonNegativeInteger(attributes.expected_trap_id, "attributes.expected_trap_id");
      break;
    case "validation/completed":
      enumValue(attributes.kind, VALIDATION_KINDS, "attributes.kind");
      nullableString(attributes.command_fingerprint, "attributes.command_fingerprint");
      enumValue(attributes.status, VALIDATION_STATUSES, "attributes.status");
      nullableNonNegativeInteger(attributes.passed, "attributes.passed");
      nullableNonNegativeInteger(attributes.failed, "attributes.failed");
      nullableNonNegativeNumber(attributes.duration_ms, "attributes.duration_ms");
      break;
    case "learning/insight-shelved":
      validateInsight(attributes);
      break;
    case "learning/status-changed":
      validateInsight(attributes);
      enumValue(attributes.status, LEARNING_STATUSES, "attributes.status");
      break;
    case "learning/feedback-recorded":
      validateInsight(attributes);
      enumValue(attributes.feedback, LEARNING_FEEDBACK_VALUES, "attributes.feedback");
      break;
    case "learning/promoted-to-candidate":
      validateInsight(attributes);
      nonEmptyString(attributes.candidate_id, "attributes.candidate_id");
      break;
    case "learning/linked-to-run":
      validateInsight(attributes);
      nonEmptyString(attributes.linked_run_id, "attributes.linked_run_id");
      break;
    case "candidate/status-changed":
      nonEmptyString(attributes.candidate_id, "attributes.candidate_id");
      nonEmptyString(attributes.status, "attributes.status");
      nullableNonNegativeInteger(attributes.revision, "attributes.revision");
      break;
    case "share/created":
    case "share/revoked":
    case "share/expired":
      nonEmptyString(attributes.share_id, "attributes.share_id");
      nonEmptyString(attributes.target_kind, "attributes.target_kind");
      nonEmptyString(attributes.target_id, "attributes.target_id");
      break;
    case "eval/experiment-completed":
      nonEmptyString(attributes.experiment_id, "attributes.experiment_id");
      nonEmptyString(attributes.suite_id, "attributes.suite_id");
      nullableNonNegativeInteger(attributes.baseline_passed, "attributes.baseline_passed");
      nullableNonNegativeInteger(attributes.candidate_passed, "attributes.candidate_passed");
      nullableNonNegativeInteger(attributes.total_cases, "attributes.total_cases");
      break;
  }
  return attributes;
}

function validateSearchReceipt(attributes: JsonObject): void {
  nonEmptyString(attributes.query_fingerprint, "attributes.query_fingerprint");
  enumValue(attributes.mode, ["fts", "semantic", "hybrid"] as const, "attributes.mode");
  nullableString(attributes.path_hint, "attributes.path_hint");
  nullableString(attributes.module_hint, "attributes.module_hint");
  nullableNonNegativeNumber(attributes.duration_ms, "attributes.duration_ms");
  if (!Array.isArray(attributes.diagnostics) || attributes.diagnostics.some((item) => typeof item !== "string")) {
    throw new Error("attributes.diagnostics must be an array of strings.");
  }
  if (!Array.isArray(attributes.results)) throw new Error("attributes.results must be an array.");
  for (const [index, result] of attributes.results.entries()) {
    const item = jsonObject(result, `attributes.results[${index}]`);
    nonNegativeInteger(item.trap_id, `attributes.results[${index}].trap_id`);
    nonEmptyString(item.revision, `attributes.results[${index}].revision`);
    const rank = nonNegativeInteger(item.rank, `attributes.results[${index}].rank`);
    if (rank < 1) throw new Error(`attributes.results[${index}].rank must be at least 1.`);
  }
}

function validateInsight(attributes: JsonObject): void {
  nonEmptyString(attributes.insight_id, "attributes.insight_id");
  nullableString(attributes.collection_id, "attributes.collection_id");
}

function validateInferenceBasis(attributes: JsonObject): void {
  if (!Array.isArray(attributes.basis_event_ids) || attributes.basis_event_ids.length === 0 || attributes.basis_event_ids.some((id) => typeof id !== "string" || id.trim() === "")) {
    throw new Error("derived_inference attributes require non-empty basis_event_ids.");
  }
  nonEmptyString(attributes.inference_version, "attributes.inference_version");
}

function validateAttributeKeys(
  type: ObservationEventType,
  attributes: JsonObject,
  evidenceClass: EvidenceClass
): void {
  const allowed = new Set<string>(ATTRIBUTE_KEYS[type]);
  if (evidenceClass === "derived_inference") {
    allowed.add("basis_event_ids");
    allowed.add("inference_version");
  }
  for (const key of Object.keys(attributes)) {
    if (!allowed.has(key)) {
      throw new Error(
        `attributes.${key} is not allowed for ${type}; structured metadata must not contain arbitrary body content.`
      );
    }
  }
}

function validateObjectKeys(
  object: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string
): void {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) throw new Error(`${label} field ${key} is not allowed.`);
  }
}

function canonicalJson(value: JsonValue | ObservationEvent): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: JsonValue | ObservationEvent): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Observation JSON cannot contain non-finite numbers.");
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => sortJson(item));
  const sorted: JsonObject = {};
  for (const key of Object.keys(value).sort()) {
    const item = (value as Record<string, unknown>)[key];
    if (item === undefined || typeof item === "function" || typeof item === "symbol" || typeof item === "bigint") {
      throw new Error(`Observation JSON field ${key} is not serializable.`);
    }
    sorted[key] = sortJson(item as JsonValue);
  }
  return sorted;
}

function plainObject(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error(`${label} must be an object.`);
  return input as Record<string, unknown>;
}

function jsonObject(input: unknown, label: string): JsonObject {
  const object = plainObject(input, label);
  canonicalJson(object as JsonObject);
  return object as JsonObject;
}

function enumValue<const T extends readonly string[]>(input: unknown, values: T, label: string): T[number] {
  if (typeof input !== "string" || !values.includes(input)) {
    throw new Error(`${label} must be one of: ${values.join(", ")}.`);
  }
  return input as T[number];
}

function nonEmptyString(input: unknown, label: string): string {
  if (typeof input !== "string" || input.trim() === "") throw new Error(`${label} must be a non-empty string.`);
  return input;
}

function nullableString(input: unknown, label: string): string | null {
  if (input === null) return null;
  return nonEmptyString(input, label);
}

function nonNegativeInteger(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isInteger(input) || input < 0) throw new Error(`${label} must be a non-negative integer.`);
  return input;
}

function nullableNonNegativeInteger(input: unknown, label: string): number | null {
  if (input === null) return null;
  return nonNegativeInteger(input, label);
}

function nullableNonNegativeNumber(input: unknown, label: string): number | null {
  if (input === null) return null;
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0) throw new Error(`${label} must be a non-negative finite number.`);
  return input;
}

function exactNumber(input: unknown, expected: number, label: string): void {
  if (input !== expected) throw new Error(`${label} must be ${expected}; unknown observation versions fail closed.`);
}

function isoTimestamp(input: unknown, label: string): string {
  const value = nonEmptyString(input, label);
  if (!ISO_8601_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO-8601 timestamp with a timezone.`);
  }
  return value;
}

const ISO_8601_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function normalizeLimit(input: number | undefined): number {
  if (input === undefined) return 1_000;
  if (!Number.isInteger(input) || input < 1) throw new Error("limit must be a positive integer.");
  return Math.min(input, 100_000);
}
