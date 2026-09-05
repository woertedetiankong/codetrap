import { learningKey, type LearningFields, type LearningTarget } from "./learning-data";

export const LEARNING_DRAFT_PREFIX = "codetrap-learning-draft:";
export const LEARNING_DRAFT_TTL = 30 * 24 * 60 * 60 * 1000;
export const LEARNING_DRAFT_LIMIT = 100;
export const LEARNING_DRAFT_BYTES = 64 * 1024;
export type DraftContent = { kind: "practice"; value: string; baseline: string } | { kind: "proposal"; value: LearningFields };
export type DraftSnapshot = DraftContent & { version: 1; id: string; updatedAt: number; target: LearningTarget };
export interface StoredLearningDraft { key: string; raw: string; snapshot: DraftSnapshot }
export type DraftStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
const fieldNames = ["title", "context", "mistake", "fix", "scope", "tags", "path_globs", "module"];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function parse(raw: string, key: string, now: number): DraftSnapshot | null {
  if (new TextEncoder().encode(raw).length > LEARNING_DRAFT_BYTES) return null;
  let v: unknown; try { v = JSON.parse(raw); } catch { return null; }
  if (!object(v) || v.version !== 1 || typeof v.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(v.id) || key !== LEARNING_DRAFT_PREFIX + v.id ||
      typeof v.updatedAt !== "number" || !Number.isSafeInteger(v.updatedAt) || v.updatedAt < 0 || v.updatedAt > now + 300000 || !object(v.target)) return null;
  const t = v.target;
  if (!["project", "id", "title", "libraryKey"].every(k => typeof t[k] === "string") || !t.project || !t.id || t.libraryKey !== t.project + "::" + t.id) return null;
  if (v.kind === "practice") {
    if (typeof v.value !== "string" || v.value.length > 1000 || typeof v.baseline !== "string" || v.baseline.length > 1000) return null;
  } else if (v.kind === "proposal") {
    if (!object(v.value) || Object.keys(v.value).length !== fieldNames.length || !fieldNames.every(k => typeof (v.value as Record<string, unknown>)[k] === "string") || !["project", "global"].includes(String(v.value.scope))) return null;
  } else return null;
  // Reconstruct the allowlisted envelope; unknown fields never reach model state.
  const target: LearningTarget = { project: String(t.project), id: String(t.id), title: String(t.title), libraryKey: String(t.libraryKey) };
  const metadata = { version: 1 as const, id: v.id, updatedAt: v.updatedAt, target };
  return v.kind === "practice" ? { ...metadata, kind: "practice", value: v.value as string, baseline: v.baseline as string }
    : { ...metadata, kind: "proposal", value: Object.fromEntries(fieldNames.map(k => [k, (v.value as Record<string, unknown>)[k]])) as LearningFields };
}
export function createLearningDraftStore(storage: () => DraftStorage, now: () => number = Date.now, id: () => string = () => crypto.randomUUID()) {
  function remove(record: StoredLearningDraft) {
    const s = storage();
    if (s.getItem(record.key) === record.raw) s.removeItem(record.key);
  }
  function list(target?: LearningTarget) {
    const s = storage(), time = now(), keys: string[] = [], records: StoredLearningDraft[] = [];
    let skipped = 0;
    for (let i = 0; i < s.length; i++) { const key = s.key(i); if (key?.startsWith(LEARNING_DRAFT_PREFIX)) keys.push(key); }
    for (const key of keys) {
      const raw = s.getItem(key); if (raw === null) continue;
      const snapshot = parse(raw, key, time); if (!snapshot) { skipped++; continue; }
      const record = { key, raw, snapshot };
      if (time - snapshot.updatedAt >= LEARNING_DRAFT_TTL) { remove(record); continue; }
      if (!target || learningKey(snapshot.target) === learningKey(target)) records.push(record);
    }
    records.sort((a, b) => b.snapshot.updatedAt - a.snapshot.updatedAt || a.key.localeCompare(b.key));
    return { records, skipped };
  }
  function put(target: LearningTarget, content: DraftContent, previous?: StoredLearningDraft): StoredLearningDraft {
    const s = storage(), time = now(), snapshot = { ...content, version: 1 as const, id: id(), updatedAt: time, target: { ...target } };
    const key = LEARNING_DRAFT_PREFIX + snapshot.id, raw = JSON.stringify(snapshot);
    if (!parse(raw, key, time)) throw new Error("Draft exceeds supported storage format or size");
    const existing = list().records;
    if (existing.length - Number(existing.some(r => r.key === previous?.key)) >= LEARNING_DRAFT_LIMIT) throw new Error("Draft storage is full");
    if (s.getItem(key) !== null) throw new Error("Draft snapshot identity collision");
    // Each write has a new immutable key. Never overwrite another tab's version.
    s.setItem(key, raw);
    if (previous) remove(previous);
    return { key, raw, snapshot };
  }
  return { list, put, remove };
}
