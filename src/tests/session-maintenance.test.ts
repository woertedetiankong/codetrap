import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";

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

function sessionHarness(prefix: string): { project: string; store: SessionStore; sessions: SessionOperations; traps: TrapOperations } {
  const project = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(project, ".codetrap"));
  const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
  const traps = new TrapOperations(new TrapStore(project, undefined, home));
  const store = new SessionStore(project);
  return {
    project,
    store,
    traps,
    sessions: new SessionOperations(store, traps),
  };
}

function sessionDir(project: string, id: string): string {
  return join(project, ".codetrap", "sessions", id);
}
