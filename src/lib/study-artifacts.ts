import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Phase2Store } from "./phase2-store";
import { withAdvisoryLock } from "./advisory-lock";
import { writeFileAtomic } from "./fs-json";

export const MAX_STUDY_BYTES = 8 * 1024 * 1024;
export type StudyTarget = { kind: "insight" | "collection"; id: string };
export type StudyRevision = {
  version: number; sha256: string; bytes: number; title: string;
  source_refs: string[]; source_revision: string | null; created_at: string;
  restored_from: number | null;
};
export type StudyArtifact = { id: string; target: StudyTarget; revisions: StudyRevision[] };
export type StudyImport = {
  file: string; target: StudyTarget; title: string; id?: string;
  expected_version?: number; source_refs?: string[]; source_revision?: string | null;
};
type Document = { version: 1; artifacts: StudyArtifact[] };
const ID = /^study-[a-f0-9-]{36}$/;
const HASH = /^[a-f0-9]{64}$/;
function digest(data: Uint8Array) { return createHash("sha256").update(data).digest("hex"); }
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v); }
function text(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim() || v.length > 4096 || /[\u0000-\u0008]/.test(v)) throw new Error(`Invalid ${field}.`);
  return v.trim();
}
function positive(v: unknown, field: string): number {
  if (!Number.isSafeInteger(v) || Number(v) < 1) throw new Error(`Invalid ${field}.`);
  return Number(v);
}
export function studyTarget(v: unknown): StudyTarget {
  if (!record(v) || !["insight", "collection"].includes(String(v.kind))) throw new Error("Target must be an insight or collection.");
  return { kind: v.kind as StudyTarget["kind"], id: text(v.id, "target.id") };
}
function refs(v: unknown): string[] {
  if (!Array.isArray(v) || v.length > 100) throw new Error("source_refs must be a list of at most 100 strings.");
  return [...new Set(v.map(x => text(x, "source_ref")))];
}
function regular(path: string) {
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) throw new Error("Study files must be regular files, not symbolic links.");
}
function readBounded(path: string): Buffer {
  regular(path);
  const fd = openSync(path, "r");
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_STUDY_BYTES || stat.size === 0) throw new Error("Study HTML must be non-empty and at most 8 MiB.");
    const data = readFileSync(fd);
    if (data.length > MAX_STUDY_BYTES) throw new Error("Study HTML exceeds 8 MiB.");
    return data;
  } finally { closeSync(fd); }
}
/** Files are copied, never executed or followed as URLs. Targets remain in the existing Learning library. */
export class StudyArtifacts {
  private base: string;
  constructor(private projectRoot: string) { this.base = join(projectRoot, ".codetrap", "learning", "artifacts"); }
  private directories(create = false) {
    let dir = this.projectRoot;
    for (const segment of [".codetrap", "learning", "artifacts", "blobs"]) {
      dir = join(dir, segment);
      if (!existsSync(dir)) { if (create) mkdirSync(dir); else continue; }
      if (existsSync(dir) && (lstatSync(dir).isSymbolicLink() || !lstatSync(dir).isDirectory())) throw new Error("Unsafe study storage directory.");
    }
  }
  private read(): Document {
    this.directories();
    const path = join(this.base, "index.json");
    if (!existsSync(path)) return { version: 1, artifacts: [] };
    regular(path);
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!record(raw) || raw.version !== 1 || !Array.isArray(raw.artifacts)) throw new Error("Invalid study artifact index.");
    const ids = new Set<string>();
    const artifacts = raw.artifacts.map((a: unknown): StudyArtifact => {
      if (!record(a) || typeof a.id !== "string" || !ID.test(a.id) || ids.has(a.id) || !Array.isArray(a.revisions) || !a.revisions.length) throw new Error("Invalid study artifact record.");
      ids.add(a.id);
      const revisions = a.revisions.map((r: unknown, i: number): StudyRevision => {
        if (!record(r) || r.version !== i + 1 || typeof r.sha256 !== "string" || !HASH.test(r.sha256)) throw new Error("Invalid study revision.");
        const bytes = positive(r.bytes, "bytes");
        if (bytes > MAX_STUDY_BYTES) throw new Error("Invalid study revision size.");
        return { version: i + 1, sha256: r.sha256, bytes, title: text(r.title, "title"), source_refs: refs(r.source_refs),
          source_revision: r.source_revision === null ? null : text(r.source_revision, "source_revision"), created_at: text(r.created_at, "created_at"),
          restored_from: r.restored_from === null ? null : positive(r.restored_from, "restored_from") };
      });
      return { id: a.id, target: studyTarget(a.target), revisions };
    });
    return { version: 1, artifacts };
  }
  private checkTarget(target: StudyTarget) {
    const library = new Phase2Store(this.projectRoot).learningLibrary();
    const entries = target.kind === "insight" ? library.insights : library.collections;
    if (!entries.some(x => x.id === target.id)) throw new Error(`Learning ${target.kind} ${target.id} not found. Save the study content to Learning first.`);
  }
  list(target?: StudyTarget): StudyArtifact[] {
    if (target) this.checkTarget(studyTarget(target));
    return this.read().artifacts.filter(a => !target || a.target.kind === target.kind && a.target.id === target.id);
  }
  forInsight(id: string): StudyArtifact[] {
    this.checkTarget({ kind: "insight", id });
    const collectionIds = new Phase2Store(this.projectRoot).learningLibrary().collection_items.filter(i => i.insight_id === id).map(i => i.collection_id);
    return this.list().filter(a => a.target.kind === "insight" ? a.target.id === id : collectionIds.includes(a.target.id));
  }
  get(id: string): StudyArtifact {
    if (!ID.test(id)) throw new Error("Invalid study artifact id.");
    const a = this.read().artifacts.find(a => a.id === id);
    if (!a) throw new Error("Study artifact not found.");
    this.checkTarget(a.target);
    return a;
  }
  content(id: string, version?: number): { artifact: StudyArtifact; revision: StudyRevision; html: string } {
    const artifact = this.get(id);
    const revision = version === undefined ? artifact.revisions.at(-1)! : artifact.revisions[positive(version, "version") - 1];
    if (!revision) throw new Error("Study revision not found.");
    const data = readBounded(join(this.base, "blobs", revision.sha256 + ".html"));
    if (data.length !== revision.bytes || digest(data) !== revision.sha256) throw new Error("Study content integrity check failed.");
    return { artifact, revision, html: new TextDecoder("utf-8", { fatal: true }).decode(data) };
  }
  import(input: StudyImport): StudyArtifact {
    const target = studyTarget(input.target); this.checkTarget(target);
    const title = text(input.title, "title");
    const file = resolve(text(input.file, "file"));
    if (!/\.html?$/i.test(file)) throw new Error("Import a self-contained .html file.");
    const data = readBounded(file);
    const html = new TextDecoder("utf-8", { fatal: true }).decode(data);
    if (!/<(?:!doctype\s+html|html|div|svg|main|section)\b/i.test(html) || html.includes("\0")) throw new Error("Expected UTF-8 HTML.");
    const sourceRefs = refs(input.source_refs ?? []);
    const sourceRevision = input.source_revision == null ? null : text(input.source_revision, "source_revision");
    this.directories(true);
    return withAdvisoryLock(join(this.base, ".lock"), () => {
      const document = this.read();
      let a: StudyArtifact;
      if (input.id !== undefined) {
        a = document.artifacts.find(a => a.id === input.id)!;
        if (!a) throw new Error("Study artifact not found.");
        if (a.target.kind !== target.kind || a.target.id !== target.id) throw new Error("Cannot change a study artifact's target.");
        this.expectVersion(a, input.expected_version);
      } else {
        if (input.expected_version !== undefined) throw new Error("expected_version requires an artifact id.");
        a = { id: "study-" + randomUUID(), target, revisions: [] }; document.artifacts.push(a);
      }
      const sha256 = digest(data), blob = join(this.base, "blobs", sha256 + ".html");
      if (existsSync(blob)) { const old = readBounded(blob); if (digest(old) !== sha256) throw new Error("Existing study blob failed integrity check."); }
      else writeFileSync(blob, data, { flag: "wx", mode: 0o600 });
      a.revisions.push({ version: a.revisions.length + 1, title, sha256, bytes: data.length, source_refs: sourceRefs, source_revision: sourceRevision, created_at: new Date().toISOString(), restored_from: null });
      writeFileAtomic(join(this.base, "index.json"), JSON.stringify(document, null, 2) + "\n");
      return a;
    }).value;
  }
  restore(id: string, version: number, expectedVersion: number): StudyArtifact {
    const verified = this.content(id, version);
    this.directories(true);
    return withAdvisoryLock(join(this.base, ".lock"), () => {
      const document = this.read();
      const a = document.artifacts.find(a => a.id === id)!;
      if (!a) throw new Error("Study artifact not found.");
      this.expectVersion(a, expectedVersion);
      a.revisions.push({ ...verified.revision, version: a.revisions.length + 1, created_at: new Date().toISOString(), restored_from: version });
      writeFileAtomic(join(this.base, "index.json"), JSON.stringify(document, null, 2) + "\n");
      return a;
    }).value;
  }
  private expectVersion(a: StudyArtifact, expected: number | undefined) {
    if (positive(expected, "expected_version") !== a.revisions.length) throw new Error("Study artifact changed. Reload its latest version before updating.");
  }
}
