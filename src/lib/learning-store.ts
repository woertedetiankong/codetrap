import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEARNING_VERSION,
  type LearningReceipt,
  type ReceiptAction,
  type SuppressionDocument,
  type SuppressionRecord,
} from "../domain/learning";
import { CODETRAP_DIR } from "./constants";
import { readJsonFile, writeFileAtomic } from "./fs-json";

export const SUPPRESSIONS_FILE = "suppressions.json";
export const RECEIPTS_FILE = "receipts.jsonl";

export type RecordSuppressionArgs = {
  fingerprint: string;
  title: string;
  reason?: string | null;
  sessionId?: string | null;
  candidateId?: string | null;
};

export type AppendReceiptArgs = {
  action: ReceiptAction;
  executor: LearningReceipt["executor"];
  authorizedScope: string;
  fingerprint: string;
  title: string;
  sessionId?: string | null;
  candidateId?: string | null;
  trapId?: number | null;
  trapScope?: string | null;
  supersededId?: number | null;
  reason?: string | null;
};

/**
 * The project-level audit layer for learning decisions (§3.2): an append-only
 * receipt log for every durable write, and a suppression index that outlives
 * the session a lesson was rejected in.
 *
 * Both live under `.codetrap/` rather than inside a session directory, because
 * both must survive `session delete` and `session prune` — a suppression that
 * disappears with its session would let the same lesson return on the next
 * mining run, which is exactly what Phase 1A must prevent.
 */
export class LearningStore {
  constructor(private readonly projectRoot: string) {}

  isSuppressed(fingerprint: string): SuppressionRecord | null {
    return this.readSuppressions().suppressions.find((entry) => entry.fingerprint === fingerprint) ?? null;
  }

  listSuppressions(): SuppressionRecord[] {
    return this.readSuppressions().suppressions;
  }

  /**
   * Idempotent: re-rejecting the same lesson refreshes the reason rather than
   * appending a second entry, so the index stays one row per lesson.
   */
  recordSuppression(args: RecordSuppressionArgs, now = new Date()): SuppressionRecord {
    const record: SuppressionRecord = {
      fingerprint: args.fingerprint,
      title: args.title,
      reason: args.reason || null,
      suppressed_at: now.toISOString(),
      session_id: args.sessionId ?? null,
      candidate_id: args.candidateId ?? null,
    };
    const existing = this.readSuppressions().suppressions.filter(
      (entry) => entry.fingerprint !== record.fingerprint
    );
    this.writeSuppressions([...existing, record]);
    return record;
  }

  /** Returns the removed record, or null when the fingerprint was not suppressed. */
  removeSuppression(fingerprint: string): SuppressionRecord | null {
    const suppressions = this.readSuppressions().suppressions;
    const removed = suppressions.find((entry) => entry.fingerprint === fingerprint) ?? null;
    if (!removed) return null;
    this.writeSuppressions(suppressions.filter((entry) => entry.fingerprint !== fingerprint));
    return removed;
  }

  appendReceipt(args: AppendReceiptArgs, now = new Date()): LearningReceipt {
    const receipt: LearningReceipt = {
      version: LEARNING_VERSION,
      recorded_at: now.toISOString(),
      action: args.action,
      executor: args.executor,
      authorized_scope: args.authorizedScope,
      destination: "pitfall_trap",
      session_id: args.sessionId ?? null,
      candidate_id: args.candidateId ?? null,
      fingerprint: args.fingerprint,
      title: args.title,
      trap_id: args.trapId ?? null,
      trap_scope: args.trapScope ?? null,
      superseded_id: args.supersededId ?? null,
      reason: args.reason || null,
    };
    this.ensureDir();
    appendFileSync(this.receiptsPath(), `${JSON.stringify(receipt)}\n`);
    return receipt;
  }

  /**
   * Newest first. `limit` of 0 or less returns every receipt.
   *
   * A line that will not parse is skipped rather than thrown on: a process
   * killed mid-append leaves a torn final line, and one damaged byte must not
   * cost read access to the whole audit trail. `damaged` reports how many were
   * skipped so the loss is visible instead of silent.
   */
  listReceipts(limit = 0): LearningReceipt[] {
    return this.readReceipts(limit).receipts;
  }

  readReceipts(limit = 0): { receipts: LearningReceipt[]; damaged: number } {
    const path = this.receiptsPath();
    if (!existsSync(path)) return { receipts: [], damaged: 0 };
    const lines = readFileSync(path, "utf-8").split(/\r?\n/).filter((line) => line.trim() !== "");
    const receipts: LearningReceipt[] = [];
    let damaged = 0;
    for (const line of lines) {
      const parsed = parseReceiptLine(line);
      if (parsed) receipts.push(parsed);
      else damaged += 1;
    }
    receipts.reverse();
    return { receipts: limit > 0 ? receipts.slice(0, limit) : receipts, damaged };
  }

  suppressionsPath(): string {
    return join(this.projectRoot, CODETRAP_DIR, SUPPRESSIONS_FILE);
  }

  receiptsPath(): string {
    return join(this.projectRoot, CODETRAP_DIR, RECEIPTS_FILE);
  }

  private readSuppressions(): SuppressionDocument {
    const path = this.suppressionsPath();
    if (!existsSync(path)) return { version: LEARNING_VERSION, suppressions: [] };
    const document = readJsonFile<SuppressionDocument>(path, "suppression index");
    if (!document || !Array.isArray(document.suppressions)) {
      throw new Error(
        `Corrupt suppression index ${path}: expected a "suppressions" array. Fix or delete the file, then retry.`
      );
    }
    return document;
  }

  private writeSuppressions(suppressions: SuppressionRecord[]): void {
    this.ensureDir();
    const document: SuppressionDocument = { version: LEARNING_VERSION, suppressions };
    writeFileAtomic(this.suppressionsPath(), `${JSON.stringify(document, null, 2)}\n`);
  }

  private ensureDir(): void {
    mkdirSync(join(this.projectRoot, CODETRAP_DIR), { recursive: true });
  }
}

function parseReceiptLine(line: string): LearningReceipt | null {
  try {
    const parsed = JSON.parse(line) as LearningReceipt;
    return parsed && typeof parsed === "object" && typeof parsed.action === "string" ? parsed : null;
  } catch {
    return null;
  }
}
