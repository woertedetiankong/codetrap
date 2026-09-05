import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEvalFixture, type EvalFixture } from "./search-eval";
import type { TrapOperations } from "./trap-operations";
import { revisionInput } from "../domain/experience-revision";
import { withAdvisoryLock } from "./advisory-lock";
import { writeFileAtomic } from "./fs-json";

export const PROJECT_EVAL_SUITE = ".codetrap/evals/suite.json";
export const LEGACY_EVAL_SUITE = "src/tests/fixtures/search-eval.json";
export type EvalSuitePath = typeof PROJECT_EVAL_SUITE | typeof LEGACY_EVAL_SUITE;
export interface EvalSuiteIdentity {
  version: 1;
  origin: "library" | "legacy";
  source_sha256: string;
  refs: Array<{ fixture_id: number; scope: "project" | "global" | null; trap_id: number | null; revision: string | null }>;
}
export type ProjectSuiteFixture = EvalFixture & { codetrap_suite?: EvalSuiteIdentity };
export const evalSuiteHash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const evalCorpusHash = (fixture: ProjectSuiteFixture) => evalSuiteHash(JSON.stringify([fixture.traps, fixture.codetrap_suite ?? null]));
export function projectEvalPath(project: string): EvalSuitePath {
  return existsSync(join(project, PROJECT_EVAL_SUITE)) || !existsSync(join(project, LEGACY_EVAL_SUITE)) ? PROJECT_EVAL_SUITE : LEGACY_EVAL_SUITE;
}
export function requireEvalPath(value: unknown): EvalSuitePath {
  if (value !== PROJECT_EVAL_SUITE && value !== LEGACY_EVAL_SUITE) throw new Error("Unsupported evaluation suite path.");
  return value;
}
export function readProjectSuite(project: string, path: EvalSuitePath = projectEvalPath(project)) {
  const bytes = readFileSync(join(project, path), "utf8");
  const fixture = parseEvalFixture(bytes, path) as ProjectSuiteFixture;
  // New identity metadata is checked before displaying or using any live links.
  const meta = fixture.codetrap_suite;
  if (meta && (meta.version !== 1 || !/^[a-f0-9]{64}$/.test(meta.source_sha256) || !["library", "legacy"].includes(meta.origin) || !Array.isArray(meta.refs)
    || meta.refs.length !== fixture.traps.length || !meta.refs.every((r, i) => r.fixture_id === i + 1 &&
      (meta.origin === "legacy" ? r.scope === null && r.trap_id === null && r.revision === null
        : ["project", "global"].includes(r.scope!) && Number.isSafeInteger(r.trap_id) && r.trap_id! > 0 && typeof r.revision === "string" && r.revision.startsWith(r.scope + ":"))))) throw new Error("Invalid evaluation corpus identity mapping.");
  if (meta?.origin === "library" && meta.source_sha256 !== evalSuiteHash(JSON.stringify([fixture.traps, meta.refs]))) throw new Error("The frozen corpus no longer matches its source identities.");
  return { path, fixture, bytes, sha256: evalSuiteHash(bytes), corpus_sha256: evalCorpusHash(fixture) };
}

export class ProjectEvalSuite {
  constructor(private readonly project: string, private readonly traps: TrapOperations) {}
  status() {
    const path = projectEvalPath(this.project);
    if (!existsSync(join(this.project, path))) return { state: "missing" as const, path, count: 0, cases: 0, sha256: null, corpus_sha256: null, traps: [] };
    try {
      const value = readProjectSuite(this.project, path);
      return { state: path === PROJECT_EVAL_SUITE ? "local" as const : "legacy" as const, path, count: value.fixture.traps.length, cases: value.fixture.queries.length, sha256: value.sha256,
        corpus_sha256: value.corpus_sha256, traps: value.fixture.traps.map((trap, i) => ({ id: i + 1, title: trap.title, source_ref: value.fixture.codetrap_suite?.refs[i] })) };
    } catch { return { state: "invalid" as const, path, count: null, cases: null, sha256: null, corpus_sha256: null, traps: [] }; }
  }
  preview(origin: "library" | "legacy") {
    const local = join(this.project, PROJECT_EVAL_SUITE);
    if (existsSync(local)) throw new Error("A project suite already exists. Its frozen corpus cannot be replaced here.");
    const fixture = this.prepare(origin);
    return this.view(fixture);
  }
  create(origin: "library" | "legacy", digest: string) {
    mkdirSync(join(this.project, ".codetrap/evals"), { recursive: true });
    return withAdvisoryLock(join(this.project, ".codetrap/evals/.initialize.lock"), () => {
      const local = join(this.project, PROJECT_EVAL_SUITE);
      if (existsSync(local)) {
        const prior = readProjectSuite(this.project, PROJECT_EVAL_SUITE);
        if (prior.sha256 === digest) return this.status();
        throw new Error("A different project suite already exists.");
      }
      const fixture = this.prepare(origin);
      const bytes = this.bytes(fixture);
      if (evalSuiteHash(bytes) !== digest) throw new Error("The source changed after preview. Preview the corpus again.");
      writeFileAtomic(local, bytes);
      return this.status();
    }).value;
  }
  export(digest: string) {
    const suite = readProjectSuite(this.project);
    if (suite.sha256 !== digest) throw new Error("The suite changed. Refresh before exporting.");
    return { filename: "codetrap-eval-suite.json", content: suite.bytes, sha256: suite.sha256 };
  }
  private prepare(origin: "library" | "legacy"): ProjectSuiteFixture {
    if (origin === "legacy") {
      const legacy = readProjectSuite(this.project, LEGACY_EVAL_SUITE);
      return { ...legacy.fixture, codetrap_suite: { version: 1, origin, source_sha256: legacy.sha256,
        refs: legacy.fixture.traps.map((_, i) => ({ fixture_id: i + 1, scope: null, trap_id: null, revision: null })) } };
    }
    if (origin !== "library") throw new Error("Choose library or legacy as the corpus source.");
    const entries = this.traps.listTraps({ status: "active", limit: 501 }).flatMap(group => {
      if (group.traps.length > 500) throw new Error("Corpus creation supports at most 500 active lessons per scope.");
      return group.traps.map(trap => ({ trap, scope: group.scope as "project" | "global" }));
    });
    if (!entries.length) throw new Error("Add a confirmed lesson before creating an evaluation corpus.");
    const traps = entries.map(e => revisionInput(e.trap));
    const refs = entries.map((e, i) => ({ fixture_id: i + 1, scope: e.scope, trap_id: e.trap.id, revision: `${e.scope}:${e.trap.updated_at}` }));
    return { traps, queries: [], codetrap_suite: { version: 1, origin, source_sha256: evalSuiteHash(JSON.stringify([traps, refs])), refs } };
  }
  private bytes(fixture: ProjectSuiteFixture) { return JSON.stringify(fixture, null, 2) + "\n"; }
  private view(fixture: ProjectSuiteFixture) {
    return { path: PROJECT_EVAL_SUITE, origin: fixture.codetrap_suite!.origin, digest: evalSuiteHash(this.bytes(fixture)),
      cases: fixture.queries.length, traps: fixture.traps.map((trap, i) => ({ title: trap.title, ...fixture.codetrap_suite!.refs[i]! })) };
  }
}
