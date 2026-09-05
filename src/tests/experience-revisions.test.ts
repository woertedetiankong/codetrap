import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ExperienceRevisions } from "../lib/experience-revisions";
import { openObservationLedgerReadOnly, observationLedgerPath } from "../lib/observation-ledger";
import { revisionFixture, revisionInput } from "./experience-revision-fixture";
import { tempHome, tempProjectDir, trap } from "./helpers";

async function tested(f: ReturnType<typeof revisionFixture>, id?: string) { const d = f.draft(id); return f.ops.evaluate(d.draft.id, d.draft.digest); }

describe("feedback revision governance", () => {
  test("reads without creating observation or revision files; requires a real scoped feedback event", () => {
    const root = tempProjectDir("revision-empty-");
    const ops = new ExperienceRevisions(root, tempHome("revision-empty-home-"));
    expect(ops.list("project", 1)).toEqual([]);
    expect(() => ops.context("demo-event")).toThrow();
    expect(existsSync(observationLedgerPath(root))).toBe(false);
    expect(existsSync(join(root, ".codetrap/experience-revisions"))).toBe(false);
    const f = revisionFixture();
    expect(() => f.ops.save("rev-test-12345678", f.exposure.id, revisionInput)).toThrow("Record feedback");
    f.recorder.feedback({ ...f.call, event_id: "unknown-scope", trap_id: 1, revision: "legacy", feedback: "harmful", note: null });
    expect(() => f.ops.context("unknown-scope")).toThrow("explicit lesson identity");
    expect(() => f.ops.get("../secrets")).toThrow("Invalid revision ID");
  });
  test("deduplicates feedback retries and refuses request ID reuse for a different judgment", () => {
    const f = revisionFixture();
    const id = f.feedback();
    expect(f.ops.feedback(f.exposure.id, "irrelevant", "request-12345678")).toEqual({ event_id: id, duplicate: true });
    expect(() => f.ops.feedback(f.exposure.id, "helpful", "request-12345678")).toThrow("already used");
    expect(f.ops.context(id).feedback).toBe("irrelevant");
    const ledger = openObservationLedgerReadOnly(f.project)!;
    expect(ledger.listRunEvents(f.call.run_id).filter(e => e.type === "trap/feedback-recorded")).toHaveLength(1);
    ledger.close();
  });
  test("checks both boundaries, applies atomically, survives restart and rolls back while preserving usage", async () => {
    const f = revisionFixture();
    const value = await tested(f);
    expect(value.draft.evaluation).toMatchObject({ passed: true, cases: [{ baseline: false, candidate: true }, { baseline: false, candidate: true }] });
    const { id, digest } = value.draft;
    const accepted = f.ops.accept(id, digest);
    expect(accepted.status).toBe("accepted");
    expect(accepted.current?.title).toBe(revisionInput.title);
    expect(accepted.current?.updated_at).not.toBe(f.before.updated_at);
    const restarted = new ExperienceRevisions(f.project, f.home);
    expect(restarted.accept(id, digest).commit).toEqual(accepted.commit);
    const db = new Database(join(f.project, ".codetrap/traps.db"));
    try {
      db.exec("UPDATE traps SET useful_count=7, hit_count=9 WHERE id=1");
      const receipt = (db.query("SELECT receipt FROM experience_revision_commits").get() as { receipt: string }).receipt;
      expect(receipt).not.toContain("PRIVATE_REASON");
      expect(receipt).not.toContain("PRIVATE_QUERY");
    } finally { db.close(); }
    const restored = restarted.rollback(id, digest);
    expect(restored.status).toBe("rolled_back");
    expect(restored.current).toMatchObject({ title: f.before.title, useful_count: 7, hit_count: 9 });
    expect(restarted.rollback(id, digest).commit).toEqual(restored.commit);
    expect(() => restarted.accept(id, digest)).toThrow("finalized");
    expect(() => restarted.save(id, f.feedback(), revisionInput, digest)).toThrow("finalized");
  });
  test("blocks incomplete, failing, stale and edited test results", async () => {
    const f = revisionFixture();
    let d = f.draft("rev-test-positive", { ...revisionInput, cases: revisionInput.cases.slice(0, 1) });
    await expect(f.ops.evaluate(d.draft.id, d.draft.digest)).rejects.toThrow("positive query and one negative");
    expect(() => f.ops.accept(d.draft.id, d.draft.digest)).toThrow("must pass");
    d = f.draft("rev-test-failing1", { ...revisionInput, cases: [{ query: "absentword", expectation: "include" }, revisionInput.cases[1]!] });
    const fail = await f.ops.evaluate(d.draft.id, d.draft.digest);
    expect(fail.draft.evaluation?.passed).toBe(false);
    expect(() => f.ops.accept(d.draft.id, d.draft.digest)).toThrow("must pass");
    const pass = await tested(f, "rev-test-passing1");
    const changed = f.ops.save(pass.draft.id, f.feedback(), { ...revisionInput, fix: "A different transaction fix" }, pass.draft.digest);
    expect(changed.draft.evaluation).toBeNull();
    expect(() => f.ops.accept(pass.draft.id, pass.draft.digest)).toThrow("no longer matches");
    expect(() => f.ops.save(pass.draft.id, f.feedback(), revisionInput, pass.draft.digest)).toThrow("draft changed");
    expect(f.store.getDetails(1, "project")!.trap.title).toBe(f.before.title);
  });
  test("detects edits during asynchronous evaluation and leaves latest draft untested", async () => {
    const f = revisionFixture();
    const d = f.draft();
    const evaluating = f.ops.evaluate(d.draft.id, d.draft.digest);
    f.ops.save(d.draft.id, f.feedback(), { ...revisionInput, reason: "Revised reasoning" }, d.draft.digest);
    await expect(evaluating).rejects.toThrow("changed during evaluation");
    expect(f.ops.get(d.draft.id).draft.evaluation).toBeNull();
  });
  test("protects a shared global lesson from competing project approvals and later edits", async () => {
    const a = revisionFixture("global");
    const b = revisionFixture("global", a.home);
    a.store.add(trap({ scope: "project", title: "Other scope same ID" }));
    const da = await tested(a, "rev-project-a1");
    const db = await tested(b, "rev-project-b1");
    a.ops.accept(da.draft.id, da.draft.digest);
    expect(() => b.ops.accept(db.draft.id, db.draft.digest)).toThrow("lesson changed");
    expect(a.store.getDetails(1, "project")!.trap.title).toBe("Other scope same ID");
    expect(() => b.ops.get(da.draft.id)).toThrow();
    a.store.update(1, { fix: "Later user edit" }, "global");
    expect(() => a.ops.rollback(da.draft.id, da.draft.digest)).toThrow("later work");
    expect(a.store.getDetails(1, "global")!.trap.fix).toBe("Later user edit");
  });
  test("does not apply after a later edit, and rejection is final", async () => {
    const f = revisionFixture();
    const d = await tested(f);
    f.store.update(1, { title: "New current title" }, "project");
    expect(() => f.ops.accept(d.draft.id, d.draft.digest)).toThrow("lesson changed");
    f.ops.reject(d.draft.id, d.draft.digest);
    expect(() => f.ops.accept(d.draft.id, d.draft.digest)).toThrow("no longer matches");
  });
  test("rolls back content when writing the acceptance receipt fails", async () => {
    const f = revisionFixture();
    const d = await tested(f);
    const db = new Database(join(f.project, ".codetrap/traps.db"));
    try {
      db.exec("CREATE TABLE experience_revision_commits (id TEXT PRIMARY KEY, owner TEXT NOT NULL, receipt TEXT NOT NULL); CREATE TRIGGER fail_receipt BEFORE INSERT ON experience_revision_commits BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
      expect(() => f.ops.accept(d.draft.id, d.draft.digest)).toThrow("injected failure");
      expect(f.store.getDetails(1, "project")!.trap.title).toBe(f.before.title);
      expect(db.query("SELECT count(*) AS n FROM experience_revision_commits").get()).toEqual({ n: 0 });
    } finally { db.close(); }
  });
  test("attributes later evidence only to the applied scope, ID and exact version", async () => {
    const f = revisionFixture();
    const d = await tested(f);
    const accepted = f.ops.accept(d.draft.id, d.draft.digest);
    const revision = `project:${accepted.current!.updated_at}`;
    f.recorder.feedback({ ...f.call, trap_id: 1, revision: `global:${accepted.current!.updated_at}`, feedback: "harmful", note: null });
    expect(f.ops.get(d.draft.id).activity?.runs).toEqual([]);
    f.recorder.search(f.call, { query: "transaction", mode: "fts", path: null, module: null, duration_ms: 1, diagnostics: [], results: [{ trap_id: 1, revision, rank: 1 }] });
    f.recorder.feedback({ ...f.call, trap_id: 1, revision, feedback: "helpful", note: null });
    expect(f.ops.get(d.draft.id).activity?.runs).toEqual([{ id: f.call.run_id, exposures: 1, feedback: "helpful" }]);
    // Read failure must never hide a successful SQLite acceptance/rollback receipt.
    const path = observationLedgerPath(f.project);
    const backup = readFileSync(path);
    try { writeFileSync(path, "broken ledger"); expect(f.ops.get(d.draft.id)).toMatchObject({ status: "accepted", activity: { availability: "unavailable" } }); }
    finally { writeFileSync(path, backup); }
  });
  test("rejects archived and graduated targets after successful evaluation", async () => {
    for (const change of ["status='archived'", "graduated_at='2026-09-05T01:00:00Z'"]) {
      const f = revisionFixture();
      const d = await tested(f);
      const db = new Database(join(f.project, ".codetrap/traps.db"));
      try { db.exec("UPDATE traps SET " + change + " WHERE id=1"); }
      finally { db.close(); }
      expect(() => f.ops.accept(d.draft.id, d.draft.digest)).toThrow("retired, or graduated");
      expect(f.store.getDetails(1, "project")!.trap.title).toBe(f.before.title);
    }
  });

});
