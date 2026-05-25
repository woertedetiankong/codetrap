import type { TrapEvidenceInput, TrapInput } from "./trap";
import type { Scope } from "../lib/constants";

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
}

export interface CandidateTrapDocument {
  version: typeof SESSION_VERSION;
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
