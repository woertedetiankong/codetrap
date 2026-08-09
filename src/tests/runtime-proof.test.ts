import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli, tempHome, tempProjectDir } from "./helpers";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { buildContextPack, formatContextPackMarkdown } from "../lib/context-pack";
import { createWebHandler } from "../web/server";
import { addWebProject } from "../web/project-registry";

describe("Phase 1E — usefulness is a distinct signal from recall", () => {
  test("marking useful does not just count views", () => {
    const cwd = tempProjectDir("codetrap-1e-useful-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const added = JSON.parse(runCli([
      "add", "--input-json", JSON.stringify(trapInput()), "--json",
    ], cwd, home).stdout);

    // Viewing bumps hit_count only.
    runCli(["show", String(added.id), "--json"], cwd, home);
    const afterView = JSON.parse(runCli(["show", String(added.id), "--json"], cwd, home).stdout);
    expect(afterView.trap.hit_count).toBeGreaterThan(0);
    expect(afterView.trap.useful_count).toBe(0);

    const marked = JSON.parse(runCli(["useful", String(added.id), "--json"], cwd, home).stdout);
    expect(marked).toMatchObject({ success: true, id: added.id, useful_count: 1 });
    expect(marked.last_useful_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const after = JSON.parse(runCli(["show", String(added.id), "--json"], cwd, home).stdout);
    expect(after.trap.useful_count).toBe(1);
  });

  test("marking useful twice accumulates", () => {
    const cwd = tempProjectDir("codetrap-1e-useful-twice-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const added = JSON.parse(runCli(["add", "--input-json", JSON.stringify(trapInput()), "--json"], cwd, home).stdout);
    runCli(["useful", String(added.id)], cwd, home);
    const second = JSON.parse(runCli(["useful", String(added.id), "--json"], cwd, home).stdout);
    expect(second.useful_count).toBe(2);
  });

  test("marking a missing trap useful fails loudly", () => {
    const cwd = tempProjectDir("codetrap-1e-useful-missing-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const result = runCli(["useful", "4242"], cwd, home);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("not found");
  });
});

describe("Phase 1E — curated context pack", () => {
  test("C2: a pack contains the chosen committed lessons and says it is not injection", () => {
    const cwd = tempProjectDir("codetrap-1e-pack-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const first = JSON.parse(runCli(["add", "--input-json", JSON.stringify(trapInput()), "--json"], cwd, home).stdout);
    const second = JSON.parse(runCli([
      "add", "--input-json", JSON.stringify(trapInput({ title: "A second committed lesson" })), "--json",
    ], cwd, home).stdout);
    runCli(["useful", String(first.id)], cwd, home);

    const result = runCli(["pack", "export", "--traps", `${first.id},${second.id}`, "--json"], cwd, home);
    expect(result.exitCode).toBe(0);
    const pack = JSON.parse(result.stdout);

    expect(pack.entries).toHaveLength(2);
    expect(pack.entries.map((e: { trap_id: number }) => e.trap_id)).toEqual([first.id, second.id]);
    expect(pack.entries[0].useful_count).toBe(1);
    // §12.1: user-invoked, never auto-injected, and not a substitute for
    // agent-initiated pre-flight recall.
    expect(pack.note).toContain("Not auto-injected");
    expect(pack.note.toLowerCase()).toContain("pre-flight");

    const markdown = runCli(["pack", "export", "--traps", String(first.id)], cwd, home).stdout;
    expect(markdown).toContain("# codetrap context pack");
    expect(markdown).toContain("When this applies");
    expect(markdown).toContain("marked useful 1×");
  });

  test("a pack refuses ids that are not committed lessons", () => {
    const cwd = tempProjectDir("codetrap-1e-pack-missing-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const result = runCli(["pack", "export", "--traps", "1,999"], cwd, home);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("committed lessons only");
  });

  test("pack export requires an explicit selection", () => {
    const cwd = tempProjectDir("codetrap-1e-pack-empty-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const result = runCli(["pack", "export"], cwd, home);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("--traps is required");
  });

  test("the markdown form is what a user pastes into planning", () => {
    const pack = buildContextPack({
      details: [{
        scope: "project",
        trap: {
          id: 7, title: "T", category: "convention", tags: "[]", scope: "project",
          context: "when", mistake: "avoid", fix: "do", search_text: "", before_code: null,
          after_code: null, severity: "warning", path_globs: "[]", module: null, owner: null,
          status: "active" as const, state_key: null, supersedes_id: null,
          valid_from: null as unknown as string, valid_until: null,
          project_path: "/p",
          hit_count: 0, useful_count: 3, last_useful_at: "2026-07-25T00:00:00.000Z",
          last_validated: null, graduated_at: null, graduated_to: null,
          created_at: "", updated_at: "",
        },
        evidence: [],
      }],
      projectPath: "/p",
      now: new Date("2026-07-25T00:00:00.000Z"),
    });
    const markdown = formatContextPackMarkdown(pack);
    expect(markdown).toContain("## T");
    expect(markdown).toContain("trap #7 (project)");
    expect(markdown).toContain("marked useful 3×");
  });
});

describe("Phase 1E — review fixes", () => {
  test("usefulness survives an export/import round trip", () => {
    const cwd = tempProjectDir("codetrap-1e-roundtrip-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const added = JSON.parse(runCli(["add", "--input-json", JSON.stringify(trapInput()), "--json"], cwd, home).stdout);
    runCli(["useful", String(added.id)], cwd, home);
    runCli(["useful", String(added.id)], cwd, home);

    const exportPath = join(cwd, "export.json");
    writeFileSync(exportPath, runCli(["export", "--json"], cwd, home).stdout);

    const target = tempProjectDir("codetrap-1e-roundtrip-target-");
    const targetHome = tempHome();
    runCli(["init"], target, targetHome);
    const imported = runCli(["import", exportPath, "--json"], target, targetHome);
    expect(JSON.parse(imported.stdout).imported).toBe(1);

    const [trap] = JSON.parse(runCli(["list", "--status", "all", "--json"], target, targetHome).stdout);
    // The metric the §17 falsifier depends on must not be destroyed by
    // ordinary maintenance while hit_count survives.
    expect(trap.useful_count).toBe(2);
    expect(trap.last_useful_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("a pack refuses archived and superseded traps", () => {
    const cwd = tempProjectDir("codetrap-1e-pack-retired-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const added = JSON.parse(runCli(["add", "--input-json", JSON.stringify(trapInput()), "--json"], cwd, home).stdout);
    runCli(["archive_trap", String(added.id)], cwd, home);

    const result = runCli(["pack", "export", "--traps", String(added.id)], cwd, home);
    expect(result.exitCode).toBe(1);
    // A retired lesson pasted into planning context reads as current advice.
    expect(`${result.stdout}${result.stderr}`).toContain("Not active");
  });

  test("a malformed --traps list is refused, not silently truncated", () => {
    const cwd = tempProjectDir("codetrap-1e-pack-parse-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const added = JSON.parse(runCli(["add", "--input-json", JSON.stringify(trapInput()), "--json"], cwd, home).stdout);

    for (const bad of ["1;2", "abc", `${added.id},abc`]) {
      const result = runCli(["pack", "export", "--traps", bad], cwd, home);
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain("Invalid trap id");
    }

    // Duplicates collapse rather than emitting the lesson twice.
    const pack = JSON.parse(
      runCli(["pack", "export", "--traps", `${added.id},${added.id}`, "--json"], cwd, home).stdout
    );
    expect(pack.entries).toHaveLength(1);
  });

  test("approve binds to the draft the user is looking at", async () => {
    const home = tempHome("codetrap-1e-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-1e-web-approve-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));
    const sessions = new SessionOperations(new SessionStore(project), traps);
    const captured = sessions.captureCandidate(lesson());
    if (captured.suppressed) throw new Error("unexpected suppression");

    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });
    const edited = { ...captured.candidate.trap, fix: "A fix the user rewrote in the console before approving." };
    const response = await webPost(handler, "/api/candidate/approve", {
      projectRoot: project,
      sessionId: captured.session.id,
      candidateId: captured.candidate.id,
      trap: edited,
    });
    expect(response.status).toBe(200);
    const payload = await response.json();

    // The approval must cover the edited content, so an agent committing
    // against it commits what the user actually saw.
    const stored = sessions.getCandidate(captured.candidate.id).candidate;
    expect(stored.trap.fix).toContain("rewrote in the console");
    expect(payload.authorization.content_hash).toBe(stored.content_hash);
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "agent",
    });
    expect(accepted.success).toBe(true);
  });

  test("the rollback route undoes a console commit", async () => {
    const home = tempHome("codetrap-1e-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-1e-web-rollback-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));
    const sessions = new SessionOperations(new SessionStore(project), traps);
    const captured = sessions.captureCandidate(lesson());
    if (captured.suppressed) throw new Error("unexpected suppression");

    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });
    const accepted = await (await webPost(handler, "/api/candidate/accept", {
      projectRoot: project,
      sessionId: captured.session.id,
      candidateId: captured.candidate.id,
    })).json();
    expect(traps.getTrapDetails(accepted.trap_id, accepted.scope)).not.toBeNull();

    const rolled = await (await webPost(handler, "/api/candidate/rollback", {
      projectRoot: project,
      sessionId: captured.session.id,
      candidateId: captured.candidate.id,
    })).json();
    expect(rolled).toMatchObject({ success: true, trap_deleted: true });
    expect(rolled.receipt.action).toBe("rollback");
    expect(traps.getTrapDetails(accepted.trap_id, accepted.scope)).toBeNull();
  });
});

const TOKEN = "phase1e-token";

function webPost(
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: unknown
): Promise<Response> {
  return handler(new Request(`http://codetrap.local${path}`, {
    method: "POST",
    headers: new Headers({ "X-Codetrap-Token": TOKEN, "content-type": "application/json" }),
    body: JSON.stringify(body),
  }));
}

describe("Phase 1E — inbox budgets and commit discipline", () => {
  test("§4.2 inbox health reports the soft cap and staleness horizon", () => {
    const { sessions } = harness("codetrap-1e-budget-");
    const health = sessions.inboxHealth();
    expect(health).toMatchObject({ pending_count: 0, soft_cap: 30, over_cap: false, stale_after_days: 60 });
  });

  test("§4.2 a pending candidate older than the horizon is reported stale, never deleted", () => {
    const { sessions } = harness("codetrap-1e-stale-");
    const captured = sessions.captureCandidate(lesson());
    expect(captured.suppressed).toBe(false);

    const fresh = sessions.inboxHealth();
    expect(fresh.pending_count).toBe(1);
    expect(fresh.stale_count).toBe(0);

    // Look at the same store 90 days later.
    const later = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const aged = sessions.inboxHealth(later);
    expect(aged.stale_count).toBe(1);
    expect(aged.pending_count).toBe(1); // still there — stale is a label, not a delete
    expect(aged.stale_candidates[0].title).toContain("Scratchpad Node scripts");
  });

  test("doctor surfaces the inbox budget", () => {
    const cwd = tempProjectDir("codetrap-1e-doctor-budget-");
    const home = tempHome();
    runCli(["init"], cwd, home);
    const report = JSON.parse(runCli(["doctor", "--json"], cwd, home).stdout);
    expect(report.inbox_health).toMatchObject({ soft_cap: 30, stale_after_days: 60 });
  });

  test("§16 1E: only pitfall_trap commits; unclassified is reviewable but not committable", async () => {
    const { sessions } = harness("codetrap-1e-unclassified-");
    const captured = sessions.captureCandidate({ ...lesson(), candidateKind: "unclassified" });
    expect(captured.suppressed).toBe(false);
    if (captured.suppressed) return;
    expect(captured.candidate.candidate_kind).toBe("unclassified");

    await expect(
      sessions.acceptCandidate({ candidateId: captured.candidate.id, executor: "user" })
    ).rejects.toThrow(/commits only pitfall_trap/);

    // It can still be reviewed and suppressed — that is the point of the kind.
    const rejected = sessions.rejectCandidate({
      candidateId: captured.candidate.id,
      reason: "Not agent-actionable.",
    });
    expect(rejected.candidate.status).toBe("rejected");
    expect(rejected.suppression.fingerprint).toBe(captured.fingerprint);
  });
});

function harness(prefix: string) {
  const project = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(project, ".codetrap"));
  const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
  const traps = new TrapOperations(new TrapStore(project, undefined, home));
  return { project, traps, sessions: new SessionOperations(new SessionStore(project), traps) };
}

function trapInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "A committed lesson worth recalling",
    category: "convention",
    scope: "project",
    severity: "warning",
    tags: ["node"],
    context: "When doing the thing that triggers this lesson.",
    mistake: "Doing it the way that fails.",
    fix: "Do it the way that works.",
    ...overrides,
  };
}

function lesson() {
  return {
    trap: {
      title: "Scratchpad Node scripts cannot resolve project node_modules",
      category: "convention",
      scope: "project",
      severity: "warning",
      context: "When writing a throwaway script that imports a project dependency.",
      mistake: "Putting it in the session scratchpad where Node cannot resolve the repo.",
      fix: "Write it under the project tree, or set NODE_PATH to the repo.",
    } as Record<string, unknown>,
  };
}
