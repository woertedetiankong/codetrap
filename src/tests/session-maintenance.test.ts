import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { runCliAsync } from "./helpers";

describe("session maintenance", () => {
  test("deletes sessions and prunes closed sessions through one operations interface", () => {
    const { project, store, sessions } = sessionHarness("codetrap-session-maintenance-");
    const old = store.startSession({ goal: "old cleanup target" }, new Date("2026-01-01T00:00:00.000Z"));
    store.closeSession(old.id, false, new Date("2026-01-02T00:00:00.000Z"));
    const recent = store.startSession({ goal: "recent session" }, new Date("2026-05-30T00:00:00.000Z"));
    store.closeSession(recent.id, false, new Date("2026-05-30T00:00:00.000Z"));

    const dryRun = sessions.pruneSessions({
      olderThanDays: 30,
      apply: false,
      now: new Date("2026-05-31T00:00:00.000Z"),
    });
    expect(dryRun).toMatchObject({
      dry_run: true,
      deleted_count: 0,
      sessions: [expect.objectContaining({ id: old.id })],
    });
    expect(existsSync(sessionDir(project, old.id))).toBe(true);

    const applied = sessions.pruneSessions({
      olderThanDays: 30,
      apply: true,
      now: new Date("2026-05-31T00:00:00.000Z"),
    });
    expect(applied.deleted_count).toBe(1);
    expect(existsSync(sessionDir(project, old.id))).toBe(false);
    expect(sessions.listSessions({ status: "all" }).map((session) => session.id)).toEqual([recent.id]);

    const deleted = sessions.deleteSession(recent.id);
    expect(deleted).toMatchObject({ session_id: recent.id, deleted: true });
    expect(existsSync(sessionDir(project, recent.id))).toBe(false);
    expect(sessions.listSessions({ status: "all" })).toEqual([]);
  });

  test("rejects session ids that would escape the sessions directory", () => {
    const victim = sessionHarness("codetrap-session-victim-");
    const victimSession = victim.store.startSession({ goal: "victim session" });

    const attacker = sessionHarness("codetrap-session-attacker-");
    const traversal = relative(
      join(attacker.project, ".codetrap", "sessions"),
      sessionDir(victim.project, victimSession.id)
    );
    expect(() => attacker.sessions.deleteSession(traversal)).toThrow(/Invalid session id/);
    expect(() => attacker.sessions.deleteSession("..")).toThrow(/Invalid session id/);
    expect(existsSync(sessionDir(victim.project, victimSession.id))).toBe(true);
  });

  test("re-accepting a candidate rolls back instead of inserting a duplicate trap", async () => {
    const { sessions, traps } = sessionHarness("codetrap-session-accept-atomic-");
    sessions.startSession({ goal: "accept atomicity" });
    const captured = sessions.captureCandidate({
      trap: {
        title: "Guard session accept against double submission",
        category: "bug",
        scope: "project",
        context: "When accepting a reviewed candidate trap.",
        mistake: "Retrying a failed accept inserted a second identical trap.",
        fix: "Run the accept as one transaction gated on the proposed status.",
        severity: "error",
      },
    });

    const first = await sessions.acceptCandidate({ candidateId: captured.candidate.id, acceptAnyway: true });
    expect(first.success).toBe(true);

    await expect(
      sessions.acceptCandidate({ candidateId: captured.candidate.id, acceptAnyway: true })
    ).rejects.toThrow(/already accepted/);

    const groups = traps.listTraps({ status: "all" });
    const total = groups.reduce((count, group) => count + group.traps.length, 0);
    expect(total).toBe(1);
  });

  test("concurrent captures do not lose candidates", async () => {
    const { project, home, store } = sessionHarness("codetrap-session-race-");
    store.startSession({ goal: "capture race" });

    const captureArgs = (title: string) => [
      "session",
      "capture",
      "--trap-json",
      JSON.stringify({
        title,
        category: "bug",
        scope: "project",
        context: "When two agents capture lessons at the same time.",
        mistake: "Whole-file read-modify-write loses the other capture.",
        fix: "Serialize session mutations behind the per-project lock.",
        severity: "warning",
      }),
      "--json",
    ];

    const [first, second] = await Promise.all([
      runCliAsync(captureArgs("Race capture one"), project, home, { timeoutMs: 20_000 }),
      runCliAsync(captureArgs("Race capture two"), project, home, { timeoutMs: 20_000 }),
    ]);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);

    const titles = store.candidateDocument().candidates.map((candidate) => candidate.trap.title).sort();
    expect(titles).toEqual(["Race capture one", "Race capture two"]);
  });

  test("capture with an invalid kind leaves no active auto-session", () => {
    const { store, sessions } = sessionHarness("codetrap-session-bad-kind-");

    expect(() =>
      sessions.captureCandidate({
        trap: {
          title: "Validate the capture kind before starting a session",
          category: "bug",
          scope: "project",
          context: "When capturing a lesson with an unsupported note kind.",
          mistake: "Creating the auto-session before validating kind leaked an active session.",
          fix: "Validate the kind up front and clean up the created session on failure.",
          severity: "warning",
        },
        kind: "not-a-real-kind",
      })
    ).toThrow(/Invalid session note kind/);

    expect(store.status().session).toBeNull();
    expect(sessions.listSessions({ status: "all" })).toEqual([]);
  });

  test("session delete succeeds despite corrupt session, index, and active files", () => {
    const { project, store, sessions } = sessionHarness("codetrap-session-corrupt-");
    const doomed = store.startSession({ goal: "doomed session" }, new Date("2026-06-01T00:00:00.000Z"));
    store.closeSession(doomed.id, false, new Date("2026-06-01T01:00:00.000Z"));
    const survivor = store.startSession({ goal: "survivor session" }, new Date("2026-06-02T00:00:00.000Z"));

    const sessionsRoot = join(project, ".codetrap", "sessions");
    writeFileSync(join(sessionsRoot, doomed.id, "session.json"), "{truncated");
    writeFileSync(join(sessionsRoot, "index.json"), "{truncated");
    writeFileSync(join(sessionsRoot, "active.json"), "{truncated");

    const result = sessions.deleteSession(doomed.id);
    expect(result).toMatchObject({ session_id: doomed.id, deleted: true });
    expect(existsSync(sessionDir(project, doomed.id))).toBe(false);

    // Delete repaired the index from the surviving session dirs.
    expect(sessions.listSessions({ status: "all" }).map((session) => session.id)).toEqual([survivor.id]);
    expect(store.status().active_session_id).toBe(survivor.id);
  });

  test("corrupt session JSON fails with the file path, not a raw SyntaxError", () => {
    const { project, store } = sessionHarness("codetrap-session-corrupt-error-");
    const started = store.startSession({ goal: "corrupt error message" });
    writeFileSync(join(project, ".codetrap", "sessions", started.id, "session.json"), "{truncated");

    expect(() => store.showSession(started.id)).toThrow(/Corrupt session file .*session\.json/);
  });

  test("a stale session lock is stolen instead of blocking forever", () => {
    const { project, store } = sessionHarness("codetrap-session-stale-lock-");
    const lockDir = join(project, ".codetrap", "sessions", ".lock");
    mkdirSync(lockDir, { recursive: true });
    const past = new Date(Date.now() - 60_000);
    utimesSync(lockDir, past, past);

    const session = store.startSession({ goal: "steal the stale lock" });
    expect(session.status).toBe("active");
    expect(existsSync(lockDir)).toBe(false);
  });

  test("conflict check finds duplicates in the other scope", async () => {
    const { sessions, traps } = sessionHarness("codetrap-conflict-cross-scope-");
    traps.addTrap({
      title: "Use stable API client for requests",
      category: "api",
      scope: "global",
      context: "When making API requests across projects.",
      mistake: "Calling fetch directly bypasses retry behavior.",
      fix: "Use the stable API client helper.",
      tags: ["api", "fetch"],
      severity: "warning",
    });

    sessions.startSession({ goal: "cross scope conflict" });
    const captured = sessions.captureCandidate({
      trap: {
        title: "Use stable API client wrapper",
        category: "api",
        scope: "project",
        context: "When making API requests in this project.",
        mistake: "Calling fetch directly skips the shared wrapper.",
        fix: "Use the stable API client wrapper.",
        tags: ["api"],
        severity: "warning",
      },
    });

    const blocked = await sessions.acceptCandidate({ candidateId: captured.candidate.id });
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.possible_conflicts[0]).toMatchObject({
        scope: "global",
        title: "Use stable API client for requests",
      });
    }
  });

  test("same module without topical overlap is not a conflict", async () => {
    const { sessions, traps } = sessionHarness("codetrap-conflict-module-only-");
    traps.addTrap({
      title: "Rotate service credentials quarterly",
      category: "security",
      scope: "project",
      context: "When operating long-lived service credentials.",
      mistake: "Credentials that never rotate leak quietly.",
      fix: "Rotate credentials on a quarterly schedule.",
      tags: ["security", "credentials"],
      severity: "warning",
      module: "api",
    });

    sessions.startSession({ goal: "module-only non-conflict" });
    const captured = sessions.captureCandidate({
      trap: {
        title: "Cache dashboard summary queries",
        category: "performance",
        scope: "project",
        context: "When rendering the dashboard summary panel.",
        mistake: "Recomputing summaries per request overloads the database.",
        fix: "Cache summary queries with a short TTL.",
        tags: ["cache"],
        severity: "warning",
        module: "api",
      },
    });

    const accepted = await sessions.acceptCandidate({ candidateId: captured.candidate.id });
    expect(accepted.success).toBe(true);
  });

  test("cleans accepted candidates whose confirmed traps were deleted", async () => {
    const { sessions, traps } = sessionHarness("codetrap-session-cleanup-");
    const started = sessions.startSession({ goal: "cleanup deleted accepted candidates" });
    sessions.addNote({
      kind: "review",
      text: [
        "Title: Prefer stable API client",
        "Category: api",
        "Context: When making API requests in this project.",
        "Mistake: Calling fetch directly skips the shared request wrapper.",
        "Fix: Use the stable apiClient helper instead.",
        "Severity: error",
        "Tags: api,fetch",
        "Path globs: src/api/**",
      ].join("\n"),
    });
    sessions.closeSession(started.id, true);
    const accepted = await sessions.acceptCandidate({
      candidateId: "cand-001",
      sessionId: started.id,
      acceptAnyway: true,
    });
    expect(accepted.success).toBe(true);
    if (!accepted.success) throw new Error("expected accepted candidate");
    expect(traps.deleteTrap(accepted.trap_id, accepted.scope).success).toBe(true);

    const cleaned = sessions.cleanupDeletedTrapCandidates(started.id);
    expect(cleaned).toMatchObject({
      removed_count: 1,
      removed_candidate_ids: ["cand-001"],
    });
    expect(sessions.candidateDocument(started.id).candidates).toEqual([]);
    expect(sessions.listSessions({ status: "all" })[0]).toMatchObject({
      candidate_count: 0,
      accepted_count: 0,
    });
  });
});

function sessionHarness(prefix: string): { project: string; home: string; store: SessionStore; sessions: SessionOperations; traps: TrapOperations } {
  const project = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(project, ".codetrap"));
  const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
  const traps = new TrapOperations(new TrapStore(project, undefined, home));
  const store = new SessionStore(project);
  return {
    project,
    home,
    store,
    traps,
    sessions: new SessionOperations(store, traps),
  };
}

function sessionDir(project: string, id: string): string {
  return join(project, ".codetrap", "sessions", id);
}
