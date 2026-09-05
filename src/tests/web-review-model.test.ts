import { expect, test } from "bun:test";
import type { ReviewedSessionCandidate } from "../domain/session-review";
import { candidateFields, createReviewModel } from "../web/browser/review-model";
import { parseCandidates, parseSessions, parseMutation } from "../web/browser/review-data";
import { ApiError } from "../web/browser/platform";
import { trap } from "./helpers";

function candidate(id = "c1"): ReviewedSessionCandidate {
  return { id, status: "proposed", quality_score: 1, trap: trap({ title: "Candidate " + id, scope: "project" }), evidence: [],
    quality: { has_clear_trigger: true, has_clear_mistake: true, has_actionable_fix: true, not_too_broad: true, future_reuse_likely: true, proper_scope: true, evidence_count: 0, conflict_checked: false, conflict_status: "none", staleness_risk: "low", suggested_action: "accept", warnings: [] }, review: { status: "pending", label: "Pending" } };
}
const sessionData = (project = "/a") => ({ project_root: project, candidate_review: null, sessions: [{ id: "s1", goal: "Review", status: "closed", candidate_count: 2, accepted_count: 0, pending_count: 2 }] });
const candidatesData = (project = "/a", session = "s1", candidates = [candidate(), candidate("c2")]) => ({ project_root: project, session: { id: session }, candidates });
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (error: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function fixture() {
  const requests: Array<ReturnType<typeof deferred> & { path: string; options?: RequestInit }> = [], notifications: string[] = [], receipts: unknown[] = [];
  const model = createReviewModel({ api(path, options) { const r = { ...deferred(), path, options }; requests.push(r); return r.promise; }, changed() {}, notify: key => { notifications.push(key); }, receipt: (receipt, target) => { receipts.push({ receipt, target }); } });
  model.reset("/a", "s1", "c1"); return { model, requests, notifications, receipts };
}
async function seed(f: ReturnType<typeof fixture>, project = "/a", session = "s1") {
  const loading = f.model.loadCandidates(); f.requests.at(-1)!.resolve(candidatesData(project, session)); await loading;
}
const receipt = { action: "approve", destination: "pitfall_trap", executor: "user", authorized_scope: "project", recorded_at: "2026-09-05", trap_id: null, trap_scope: null, session_id: "s1", candidate_id: "c1" };

test("Review transport rejects unrelated projects/sessions, duplicate IDs and malformed form fields", () => {
  expect(() => parseSessions(sessionData("/b"), "/a")).toThrow();
  expect(() => parseCandidates(candidatesData("/b"), "/a", "s1")).toThrow();
  expect(() => parseCandidates(candidatesData("/a", "s2"), "/a", "s1")).toThrow();
  expect(() => parseCandidates(candidatesData("/a", "s1", [candidate(), candidate()]), "/a", "s1")).toThrow();
  const malformed = candidatesData(); (malformed.candidates[0]!.trap as unknown as Record<string, unknown>).tags = "invalid";
  expect(() => parseCandidates(malformed, "/a", "s1")).toThrow();
  expect(() => parseMutation({ candidate: { id: "c2" } }, { projectRoot: "/a", sessionId: "s1", candidateId: "c1" })).toThrow();
});

test("Review drafts are isolated by project, session and candidate and preserve raw text", async () => {
  const f = fixture(); await seed(f); const base = candidateFields(candidate());
  f.model.edit(f.model.target()!, { ...base, title: "  Untrimmed A  " }, base);
  f.model.selectCandidate("c2"); expect(f.model.fields()).toBeUndefined();
  f.model.selectCandidate("c1"); expect(f.model.fields()?.title).toBe("  Untrimmed A  ");
  f.model.reset("/b", "s1", "c1"); await seed(f, "/b"); expect(f.model.dirty()).toBe(false);
  f.model.edit(f.model.target()!, { ...base, title: "B" }, base);
  f.model.reset("/a", "s2", "c1"); await seed(f, "/a", "s2"); expect(f.model.dirty()).toBe(false);
  f.model.reset("/a", "s1", "c1"); await seed(f); expect(f.model.fields()?.title).toBe("  Untrimmed A  ");
  f.model.discard(); expect(f.model.dirty()).toBe(false); expect(f.model.hasDrafts()).toBe(true);
});

test("candidate responses and errors cannot win across session changes or project A/B/A", async () => {
  const f = fixture(); const a = f.model.loadCandidates();
  f.model.reset("/b", "s1", "c1"); const b = f.model.loadCandidates();
  f.model.reset("/a", "s2", "c2"); const latest = f.model.loadCandidates();
  f.requests[2]!.resolve(candidatesData("/a", "s2")); await latest;
  f.requests[0]!.resolve(candidatesData()); await a;
  f.requests[1]!.reject(new Error("old failure")); await b;
  expect(f.model.state.sessionId).toBe("s2"); expect(f.model.current()?.id).toBe("c2"); expect(f.model.state.candidatesLoad).toBe("ready");
  expect(f.requests.every(r => r.options?.cache === "no-store")).toBe(true);
});

test("failed reads preserve drafts and retry without substituting a missing routed candidate", async () => {
  const f = fixture(); await seed(f); const base = candidateFields(candidate()); f.model.edit(f.model.target()!, { ...base, title: "Saved locally" }, base);
  const failed = f.model.loadCandidates(); f.requests.at(-1)!.reject(new Error("offline")); await failed;
  expect(f.model.state.candidatesLoad).toBe("error"); expect(f.model.fields()?.title).toBe("Saved locally");
  await seed(f); expect(f.model.fields()?.title).toBe("Saved locally");
  f.model.reset("/a", "s1", "missing"); await seed(f); expect(f.model.current()).toBeNull(); expect(f.model.state.candidateId).toBe("missing");
});

test("background refresh binds both reads to one context and defers external updates for a draft", async () => {
  const f = fixture(); await seed(f); const base = candidateFields(candidate()); f.model.edit(f.model.target()!, { ...base, title: "Local" }, base);
  const refresh = f.model.refresh(true); f.requests[1]!.resolve(sessionData()); await Promise.resolve(); await Promise.resolve();
  f.requests[2]!.resolve(candidatesData()); await refresh;
  expect(f.model.state.deferred).toBe(true); expect(f.model.fields()?.title).toBe("Local");
  expect(f.notifications).toContain("status.externalChangesDeferred");
  const late = f.model.refresh(true); f.model.reset("/b", "s1", "c1"); f.requests[3]!.resolve(sessionData()); await late;
  expect(f.requests).toHaveLength(4); expect(f.model.state.sessions).toEqual([]);
});

test("save captures original identity/payload and a late receipt cannot overwrite another project's draft", async () => {
  const f = fixture(); await seed(f); const base = candidateFields(candidate());
  f.model.edit(f.model.target()!, { ...base, title: "A submitted" }, base);
  const save = f.model.mutate("save"); await f.model.mutate("save");
  expect(f.requests).toHaveLength(2); expect(f.model.state.busy).toBe(true);
  expect(JSON.parse(String(f.requests[1]!.options?.body))).toMatchObject({ projectRoot: "/a", sessionId: "s1", candidateId: "c1", trap: { title: "A submitted" } });
  f.model.reset("/b", "s1", "c1"); await seed(f, "/b"); f.model.edit(f.model.target()!, { ...base, title: "B unsaved" }, base);
  f.requests[1]!.resolve({ candidate: { id: "c1" }, receipt }); await save;
  expect(f.model.state.project).toBe("/b"); expect(f.model.fields()?.title).toBe("B unsaved");
  expect(f.receipts[0]).toMatchObject({ target: { projectRoot: "/a", sessionId: "s1", candidateId: "c1" } });
  expect(f.notifications).toContain("review.completedElsewhere"); expect(f.model.state.busy).toBe(false);
});

test("a newer edit is retained when an earlier submitted draft completes", async () => {
  const f = fixture(); await seed(f); const base = candidateFields(candidate()), original = f.model.target()!;
  f.model.edit(original, { ...base, title: "Submitted" }, base); const save = f.model.mutate("save");
  f.model.edit(original, { ...base, title: "Newer" }, base); f.model.reset("/b", "s1", "c1");
  f.requests[1]!.resolve({ candidate: { id: "c1" } }); await save;
  f.model.reset("/a", "s1", "c1"); await seed(f); expect(f.model.fields()?.title).toBe("Newer");
});

test("accept conflicts preserve the visible draft and remain scoped to the initiating candidate", async () => {
  const f = fixture(); await seed(f); const base = candidateFields(candidate()); f.model.edit(f.model.target()!, { ...base, title: "My draft" }, base);
  const accept = f.model.mutate("accept");
  f.requests[1]!.reject(new ApiError("Conflict", 409, { possible_conflicts: [{ trap_id: 1, scope: "global", title: "Other", context: "Context", fix: "Fix", reason: "Similar" }] })); await accept;
  expect(f.model.fields()?.title).toBe("My draft"); expect(f.model.conflicts()[0]?.scope).toBe("global");
  f.model.selectCandidate("c2"); expect(f.model.conflicts()).toEqual([]);
  f.model.selectCandidate("c1"); f.model.edit(f.model.target()!, { ...base, title: "Edited" }, base); expect(f.model.conflicts()).toEqual([]);
});

test("insight mutations carry visible fields while preserving unrelated destination metadata", async () => {
  const f = fixture(), item = { ...candidate(), candidate_kind: "insight" as const, destination_payload: { title: "Source", body: "Body", summary: "Summary", tags: [], source_refs: ["https://example.com"], collection: { id: "collection" } } };
  const loading = f.model.loadCandidates(); f.requests[0]!.resolve(candidatesData("/a", "s1", [item])); await loading;
  const base = candidateFields(item); f.model.edit(f.model.target()!, { ...base, insight_body: "Edited body", insight_tags: "one, one\ntwo" }, base);
  const action = f.model.mutate("apply-insight"); f.model.reset("/b");
  expect(JSON.parse(String(f.requests[1]!.options?.body))).toMatchObject({ destinationPayload: { body: "Edited body", tags: ["one", "two"], collection: { id: "collection" } } });
  f.requests[1]!.resolve({ candidate: { id: "c1" }, receipt }); await action;
});

test("session deletion clears only that project's removed drafts and cannot reset a new selection", async () => {
  const f = fixture(), base = candidateFields(candidate()); await seed(f);
  f.model.edit(f.model.target()!, { ...base, title: "A draft" }, base);
  f.model.reset("/b", "s1", "c1"); await seed(f, "/b"); f.model.edit(f.model.target()!, { ...base, title: "B draft" }, base);
  const deletion = f.model.manageSession("delete", "s1"); await f.model.manageSession("delete", "s1");
  expect(f.requests).toHaveLength(3);
  f.model.reset("/a", "s1", "c1"); await seed(f);
  f.requests[2]!.resolve({ success: true }); await deletion;
  expect(f.model.fields()?.title).toBe("A draft"); expect(f.model.state.sessionId).toBe("s1");
  f.model.discard(); expect(f.model.hasDrafts()).toBe(false);
});

test("discard after deferred external changes loads the server version before actions resume", async () => {
  const f = fixture(), base = candidateFields(candidate()); await seed(f);
  f.model.edit(f.model.target()!, { ...base, title: "Local draft" }, base);
  const refresh = f.model.refresh(true); f.requests[1]!.resolve(sessionData()); await Promise.resolve(); await Promise.resolve();
  const latest = { ...candidate(), trap: { ...candidate().trap, title: "External edit" } };
  f.requests[2]!.resolve(candidatesData("/a", "s1", [latest])); await refresh;
  f.model.discard(); expect(f.model.state.candidatesLoad).toBe("loading"); expect(f.model.current()).toBeNull();
  f.requests[3]!.resolve(candidatesData("/a", "s1", [latest])); await Promise.resolve(); await Promise.resolve();
  expect(f.model.current()?.trap.title).toBe("External edit"); expect(f.model.dirty()).toBe(false);
});
