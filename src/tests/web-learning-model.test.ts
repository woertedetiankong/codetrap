import { expect, test } from "bun:test";
import { createLearningModel } from "../web/browser/learning-model";
import { draftFields, parseLearningLibrary, parsePreview, type LearningFields, type LearningTarget } from "../web/browser/learning-data";
const a: LearningTarget = { project: "/alpha", id: "same", title: "Alpha", libraryKey: "/alpha::same" };
const b: LearningTarget = { project: "/beta", id: "same", title: "Beta", libraryKey: "/beta::same" };
const draft = { title: "Rule", context: "When writing code", mistake: "Guessing the result", fix: "Check the source", scope: "project" as const, tags: ["one"], path_globs: ["src/**"], module: null };
const preview = (t = a) => ({ success: true, project_root: t.project, insight_id: t.id, destination: "candidate_inbox", draft });
const impact = (t = a, note: string | null = "saved") => ({ project_root: t.project, progress: { actor_ref: "local-user", insight_id: t.id, status: "not_started", feedback: null, linked_run_id: null, practice_note: note, updated_at: "2026-09-05T12:00:00Z", legacy_derived: false }, promotion: null });
function deferred() { let resolve!: (v: unknown) => void, reject!: (e: unknown) => void; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function setup(api: (path: string, options?: RequestInit) => Promise<unknown>) {
  const changes: Array<{ target: LearningTarget; part: string }> = [], notices: string[] = [], applied: LearningTarget[] = [], created: LearningTarget[] = [];
  const model = createLearningModel({ api, blocked: () => false, changed: (target, part) => { changes.push({ target, part }); }, notify: key => { notices.push(key); }, applyImpact: t => { applied.push(t); }, created: async t => { created.push(t); } });
  return { model, changes, notices, applied, created };
}
test("Learning drafts retain raw fields under source identity and discard only the selected draft", () => {
  const { model } = setup(async () => null);
  const fields: LearningFields = { ...draftFields(draft), tags: " one,  two ,", path_globs: "src/**\n lib/** " };
  model.editProposal(a, fields); model.editProposal(b, { ...fields, title: "Beta edits" }); model.editPractice(a, "Private\nnote", "");
  model.discard(a, "proposal");
  expect(model.entry(a)?.proposal).toBeUndefined(); expect(model.entry(a)?.practice?.value).toBe("Private\nnote");
  expect(model.entry(b)?.proposal?.value).toMatchObject({ title: "Beta edits", tags: fields.tags, path_globs: fields.path_globs });
  expect(model.hasDrafts()).toBe(true);
});
test("late draft generation installs only the original source's draft", async () => {
  const d = deferred(), { model, changes } = setup(async () => d.promise);
  const request = model.act(a, "begin"); model.editProposal(b, { ...draftFields(draft), title: "Keep beta" });
  d.resolve(preview()); await request;
  expect(model.entry(a)?.proposal?.value.title).toBe("Rule"); expect(model.entry(b)?.proposal?.value.title).toBe("Keep beta");
  expect(changes.filter(c => c.part === "render").map(c => c.target.project)).toEqual(["/alpha"]);
});
test("preview preserves newer typing and validates an exact version without reformatting raw fields", async () => {
  const d = deferred(); let waiting = true;
  const { model, notices } = setup(async () => waiting ? d.promise : preview());
  model.editProposal(a, draftFields(draft)); const pending = model.act(a, "preview");
  const newer = { ...draftFields(draft), title: "New title", tags: "one,  two ,", path_globs: "src/**\n lib/**" };
  model.editProposal(a, newer); d.resolve(preview()); await pending;
  expect(model.entry(a)?.proposal?.value).toEqual(newer); expect(model.entry(a)?.validatedVersion).toBeUndefined();
  expect(notices).toContain("learningFlow.earlierValidated");
  waiting = false; await model.act(a, "preview");
  expect(model.entry(a)?.proposal?.value).toEqual(newer);
  expect(model.entry(a)?.validatedVersion).toBe(model.entry(a)?.proposal?.version);
});
test("practice save keeps an edit back to the old saved value and blocks duplicate writes", async () => {
  const d = deferred(); const bodies: unknown[] = [];
  const { model, applied } = setup(async (_path, options) => { bodies.push(JSON.parse(String(options?.body))); return d.promise; });
  model.editPractice(a, "Submitted", "Original"); const pending = model.act(a, "practice");
  model.editPractice(a, "Original", "Original"); await model.act(a, "practice");
  d.resolve(impact(a, "Submitted")); await pending;
  expect(bodies).toEqual([{ projectRoot: "/alpha", id: "same", practiceNote: "Submitted" }]);
  expect(model.entry(a)?.practice?.value).toBe("Original"); expect(applied).toEqual([a]); expect(model.busy).toBe(false);
});
test("a wrong-project progress response preserves the draft and never updates the selected item", async () => {
  const { model, applied } = setup(async () => impact(b));
  model.editPractice(a, "Keep this", ""); await model.act(a, "practice");
  expect(model.entry(a)?.practice?.value).toBe("Keep this"); expect(model.entry(a)?.error).toContain("identity mismatch"); expect(applied).toEqual([]);
});
test("creation submits the visible payload and clears only that source's successful proposal", async () => {
  const d = deferred(); let body: Record<string, unknown> = {};
  const { model, created } = setup(async (_path, options) => { body = JSON.parse(String(options?.body)); return d.promise; });
  model.editProposal(a, { ...draftFields(draft), title: "Visible title", tags: "one, two", path_globs: "a/**\nb/**" });
  const pending = model.act(a, "create"); model.editProposal(b, { ...draftFields(draft), title: "Keep beta" });
  d.resolve({ success: true, project_root: a.project, insight_id: a.id, destination: "candidate_inbox", session_id: "session", candidate: { id: "candidate", title: "Visible title", status: "proposed" } }); await pending;
  expect(body).toMatchObject({ projectRoot: "/alpha", id: "same", draft: { title: "Visible title", tags: ["one", "two"], path_globs: ["a/**", "b/**"] } });
  expect(model.entry(a)?.proposal).toBeUndefined(); expect(model.entry(b)?.proposal?.value.title).toBe("Keep beta"); expect(created).toEqual([a]);
});
test("unconfirmed preview/create failures retain drafts, remain scoped and allow explicit retry", async () => {
  let fail = true; const { model } = setup(async () => { if (fail) throw new Error("Disconnected"); return preview(); });
  model.editProposal(a, draftFields(draft)); model.editProposal(b, draftFields(draft));
  await model.act(a, "preview"); expect(model.entry(a)?.error).toBe("Disconnected"); expect(model.entry(b)?.error).toBe("");
  expect(model.entry(a)?.proposal).toBeDefined(); fail = false; await model.act(a, "preview"); expect(model.entry(a)?.error).toBe("");
});
test("Learning response decoding rejects wrong routes, source identities and malformed consumed fields", () => {
  const insight = { id: a.id, library_key: a.libraryKey, origin_project_root: a.project, origin_project_name: "Alpha", title: "A", summary: "Summary", body: "Body", tags: [], source_refs: [], learning_impact: impact(a) };
  const payload = { project_root: a.project, scope: "all", insights: [insight], collections: [], collection_items: [] };
  expect(parseLearningLibrary(payload, a.project, "all").insights).toHaveLength(1);
  for (const invalid of [{ ...payload, project_root: "/beta" }, { ...payload, scope: "project" }, { ...payload, insights: [insight, insight] }, { ...payload, insights: [{ ...insight, library_key: b.libraryKey }] }, { ...payload, insights: [{ ...insight, tags: "bad" }] }]) expect(() => parseLearningLibrary(invalid, a.project, "all")).toThrow();
  expect(() => parsePreview(preview(b), a)).toThrow("identity mismatch");
});
