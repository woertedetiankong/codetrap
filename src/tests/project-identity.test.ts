import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDoctorReport } from "../lib/doctor";
import {
  ensureProjectIdentity,
  projectIdentityPath,
  readProjectIdentity,
} from "../lib/project-identity";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { runCli, tempDir, tempHome, tempProjectDir, trap } from "./helpers";

function projectDbPath(root: string): string {
  return join(root, ".codetrap", "traps.db");
}

function readProjectMetaRow(root: string): { project_id: string; project_path: string | null } | null {
  const db = new Database(projectDbPath(root), { readonly: true });
  try {
    return db.query("SELECT project_id, project_path FROM project_meta LIMIT 1").get() as
      | { project_id: string; project_path: string | null }
      | null;
  } finally {
    db.close();
  }
}

describe("project identity (A1)", () => {
  test("ensureProjectIdentity mints a stable id and is idempotent", () => {
    const project = tempProjectDir("codetrap-identity-mint-", { realpath: true });

    const first = ensureProjectIdentity(project);
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(first.path).toBe(project);
    expect(existsSync(projectIdentityPath(project))).toBe(true);

    // A second call must return the same id — never re-mint over an existing one.
    const second = ensureProjectIdentity(project);
    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);
  });

  test("readProjectIdentity returns null when absent and throws on corruption", () => {
    const project = tempProjectDir("codetrap-identity-read-", { realpath: true });
    expect(readProjectIdentity(project)).toBeNull();

    writeFileSync(projectIdentityPath(project), "{ not json");
    expect(() => readProjectIdentity(project)).toThrow(/Corrupt project identity file/);
  });

  test("adding a project trap mints the identity and records it in project_meta", () => {
    const home = tempHome("codetrap-identity-home-", { initCodetrap: true });
    const project = tempProjectDir("codetrap-identity-add-", { realpath: true });
    const store = new TrapStore(project, undefined, home);

    store.add(trap({ scope: "project", title: "Project-scoped lesson" }));

    const identity = readProjectIdentity(project);
    expect(identity).not.toBeNull();
    const meta = readProjectMetaRow(project);
    expect(meta?.project_id).toBe(identity!.id);
    expect(meta?.project_path).toBe(project);

    // A second write keeps the same identity.
    store.add(trap({ scope: "project", title: "Another project lesson" }));
    expect(readProjectIdentity(project)!.id).toBe(identity!.id);
  });

  test("a global write outside a project does not mint a project identity", () => {
    const home = tempHome("codetrap-identity-global-home-", { initCodetrap: true });
    const noProject = tempDir("codetrap-identity-noproject-", { realpath: true });
    const store = new TrapStore(noProject, undefined, home);

    store.add(trap({ scope: "global", title: "Global lesson" }));

    expect(existsSync(projectIdentityPath(noProject))).toBe(false);
    expect(store.projectIdentity()).toBeNull();
  });

  test("doctor surfaces the project id and flags a moved project", async () => {
    const home = tempHome("codetrap-identity-doctor-home-", { initCodetrap: true });
    const project = tempProjectDir("codetrap-identity-doctor-", { realpath: true });
    const store = new TrapStore(project, undefined, home);
    const operations = new TrapOperations(store);

    const identity = ensureProjectIdentity(project);
    const report = await buildDoctorReport(store, operations, project);
    expect(report.project_id).toBe(identity.id);
    expect(report.project_moved).toBe(false);

    // Simulate a rename/move: the recorded creation path no longer matches the
    // current root, but the id is unchanged — path is display-only metadata.
    const moved = { ...identity, path: join(project, "..", "some-old-name") };
    writeFileSync(projectIdentityPath(project), `${JSON.stringify(moved, null, 2)}\n`);
    const movedReport = await buildDoctorReport(store, operations, project);
    expect(movedReport.project_id).toBe(identity.id);
    expect(movedReport.project_moved).toBe(true);
  });

  test("`codetrap init` mints and reports the project id, and back-fills a pre-A1 project", () => {
    const home = tempHome("codetrap-identity-init-home-", { initCodetrap: true });

    // Fresh directory with no .codetrap yet.
    const fresh = tempDir("codetrap-identity-init-fresh-", { realpath: true });
    const first = runCli(["init"], fresh, home);
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain("Initialized .codetrap/");
    expect(first.stdout).toMatch(/Project id: [0-9a-f-]{36}/);
    const minted = readProjectIdentity(fresh);
    expect(minted).not.toBeNull();

    // A project initialized before A1: has .codetrap/ but no project.json. Init
    // must back-fill the identity rather than report nothing.
    const legacy = tempProjectDir("codetrap-identity-init-legacy-", { realpath: true });
    expect(existsSync(projectIdentityPath(legacy))).toBe(false);
    const second = runCli(["init"], legacy, home);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("Project already initialized.");
    expect(second.stdout).toMatch(/Project id: [0-9a-f-]{36}/);
    expect(readProjectIdentity(legacy)).not.toBeNull();
  });
});
