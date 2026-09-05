import { statSync } from "node:fs";
// Cache projections only, never connections or raw events. File changes (including
// WAL commits and replacement) invalidate the entry before the next read.
const entries = new Map<string, { stamp: string; value: unknown; bytes: number }>();
const MAX_BYTES = 8 * 1024 * 1024, MAX_ENTRIES = 24;
let bytes = 0;
export function observationFileStamp(path: string): string | null {
  try {
    return [path, path + "-wal", path + "-journal"].map((file, i) => {
      try { const s = statSync(file, { bigint: true }); return [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(":"); }
      catch (error) { if (i && (error as NodeJS.ErrnoException).code === "ENOENT") return "absent"; throw error; }
    }).join("/");
  } catch { return null; }
}
export function cachedObservationRead<T>(path: string, project: string, part: string, compute: () => T, openedStamp: string | null): T {
  const key = JSON.stringify([path, project, part]), before = observationFileStamp(path), cached = entries.get(key);
  // Each caller has already opened and schema-checked the database. A commit
  // during open/read disables caching for that read instead of blessing it.
  if (before && before === openedStamp && cached?.stamp === before) {
    entries.delete(key); entries.set(key, cached); return structuredClone(cached.value) as T;
  }
  if (cached) { entries.delete(key); bytes -= cached.bytes; }
  const value = compute();
  if (before && before === openedStamp && before === observationFileStamp(path)) {
    const size = Buffer.byteLength(JSON.stringify(value));
    if (size <= MAX_BYTES / 2) {
      while (entries.size && (entries.size >= MAX_ENTRIES || bytes + size > MAX_BYTES)) {
        const oldest = entries.keys().next().value!; bytes -= entries.get(oldest)!.bytes; entries.delete(oldest);
      }
      entries.set(key, { stamp: before, value: structuredClone(value), bytes: size }); bytes += size;
    }
  }
  return value;
}
