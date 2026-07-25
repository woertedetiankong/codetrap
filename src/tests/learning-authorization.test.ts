import { describe, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { LearningStore } from "../lib/learning-store";
import { trapFingerprint } from "../lib/session-capture";
import { runCli, tempHome, tempProjectDir, type CliResult } from "./helpers";
import { createWebHandler } from "../web/server";
import { addWebProject } from "../web/project-registry";

// One test per Phase 1A acceptance criterion (§16). The numbering is load
// bearing: if a criterion regresses, the failing test names which one.
describe("Phase 1A — authorization, suppression, and rollback", () => {
  test("C2/C6: an agent-executed commit records executor and authorized scope", async () => {
    const { sessions } = harness("codetrap-1a-receipt-");
    const captured = capture(sessions, scratchpadLesson());

    // Phase 1B: an agent may not authorize itself, so the user approves the
    // revision first and the agent then executes against that approval.
    sessions.approveCandidate({
      candidateId: captured.candidate.id,
      authorizedScope: "cluster C01 only",
    });
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "agent",
      authorizedScope: "cluster C01 only",
    });
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;

    expect(accepted.receipt).toMatchObject({
      action: "commit",
      executor: "agent",
      authorized_scope: "cluster C01 only",
      destination: "pitfall_trap",
      trap_id: accepted.trap_id,
      trap_scope: accepted.scope,
      candidate_id: captured.candidate.id,
    });
    expect(accepted.receipt.fingerprint).toBe(captured.fingerprint);

    const receipts = sessions.listReceipts();
    expect(receipts.map((receipt) => receipt.action)).toEqual(["commit", "approve"]);
  });

  test("C6: executor defaults to user and the scope names the single candidate", async () => {
    const { sessions } = harness("codetrap-1a-receipt-default-");
    const captured = capture(sessions, scratchpadLesson());

    const accepted = await sessions.acceptCandidate({ candidateId: captured.candidate.id });
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;

    expect(accepted.receipt.executor).toBe("user");
    expect(accepted.receipt.authorized_scope).toBe(`candidate ${captured.candidate.id} only`);
  });

  test("C3: a committed trap is findable by search afterward", async () => {
    const { sessions, traps } = harness("codetrap-1a-search-");
    const captured = capture(sessions, scratchpadLesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id });
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "agent",
    });
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;

    // searchTrapCards is the shape `codetrap search` emits, so this asserts on
    // the surface the user actually reads.
    const found = await traps.searchTrapCards({ query: "throwaway node script scratchpad", mode: "fts" });
    expect(found.cards.map((card) => card.trap_id)).toContain(accepted.trap_id);
  });

  test("C4: rollback deletes the trap, restores the candidate, and leaves a receipt", async () => {
    const { sessions, traps } = harness("codetrap-1a-rollback-");
    const captured = capture(sessions, scratchpadLesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id });
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "agent",
    });
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;

    const rolledBack = sessions.rollbackCandidate({
      candidateId: captured.candidate.id,
      executor: "agent",
      authorizedScope: "rollback of cluster C01",
    });

    expect(rolledBack.trap_deleted).toBe(true);
    expect(rolledBack.candidate.status).toBe("proposed");
    // The durable trap is gone, not merely archived.
    expect(traps.getTrapDetails(accepted.trap_id, accepted.scope)).toBeNull();
    // The link back to the deleted trap is cleared, so the candidate is not
    // left pointing at a trap id that no longer resolves.
    expect(rolledBack.candidate.accepted_trap_id).toBeUndefined();
    expect(rolledBack.candidate.accepted_at).toBeUndefined();

    expect(rolledBack.receipt).toMatchObject({
      action: "rollback",
      executor: "agent",
      authorized_scope: "rollback of cluster C01",
      trap_id: accepted.trap_id,
    });
    expect(sessions.listReceipts().map((receipt) => receipt.action)).toEqual(["rollback", "commit", "approve"]);
  });

  test("C4: a rolled-back candidate can be reviewed and committed again", async () => {
    const { sessions, traps } = harness("codetrap-1a-rollback-recommit-");
    const captured = capture(sessions, scratchpadLesson());
    const first = await sessions.acceptCandidate({ candidateId: captured.candidate.id });
    expect(first.success).toBe(true);
    if (!first.success) return;

    sessions.rollbackCandidate({ candidateId: captured.candidate.id });
    const second = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      acceptAnyway: true,
    });
    expect(second.success).toBe(true);
    if (!second.success) return;

    // Exactly one live trap: the rollback removed the first rather than
    // leaving both behind.
    const live = traps.listTraps({ status: "all" }).flatMap((group) => group.traps);
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(second.trap_id);
  });

  test("C4: rollback repairs a candidate stranded by a bare trap delete", async () => {
    const { sessions, traps } = harness("codetrap-1a-rollback-stranded-");
    const captured = capture(sessions, scratchpadLesson());
    const accepted = await sessions.acceptCandidate({ candidateId: captured.candidate.id });
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;

    // The pre-1A failure mode: delete the trap directly and the candidate is
    // stuck at accepted, pointing at a trap that no longer exists.
    traps.deleteTrap(accepted.trap_id, accepted.scope);

    const rolledBack = sessions.rollbackCandidate({ candidateId: captured.candidate.id });
    expect(rolledBack.trap_deleted).toBe(false);
    expect(rolledBack.candidate.status).toBe("proposed");
    expect(rolledBack.receipt.reason).toContain("already absent");
  });

  test("C4: rollback refuses a commit that superseded another trap", async () => {
    const { sessions, traps } = harness("codetrap-1a-rollback-supersede-");
    const older = traps.addTrap({
      title: "Older scratchpad lesson",
      category: "convention",
      scope: "project",
      severity: "warning",
      context: "When writing a throwaway script that needs project dependencies.",
      mistake: "Putting it in the scratchpad.",
      fix: "Write it under the project tree instead.",
    });
    const captured = capture(sessions, scratchpadLesson());
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      supersedesId: older.id,
    });
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;
    expect(accepted.receipt.superseded_id).toBe(older.id);

    // Deleting the successor would retire both lessons: the predecessor is
    // marked `superseded` and nothing can put it back.
    expect(() => sessions.rollbackCandidate({ candidateId: captured.candidate.id }))
      .toThrow(new RegExp(`superseded trap #${older.id}`));

    // Neither trap was touched by the refused rollback.
    expect(traps.getTrapDetails(accepted.trap_id, accepted.scope)).not.toBeNull();
    expect(sessions.getCandidate(captured.candidate.id).candidate.status).toBe("accepted");
  });

  test("C4: rollback refuses a candidate that was never committed", () => {
    const { sessions } = harness("codetrap-1a-rollback-guard-");
    const captured = capture(sessions, scratchpadLesson());

    expect(() => sessions.rollbackCandidate({ candidateId: captured.candidate.id }))
      .toThrow(/is proposed, not accepted/);
  });

  test("C5: a suppressed lesson does not reappear from the same evidence", () => {
    const { sessions } = harness("codetrap-1a-suppress-");
    const captured = capture(sessions, trackingDocLesson());

    sessions.rejectCandidate({
      candidateId: captured.candidate.id,
      reason: "Too broad; would cause doc churn on unrelated tasks.",
      executor: "user",
    });

    // Re-mining the same evidence produces the identical lesson. It must not
    // return to the inbox, and must not create a session on the way in.
    const before = sessions.listSessions().length;
    const again = sessions.captureCandidate(trackingDocLesson());

    expect(again.suppressed).toBe(true);
    if (!again.suppressed) return;
    expect(again.suppression.reason).toBe("Too broad; would cause doc churn on unrelated tasks.");
    expect(again.fingerprint).toBe(captured.fingerprint);
    expect(sessions.listSessions().length).toBe(before);

    const pending = sessions
      .listSessions()
      .flatMap((session) => sessions.candidateDocument(session.id).candidates)
      .filter((candidate) => candidate.status === "proposed");
    expect(pending).toHaveLength(0);
  });

  test("C5: suppression survives deletion of the session it was rejected in", () => {
    const { sessions } = harness("codetrap-1a-suppress-survives-");
    const captured = capture(sessions, trackingDocLesson());
    const sessionId = captured.session.id;

    sessions.rejectCandidate({ candidateId: captured.candidate.id, reason: "Not useful." });
    sessions.deleteSession(sessionId);

    const again = sessions.captureCandidate(trackingDocLesson());
    expect(again.suppressed).toBe(true);
  });

  test("C5: suppression ignores whitespace and case differences in the same lesson", () => {
    const { sessions } = harness("codetrap-1a-suppress-normalize-");
    const captured = capture(sessions, trackingDocLesson());
    sessions.rejectCandidate({ candidateId: captured.candidate.id, reason: "No." });

    const reworded = trackingDocLesson();
    reworded.trap.title = `  ${String(reworded.trap.title).toUpperCase()}  `;
    const again = sessions.captureCandidate(reworded);
    expect(again.suppressed).toBe(true);
  });

  test("C5: a different lesson is still captured normally", () => {
    const { sessions } = harness("codetrap-1a-suppress-scoped-");
    const captured = capture(sessions, trackingDocLesson());
    sessions.rejectCandidate({ candidateId: captured.candidate.id, reason: "No." });

    const other = sessions.captureCandidate(scratchpadLesson());
    expect(other.suppressed).toBe(false);
  });

  test("C5: unsuppress lets the lesson be captured again and leaves a receipt", () => {
    const { sessions } = harness("codetrap-1a-unsuppress-");
    const captured = capture(sessions, trackingDocLesson());
    sessions.rejectCandidate({ candidateId: captured.candidate.id, reason: "Changed my mind later." });

    const removed = sessions.unsuppress({ fingerprint: captured.fingerprint, executor: "user" });
    expect(removed.suppression.fingerprint).toBe(captured.fingerprint);
    expect(removed.receipt.action).toBe("unsuppress");
    expect(sessions.listSuppressions()).toHaveLength(0);

    const again = sessions.captureCandidate(trackingDocLesson());
    expect(again.suppressed).toBe(false);
  });

  test("C5: close --propose-traps does not resurrect a suppressed lesson", () => {
    const { sessions, project } = harness("codetrap-1a-suppress-close-");
    const learning = new LearningStore(project);

    const started = sessions.startSession({ goal: "propose from notes" });
    const noteText = [
      "Title: Update the tracking doc as part of finishing the work",
      "Context: When you finish implementing items that came from a tracking document.",
      "Mistake: Reporting the code as done while the doc still lists the items open.",
      "Fix: Edit the doc in the same turn and include it in the commit.",
      "Category: convention",
      "Scope: project",
    ].join("\n");
    sessions.addNote({ kind: "decision", text: noteText });

    // Suppress the exact lesson the note would produce.
    const closedProbe = sessions.closeSession(started.id, true);
    expect(closedProbe.candidate_count).toBe(1);
    const proposed = sessions.candidateDocument(started.id).candidates[0];
    learning.recordSuppression({
      fingerprint: trapFingerprint(proposed.trap),
      title: proposed.trap.title,
      reason: "Suppressed before the re-run.",
    });

    // Re-run the same note through a fresh session: the lesson must not return.
    const rerun = sessions.startSession({ goal: "propose from notes again" });
    sessions.addNote({ kind: "decision", text: noteText });
    const closed = sessions.closeSession(rerun.id, true);
    expect(closed.candidate_count).toBe(0);
  });

  test("a torn receipt line does not cost read access to the rest of the log", async () => {
    const { sessions, project } = harness("codetrap-1a-torn-receipt-");
    const captured = capture(sessions, scratchpadLesson());
    const accepted = await sessions.acceptCandidate({ candidateId: captured.candidate.id });
    expect(accepted.success).toBe(true);

    // Simulate a process killed mid-append.
    const path = join(project, ".codetrap", "receipts.jsonl");
    appendFileSync(path, '{"version":1,"recorded_at":"2026-07-25T00:00:00.000Z","act');

    const log = new LearningStore(project).readReceipts();
    expect(log.receipts).toHaveLength(1);
    expect(log.receipts[0].action).toBe("commit");
    expect(log.damaged).toBe(1);
  });

  test("a structurally wrong suppression index fails with an actionable message", () => {
    const { sessions, project } = harness("codetrap-1a-bad-index-");
    mkdirSync(join(project, ".codetrap"), { recursive: true });
    writeFileSync(join(project, ".codetrap", "suppressions.json"), "{}");

    expect(() => sessions.captureCandidate(scratchpadLesson()))
      .toThrow(/Corrupt suppression index .*expected a "suppressions" array/);
  });

  test("a plain close does not read the suppression index at all", () => {
    const { sessions, project } = harness("codetrap-1a-close-no-read-");
    mkdirSync(join(project, ".codetrap"), { recursive: true });
    // A close without --propose-traps must not touch this file, so a corrupt
    // one cannot block closing (or deleting) the session.
    writeFileSync(join(project, ".codetrap", "suppressions.json"), "not json at all");

    const started = sessions.startSession({ goal: "close without proposing" });
    sessions.addNote({
      kind: "decision",
      text: [
        "Title: A lesson that would be proposed",
        "Context: When closing a session that has structured trap notes.",
        "Mistake: Assuming close always proposes candidates.",
        "Fix: Check the propose-traps flag before reading the suppression index.",
      ].join("\n"),
    });
    expect(() => sessions.closeSession(started.id, false)).not.toThrow();
  });

  test("receipts and suppressions live outside the session directory", () => {
    const { sessions, project } = harness("codetrap-1a-paths-");
    const captured = capture(sessions, trackingDocLesson());
    sessions.rejectCandidate({ candidateId: captured.candidate.id, reason: "No." });

    expect(existsSync(join(project, ".codetrap", "suppressions.json"))).toBe(true);
    expect(existsSync(join(project, ".codetrap", "receipts.jsonl"))).toBe(true);
  });

  test("the receipt log is append-only and ordered newest first", async () => {
    const { sessions } = harness("codetrap-1a-receipt-log-");
    const first = capture(sessions, scratchpadLesson());
    const accepted = await sessions.acceptCandidate({ candidateId: first.candidate.id });
    expect(accepted.success).toBe(true);
    if (!accepted.success) return;
    sessions.rollbackCandidate({ candidateId: first.candidate.id });

    const second = capture(sessions, trackingDocLesson());
    sessions.rejectCandidate({ candidateId: second.candidate.id, reason: "No." });

    expect(sessions.listReceipts().map((receipt) => receipt.action))
      .toEqual(["suppress", "rollback", "commit"]);
    expect(sessions.listReceipts(2).map((receipt) => receipt.action))
      .toEqual(["suppress", "rollback"]);
  });

});

