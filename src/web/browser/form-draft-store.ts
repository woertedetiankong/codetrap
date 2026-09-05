import { createSnapshotStore, SNAPSHOT_BYTES, type Snapshot, type SnapshotStorage } from "./snapshot-store";
export const FORM_DRAFT_PREFIX = "codetrap-form-draft:";
export type FormKind = "review" | "eval-candidate" | "eval-case" | "eval-run";
export type FormFields = Record<string, string>;
export interface FormSnapshot extends Snapshot { form: FormKind; owner: string[]; context: string; fields: FormFields }
const allowed: Record<FormKind, string[]> = {
  review: ["title", "category", "scope", "severity", "tags", "path_globs", "module", "owner", "context", "mistake", "fix", "insight_title", "insight_tags", "insight_summary", "insight_body", "insight_source_refs", "insight_source_unit_refs"],
  "eval-candidate": ["query", "mode", "judgment", "goldTrapIds", "note", "rejectionReason"],
  "eval-case": ["query", "judgment", "goldTrapIds"], "eval-run": ["profile", "trials", "seed"],
};
export const formOwnerKey = (form: FormKind, owner: string[]) => JSON.stringify([form, ...owner]);
function parse(raw: string, key: string, now: number): FormSnapshot | null {
  if (new TextEncoder().encode(raw).length > SNAPSHOT_BYTES) return null;
  let v: FormSnapshot; try { v = JSON.parse(raw); } catch { return null; }
  if (!v || v.version !== 1 || typeof v.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(v.id) || key !== FORM_DRAFT_PREFIX + v.id ||
    !Number.isSafeInteger(v.updatedAt) || v.updatedAt < 0 || v.updatedAt > now + 300000 || typeof v.form !== "string" || !Object.hasOwn(allowed, v.form) ||
    !Array.isArray(v.owner) || v.owner.length !== (v.form === "review" ? 3 : v.form === "eval-candidate" ? 2 : 1) || !v.owner.every(s => typeof s === "string" && s.length > 0) ||
    typeof v.context !== "string" || !v.context || !v.fields || typeof v.fields !== "object" || Array.isArray(v.fields) || !Object.keys(v.fields).length ||
    !Object.entries(v.fields).every(([k, value]) => allowed[v.form].includes(k) && typeof value === "string")) return null;
  const required = v.form === "review" ? ("insight_title" in v.fields ? allowed.review.filter(k => k.startsWith("insight_")) : allowed.review.filter(k => !k.startsWith("insight_"))) : allowed[v.form];
  if (required.some(k => !Object.hasOwn(v.fields, k))) return null;
  if ("goldTrapIds" in v.fields) { try { const ids: unknown = JSON.parse(v.fields.goldTrapIds!); if (!Array.isArray(ids) || !ids.every(id => Number.isSafeInteger(id) && id > 0)) return null; } catch { return null; } }
  return { version: 1, id: v.id, updatedAt: v.updatedAt, form: v.form, owner: [...v.owner], context: v.context, fields: { ...v.fields } };
}
export const createFormDraftStore = (storage: () => SnapshotStorage = () => window.localStorage, now = Date.now, id: () => string = () => crypto.randomUUID()) => createSnapshotStore(FORM_DRAFT_PREFIX, parse, storage, now, id);
