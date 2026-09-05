/** Immutable browser backups; payload decoders remain feature-specific. */
export interface Snapshot { version: 1; id: string; updatedAt: number }
export interface StoredSnapshot<T extends Snapshot> { key: string; raw: string; snapshot: T }
export type SnapshotStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
export const SNAPSHOT_TTL = 30 * 24 * 60 * 60 * 1000;
export const SNAPSHOT_LIMIT = 100;
export const SNAPSHOT_BYTES = 64 * 1024;
export function createSnapshotStore<T extends Snapshot>(prefix: string, decode: (raw: string, key: string, now: number) => T | null,
  storage: () => SnapshotStorage, now: () => number = Date.now, id: () => string = () => crypto.randomUUID()) {
  function remove(record: StoredSnapshot<T>) {
    const s = storage(); if (s.getItem(record.key) === record.raw) s.removeItem(record.key);
  }
  function list() {
    const s = storage(), time = now(), keys: string[] = [], records: StoredSnapshot<T>[] = []; let skipped = 0;
    for (let i = 0; i < s.length; i++) { const key = s.key(i); if (key?.startsWith(prefix)) keys.push(key); }
    for (const key of keys) {
      const raw = s.getItem(key); if (raw === null) continue;
      const snapshot = decode(raw, key, time); if (!snapshot) { skipped++; continue; }
      const record = { key, raw, snapshot };
      if (time - snapshot.updatedAt >= SNAPSHOT_TTL) { remove(record); continue; }
      records.push(record);
    }
    records.sort((a, b) => b.snapshot.updatedAt - a.snapshot.updatedAt || a.key.localeCompare(b.key));
    return { records, skipped };
  }
  function put(content: Record<string, unknown>, previous?: StoredSnapshot<T>): StoredSnapshot<T> {
    const time = now(), value = { ...content, version: 1, id: id(), updatedAt: time }, key = prefix + value.id, raw = JSON.stringify(value);
    const snapshot = decode(raw, key, time); if (!snapshot) throw new Error("Draft exceeds supported storage format or size");
    const existing = list().records;
    if (existing.length - Number(existing.some(r => r.key === previous?.key)) >= SNAPSHOT_LIMIT) throw new Error("Draft storage is full");
    const s = storage(); if (s.getItem(key) !== null) throw new Error("Draft snapshot identity collision");
    s.setItem(key, raw); if (previous) remove(previous);
    return { key, raw, snapshot };
  }
  return { list, put, remove, contains: (record: StoredSnapshot<T>) => storage().getItem(record.key) === record.raw };
}
