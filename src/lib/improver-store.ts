import { existsSync, lstatSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  IMPROVER_VERSION,
  type BehaviorOutcome,
  type FeedbackEvent,
  type FeedbackResolution,
  type FeedbackTombstone,
  type ImproverDocument,
} from "../domain/improver";
import { withAdvisoryLock } from "./advisory-lock";
import { CODETRAP_DIR } from "./constants";
import { readJsonFile, writeFileAtomic } from "./fs-json";

const IMPROVER_DIR = "improver";
const STATE_FILE = "state.json";
const LOCK_DIR = ".improver.lock";

export type FeedbackResolutionBatch = {
  event_ids: string[];
  resolution: Omit<FeedbackResolution, "resolved_at">;
};

export type RecordFeedbackResult =
  | { event: FeedbackEvent; tombstone: null; duplicate: boolean; deleted: false }
  | { event: null; tombstone: FeedbackTombstone; duplicate: true; deleted: true };

export type ResolveFeedbackResult = {
  events: FeedbackEvent[];
  tombstoned_event_ids: string[];
};

export class ImproverStore {
  constructor(private readonly projectRoot: string) {}

  recordFeedback(event: FeedbackEvent): RecordFeedbackResult {
    return this.withLock(() => {
      const document = this.readDocument();
      const tombstone = document.tombstones.find((item) => item.event_id === event.id);
      if (tombstone) {
        if (tombstone.content_hash !== event.content_hash) {
          throw new Error(`Deleted feedback event ${event.id} has different content.`);
        }
        return { event: null, tombstone, duplicate: true, deleted: true } as const;
      }
      const existing = document.feedback.find((item) => item.id === event.id);
      if (existing) {
        if (existing.content_hash !== event.content_hash) {
          throw new Error(`Feedback event ${event.id} already exists with different content.`);
        }
        return { event: existing, tombstone: null, duplicate: true, deleted: false } as const;
      }
      document.feedback.push(event);
      this.writeDocument(document);
      return { event, tombstone: null, duplicate: false, deleted: false } as const;
    }).value;
  }

  listFeedback(): FeedbackEvent[] {
    return [...this.readDocument().feedback].sort((left, right) =>
      right.captured_at.localeCompare(left.captured_at) || right.id.localeCompare(left.id)
    );
  }

  deleteFeedback(eventId: string, apply: boolean, now = new Date()): {
    applied: boolean;
    duplicate: boolean;
    event: FeedbackEvent | null;
    tombstone: FeedbackTombstone | null;
  } {
    return this.withLock(() => {
      const document = this.readDocument();
      const existingTombstone = document.tombstones.find((item) => item.event_id === eventId) ?? null;
      const event = document.feedback.find((item) => item.id === eventId) ?? null;
      if (!event) {
        if (existingTombstone) {
          return { applied: apply, duplicate: true, event: null, tombstone: existingTombstone };
        }
        throw new Error(`Feedback event ${eventId} not found.`);
      }
      if (!apply) return { applied: false, duplicate: false, event, tombstone: null };
      const tombstone: FeedbackTombstone = {
        version: IMPROVER_VERSION,
        event_id: event.id,
        content_hash: event.content_hash,
        pattern_key: event.lesson.key,
        source: event.source,
        captured_at: event.captured_at,
        deleted_at: now.toISOString(),
        resolution: event.resolution,
      };
      document.feedback = document.feedback.filter((item) => item.id !== eventId);
      document.tombstones.push(tombstone);
      this.writeDocument(document);
      return { applied: true, duplicate: false, event: null, tombstone };
    }).value;
  }