// Criterion 2 is specifically about the CLI: an agent commits by running
// `codetrap session accept`, so these drive the real binary rather than the
// library it wraps.
describe("Phase 1A — CLI authorization surface", () => {
  test("C2/C6: an agent-executed accept records both authorization and executor", () => {
    const { cwd, home } = cliProject("codetrap-1a-cli-accept-");
    const captured = JSON.parse(
      expectOk(runCli(["session", "capture", "--trap-json", JSON.stringify(scratchpadLesson().trap), "--json"], cwd, home)).stdout
    );

    expectOk(runCli([
      "session", "approve", captured.candidate_id,
      "--session", captured.session_id,
      "--authorized-scope", "cluster C01 only",
      "--json",
    ], cwd, home));
    const accept = expectOk(runCli([
      "session", "accept", captured.candidate_id,
      "--session", captured.session_id,
      "--executor", "agent",
      "--authorized-scope", "cluster C01 only",
      "--json",
    ], cwd, home));
    const accepted = JSON.parse(accept.stdout);
    expect(accepted.receipt).toMatchObject({
      action: "commit",
      executor: "agent",
      authorized_scope: "cluster C01 only",
      destination: "pitfall_trap",
    });

    // C3: findable through the search command the user would actually run.
    const search = expectOk(runCli(["search", "throwaway node script scratchpad", "--json"], cwd, home));
    expect(JSON.parse(search.stdout).results.map((r: { trap_id: number }) => r.trap_id))
      .toContain(accepted.trap_id);

    // C4: reversible through the documented rollback path.
    const rollback = expectOk(runCli([
      "session", "rollback", captured.candidate_id,
      "--session", captured.session_id,
      "--executor", "agent",
      "--json",
    ], cwd, home));
    const rolledBack = JSON.parse(rollback.stdout);
    expect(rolledBack).toMatchObject({ trap_deleted: true, status: "proposed" });

    const afterRollback = expectOk(runCli(["search", "throwaway node script scratchpad", "--json"], cwd, home));
    expect(JSON.parse(afterRollback.stdout).results).toHaveLength(0);

    const receipts = JSON.parse(expectOk(runCli(["session", "receipts", "--json"], cwd, home)).stdout);
    expect(receipts.receipts.map((r: { action: string }) => r.action)).toEqual(["rollback", "commit", "approve"]);
    expect(receipts.executor_note).toContain("declared");
  });

  test("C6: an unknown executor is refused instead of being recorded", () => {
    const { cwd, home } = cliProject("codetrap-1a-cli-executor-");
    const captured = JSON.parse(
      expectOk(runCli(["session", "capture", "--trap-json", JSON.stringify(scratchpadLesson().trap), "--json"], cwd, home)).stdout
    );

    const accept = runCli([
      "session", "accept", captured.candidate_id,
      "--session", captured.session_id,
      "--executor", "root",
      "--json",
    ], cwd, home);
    expect(accept.exitCode).toBe(1);
    expect(`${accept.stdout}${accept.stderr}`).toContain("Invalid executor");
    // Nothing was committed, so no receipt claims a write that did not happen.
    const receipts = JSON.parse(expectOk(runCli(["session", "receipts", "--json"], cwd, home)).stdout);
    expect(receipts.receipts).toHaveLength(0);
  });

  test("C5: the CLI refuses to re-capture a suppressed lesson and says how to undo", () => {
    const { cwd, home } = cliProject("codetrap-1a-cli-suppress-");
    const lesson = JSON.stringify(trackingDocLesson().trap);
    const captured = JSON.parse(
      expectOk(runCli(["session", "capture", "--trap-json", lesson, "--json"], cwd, home)).stdout
    );

    const reject = expectOk(runCli([
      "session", "reject", captured.candidate_id,
      "--session", captured.session_id,
      "--reason", "Too broad; would cause doc churn.",
      "--json",
    ], cwd, home));
    const fingerprint = JSON.parse(reject.stdout).suppression.fingerprint;

    const again = expectOk(runCli(["session", "capture", "--trap-json", lesson, "--json"], cwd, home));
    const suppressed = JSON.parse(again.stdout);
    expect(suppressed).toMatchObject({ suppressed: true, fingerprint });
    expect(suppressed.next_action.command).toBe(`codetrap session unsuppress ${fingerprint}`);

    expectOk(runCli(["session", "unsuppress", fingerprint, "--json"], cwd, home));
    const third = expectOk(runCli(["session", "capture", "--trap-json", lesson, "--json"], cwd, home));
    expect(JSON.parse(third.stdout).suppressed).toBe(false);
  });
});

