import type { TrapEvidenceInput, TrapInput } from "./trap";
import type { Scope } from "../lib/constants";
import type {
  CandidateAuthorization,
  CandidateKind,
  DeliveryState,
  ReviewDecision,
  SourceAgent,
} from "./candidate";

export const SESSION_VERSION = 1;

export const SESSION_STATUSES = ["active", "closed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_NOTE_KINDS = [
  "decision",
  "deviation",
  "tradeoff",
  "open_question",
  "failure",
  "test_failure",
  "correction",
  "review",
  "observation",
] as const;

export type SessionNoteKind = (typeof SESSION_NOTE_KINDS)[number];

export const CANDIDATE_STATUSES = ["proposed", "accepted", "rejected"] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export interface SessionMetadata {
  version: typeof SESSION_VERSION;
  id: string;
  goal: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  scope: Scope;
  project_path: string;
  module: string | null;
  owner: string | null;
  spec_ref: string | null;
  notes_path: string;
  recap_path: string;
  candidate_traps_path: string;
}

export interface SessionNote {
  created_at: string;
  kind: SessionNoteKind;
  text: string;
  related_files: string[];
  source_ref: string | null;
}

export type SessionNoteCounts = Partial<Record<SessionNoteKind, number>>;

export interface SessionIndexEntry {
  id: string;
  goal: string;
  status: SessionStatus;
  created_at: string;
  closed_at: string | null;
  module: string | null;
  owner: string | null;
  note_counts: SessionNoteCounts;
  candidate_count: number;
  accepted_count: number;
  summary: string | null;
}

export interface SessionIndexDocument {
  version: typeof SESSION_VERSION;
  sessions: SessionIndexEntry[];
}

export interface ActiveSessionDocument {
  active_session_id: string | null;
  updated_at: string;
}

export interface CandidateQuality {
  has_clear_trigger: boolean;
  has_clear_mistake: boolean;
  has_actionable_fix: boolean;
  not_too_broad: boolean;
  future_reuse_likely: boolean;
  proper_scope: boolean;
  evidence_count: number;
  conflict_checked: boolean;
  conflict_status: "none" | "possible" | "confirmed";
  staleness_risk: "low" | "medium" | "high";
  suggested_action: "accept" | "edit" | "supersede" | "archive_old" | "reject";
  warnings: string[];
}

export interface CandidateTrap {
  id: string;
  /**
   * Derived from `review_decision` + `delivery_state` (§8.3) and kept in sync
   * with them. Retained rather than replaced because the Web review console
   * reads it from untyped browser JS, where a rename would fail silently.
   */
  status: CandidateStatus;
  quality_score: number;
  quality: CandidateQuality;
  trap: TrapInput;
  evidence: TrapEvidenceInput[];
  accepted_trap_id?: number;
  accepted_scope?: Scope;
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;

  // --- v2 envelope (§8.2). Optional on read so v1 records normalize cleanly. ---
  schema_version?: number;
  /** Bumped by every material edit; authorization is bound to one revision. */
  revision?: number;
  /** Hash of the material fields. Commit refuses when it no longer matches. */
  content_hash?: string;
  candidate_kind?: CandidateKind;
  /** Free-form and non-binding: a hint, never a schema enum (§8.1). */
  destination_hint?: string;
  review_decision?: ReviewDecision;
  delivery_state?: DeliveryState;
  /** Why the action is right and what breaks otherwise (§1.7's second consumer). */
  rationale?: string;
  source_agent?: SourceAgent;
  source_manifest_refs?: string[];
  authorization?: CandidateAuthorization;
  /** Set by migration when a legacy record could not be mapped cleanly. */
  migration_warning?: string;
}

export interface CandidateTrapDocument {
  /** `CANDIDATE_SCHEMA_VERSION`, not `SESSION_VERSION` — see domain/candidate.ts. */
  version: number;
  session_id: string;
  candidates: CandidateTrap[];
}

export function parseSessionNoteKind(value: string | undefined): SessionNoteKind {
  const normalized = value ?? "observation";
  if ((SESSION_NOTE_KINDS as readonly string[]).includes(normalized)) {
    return normalized as SessionNoteKind;
  }
  throw new Error(`Invalid session note kind: ${normalized}. Expected one of: ${SESSION_NOTE_KINDS.join(", ")}`);
}
