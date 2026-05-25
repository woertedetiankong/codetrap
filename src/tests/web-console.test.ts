import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTrapInput } from "../domain/trap";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { addWebProject, loadWebProjectRegistry, resolveWebProjectRoot, webProjectsPath } from "../web/project-registry";
import { createWebHandler } from "../web/server";

const TOKEN = "test-token";

describe("web project registry", () => {
  test("loads, saves, and resolves manually added projects from absolute paths", () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-project-");
    const nested = join(project, "src", "nested");
    mkdirSync(nested, { recursive: true });

    const added = addWebProject(nested, home, new Date("2026-05-24T12:00:00.000Z"));
    expect(added.root).toBe(project);
    expect(resolveWebProjectRoot(nested, home)).toBe(project);

    const registry = loadWebProjectRegistry(home);
    expect(registry.projects).toEqual([added]);
    expect(existsSync(webProjectsPath(home))).toBe(true);
  });

  test("rejects paths that do not belong to an initialized codetrap project", () => {
    const home = tempHome();
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "codetrap-web-uninit-")));

    expect(() => addWebProject(dir, home)).toThrow("No initialized codetrap project");
  });
});

describe("web API", () => {
  test("requires the launch token for API routes", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-token-");
    addWebProject(project, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const missing = await handler(new Request("http://codetrap.local/api/bootstrap"));
    expect(missing.status).toBe(401);

    const ok = await api(handler, "/api/bootstrap");
    expect(ok.status).toBe(200);
    expect((await ok.json()).projects[0].root).toBe(project);
  });

  test("saves candidate drafts and resets conflict diagnostics", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-save-");
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 1);
    traps.addTrap({ ...existingProjectTrap() });

    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });
    const blocked = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: {
        projectRoot: project,
        sessionId,
        candidateId: "cand-001",
      },
    });
    expect(blocked.status).toBe(409);

    const afterConflict = JSON.parse(readFileSync(join(
      project,
      ".codetrap",
      "sessions",
      sessionId,
      "candidate-traps.json"
    ), "utf-8"));
    expect(afterConflict.candidates[0].quality).toMatchObject({
      conflict_checked: true,
      conflict_status: "possible",
    });

    const saved = await api(handler, "/api/candidate/save", {
      method: "POST",
      body: {
        projectRoot: project,
        sessionId,
        candidateId: "cand-001",
        trap: {
          ...afterConflict.candidates[0].trap,
          module: "web",
          owner: "",
        },
      },
    });
    expect(saved.status).toBe(200);
    const payload = await saved.json();
    expect(payload.candidate.trap.module).toBe("web");
    expect(payload.candidate.quality).toMatchObject({
      conflict_checked: false,
      conflict_status: "none",
    });
  });

  test("accepts, rejects, accepts anyway, and supersedes through the API", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-actions-");
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 3);
    traps.addTrap({ ...existingProjectTrap() });
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const blocked = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-001" },
    });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).possible_conflicts[0]).toMatchObject({
      trap_id: 1,
      scope: "project",
    });

    const acceptedAnyway = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-001", acceptAnyway: true },
    });
    expect(acceptedAnyway.status).toBe(200);
    expect((await acceptedAnyway.json()).candidate.status).toBe("accepted");

    const superseded = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-002", supersedesId: 1 },
    });
    expect(superseded.status).toBe(200);
    expect((await superseded.json()).superseded_id).toBe(1);
    expect(traps.getTrapDetails(1, "project")?.trap.status).toBe("superseded");

    const rejected = await api(handler, "/api/candidate/reject", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-003", reason: "Too broad." },
    });
    expect(rejected.status).toBe(200);
    const rejectedPayload = await rejected.json();
    expect(rejectedPayload.candidate).toMatchObject({
      id: "cand-003",
      status: "rejected",
      rejection_reason: "Too broad.",
    });
  });

  test("candidate list reports accepted traps that were later deleted", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-reviewed-");
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 1);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const initial = await api(handler, `/api/candidates?project=${encodeURIComponent(project)}&session=${encodeURIComponent(sessionId)}`);
    expect((await initial.json()).candidates[0].review).toMatchObject({
      status: "pending",
    });

    const accepted = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-001" },
    });
    const acceptedPayload = await accepted.json();
    expect(accepted.status).toBe(200);
    expect(traps.deleteTrap(acceptedPayload.trap_id, "project").success).toBe(true);

    const candidates = await api(handler, `/api/candidates?project=${encodeURIComponent(project)}&session=${encodeURIComponent(sessionId)}`);
    const payload = await candidates.json();
    expect(payload.candidates[0].review).toMatchObject({
      status: "accepted_missing",
      label: `accepted -> trap #${acceptedPayload.trap_id} deleted`,
      trap_id: acceptedPayload.trap_id,
      trap_present: false,
    });
  });
});

function seedCandidateSession(project: string, count: number): { sessionId: string; traps: TrapOperations } {
  const traps = new TrapOperations(new TrapStore(project));
  const sessions = new SessionOperations(new SessionStore(project), traps);
  const session = sessions.startSession({
    goal: "review web candidates",
    module: "api",
    owner: "local",
  });
  for (let index = 1; index <= count; index++) {
    sessions.addNote({
      kind: "review",
      text: [
        `Title: Prefer stable API client ${index}`,
        "Category: api",
        "Context: When making API requests in this project.",
        "Mistake: Calling fetch directly skips the shared request wrapper.",
        "Fix: Use the stable apiClient helper instead.",
        "Severity: error",
        "Tags: api,fetch",
        "Path globs: src/api/**",
      ].join("\n"),
    });
  }
  sessions.closeSession(session.id, true);
  return { sessionId: session.id, traps };
}

function existingProjectTrap() {
  return buildTrapInput({
    title: "Use stable API client",
    category: "api",
    scope: "project",
    context: "When making API requests in this project.",
    mistake: "Calling fetch directly bypasses retry behavior.",
    fix: "Use the stable API client helper.",
    tags: ["api", "fetch"],
    severity: "error",
    module: "api",
  });
}

function api(
  handler: (request: Request) => Promise<Response>,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<Response> {
  const headers = new Headers({ "X-Codetrap-Token": TOKEN });
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }
  return handler(new Request(`http://codetrap.local${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  }));
}

function tempHome(): string {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "codetrap-web-home-")));
  mkdirSync(join(home, ".codetrap"), { recursive: true });
  return home;
}

function tempProjectDir(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  mkdirSync(join(dir, ".codetrap"));
  return dir;
}
