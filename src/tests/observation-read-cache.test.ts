import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { copyFileSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openObservationLedger, openObservationLedgerReadOnly, observationLedgerPath } from "../lib/observation-ledger";
import { ObservationRunRecorder } from "../lib/observation-recorder";
import { cachedObservationRead, observationFileStamp } from "../lib/observation-read-cache";
const start = (root: string, id: string) => new ObservationRunRecorder(root).start({ run_id: id, device_id: "test", source_client: "codex", source_session_ref: null, repository_revision: null, branch: null, model_provider: null, model_name: null, completeness: "partial" });
const read = (root: string) => { const ledger = openObservationLedgerReadOnly(root)!; try { return { overview: ledger.overview(), runs: ledger.listRuns(2), evals: ledger.evals() }; } finally { ledger.close(); } };
test("cached reads equal fresh projections and observe a different process committing to the WAL", () => {
  const root = mkdtempSync(join(tmpdir(), "codetrap-cache-test-"));
  try {
    expect(start(root, "one").success).toBe(true);
    const writer = openObservationLedger(root);
    const expected = { overview: writer.overview(), runs: writer.listRuns(2), evals: writer.evals() };
    expect(read(root)).toEqual(expected);
    const result = read(root); result.overview.total_events = 999; result.runs[0]!.id = "mutated";
    expect(read(root)).toEqual(expected);
    const source = `import { ObservationRunRecorder } from ${JSON.stringify(join(process.cwd(), "src/lib/observation-recorder.ts"))}; const r = new ObservationRunRecorder(process.argv[2]); if (!r.start({run_id:"two",device_id:"test",source_client:"codex",source_session_ref:null,repository_revision:null,branch:null,model_provider:null,model_name:null,completeness:"partial"}).success) process.exit(1);`;
    const script = join(root, "append.ts"); writeFileSync(script, source);
    const child = Bun.spawnSync([process.execPath, "run", script, root]); expect(child.exitCode).toBe(0);
    const next = read(root); expect(next.overview.total_runs).toBe(2); expect(next).toEqual({ overview: writer.overview(), runs: writer.listRuns(2), evals: writer.evals() });
    writer.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("schema errors and file replacement cannot reuse earlier valid projections", () => {
  const root = mkdtempSync(join(tmpdir(), "codetrap-cache-replace-"));
  try {
    start(root, "one"); const before = read(root); expect(before.overview.total_runs).toBe(1);
    const path = observationLedgerPath(root), replacement = path + ".replacement";
    copyFileSync(path, replacement); const db = new Database(replacement); db.exec("UPDATE observation_schema_version SET version = 99"); db.close(true); renameSync(replacement, path);
    expect(() => read(root)).toThrow("schema version 99");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("a file change during computation is never cached, and unknown file stamps bypass caching", () => {
  const root = mkdtempSync(join(tmpdir(), "codetrap-cache-race-")), path = join(root, "fake-ledger");
  try {
    writeFileSync(path, "before"); let calls = 0;
    cachedObservationRead(path, "p", "overview", () => { calls++; writeFileSync(path, "after"); return "old"; }, observationFileStamp(path));
    expect(cachedObservationRead(path, "p", "overview", () => { calls++; return "new"; }, observationFileStamp(path))).toBe("new"); expect(calls).toBe(2);
    expect(cachedObservationRead(path, "p", "overview", () => "should not run", observationFileStamp(path))).toBe("new");
    expect(cachedObservationRead(path, "another-project", "overview", () => "isolated", observationFileStamp(path))).toBe("isolated");
    expect(cachedObservationRead(path, "p", "overview", () => "uncached", null)).toBe("uncached");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
