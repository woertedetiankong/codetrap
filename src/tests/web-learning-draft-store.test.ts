import { expect, test } from "bun:test";
import { createLearningDraftStore, LEARNING_DRAFT_PREFIX, LEARNING_DRAFT_TTL, LEARNING_DRAFT_LIMIT, type DraftStorage } from "../web/browser/learning-draft-store";
import type { LearningTarget } from "../web/browser/learning-data";
const a: LearningTarget = { project: "/alpha", id: "one", title: "Alpha", libraryKey: "/alpha::one" };
const b: LearningTarget = { project: "/beta", id: "one", title: "Beta", libraryKey: "/beta::one" };
const fields = { title: "A rule", context: "Context\nwith lines", mistake: "Mistake", fix: "  Keep raw text\n", tags: " one,  two ,", scope: "project", module: "", path_globs: "src/**\n lib/**" };
function memory() {
  const values = new Map<string, string>(); let deny = false;
  const storage: DraftStorage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: k => values.get(k) ?? null,
    setItem(k, v) { if (deny) throw new Error("Quota exceeded"); values.set(k, v); }, removeItem: k => { values.delete(k); } };
  let n = 0, time = 1000000000000;
  return { values, storage, store: createLearningDraftStore(() => storage, () => time, () => "snapshot-" + ++n), fail: () => { deny = true; }, advance: (ms: number) => { time += ms; } };
}
test("durable Learning drafts preserve raw fields, separate sources and recover after reopening the store", () => {
  const f = memory(); f.store.put(a, { kind: "proposal", value: fields }); f.store.put(b, { kind: "practice", value: "Beta note", baseline: "Old" });
  const reopened = createLearningDraftStore(() => f.storage, () => 1000000000000);
  expect(reopened.list(a).records.map(r => r.snapshot)).toMatchObject([{ kind: "proposal", value: fields, target: a }]);
  expect(reopened.list(b).records[0].snapshot).toMatchObject({ kind: "practice", value: "Beta note", baseline: "Old" });
});
test("immutable snapshots preserve concurrent writers and delete only the inspected version", () => {
  const f = memory();
  const first = f.store.put(a, { kind: "practice", value: "Tab A", baseline: "" });
  const second = f.store.put(a, { kind: "practice", value: "Tab B", baseline: "" });
  const newer = f.store.put(a, { kind: "practice", value: "Tab A newer", baseline: "" }, first);
  f.store.remove(first); f.store.remove(second);
  expect(f.store.list(a).records.map(r => r.snapshot.value)).toEqual(["Tab A newer"]);
  expect(newer.key).not.toBe(first.key);
});
test("quota and oversized-draft failures retain the prior recoverable snapshot", () => {
  const f = memory(), previous = f.store.put(a, { kind: "practice", value: "Recover me", baseline: "" });
  expect(() => f.store.put(a, { kind: "proposal", value: { ...fields, fix: "中".repeat(30000) } }, previous)).toThrow();
  f.fail(); expect(() => f.store.put(a, { kind: "practice", value: "New", baseline: "" }, previous)).toThrow("Quota");
  expect(f.store.list(a).records[0].snapshot.value).toBe("Recover me");
});
test("expiry removes supported old drafts only and ignores malformed or future schemas", () => {
  const f = memory(); f.store.put(a, { kind: "practice", value: "Old", baseline: "" });
  f.values.set("other-app", "keep"); f.values.set(LEARNING_DRAFT_PREFIX + "broken", "{");
  f.values.set(LEARNING_DRAFT_PREFIX + "future", JSON.stringify({ version: 2, value: "keep" }));
  f.advance(LEARNING_DRAFT_TTL); expect(f.store.list()).toEqual({ records: [], skipped: 2 });
  expect(f.values.size).toBe(3); expect(f.values.get("other-app")).toBe("keep");
});
test("snapshot count limit never evicts another draft and permits replacing an owned version", () => {
  const f = memory(); const first = f.store.put(a, { kind: "practice", value: "first", baseline: "" });
  for (let i = 1; i < LEARNING_DRAFT_LIMIT; i++) f.store.put(a, { kind: "practice", value: String(i), baseline: "" });
  expect(() => f.store.put(b, { kind: "proposal", value: fields })).toThrow("full");
  f.store.put(a, { kind: "practice", value: "updated", baseline: "" }, first);
  expect(f.store.list().records).toHaveLength(LEARNING_DRAFT_LIMIT);
});
test("tampered identities, fields and timestamps cannot become recoverable state", () => {
  const f = memory(), record = f.store.put(a, { kind: "proposal", value: fields });
  for (const change of [{ target: { ...a, libraryKey: b.libraryKey } }, { value: { ...fields, fix: 7 } }, { updatedAt: 9999999999999 }, { id: "different" }, { value: { ...fields, token: "should not restore" } }]) {
    f.values.set(record.key, JSON.stringify({ ...record.snapshot, ...change }));
    expect(f.store.list().records).toHaveLength(0);
  }
  f.store.remove(record); expect(f.values.has(record.key)).toBe(true);
});
test("unavailable browser storage is reported without introducing a memory-only success", () => {
  const store = createLearningDraftStore(() => { throw new Error("Storage denied"); });
  expect(() => store.list()).toThrow("Storage denied");
  expect(() => store.put(a, { kind: "practice", value: "note", baseline: "" })).toThrow("Storage denied");
});