// The brief's flow routes authorization through the Web review console, so the
// receipt must be recorded on that path too, not only the CLI's.
describe("Phase 1A — Web review surface", () => {
  test("C6: the Web accept route records a receipt and defaults the executor to user", async () => {
    const home = tempHome("codetrap-1a-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-1a-web-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));
    const sessions = new SessionOperations(new SessionStore(project), traps);
    const captured = capture(sessions, scratchpadLesson());

    const handler = createWebHandler({ token: WEB_TOKEN, cwd: project, home, currentProjectRoot: project });
    const accepted = await webApi(handler, "/api/candidate/accept", {
      projectRoot: project,
      sessionId: captured.session.id,
      candidateId: captured.candidate.id,
    });
    expect(accepted.status).toBe(200);
    const payload = await accepted.json();
    expect(payload.receipt).toMatchObject({
      action: "commit",
      executor: "user",
      authorized_scope: `candidate ${captured.candidate.id} only`,
      destination: "pitfall_trap",
    });
  });

  test("C5/C6: the Web reject route suppresses the lesson and records the receipt", async () => {
    const home = tempHome("codetrap-1a-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-1a-web-reject-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));
    const sessions = new SessionOperations(new SessionStore(project), traps);
    const captured = capture(sessions, trackingDocLesson());

    const handler = createWebHandler({ token: WEB_TOKEN, cwd: project, home, currentProjectRoot: project });
    const rejected = await webApi(handler, "/api/candidate/reject", {
      projectRoot: project,
      sessionId: captured.session.id,
      candidateId: captured.candidate.id,
      reason: "Too broad.",
    });
    expect(rejected.status).toBe(200);
    const payload = await rejected.json();
    expect(payload.suppression.fingerprint).toBe(captured.fingerprint);
    expect(payload.receipt).toMatchObject({ action: "suppress", executor: "user" });

    // And the suppression takes effect for the next capture.
    expect(sessions.captureCandidate(trackingDocLesson()).suppressed).toBe(true);
  });

  test("C6: an agent posting to the Web route must declare itself", async () => {
    const home = tempHome("codetrap-1a-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-1a-web-agent-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));
    const sessions = new SessionOperations(new SessionStore(project), traps);
    const captured = capture(sessions, scratchpadLesson());

    sessions.approveCandidate({ candidateId: captured.candidate.id, authorizedScope: "cluster C01 only" });

    const handler = createWebHandler({ token: WEB_TOKEN, cwd: project, home, currentProjectRoot: project });
    const accepted = await webApi(handler, "/api/candidate/accept", {
      projectRoot: project,
      sessionId: captured.session.id,
      candidateId: captured.candidate.id,
      executor: "agent",
      authorizedScope: "cluster C01 only",
    });
    expect((await accepted.json()).receipt).toMatchObject({
      executor: "agent",
      authorized_scope: "cluster C01 only",
    });
  });
});

const WEB_TOKEN = "phase1a-token";

function webApi(
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: unknown
): Promise<Response> {
  return handler(new Request(`http://codetrap.local${path}`, {
    method: "POST",
    headers: new Headers({ "X-Codetrap-Token": WEB_TOKEN, "content-type": "application/json" }),
    body: JSON.stringify(body),
  }));
}

function cliProject(prefix: string): { cwd: string; home: string } {
  return { cwd: tempProjectDir(prefix), home: tempHome() };
}

function expectOk(result: CliResult): CliResult {
  if (result.exitCode !== 0) {
    throw new Error(`CLI exited ${result.exitCode}:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function harness(prefix: string): {
  project: string;
  sessions: SessionOperations;
  traps: TrapOperations;
} {
  const project = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(project, ".codetrap"));
  const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
  const traps = new TrapOperations(new TrapStore(project, undefined, home));
  return { project, traps, sessions: new SessionOperations(new SessionStore(project), traps) };
}

function capture(sessions: SessionOperations, request: Parameters<SessionOperations["captureCandidate"]>[0]) {
  const result = sessions.captureCandidate(request);
  if (result.suppressed) throw new Error(`Expected a proposed candidate, got a suppressed one: ${result.title}`);
  return result;
}

/** Phase 0 cluster C01 — the lesson Phase 1A pushes end to end. */
function scratchpadLesson() {
  return {
    trap: {
      title: "Scratchpad Node scripts cannot resolve project node_modules",
      category: "convention",
      scope: "project",
      severity: "warning",
      tags: ["node", "scratchpad", "esm"],
      context: "About to write a throwaway .mjs script that imports a project dependency to reproduce a bug.",
      mistake: "Writing the script into the session scratchpad; Node resolves upward and never reaches the repo, so the import fails with ERR_MODULE_NOT_FOUND.",
      fix: "Put the script under the project tree, or run it with NODE_PATH=<repo>/node_modules.",
    },
    sourceRef: "phase0:C01",
  };
}

/** Phase 0 cluster C05 — the lesson used for the suppression half. */
function trackingDocLesson() {
  return {
    trap: {
      title: "Update the tracking doc as part of finishing the work",
      category: "convention",
      scope: "project",
      severity: "warning",
      context: "When you finish implementing items that came from a tracking document.",
      mistake: "Reporting the code as done while the doc still lists the items open.",
      fix: "Edit the doc in the same turn and include it in the commit.",
    } as Record<string, unknown>,
    sourceRef: "phase0:C05",
  };
}
