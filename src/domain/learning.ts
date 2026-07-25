export const LEARNING_VERSION = 1;

// The durable actions a receipt can record. `approve` binds a user decision to
// one candidate revision; `commit` and `rollback` bracket a trap write;
// `suppress` and `unsuppress` bracket a suppression entry. Every one of them is
// a durable write under §3.2 and therefore leaves a receipt.
export const RECEIPT_ACTIONS = ["approve", "commit", "rollback", "suppress", "unsuppress"] as const;
export type ReceiptAction = (typeof RECEIPT_ACTIONS)[number];

// §3.2 is explicit that codetrap cannot distinguish a human from an agent
// running under the same OS account. `executor` is therefore a *declared*
// claim recorded for audit, never a verified fact — see EXECUTOR_IS_DECLARED.
export const EXECUTORS = ["user", "agent"] as const;
export type Executor = (typeof EXECUTORS)[number];

export const DEFAULT_EXECUTOR: Executor = "user";

export const EXECUTOR_IS_DECLARED =
  "executor is declared by the caller, not verified; codetrap cannot distinguish a human from a same-account agent (§3.2).";

// Phase 1A ships one destination. Kept as a field rather than an implicit
// constant so 1B can widen it without rewriting stored receipts.
export const RECEIPT_DESTINATIONS = ["pitfall_trap"] as const;
export type ReceiptDestination = (typeof RECEIPT_DESTINATIONS)[number];

export interface LearningReceipt {
  version: typeof LEARNING_VERSION;
  recorded_at: string;
  action: ReceiptAction;
  /** Declared, not proven. See EXECUTOR_IS_DECLARED. */
  executor: Executor;
  /** What the user authorized, in their terms. */
  authorized_scope: string;
  destination: ReceiptDestination;
  session_id: string | null;
  candidate_id: string | null;
  /** Content hash of the candidate's material fields; 1B replaces this with a revision. */
  fingerprint: string;
  title: string;
  trap_id: number | null;
  trap_scope: string | null;
  /** The trap this commit retired, if any. Rollback refuses when it is set. */
  superseded_id: number | null;
  reason: string | null;
}

export interface SuppressionRecord {
  fingerprint: string;
  title: string;
  reason: string | null;
  suppressed_at: string;
  session_id: string | null;
  candidate_id: string | null;
}

export interface SuppressionDocument {
  version: typeof LEARNING_VERSION;
  suppressions: SuppressionRecord[];
}

/**
 * Who ran a durable write and what the user authorized. Both are optional at
 * the API boundary and defaulted on the way in, so a caller that omits them
 * still produces a complete receipt.
 */
export interface AuthorizationInput {
  executor?: Executor;
  authorizedScope?: string | null;
}

export function parseExecutor(value: string | undefined | null): Executor {
  if (value === undefined || value === null || String(value).trim() === "") return DEFAULT_EXECUTOR;
  const normalized = String(value).trim().toLowerCase();
  if ((EXECUTORS as readonly string[]).includes(normalized)) return normalized as Executor;
  throw new Error(`Invalid executor: ${normalized}. Expected one of: ${EXECUTORS.join(", ")}`);
}

/**
 * The scope recorded when the caller does not name one. A bare
 * `session accept <id>` authorizes exactly that one candidate and nothing
 * else, so say so rather than leaving the field blank.
 */
export function defaultAuthorizedScope(candidateId: string): string {
  return `candidate ${candidateId} only`;
}
