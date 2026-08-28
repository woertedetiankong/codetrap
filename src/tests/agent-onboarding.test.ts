import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runCli, tempDir, tempHome } from "./helpers";

const agentAutomationFiles = [
  "plugins/codetrap-agent/hooks.json",
  "plugins/codetrap-agent/hooks/post-flight-capture.example.md",
  "plugins/codetrap-agent/templates/AGENTS.codetrap.md",
  "plugins/codetrap-agent/templates/AGENTS.codetrap-maintainer.md",
  "plugins/codetrap-agent/skills/codetrap-check/SKILL.md",
  "plugins/codetrap-agent/skills/codetrap-capture/SKILL.md",
];

const pluginSkillNames = [
  "codetrap-add",
  "codetrap-capture",
  "codetrap-capture-external",
  "codetrap-check",
  "codetrap-learning-review",
  "codetrap-search",
];

describe("agent first-run onboarding assets", () => {
  test("packaged post-task automation writes candidates instead of confirmed traps", () => {
    const hooks = JSON.parse(read("plugins/codetrap-agent/hooks.json"));
    const plugin = JSON.parse(read("plugins/codetrap-agent/.codex-plugin/plugin.json"));

    expect(hooks.post_task.description).toContain("candidate inbox");
    expect(hooks.post_task.command).toContain("codetrap session capture");
    expect(hooks.post_task.command).toContain("--trap-markdown");
    expect(plugin.hooks).toBeUndefined();

    for (const file of agentAutomationFiles) {
      expect(read(file), file).not.toContain("codetrap add --json");
    }
  });

  test("direct add skill is explicit-confirmation only", () => {
    const text = read("plugins/codetrap-agent/skills/codetrap-add/SKILL.md");
    expect(text).toContain("explicit user approval");
    expect(text).toContain("codetrap session capture --trap-markdown");
    expect(text).toContain("Only after the user confirms");
  });

  test("user-study skills request an ASCII flow and a plain-language example", () => {
    const external = read("plugins/codetrap-agent/skills/codetrap-capture-external/SKILL.md");
    const review = read("plugins/codetrap-agent/skills/codetrap-learning-review/SKILL.md");

    for (const text of [external, review]) {
      expect(text).toContain("用ASCII流程图结合通俗易懂的例子讲解");
      expect(text).toContain("plain-language example");
    }
    expect(external).toContain('"kind":"insight"');
    expect(external).toContain("An agent must not approve its own proposal");
    expect(review).toContain("applies only to user-study insights");
  });

  test("plugin bundle is the single Codex skill source", () => {
    const manifest = JSON.parse(read("package.json"));
    const plugin = JSON.parse(read("plugins/codetrap-agent/.codex-plugin/plugin.json"));
    const skillDirNames = readdirSync("plugins/codetrap-agent/skills", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(plugin.version).toBe(manifest.version);
    expect(skillDirNames).toEqual(pluginSkillNames);
    expect(existsSync("skills")).toBe(false);

    for (const skillName of pluginSkillNames) {
      expect(read(`plugins/codetrap-agent/skills/${skillName}/SKILL.md`)).toContain(`name: ${skillName}`);
    }
  });

  test("agent guidance includes a relevance gate for noisy search results", () => {
    const canonicalGuidanceFiles = [
      "plugins/codetrap-agent/templates/AGENTS.codetrap.md",
      "plugins/codetrap-agent/skills/codetrap-check/SKILL.md",
      "plugins/codetrap-agent/skills/codetrap-search/SKILL.md",
    ];

    for (const file of canonicalGuidanceFiles) {
      const text = read(file);
      expect(text, file).toContain("Severity alone is not enough");
      expect(text, file).toContain("concrete overlap in target path/module/owner");
      expect(text, file).toContain("no applicable trap");
    }

    const pointerDocs = [
      "README.md",
      "docs/installation.md",
      "docs/release-playbook.zh-CN.md",
    ];

    for (const file of pointerDocs) {
      const text = read(file);
      expect(text, file).toContain("plugins/codetrap-agent/templates/AGENTS.codetrap.md");
    }
  });

  test("packaged AGENTS snippet is generic enough for external projects", () => {
    const text = read("plugins/codetrap-agent/templates/AGENTS.codetrap.md");

    expect(text).toContain("--path path/to/file --module module-name");
    expect(text).not.toContain("dogfood-log.md");
    expect(text).not.toContain("promotion lane");
    expect(text).not.toContain("src/db/repository.ts");
  });

  test("maintainer AGENTS add-on keeps dogfood eval out of external guidance", () => {
    const text = read("plugins/codetrap-agent/templates/AGENTS.codetrap-maintainer.md");

    expect(text).toContain("Use this add-on only for codetrap maintainers");
    expect(text).toContain("dogfood-log.md");
    expect(text).toContain("promotion lane");
    expect(text).toContain("no_relevant_trap");
  });

  test("npm package manifest includes agent first-run assets", () => {
    const manifest = JSON.parse(read("package.json"));
    expect(manifest.files).toEqual(expect.arrayContaining([
      "plugins",
      "README.md",
      "docs/installation.md",
    ]));
    expect(manifest.files).not.toContain("skills");
  });

  test("setup codex installs skills and AGENTS guidance without MCP by default", () => {
    const cwd = tempDir("codetrap-setup-codex-");
    const home = tempHome();
    const codexHome = join(home, "codex-home");

    const setup = runCli(["setup", "codex", "--codex-home", codexHome, "--json"], cwd, home);
    expect(setup.exitCode).toBe(0);
    const payload = JSON.parse(setup.stdout);

    expect(payload).toMatchObject({
      success: true,
      project: { status: "created" },
      agents: { status: "created" },
      mcp: { requested: false, status: "skipped" },
    });
    expect(existsSync(join(cwd, ".codetrap"))).toBe(true);
    expect(read(join(cwd, "AGENTS.md"))).toContain("codetrap search \"<keywords>\" --mode hybrid --json");
    expect(read(join(cwd, "AGENTS.md"))).not.toContain("dogfood-log.md");
    expect(existsSync(join(codexHome, "skills", "codetrap-check", "SKILL.md"))).toBe(true);
    expect(existsSync(join(codexHome, "skills", "codetrap-capture", "SKILL.md"))).toBe(true);

    const repeat = runCli(["setup", "codex", "--codex-home", codexHome, "--json"], cwd, home);
    expect(repeat.exitCode).toBe(0);
    const repeated = JSON.parse(repeat.stdout);
    expect(repeated.project.status).toBe("already_present");
    expect(repeated.agents.status).toBe("already_present");
    expect(repeated.skills.every((skill: { status: string }) => skill.status === "unchanged")).toBe(true);
    expect(read(join(cwd, "AGENTS.md")).match(/## Codetrap/g)).toHaveLength(1);
  });

  test("setup codex only configures MCP when explicitly requested", () => {
    const cwd = tempDir("codetrap-setup-codex-mcp-");
    const home = tempHome();
    const codexHome = join(home, "codex-home");

    const setup = runCli([
      "setup",
      "codex",
      "--codex-home",
      codexHome,
      "--mcp",
      "--dry-run",
      "--json",
    ], cwd, home);
    expect(setup.exitCode).toBe(0);
    const payload = JSON.parse(setup.stdout);

    expect(payload.project.status).toBe("would_create");
    expect(payload.agents.status).toBe("would_create");
    expect(payload.mcp).toMatchObject({
      requested: true,
      status: "would_run",
      command: "codex mcp add codetrap -- codetrap serve",
    });
    expect(existsSync(join(cwd, ".codetrap"))).toBe(false);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(codexHome, "skills", "codetrap-check", "SKILL.md"))).toBe(false);
  });

  // Roadmap §3.1: Codex and Claude Code are co-equal first-class clients —
  // same skill bundle, same guidance template, symmetric setup command.
  test("setup claude installs skills and CLAUDE guidance without MCP by default", () => {
    const cwd = tempDir("codetrap-setup-claude-");
    const home = tempHome();
    const claudeHome = join(home, "claude-home");

    const setup = runCli(["setup", "claude", "--claude-home", claudeHome, "--json"], cwd, home);
    expect(setup.exitCode).toBe(0);
    const payload = JSON.parse(setup.stdout);

    expect(payload).toMatchObject({
      success: true,
      client: "claude",
      project: { status: "created" },
      agents: { status: "created" },
      mcp: { requested: false, status: "skipped" },
    });
    expect(existsSync(join(cwd, ".codetrap"))).toBe(true);
    expect(read(join(cwd, "CLAUDE.md"))).toContain("codetrap search \"<keywords>\" --mode hybrid --json");
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
    for (const skillName of pluginSkillNames) {
      expect(existsSync(join(claudeHome, "skills", skillName, "SKILL.md"))).toBe(true);
    }

    const repeat = runCli(["setup", "claude", "--claude-home", claudeHome, "--json"], cwd, home);
    expect(repeat.exitCode).toBe(0);
    const repeated = JSON.parse(repeat.stdout);
    expect(repeated.project.status).toBe("already_present");
    expect(repeated.agents.status).toBe("already_present");
    expect(repeated.skills.every((skill: { status: string }) => skill.status === "unchanged")).toBe(true);
    expect(read(join(cwd, "CLAUDE.md")).match(/## Codetrap/g)).toHaveLength(1);
  });

  test("setup claude only configures MCP when explicitly requested", () => {
    const cwd = tempDir("codetrap-setup-claude-mcp-");
    const home = tempHome();
    const claudeHome = join(home, "claude-home");

    const setup = runCli([
      "setup",
      "claude",
      "--claude-home",
      claudeHome,
      "--mcp",
      "--dry-run",
      "--json",
    ], cwd, home);
    expect(setup.exitCode).toBe(0);
    const payload = JSON.parse(setup.stdout);

    expect(payload.project.status).toBe("would_create");
    expect(payload.agents.status).toBe("would_create");
    expect(payload.mcp).toMatchObject({
      requested: true,
      status: "would_run",
      command: "claude mcp add codetrap -- codetrap serve",
    });
    expect(existsSync(join(cwd, ".codetrap"))).toBe(false);
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(claudeHome, "skills", "codetrap-check", "SKILL.md"))).toBe(false);
  });

  test("both clients install byte-identical skills from the single plugin bundle", () => {
    const cwd = tempDir("codetrap-setup-parity-");
    const home = tempHome();
    const codexHome = join(home, "codex-home");
    const claudeHome = join(home, "claude-home");

    expect(runCli(["setup", "codex", "--codex-home", codexHome, "--json"], cwd, home).exitCode).toBe(0);
    expect(runCli(["setup", "claude", "--claude-home", claudeHome, "--json"], cwd, home).exitCode).toBe(0);

    for (const skillName of pluginSkillNames) {
      expect(read(join(claudeHome, "skills", skillName, "SKILL.md"))).toBe(
        read(join(codexHome, "skills", skillName, "SKILL.md"))
      );
    }
    // One shared template: AGENTS.md (codex) and CLAUDE.md (claude) carry the
    // same guidance section.
    expect(read(join(cwd, "CLAUDE.md"))).toBe(read(join(cwd, "AGENTS.md")));
  });
});

function read(path: string): string {
  return readFileSync(path, "utf-8");
}
