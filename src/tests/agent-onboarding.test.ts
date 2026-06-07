import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const agentAutomationFiles = [
  "plugins/codetrap-agent/hooks.json",
  "plugins/codetrap-agent/hooks/post-flight-capture.example.md",
  "plugins/codetrap-agent/templates/AGENTS.codetrap.md",
  "plugins/codetrap-agent/skills/codetrap-check/SKILL.md",
  "plugins/codetrap-agent/skills/codetrap-capture/SKILL.md",
];

const pluginSkillNames = [
  "codetrap-add",
  "codetrap-capture",
  "codetrap-capture-external",
  "codetrap-check",
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

  test("plugin bundle is the single Codex skill source", () => {
    const skillDirNames = readdirSync("plugins/codetrap-agent/skills", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

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
    expect(text).toContain("dogfood-log.md");
    expect(text).toContain("promotion lane");
    expect(text).not.toContain("src/db/repository.ts");
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
});

function read(path: string): string {
  return readFileSync(path, "utf-8");
}
