import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, tempDir, tempHome, tempProjectDir } from "./helpers";

function runJson(args: string[], cwd: string, home: string): any {
  const result = runCli([...args, "--json"], cwd, home);
  expect(result.exitCode, `${result.stderr}\n${result.stdout}`).toBe(0);
  return JSON.parse(result.stdout);
}

function improveArgs(input: Record<string, unknown>, codexHome: string, claudeHome: string) {
  return [
    "phase3", "improve", "--input-json", JSON.stringify(input),
    "--codex-home", codexHome, "--claude-home", claudeHome,
  ];
}

function previewArgs(sessionId: string, candidateId: string, codexHome: string, claudeHome: string) {
  return [
    "phase3", "preview", candidateId, "--session", sessionId,
    "--codex-home", codexHome, "--claude-home", claudeHome,
  ];
}

function installArgs(sessionId: string, candidateId: string, codexHome: string, claudeHome: string) {
  return [
    "phase3", "install", candidateId, "--session", sessionId,
    "--codex-home", codexHome, "--claude-home", claudeHome,
  ];
}

function improvementInput() {
  return {
    name: "http-review",
    title: "Teach the HTTP review Skill to require explicit timeouts",
    trigger: "When reviewing code that calls an external HTTP dependency.",
    mistake: "The existing workflow checks response handling but can miss an unbounded request.",
    fix: "Apply the external-request timeout principle and consult the focused reference when HTTP calls are present.",
    why: "External dependencies can stall independently of the agent process, so timeout review must be explicit.",
    source_agent: "codex",
    source_refs: ["pr:17#review", "pr:29#review"],
    tags: ["http", "timeout"],
    operations: [
      {
        op: "replace_text",
        path: "SKILL.md",
        old_text: "## Principle\n\nKeep the main skill short.",
        new_text: "## Principle\n\nKeep the main skill short. Require an explicit timeout for external HTTP calls.\n\nSee `references/http-timeout.md` when HTTP appears in the task.",
      },
      {
        op: "write_text",
        path: "references/http-timeout.md",
        content: "# HTTP timeout review\n\nCheck the project policy and require a bounded request.\n",
      },
      {
        op: "write_base64",
        path: "assets/timeout.bin",
        content_base64: Buffer.from([0, 1, 2, 255]).toString("base64"),
      },
      { op: "delete", path: "examples/obsolete.md" },
    ],
  };
}

