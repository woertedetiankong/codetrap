import type { ReviewedSessionCandidate } from "../../domain/session-review";
import { reviewCandidateTrapDraft, reviewQueueModel, selectedReviewSessionId, type ReviewCandidateView, type ReviewSummaryLike } from "../client-review";
import { parseCandidates, parseConflicts, parseMutation, parseSessions, record, reviewKey, type ReviewConflict, type ReviewReceipt, type ReviewSession, type ReviewTarget } from "./review-data";

export type ReviewFields = Record<string, string>;
export type ReviewLoad = "idle" | "loading" | "ready" | "error";
export type ReviewAction = "save" | "approve" | "accept" | "apply-insight" | "reject" | "rollback";
interface Draft { fields: ReviewFields; baseline: ReviewFields; context: string; version: number }
interface ReviewState {
  project: string | null; sessions: ReviewSession[]; summary: ReviewSummaryLike | null;
  sessionId: string | null; candidateId: string | null; view: ReviewCandidateView;
  candidates: ReviewedSessionCandidate[]; sessionsLoad: ReviewLoad; candidatesLoad: ReviewLoad;
  busy: boolean; deferred: boolean;
}
export function candidateFields(candidate: ReviewedSessionCandidate): ReviewFields {
  const t = candidate.trap, p = candidate.destination_payload || {};
  const list = (value: unknown, separator = ", ") => Array.isArray(value) ? value.join(separator) : "";
  return candidate.candidate_kind === "insight" ? {
    insight_title: String(p.title || t.title), insight_tags: list(p.tags), insight_summary: String(p.summary || ""), insight_body: String(p.body || ""),
    insight_source_refs: list(p.source_refs, "\n"), insight_source_unit_refs: list(p.source_unit_refs, "\n"),
  } : { title: t.title, category: t.category, scope: t.scope, severity: t.severity || "warning", tags: list(t.tags), path_globs: list(t.path_globs), module: t.module || "", owner: t.owner || "", context: t.context, mistake: t.mistake, fix: t.fix };
}
const equalFields = (a: ReviewFields, b: ReviewFields) => JSON.stringify(a) === JSON.stringify(b);
export const candidateContext = (candidate: ReviewedSessionCandidate) => JSON.stringify({ status: candidate.status, revision: candidate.revision, kind: candidate.candidate_kind, review: candidate.review, fields: candidateFields(candidate) });
export function createReviewModel(deps: {
  api(path: string, options?: RequestInit): Promise<unknown>;
  changed(part: "sessions" | "candidates" | "draft" | "busy"): void;
  notify(key: string, error?: boolean, params?: Record<string, unknown>): void;
  receipt(receipt: ReviewReceipt, target: ReviewTarget, suppression?: string): void;
  draftChanged?(target: ReviewTarget, fields: ReviewFields | null, context: string): void;
}) {
  const state: ReviewState = { project: null, sessions: [], summary: null, sessionId: null, candidateId: null, view: "inbox", candidates: [], sessionsLoad: "idle", candidatesLoad: "idle", busy: false, deferred: false };
  const drafts = new Map<string, Draft>(), conflicts = new Map<string, ReviewConflict[]>();
  let generation = 0, sessionRequest = 0, candidateRequest = 0, refreshing = false;
  let sessionsSignature = "", candidatesSignature = "";
  const target = (): ReviewTarget | null => state.project && state.sessionId && state.candidateId ? { projectRoot: state.project, sessionId: state.sessionId, candidateId: state.candidateId } : null;
  const current = () => state.candidates.find(c => c.id === state.candidateId) ?? null;
  const draft = () => { const t = target(); return t ? drafts.get(reviewKey(t)) : undefined; };
  function clearCandidates() { candidateRequest++; state.candidates = []; state.candidatesLoad = "idle"; candidatesSignature = ""; state.deferred = false; }
  function reset(project: string | null, sessionId: string | null = null, candidateId: string | null = null) {
    generation++; sessionRequest++; clearCandidates();
    state.project = project; state.sessionId = sessionId; state.candidateId = candidateId;
    state.sessions = []; state.summary = null; state.sessionsLoad = "idle"; sessionsSignature = "";
    deps.changed("sessions"); deps.changed("candidates");
  }
  function selectSession(id: string | null) { generation++; state.sessionId = id; state.candidateId = null; clearCandidates(); }
  function selectCandidate(id: string | null) { generation++; state.candidateId = id; state.deferred = false; }
  function selectView(view: ReviewCandidateView) { generation++; state.view = view; state.candidateId = null; selectVisible(); }
  function selectVisible() {
    const model = reviewQueueModel({ candidates: state.candidates, candidateView: state.view, candidateId: state.candidateId, candidateReview: state.summary });
    // Preserve explicitly requested missing candidates instead of opening a different one.
    if (!state.candidateId) state.candidateId = model.selectedCandidateId;
  }
  function edit(t: ReviewTarget, fields: ReviewFields, baseline: ReviewFields) {
    const key = reviewKey(t), previous = drafts.get(key);
    if (equalFields(fields, baseline)) drafts.delete(key);
    else drafts.set(key, { fields: { ...fields }, baseline: previous?.baseline || baseline, context: previous?.context || (current() ? candidateContext(current()!) : JSON.stringify(baseline)), version: (previous?.version || 0) + 1 });
    deps.draftChanged?.(t, drafts.get(key)?.fields || null, drafts.get(key)?.context || "cleared");
    conflicts.delete(key); deps.changed("draft");
  }
  function discard() {
    const t = target(), needsRefresh = state.deferred;
    if (t) { drafts.delete(reviewKey(t)); conflicts.delete(reviewKey(t)); deps.draftChanged?.(t, null, "cleared"); }
    state.deferred = false;
    // Discarding after an external-change notice must reveal the server version.
    if (needsRefresh) void loadCandidates();
    else deps.changed("candidates");
  }
  async function loadSessions(): Promise<boolean> {
    const project = state.project, request = ++sessionRequest;
    state.sessionsLoad = project ? "loading" : "idle"; deps.changed("sessions");
    if (!project) return false;
    try {
      const raw = await deps.api("/api/sessions?" + new URLSearchParams({ project }), { cache: "no-store" });
      const data = parseSessions(raw, project);
      if (request !== sessionRequest || project !== state.project) return false;
      state.sessions = data.sessions; state.summary = data.summary; state.sessionsLoad = "ready"; sessionsSignature = JSON.stringify(raw);
      if (!state.sessionId) state.sessionId = selectedReviewSessionId(data.sessions, null);
    } catch {
      if (request !== sessionRequest || project !== state.project) return false;
      state.sessionsLoad = "error";
    }
    deps.changed("sessions"); return state.sessionsLoad === "ready";
  }
  async function loadCandidates(): Promise<boolean> {
    const project = state.project, session = state.sessionId, request = ++candidateRequest;
    state.candidatesLoad = project && session ? "loading" : "idle"; state.candidates = []; deps.changed("candidates");
    if (!project || !session) return false;
    try {
      const raw = await deps.api("/api/candidates?" + new URLSearchParams({ project, session }), { cache: "no-store" });
      const data = parseCandidates(raw, project, session);
      if (request !== candidateRequest || project !== state.project || session !== state.sessionId) return false;
      state.candidates = data; state.candidatesLoad = "ready"; candidatesSignature = JSON.stringify(data);
      const selected = current(); if (selected) state.view = selected.status === "proposed" ? "inbox" : "reviewed";
      selectVisible();
    } catch {
      if (request !== candidateRequest || project !== state.project || session !== state.sessionId) return false;
      state.candidatesLoad = "error";
    }
    deps.changed("candidates"); return state.candidatesLoad === "ready";
  }
  async function refresh(includeCandidates: boolean): Promise<void> {
    if (!state.project || state.busy || refreshing || state.sessionsLoad === "loading" || state.candidatesLoad === "loading") return;
    refreshing = true;
    const project = state.project, session = state.sessionId, epoch = generation, sr = sessionRequest, cr = candidateRequest;
    const valid = () => epoch === generation && sr === sessionRequest && cr === candidateRequest && !state.busy;
    try {
      const raw = await deps.api("/api/sessions?" + new URLSearchParams({ project }), { cache: "no-store" });
      const data = parseSessions(raw, project); if (!valid()) return;
      const nextSession = session || selectedReviewSessionId(data.sessions, null);
      let candidates: ReviewedSessionCandidate[] | null = null;
      if (includeCandidates && nextSession) candidates = parseCandidates(await deps.api("/api/candidates?" + new URLSearchParams({ project, session: nextSession }), { cache: "no-store" }), project, nextSession);
      if (!valid()) return;
      if (JSON.stringify(raw) === sessionsSignature && (!candidates || JSON.stringify(candidates) === candidatesSignature)) return;
      if (draft()) { if (!state.deferred) deps.notify("status.externalChangesDeferred"); state.deferred = true; return; }
      state.sessions = data.sessions; state.summary = data.summary; state.sessionId = nextSession; state.sessionsLoad = "ready"; sessionsSignature = JSON.stringify(raw);
      if (candidates) { state.candidates = candidates; candidatesSignature = JSON.stringify(candidates); state.candidatesLoad = "ready"; selectVisible(); }
      deps.changed("sessions"); if (includeCandidates) deps.changed("candidates"); deps.notify("status.externalChanges");
    } catch { /* Polling is best effort; explicit loads have visible retry states. */ }
    finally { refreshing = false; }
  }
  function payload(candidate: ReviewedSessionCandidate, fields: ReviewFields): Record<string, unknown> {
    if (candidate.candidate_kind !== "insight") return { trap: reviewCandidateTrapDraft(fields) };
    const split = (s = "") => [...new Set(s.split(/[,\n]/).map(s => s.trim()).filter(Boolean))];
    return { destinationPayload: { ...candidate.destination_payload, title: fields.insight_title?.trim(), summary: fields.insight_summary?.trim(), body: fields.insight_body?.trim(), tags: split(fields.insight_tags), source_refs: split(fields.insight_source_refs), source_unit_refs: split(fields.insight_source_unit_refs) } };
  }
  async function mutate(action: ReviewAction, extra: Record<string, unknown> = {}, explicitTarget = target()): Promise<void> {
    if (state.busy || !explicitTarget) return;
    const t = { ...explicitTarget }, key = reviewKey(t), item = current();
    if (!item || !target() || reviewKey(target()!) !== key) return;
    const submitted = drafts.get(key), fields = submitted?.fields || candidateFields(item);
    const body = { ...extra, ...t, ...(["reject", "rollback"].includes(action) ? {} : payload(item, fields)) };
    state.busy = true; generation++; sessionRequest++; candidateRequest++; deps.changed("busy");
    try {
      const result = parseMutation(await deps.api("/api/candidate/" + action, { method: "POST", body: JSON.stringify(body) }), t);
      if (drafts.get(key) === submitted) { drafts.delete(key); deps.draftChanged?.(t, null, "cleared"); }
      conflicts.delete(key);
      const stillSelected = () => target() && reviewKey(target()!) === key;
      const sameContext = () => state.project === t.projectRoot && state.sessionId === t.sessionId;
      if (sameContext()) {
        await loadSessions();
        if (sameContext()) await loadCandidates();
      }
      if (result.receipt) deps.receipt(result.receipt, t, result.suppression);
      const messages = { save: "status.candidateSaved", approve: "status.candidateApproved", accept: "status.candidateAccepted", "apply-insight": "status.insightAdded", reject: "status.candidateRejected", rollback: item.candidate_kind === "insight" ? "status.insightRemoved" : "status.candidateRolledBack" };
      deps.notify(stillSelected() ? messages[action] : "review.completedElsewhere", false, { id: t.candidateId, session: t.sessionId });
    } catch (error) {
      let found: ReviewConflict[] = [];
      try { if (error instanceof Error && "payload" in error) found = parseConflicts(error.payload); } catch { /* Non-conflict error. */ }
      if (found.length) conflicts.set(key, found);
      if (target() && reviewKey(target()!) === key) { deps.changed("candidates"); deps.notify(found.length ? "status.possibleConflict" : "review.actionFailed", true); }
      else deps.notify("review.actionFailedElsewhere", true, { id: t.candidateId, session: t.sessionId });
    } finally { state.busy = false; deps.changed("busy"); }
  }
  async function manageSession(action: "delete" | "rename" | "cleanup", sessionId: string, goal?: string) {
    const projectRoot = state.project;
    if (!projectRoot || state.busy) return;
    state.busy = true; generation++; sessionRequest++; candidateRequest++; deps.changed("busy");
    try {
      const raw = await deps.api("/api/session/" + action, { method: "POST", body: JSON.stringify({ projectRoot, sessionId, ...(goal ? { goal } : {}) }) });
      const result = record(raw);
      if (result.success !== true) throw new Error("Unconfirmed session action");
      for (const key of drafts.keys()) {
        const [project, session, candidate] = JSON.parse(key) as string[];
        if (project === projectRoot && session === sessionId && (action === "delete" || action === "cleanup" && Array.isArray(result.removed_candidate_ids) && result.removed_candidate_ids.includes(candidate))) {
          drafts.delete(key); conflicts.delete(key);
          deps.draftChanged?.({ projectRoot: project!, sessionId: session!, candidateId: candidate! }, null, "cleared");
        }
      }
      if (state.project !== projectRoot) return;
      if (state.sessionId === sessionId && action === "delete") selectSession(null);
      if (action === "cleanup" && Array.isArray(result.removed_candidate_ids) && result.removed_candidate_ids.includes(state.candidateId)) selectCandidate(null);
      if (await loadSessions()) await loadCandidates();
      deps.notify(action === "delete" ? "status.sessionDeleted" : action === "rename" ? "status.sessionRenamed" : "status.deletedCandidatesCleaned");
    } catch { deps.notify("review.actionFailed", true); }
    finally { state.busy = false; deps.changed("busy"); }
  }
  return { get state(): Readonly<ReviewState> { return state; }, target, current, reset, selectSession, selectCandidate, selectView, selectVisible,
    loadSessions, loadCandidates, refresh, edit, discard, mutate, manageSession, fields: () => draft()?.fields,
    dirty: () => Boolean(draft()), hasDrafts: () => drafts.size > 0,
    conflicts: () => { const t = target(); return t ? conflicts.get(reviewKey(t)) || [] : []; },
  };
}
