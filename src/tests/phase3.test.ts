import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CANDIDATE_SCHEMA_VERSION } from "../domain/candidate";
import { migrateCandidate } from "../lib/candidate-envelope";
import type { CandidateTrap } from "../domain/session";
import { runCli, tempDir, tempHome, tempProjectDir } from "./helpers";

function runJson(args: string[], cwd: string, home: string): any {
  const result = runCli([...args, "--json"], cwd, home);
  expect(result.exitCode, `${result.stderr}\n${result.stdout}`).toBe(0);
  return JSON.parse(result.stdout);
}

function propose(cwd: string, home: string) {
  return runJson(["phase3", "propose", "--preset", "review-ui-screenshots"], cwd, home);
}

function preview(cwd: string, home: string, sessionId: string, candidateId: string, codexHome: string, claudeHome: string) {
  return runJson([
    "phase3", "preview", candidateId, "--session", sessionId,
    "--codex-home", codexHome, "--claude-home", claudeHome,
  ], cwd, home);
}

function installArgs(sessionId: string, candidateId: string, codexHome: string, claudeHome: string) {
  return [
    "phase3", "install", candidateId, "--session", sessionId,
    "--codex-home", codexHome, "--claude-home", claudeHome,
  ];
}

describe("Phase 3 skill candidate lifecycle", () => {
  test("preview is read-only; exact approval installs byte-identically and rollback restores both targets", () => {
    const cwd = tempProjectDir("codetrap-p3-lifecycle-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-codex-");
    const claudeHome = tempDir("codetrap-p3-claude-");
    const codexTarget = join(codexHome, "skills", "review-ui-screenshots");
    const claudeTarget = join(claudeHome, "skills", "review-ui-screenshots");
    mkdirSync(join(codexTarget, "legacy-empty"), { recursive: true });
    writeFileSync(join(codexTarget, "SKILL.md"), "old codex skill\r\n");
    writeFileSync(join(codexTarget, "legacy.bin"), Buffer.from([0, 1, 2, 255]));
    const before = directoryState(codexTarget);

    const captured = propose(cwd, home);
    const sessionId = captured.session.id;
    const candidateId = captured.candidate.id;
    expect(captured.candidate).toMatchObject({
      schema_version: CANDIDATE_SCHEMA_VERSION,
      candidate_kind: "skill_candidate",
      review_decision: "pending",
      delivery_state: "draft",
    });

    const plan = preview(cwd, home, sessionId, candidateId, codexHome, claudeHome);
    expect(plan.targets.map((target: { client: string }) => target.client)).toEqual(["codex", "claude"]);
    expect(plan.targets[0]).toMatchObject({ created: false, changed: true });
    expect(plan.targets[1]).toMatchObject({ created: true, changed: true });
    expect(directoryState(codexTarget)).toEqual(before);
    expect(existsSync(claudeTarget)).toBe(false);

    const refused = runCli([...installArgs(sessionId, candidateId, codexHome, claudeHome), "--executor", "user", "--json"], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("no recorded authorization");
    expect(directoryState(codexTarget)).toEqual(before);
    expect(existsSync(claudeTarget)).toBe(false);

    runJson([
      "session", "approve", candidateId, "--session", sessionId,
      "--authorized-scope", plan.required_authorized_scope, "--executor", "agent",
    ], cwd, home);
    const installed = runJson([...installArgs(sessionId, candidateId, codexHome, claudeHome), "--executor", "agent"], cwd, home);
    expect(installed.candidate.delivery_state).toBe("committed");
    expect(installed.receipt).toMatchObject({
      action: "commit", destination: "skill_candidate", executor: "agent",
      authorized_scope: plan.required_authorized_scope,
    });
    expect(directoryState(codexTarget)).toEqual(directoryState(claudeTarget));
    expect(readFileSync(join(codexTarget, "SKILL.md"), "utf-8")).toContain("# Review UI Screenshots");
    expect(readFileSync(join(codexTarget, "agents", "openai.yaml"), "utf-8")).toContain("$review-ui-screenshots");

    const agentRollback = runCli(["phase3", "rollback", installed.commit.id, "--executor", "agent", "--json"], cwd, home);
    expect(agentRollback.exitCode).toBe(1);
    expect(JSON.parse(agentRollback.stdout).error).toContain("does not authorize an agent to remove");

    const rolledBack = runJson(["phase3", "rollback", installed.commit.id, "--executor", "user"], cwd, home);
    expect(rolledBack.candidate).toMatchObject({ review_decision: "pending", delivery_state: "rolled_back" });
    expect(rolledBack.receipt).toMatchObject({ action: "rollback", destination: "skill_candidate", executor: "user" });
    expect(directoryState(codexTarget)).toEqual(before);
    expect(existsSync(claudeTarget)).toBe(false);
  });

  test("material skill edits invalidate approval and require approval of the new revision", () => {
    const cwd = tempProjectDir("codetrap-p3-edit-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-edit-codex-");
    const claudeHome = tempDir("codetrap-p3-edit-claude-");
    const captured = propose(cwd, home);
    const sessionId = captured.session.id;
    const candidateId = captured.candidate.id;
    const firstPlan = preview(cwd, home, sessionId, candidateId, codexHome, claudeHome);
    runJson([
      "session", "approve", candidateId, "--session", sessionId,
      "--authorized-scope", firstPlan.required_authorized_scope,
    ], cwd, home);

    const payload = structuredClone(captured.candidate.destination_payload) as Record<string, any>;
    payload.files["SKILL.md"] += "\nApproved review output must retain stable finding identifiers.\n";
    const edited = runJson([
      "phase3", "edit", candidateId, "--session", sessionId, "--input-json", JSON.stringify(payload),
    ], cwd, home);
    expect(edited.revision).toBe(2);
    expect(edited.authorization).toBeUndefined();

    const refused = runCli([...installArgs(sessionId, candidateId, codexHome, claudeHome), "--executor", "user", "--json"], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("no recorded authorization");

    const secondPlan = preview(cwd, home, sessionId, candidateId, codexHome, claudeHome);
    runJson([
      "session", "approve", candidateId, "--session", sessionId,
      "--authorized-scope", secondPlan.required_authorized_scope,
    ], cwd, home);
    const installed = runJson(installArgs(sessionId, candidateId, codexHome, claudeHome), cwd, home);
    expect(readFileSync(join(codexHome, "skills", "review-ui-screenshots", "SKILL.md"), "utf-8"))
      .toContain("stable finding identifiers");
    runJson(["phase3", "rollback", installed.commit.id], cwd, home);
  });

  test("authorization is bound to the previewed client homes", () => {
    const cwd = tempProjectDir("codetrap-p3-scope-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-scope-codex-");
    const claudeHome = tempDir("codetrap-p3-scope-claude-");
    const otherClaudeHome = tempDir("codetrap-p3-scope-other-");
    const captured = propose(cwd, home);
    const plan = preview(cwd, home, captured.session.id, captured.candidate.id, codexHome, claudeHome);
    runJson([
      "session", "approve", captured.candidate.id, "--session", captured.session.id,
      "--authorized-scope", plan.required_authorized_scope,
    ], cwd, home);

    const refused = runCli([
      ...installArgs(captured.session.id, captured.candidate.id, codexHome, otherClaudeHome), "--json",
    ], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("does not match these exact install targets");
    expect(existsSync(join(codexHome, "skills", "review-ui-screenshots"))).toBe(false);
    expect(existsSync(join(otherClaudeHome, "skills", "review-ui-screenshots"))).toBe(false);
  });

  test("authorization is bound to exact target content, not only install paths", () => {
    const cwd = tempProjectDir("codetrap-p3-content-scope-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-content-scope-codex-");
    const claudeHome = tempDir("codetrap-p3-content-scope-claude-");
    const captured = propose(cwd, home);
    const plan = preview(cwd, home, captured.session.id, captured.candidate.id, codexHome, claudeHome);
    runJson([
      "session", "approve", captured.candidate.id, "--session", captured.session.id,
      "--authorized-scope", plan.required_authorized_scope,
    ], cwd, home);
    const target = join(codexHome, "skills", "review-ui-screenshots");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "local.txt"), "created after preview\n");

    const refused = runCli([
      ...installArgs(captured.session.id, captured.candidate.id, codexHome, claudeHome), "--json",
    ], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("does not match these exact install targets");
    expect(readFileSync(join(target, "local.txt"), "utf-8")).toBe("created after preview\n");
  });

  test("rollback refuses to overwrite a post-install edit", () => {
    const cwd = tempProjectDir("codetrap-p3-conflict-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-conflict-codex-");
    const claudeHome = tempDir("codetrap-p3-conflict-claude-");
    const captured = propose(cwd, home);
    const plan = preview(cwd, home, captured.session.id, captured.candidate.id, codexHome, claudeHome);
    runJson([
      "session", "approve", captured.candidate.id, "--session", captured.session.id,
      "--authorized-scope", plan.required_authorized_scope,
    ], cwd, home);
    const installed = runJson(installArgs(captured.session.id, captured.candidate.id, codexHome, claudeHome), cwd, home);
    const changedPath = join(claudeHome, "skills", "review-ui-screenshots", "SKILL.md");
    const installedText = readFileSync(changedPath, "utf-8");
    writeFileSync(changedPath, `${installedText}\nlocal edit\n`);

    const refused = runCli(["phase3", "rollback", installed.commit.id, "--json"], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("changed after");
    expect(readFileSync(changedPath, "utf-8")).toContain("local edit");

    writeFileSync(changedPath, installedText);
    runJson(["phase3", "rollback", installed.commit.id], cwd, home);
  });

  test("v3 candidates migrate additively and Phase 2 rejects the Phase 3 kind", () => {
    const legacy = {
      id: "cand-v3",
      status: "proposed",
      quality_score: 1,
      quality: { score: 1 },
      trap: {
        title: "Existing Phase 2 candidate", category: "other", scope: "project",
        context: "context", mistake: "mistake", fix: "fix", severity: "warning", tags: [],
      },
      evidence: [],
      schema_version: 3,
      revision: 2,
      content_hash: "preserved-v3-hash",
      candidate_kind: "docs_guidance",
      destination_payload: { path: "docs/a.md", section_id: "a", content: "A" },
      review_decision: "pending",
      delivery_state: "draft",
    } as unknown as CandidateTrap;
    const migrated = migrateCandidate(legacy);
    expect(migrated).toMatchObject({
      schema_version: CANDIDATE_SCHEMA_VERSION,
      candidate_kind: "docs_guidance",
      content_hash: "preserved-v3-hash",
      revision: 2,
    });

    const cwd = tempProjectDir("codetrap-p3-phase2-boundary-");
    const home = tempHome();
    const refused = runCli([
      "phase2", "propose", "--input-json", JSON.stringify({
        kind: "skill_candidate", title: "Wrong command", payload: { name: "wrong" },
      }), "--json",
    ], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("phase2 propose requires");
  });
});

function directoryState(path: string): Array<{ path: string; type: "dir" | "file"; bytes?: string }> {
  if (!existsSync(path)) return [];
  const state: Array<{ path: string; type: "dir" | "file"; bytes?: string }> = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        state.push({ path: itemPath, type: "dir" });
        walk(absolute, itemPath);
      } else {
        state.push({ path: itemPath, type: "file", bytes: readFileSync(absolute).toString("base64") });
      }
    }
  };
  walk(path, "");
  return state;
}