  resolveFeedback(batches: FeedbackResolutionBatch[], now = new Date()): ResolveFeedbackResult {
    if (batches.length === 0) return { events: [], tombstoned_event_ids: [] };
    return this.withLock(() => {
      const document = this.readDocument();
      const byId = new Map(document.feedback.map((event) => [event.id, event]));
      const tombstoned = new Set(document.tombstones.map((item) => item.event_id));
      const tombstonedEventIds = new Set<string>();
      const resolved: FeedbackEvent[] = [];
      for (const batch of batches) {
        for (const id of batch.event_ids) {
          const event = byId.get(id);
          if (!event) {
            if (tombstoned.has(id)) {
              tombstonedEventIds.add(id);
              continue;
            }
            throw new Error(`Feedback event ${id} no longer exists and has no deletion tombstone.`);
          }
          if (event.resolution) {
            if (!sameResolution(event.resolution, batch.resolution)) {
              throw new Error(`Feedback event ${id} is already resolved as ${event.resolution.status}.`);
            }
            resolved.push(event);
            continue;
          }
          event.resolution = { ...batch.resolution, resolved_at: now.toISOString() };
          resolved.push(event);
        }
      }
      this.writeDocument(document);
      return { events: resolved, tombstoned_event_ids: [...tombstonedEventIds].sort() };
    }).value;
  }

  recordOutcome(outcome: BehaviorOutcome): { outcome: BehaviorOutcome; duplicate: boolean } {
    return this.withLock(() => {
      const document = this.readDocument();
      const existing = document.outcomes.find((item) => item.id === outcome.id);
      if (existing) {
        if (existing.content_hash !== outcome.content_hash) {
          throw new Error(`Behavior outcome ${outcome.id} already exists with different content.`);
        }
        return { outcome: existing, duplicate: true };
      }
      document.outcomes.push(outcome);
      this.writeDocument(document);
      return { outcome, duplicate: false };
    }).value;
  }

  listOutcomes(): BehaviorOutcome[] {
    return [...this.readDocument().outcomes].sort((left, right) =>
      right.recorded_at.localeCompare(left.recorded_at) || right.id.localeCompare(left.id)
    );
  }

  listTombstones(): FeedbackTombstone[] {
    return [...this.readDocument().tombstones].sort((left, right) =>
      right.deleted_at.localeCompare(left.deleted_at) || right.event_id.localeCompare(left.event_id)
    );
  }

  private improverDir(): string {
    return join(this.projectRoot, CODETRAP_DIR, IMPROVER_DIR);
  }

  private statePath(): string {
    return join(this.improverDir(), STATE_FILE);
  }

  private readDocument(): ImproverDocument {
    const path = this.statePath();
    if (!existsSync(path)) return { version: IMPROVER_VERSION, feedback: [], outcomes: [], tombstones: [] };
    this.assertRegularPath(path, "Improver state file", false);
    const document = readJsonFile<ImproverDocument>(path, "Improver state");
    if (document.version !== IMPROVER_VERSION || !Array.isArray(document.feedback) || !Array.isArray(document.outcomes)) {
      throw new Error(`Unsupported Improver state document ${path}.`);
    }
    // The field was added before the feature shipped; keep early local fixtures
    // readable instead of forcing a schema bump for an additive empty list.
    return { ...document, tombstones: Array.isArray(document.tombstones) ? document.tombstones : [] };
  }

  private writeDocument(document: ImproverDocument): void {
    const path = this.statePath();
    mkdirSync(dirname(path), { recursive: true });
    this.assertRegularPath(this.improverDir(), "Improver directory", true);
    if (existsSync(path)) this.assertRegularPath(path, "Improver state file", false);
    writeFileAtomic(path, `${JSON.stringify(document, null, 2)}\n`);
  }

  private withLock<T>(fn: () => T) {
    const dir = this.improverDir();
    mkdirSync(dir, { recursive: true });
    this.assertRegularPath(dir, "Improver directory", true);
    return withAdvisoryLock(join(dir, LOCK_DIR), fn);
  }

  private assertRegularPath(path: string, label: string, directory: boolean): void {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error(`${label} ${path} must be a regular ${directory ? "directory" : "file"}, not a symbolic link or special entry.`);
    }
  }
}

function sameResolution(
  existing: FeedbackResolution,
  incoming: Omit<FeedbackResolution, "resolved_at">
): boolean {
  const sameTarget = existing.session_id === incoming.session_id
    && existing.candidate_id === incoming.candidate_id
    && existing.candidate_kind === incoming.candidate_kind;
  if (!sameTarget) return false;
  if (existing.status === incoming.status) return true;
  const candidateStatuses = new Set(["staged", "existing", "already_committed"]);
  return candidateStatuses.has(existing.status) && candidateStatuses.has(incoming.status);
}