describe("Phase 3 existing Skill improvement", () => {
  test("stages a minimal patch, preserves unrelated resources, installs symmetrically, and rolls back", () => {
    const cwd = tempProjectDir("codetrap-p3-improve-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-improve-codex-");
    const claudeHome = tempDir("codetrap-p3-improve-claude-");
    const marker = join(cwd, "script-ran.txt");
    writeExistingSkill(codexHome, marker);
    writeExistingSkill(claudeHome, marker);
    const codexTarget = skillTarget(codexHome);
    const claudeTarget = skillTarget(claudeHome);
    const before = directoryState(codexTarget);

    const input = improvementInput();
    input.source_refs = [
      "https://user:password@example.com/pull/17?access_token=secret-value",
      "pr:29#review",
    ];
    const proposed = runJson(improveArgs(input, codexHome, claudeHome), cwd, home);
    expect(proposed.candidate).toMatchObject({
      candidate_kind: "skill_candidate",
      review_decision: "pending",
      delivery_state: "draft",
      destination_payload: { mode: "patch", name: "http-review" },
    });
    expect(proposed.candidate.destination_payload.base_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(proposed.candidate.source_manifest_refs.join(" ")).not.toContain("secret-value");
    expect(proposed.candidate.source_manifest_refs.join(" ")).not.toContain("password@");
    expect(proposed.candidate.evidence[0].source_ref).not.toContain("secret-value");
    expect(proposed.improvement_plan.targets[0].summary).toEqual({
      added: 2, modified: 1, deleted: 1, unchanged: 4,
    });
    expect(proposed.improvement_plan.targets[0].changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "SKILL.md", status: "modified" }),
      expect.objectContaining({ path: "references/http-timeout.md", status: "added" }),
      expect.objectContaining({ path: "assets/timeout.bin", status: "added" }),
      expect.objectContaining({ path: "examples/obsolete.md", status: "deleted" }),
      expect.objectContaining({ path: "references/base.md", status: "unchanged" }),
    ]));
    expect(directoryState(codexTarget)).toEqual(before);
    expect(directoryState(claudeTarget)).toEqual(before);
    expect(existsSync(marker)).toBe(false);

    const sessionId = proposed.session.id;
    const candidateId = proposed.candidate.id;
    const plan = runJson(previewArgs(sessionId, candidateId, codexHome, claudeHome), cwd, home);
    expect(plan.required_authorized_scope).toContain(plan.targets[0].before_sha256);
    expect(plan.required_authorized_scope).toContain(plan.targets[0].after_sha256);
    runJson([
      "session", "approve", candidateId, "--session", sessionId,
      "--authorized-scope", plan.required_authorized_scope,
    ], cwd, home);
    const installed = runJson(installArgs(sessionId, candidateId, codexHome, claudeHome), cwd, home);

    expect(directoryState(codexTarget)).toEqual(directoryState(claudeTarget));
    expect(readFileSync(join(codexTarget, "SKILL.md"), "utf-8")).toContain("references/http-timeout.md");
    expect(readFileSync(join(codexTarget, "references", "base.md"), "utf-8")).toBe("existing reference\n");
    expect(readFileSync(join(codexTarget, "assets", "legacy.bin"))).toEqual(Buffer.from([255, 3, 2, 1]));
    expect(readFileSync(join(codexTarget, "assets", "timeout.bin"))).toEqual(Buffer.from([0, 1, 2, 255]));
    expect(existsSync(join(codexTarget, "examples", "obsolete.md"))).toBe(false);
    expect(existsSync(join(codexTarget, "empty-resource-dir"))).toBe(true);
    expect(existsSync(marker)).toBe(false);

    runJson(["phase3", "rollback", installed.commit.id, "--executor", "user"], cwd, home);
    expect(directoryState(codexTarget)).toEqual(before);
    expect(directoryState(claudeTarget)).toEqual(before);
  });

  test("refuses divergent client baselines before creating a candidate", () => {
    const cwd = tempProjectDir("codetrap-p3-improve-divergent-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-improve-divergent-codex-");
    const claudeHome = tempDir("codetrap-p3-improve-divergent-claude-");
    const marker = join(cwd, "script-ran.txt");
    writeExistingSkill(codexHome, marker);
    writeExistingSkill(claudeHome, marker);
    writeFileSync(join(skillTarget(claudeHome), "references", "base.md"), "Claude-only change\n");

    const refused = runCli([...improveArgs(improvementInput(), codexHome, claudeHome), "--json"], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("differs between Codex");
    expect(existsSync(marker)).toBe(false);
  });

  test("refuses install when the exact base changes after candidate creation", () => {
    const cwd = tempProjectDir("codetrap-p3-improve-drift-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-improve-drift-codex-");
    const claudeHome = tempDir("codetrap-p3-improve-drift-claude-");
    const marker = join(cwd, "script-ran.txt");
    writeExistingSkill(codexHome, marker);
    writeExistingSkill(claudeHome, marker);
    const proposed = runJson(improveArgs(improvementInput(), codexHome, claudeHome), cwd, home);
    const plan = proposed.improvement_plan;
    runJson([
      "session", "approve", proposed.candidate.id, "--session", proposed.session.id,
      "--authorized-scope", plan.required_authorized_scope,
    ], cwd, home);
    writeFileSync(join(skillTarget(codexHome), "references", "base.md"), "new shared base\n");
    writeFileSync(join(skillTarget(claudeHome), "references", "base.md"), "new shared base\n");

    const refused = runCli([
      ...installArgs(proposed.session.id, proposed.candidate.id, codexHome, claudeHome), "--json",
    ], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("changed from patch base");
    expect(readFileSync(join(skillTarget(codexHome), "references", "base.md"), "utf-8")).toBe("new shared base\n");
  });

  test("rejects unsafe paths, ambiguous replacements, and deletion of required SKILL.md", () => {
    const cwd = tempProjectDir("codetrap-p3-improve-invalid-");
    const home = tempHome();
    const codexHome = tempDir("codetrap-p3-improve-invalid-codex-");
    const claudeHome = tempDir("codetrap-p3-improve-invalid-claude-");
    const marker = join(cwd, "script-ran.txt");
    writeExistingSkill(codexHome, marker);
    writeExistingSkill(claudeHome, marker);

    for (const [operation, message] of [
      [{ op: "write_text", path: "../outside.md", content: "escape" }, "unsafe path segment"],
      [{ op: "replace_text", path: "SKILL.md", old_text: "missing text", new_text: "new" }, "exactly once"],
      [{ op: "delete", path: "SKILL.md" }, "must contain SKILL.md"],
      [{
        op: "write_text", path: "SKILL.md",
        content: "---\nname: wrong-skill\ndescription: Wrong name.\n---\n\n# Wrong\n",
      }, "frontmatter must declare name: http-review"],
      [{
        op: "write_text", path: "agents/openai.yaml",
        content: "interface:\n  default_prompt: Missing the required skill reference.\n",
      }, "must explicitly mention $http-review"],
    ] as const) {
      const input = { ...improvementInput(), operations: [operation] };
      const refused = runCli([...improveArgs(input, codexHome, claudeHome), "--json"], cwd, home);
      expect(refused.exitCode).toBe(1);
      expect(JSON.parse(refused.stdout).error).toContain(message);
    }
    expect(existsSync(join(cwd, "outside.md"))).toBe(false);
    expect(existsSync(marker)).toBe(false);

    const reserved = runCli([
      ...improveArgs({ ...improvementInput(), name: "nul" }, codexHome, claudeHome), "--json",
    ], cwd, home);
    expect(reserved.exitCode).toBe(1);
    expect(JSON.parse(reserved.stdout).error).toContain("Windows-reserved");
  });
});

function skillTarget(home: string): string {
  return join(home, "skills", "http-review");
}

function writeExistingSkill(home: string, marker: string): void {
  const target = skillTarget(home);
  for (const directory of ["agents", "references", "scripts", "assets", "examples", "empty-resource-dir"]) {
    mkdirSync(join(target, directory), { recursive: true });
  }
  writeFileSync(join(target, "SKILL.md"), [
    "---",
    "name: \"http-review\"",
    "description: Review HTTP client changes.",
    "---",
    "",
    "# HTTP Review",
    "",
    "## Principle",
    "",
    "Keep the main skill short.",
    "",
  ].join("\n"));
  writeFileSync(join(target, "agents", "openai.yaml"), [
    "interface:",
    "  default_prompt: Use $http-review before approving HTTP code.",
    "",
  ].join("\n"));
  writeFileSync(join(target, "references", "base.md"), "existing reference\n");
  writeFileSync(join(target, "examples", "obsolete.md"), "obsolete example\n");
  writeFileSync(join(target, "assets", "legacy.bin"), Buffer.from([255, 3, 2, 1]));
  writeFileSync(join(target, "scripts", "never-run.ps1"), `Set-Content -LiteralPath '${marker}' -Value 'executed'\n`);
}

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
