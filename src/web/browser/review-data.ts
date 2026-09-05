import type { ReviewedSessionCandidate } from "../../domain/session-review";
import type { ReviewSummaryLike } from "../client-review";

export interface ReviewSession { id: string; goal: string; status: "active" | "closed"; candidate_count: number; accepted_count: number; pending_count: number }
export interface ReviewTarget { projectRoot: string; sessionId: string; candidateId: string }
export interface ReviewConflict { trap_id: number; scope: string; title: string; context: string; fix: string; reason: string }
export interface ReviewReceipt { action: string; destination: string; executor: string; authorized_scope: string; recorded_at: string; trap_id: number | null; trap_scope: string | null; session_id: string | null; candidate_id: string | null }
export const reviewKey = (target: ReviewTarget): string => JSON.stringify([target.projectRoot, target.sessionId, target.candidateId]);
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Review response");
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== "string") throw new Error("Invalid Review text"); return value; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === "string"); }
function count(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid Review count"); return value; }
export function parseSessions(value: unknown, project: string): { sessions: ReviewSession[]; summary: ReviewSummaryLike | null } {
  const v = record(value);
  if (v.project_root !== project || !Array.isArray(v.sessions)) throw new Error("Review project mismatch");
  const sessions = v.sessions.map(item => {
    const s = record(item);
    if (s.status !== "active" && s.status !== "closed") throw new Error("Invalid session status");
    return { id: text(s.id), goal: text(s.goal), status: s.status, candidate_count: count(s.candidate_count), accepted_count: count(s.accepted_count), pending_count: count(s.pending_count) } as ReviewSession;
  });
  if (new Set(sessions.map(s => s.id)).size !== sessions.length) throw new Error("Duplicate session identity");
  let summary: ReviewSummaryLike | null = null;
  if (v.candidate_review != null) {
    const s = record(v.candidate_review);
    summary = { pending_count: count(s.pending_count), pending_session_count: count(s.pending_session_count), high_quality_pending_count: count(s.high_quality_pending_count), needs_edit_count: count(s.needs_edit_count) };
  }
  return { sessions, summary };
}
export function parseCandidates(value: unknown, project: string, session: string): ReviewedSessionCandidate[] {
  const v = record(value);
  if (v.project_root !== project || record(v.session).id !== session || !Array.isArray(v.candidates)) throw new Error("Review session mismatch");
  const candidates = v.candidates.map(item => {
    const c = record(item), trap = record(c.trap), quality = record(c.quality), review = record(c.review);
    text(c.id);
    if (!["proposed", "accepted", "rejected"].includes(text(c.status)) || typeof c.quality_score !== "number" || !Number.isFinite(c.quality_score)) throw new Error("Invalid candidate state");
    for (const key of ["title", "category", "scope", "context", "mistake", "fix"]) text(trap[key]);
    for (const key of ["tags", "path_globs"]) if (trap[key] != null && !strings(trap[key])) throw new Error("Invalid candidate list");
    for (const key of ["severity", "module", "owner", "before_code", "after_code"]) if (trap[key] != null) text(trap[key]);
    if (!strings(quality.warnings) || !Array.isArray(c.evidence)) throw new Error("Invalid candidate evidence");
    text(quality.conflict_status); text(quality.suggested_action);
    for (const entry of c.evidence) {
      const e = record(entry); text(e.source_type);
      if (e.related_files != null && !strings(e.related_files)) throw new Error("Invalid evidence files");
      for (const key of ["source_ref", "note"]) if (e[key] != null) text(e[key]);
    }
    if (!["pending", "approved", "accepted", "accepted_missing", "destination_committed", "rejected"].includes(text(review.status))) throw new Error("Invalid review status");
    if (review.status === "accepted") { count(review.trap_id); text(review.scope); text(review.trap_status); text(review.trap_title); }
    if (c.destination_payload != null) {
      const p = record(c.destination_payload);
      if (c.candidate_kind === "insight") {
        for (const key of ["title", "summary", "body"]) if (p[key] != null) text(p[key]);
        for (const key of ["tags", "source_refs", "source_unit_refs"]) if (p[key] != null && !strings(p[key])) throw new Error("Invalid insight draft");
      }
    }
    // Destination-specific metadata remains interpreted by the legacy renderer.
    // Validate selection, form and evidence fields at this shared boundary.
    return c as unknown as ReviewedSessionCandidate;
  });
  if (new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error("Duplicate candidate identity");
  return candidates;
}
export function parseMutation(value: unknown, target: ReviewTarget): { receipt: ReviewReceipt | null; suppression?: string } {
  const v = record(value);
  if (record(v.candidate).id !== target.candidateId) throw new Error("Review mutation identity mismatch");
  if (v.session != null && record(v.session).id !== target.sessionId) throw new Error("Review mutation session mismatch");
  let receipt: ReviewReceipt | null = null;
  if (v.receipt != null) {
    const r = record(v.receipt);
    if (r.candidate_id !== target.candidateId || r.session_id !== target.sessionId) throw new Error("Review receipt identity mismatch");
    receipt = { action: text(r.action), destination: text(r.destination), executor: text(r.executor), authorized_scope: text(r.authorized_scope), recorded_at: text(r.recorded_at),
      trap_id: r.trap_id == null ? null : count(r.trap_id), trap_scope: r.trap_scope == null ? null : text(r.trap_scope), session_id: target.sessionId, candidate_id: target.candidateId };
  }
  return { receipt, ...(v.suppression != null ? { suppression: text(record(v.suppression).fingerprint) } : {}) };
}
export function parseConflicts(value: unknown): ReviewConflict[] {
  const v = record(value);
  if (!Array.isArray(v.possible_conflicts)) return [];
  return v.possible_conflicts.map(item => { const c = record(item); return { trap_id: count(c.trap_id), scope: text(c.scope), title: text(c.title), context: text(c.context), fix: text(c.fix), reason: text(c.reason) }; });
}
