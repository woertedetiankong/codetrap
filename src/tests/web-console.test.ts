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

  test("lists trap library entries across project and global scopes with filters", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-library-");
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));

    const projectActive = traps.addTrap({ ...trapInput({
      title: "Use the shared web API helper",
      category: "api",
      scope: "project",
      context: "When adding browser requests in the web console.",
      mistake: "Calling fetch directly scatters authorization and error handling.",
      fix: "Use the console api helper for every request.",
      tags: ["web", "api"],
      severity: "error",
      module: "web",
      owner: "local",
      path_globs: ["src/web/**"],
    }) });
    traps.addTrapEvidence(projectActive.id, {
      source_type: "manual",
      related_files: ["src/web/static.ts"],
      note: "Seeded from the web library test.",
    }, "project");

    const archived = traps.addTrap({ ...trapInput({
      title: "Old review console behavior",
      category: "api",
      scope: "project",
      context: "When reviewing superseded web console behavior.",
      mistake: "Treating old review-only behavior as current.",
      fix: "Keep archived behavior out of the default library.",
      tags: ["web"],
      severity: "warning",
      module: "web",
      owner: "local",
    }) });
    traps.archiveTrap(archived.id, "project");

    traps.addTrap({ ...trapInput({
      title: "Global review habit",
      category: "convention",
      scope: "global",
      context: "When reviewing traps across projects.",
      mistake: "Assuming only project-local lessons matter.",
      fix: "Include global lessons in the default library view.",
      tags: ["review"],
      severity: "critical",
      module: "habits",
      owner: "local",
    }) });

    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const unauthorized = await handler(new Request(`http://codetrap.local/api/traps?project=${encodeURIComponent(project)}`));
    expect(unauthorized.status).toBe(401);

    const list = await api(handler, `/api/traps?project=${encodeURIComponent(project)}`);
    expect(list.status).toBe(200);
    const payload = await list.json();
    expect(payload.traps.map((trap: any) => [trap.scope, trap.title])).toEqual([
      ["project", "Use the shared web API helper"],
      ["global", "Global review habit"],
    ]);
    expect(payload.traps[0].tags).toEqual(["web", "api"]);
    expect(payload.traps.some((trap: any) => trap.title === "Old review console behavior")).toBe(false);

    const projectOnly = await api(handler, `/api/traps?project=${encodeURIComponent(project)}&scope=project`);
    expect((await projectOnly.json()).traps.map((trap: any) => trap.scope)).toEqual(["project"]);

    const allProject = await api(handler, `/api/traps?project=${encodeURIComponent(project)}&scope=project&status=all`);
    expect((await allProject.json()).traps.map((trap: any) => trap.status).sort()).toEqual(["active", "archived"]);

    const filtered = await api(handler, `/api/traps?project=${encodeURIComponent(project)}&category=api&module=web&owner=local`);
    expect((await filtered.json()).traps.map((trap: any) => trap.title)).toEqual(["Use the shared web API helper"]);

    const detail = await api(handler, `/api/trap?project=${encodeURIComponent(project)}&id=${projectActive.id}&scope=project`);
    expect(detail.status).toBe(200);
    const detailPayload = await detail.json();
    expect(detailPayload.trap.tags).toEqual(["web", "api"]);
    expect(detailPayload.trap.path_globs).toEqual(["src/web/**"]);
    expect(detailPayload.evidence[0].related_files).toEqual(["src/web/static.ts"]);
  });

  test("session list API exposes pending candidate review counts", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-session-review-counts-");
    addWebProject(project, home);
    const { sessionId } = seedCandidateSession(project, 2, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const response = await api(handler, `/api/sessions?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.candidate_review).toMatchObject({
      pending_count: 2,
      reviewed_count: 0,
      pending_session_count: 1,
      next_session_id: sessionId,
    });
    expect(payload.sessions[0]).toMatchObject({
      id: sessionId,
      pending_count: 2,
      reviewed_count: 0,
      high_quality_pending_count: 2,
      needs_edit_count: 0,
      candidate_review: {
        session_id: sessionId,
        pending_count: 2,
      },
    });
  });

  test("saves candidate drafts and resets conflict diagnostics", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-save-");
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 1, home);
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
    const blockedPayload = await blocked.json();
    expect(blockedPayload.next_actions).toBeUndefined();

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
    const { sessionId, traps } = seedCandidateSession(project, 3, home);
    traps.addTrap({ ...existingProjectTrap() });
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const blocked = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-001" },
    });
    expect(blocked.status).toBe(409);
    const blockedPayload = await blocked.json();
    expect(blockedPayload.next_actions).toBeUndefined();
    expect(blockedPayload.possible_conflicts[0]).toMatchObject({
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

  test("accepts candidate draft edits through the API", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-accept-edit-");
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 1, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const accepted = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: {
        projectRoot: project,
        sessionId,
        candidateId: "cand-001",
        trap: {
          title: "Accept current web review draft",
          category: "api",
          scope: "project",
          context: "When accepting a polished candidate in the web review console.",
          mistake: "Accepting only the last saved candidate loses visible form edits.",
          fix: "Send the current candidate form as an accept-time edit.",
          severity: "warning",
          tags: ["web", "review"],
          path_globs: ["src/web/**"],
          module: "web",
          owner: "",
        },
      },
    });

    expect(accepted.status).toBe(200);
    const payload = await accepted.json();
    expect(payload.candidate.trap).toMatchObject({
      title: "Accept current web review draft",
      module: "web",
      owner: null,
    });
    const details = traps.getTrapDetails(payload.trap_id, "project");
    expect(details?.trap).toMatchObject({
      title: "Accept current web review draft",
      fix: "Send the current candidate form as an accept-time edit.",
      owner: null,
    });
  });

  test("candidate list reports accepted traps that were later deleted", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-reviewed-");
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 1, home);
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

    const cleaned = await api(handler, "/api/session/cleanup", {
      method: "POST",
      body: { projectRoot: project, sessionId },
    });
    expect(cleaned.status).toBe(200);
    const cleanedPayload = await cleaned.json();
    expect(cleanedPayload).toMatchObject({
      removed_count: 1,
      removed_candidate_ids: ["cand-001"],
      candidates: [],
    });
  });

  test("deletes sessions through the web API", async () => {
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-session-delete-");
    addWebProject(project, home);
    const { sessionId } = seedCandidateSession(project, 1, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const deleted = await api(handler, "/api/session/delete", {
      method: "POST",
      body: { projectRoot: project, sessionId },
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({
      success: true,
      session_id: sessionId,
      deleted: true,
    });

    const list = await api(handler, `/api/sessions?project=${encodeURIComponent(project)}`);
    expect((await list.json()).sessions).toEqual([]);
  });
});

function seedCandidateSession(project: string, count: number, home: string): { sessionId: string; traps: TrapOperations } {
  const traps = new TrapOperations(new TrapStore(project, undefined, home));
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
  return trapInput({
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

function trapInput(args: Record<string, unknown>) {
  return buildTrapInput(args);
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
