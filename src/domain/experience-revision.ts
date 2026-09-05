import { createHash } from "node:crypto";
import type { Trap, TrapInput } from "./trap";
import type { TrapFeedback } from "./observation";

export type ExperienceScope = "project" | "global";
export type RevisionFields = Pick<Trap, "title" | "context" | "mistake" | "fix"> & { tags: string[] };
export interface RevisionSource {
  event_id: string;
  run_id: string;
  trap_id: number;
  scope: ExperienceScope;
  revision: string;
  feedback: TrapFeedback | null;
}
export interface RevisionCase { query: string; expectation: "include" | "exclude" }
export interface RevisionTestResult {
  digest: string;
  corpus_hash: string;
  evaluated_at: string;
  passed: boolean;
  cases: Array<RevisionCase & { baseline: boolean; candidate: boolean; error: string | null }>;
}
export interface RevisionDraft {
  version: 1;
  id: string;
  owner: string;
  source: RevisionSource;
  base: Trap;
  base_hash: string;
  fields: RevisionFields;
  reason: string;
  cases: RevisionCase[];
  corpus: Array<{ scope: ExperienceScope; id: number; revision: string; trap: TrapInput }>;
  digest: string;
  evaluation: RevisionTestResult | null;
  status: "draft" | "rejected";
  created_at: string;
}
export interface RevisionCommit {
  id: string;
  owner: string;
  scope: ExperienceScope;
  trap_id: number;
  source: RevisionSource;
  digest: string;
  before: Trap;
  after: Trap;
  status: "accepted" | "rolled_back";
  accepted_at: string;
  rolled_back_at: string | null;
  rollback_revision: string | null;
}
export function revisionHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function revisionFields(trap: Trap): RevisionFields {
  return { title: trap.title, context: trap.context, mistake: trap.mistake, fix: trap.fix, tags: JSON.parse(trap.tags) };
}
/** Usage counters do not invalidate review; material edits and lifecycle changes do. */
export function trapRevisionHash(trap: Trap): string {
  const { hit_count, useful_count, last_useful_at, last_validated, search_text, ...material } = trap;
  return revisionHash(material);
}
export function revisionInput(trap: Trap): TrapInput {
  return { ...revisionFields(trap), scope: trap.scope, category: trap.category, severity: trap.severity,
    before_code: trap.before_code ?? undefined, after_code: trap.after_code ?? undefined,
    path_globs: JSON.parse(trap.path_globs), module: trap.module, owner: trap.owner, project_path: trap.project_path };
}
export function draftRevisionDigest(draft: RevisionDraft): string {
  return revisionHash([draft.owner, draft.source, draft.base_hash, draft.fields, draft.reason, draft.cases, draft.corpus]);
}
