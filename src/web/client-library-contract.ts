import type { TrapExperienceObservations } from "../domain/trap-experience";
import type { Trap, TrapEvidence } from "../domain/trap";

export interface TrapExperienceWebPayload {
  project_root: string;
  trap: { id: number; scope: "project" | "global" };
  sources: {
    availability: "ready" | "unavailable";
    insights: Array<{ insight_id: string; title: string; session_id: string; candidate_id: string }>;
  };
  observations: TrapExperienceObservations;
}

export type LibraryScope = "project" | "global";
export type LibraryTrap = Pick<Trap,
  "id" | "title" | "category" | "severity" | "status" | "context" | "mistake" | "fix" |
  "module" | "owner" | "hit_count" | "useful_count" | "last_validated" | "created_at" | "updated_at" |
  "state_key" | "supersedes_id" | "valid_from" | "valid_until" | "before_code" | "after_code"
> & { scope: LibraryScope; tags: string[]; path_globs: string[] };
export type LibraryEvidence = Pick<TrapEvidence, "source_type" | "source_ref" | "note"> & { related_files: string[] };
export interface LibraryDetail { scope: LibraryScope; trap: LibraryTrap; evidence: LibraryEvidence[] }
export interface LibraryList { project_root: string; traps: LibraryTrap[] }
