import { createSnapshotStore } from "./snapshot-store";
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
  const store = createSnapshotStore(LEARNING_DRAFT_PREFIX, parse, storage, now, id);
  return { remove: store.remove,
    list(target?: LearningTarget) { const result = store.list(); return { ...result, records: result.records.filter(r => !target || learningKey(r.snapshot.target) === learningKey(target)) }; },
    put(target: LearningTarget, content: DraftContent, previous?: StoredLearningDraft) { return store.put({ ...content, target: { ...target } }, previous); },
  };
}
