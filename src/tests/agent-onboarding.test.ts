import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const agentAutomationFiles = [
  "plugins/codetrap-agent/hooks.json",
  "plugins/codetrap-agent/hooks/post-flight-capture.example.md",
  "plugins/codetrap-agent/templates/AGENTS.codetrap.md",
  "plugins/codetrap-agent/skills/codetrap-check/SKILL.md",
  "plugins/codetrap-agent/skills/codetrap-capture/SKILL.md",
  "skills/codetrap-capture/SKILL.md",
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
    const text = read("skills/codetrap-add/SKILL.md");
    expect(text).toContain("explicit user approval");
    expect(text).toContain("codetrap session capture --trap-markdown");
    expect(text).toContain("Only after the user confirms");
  });

  test("agent guidance includes a relevance gate for noisy search results", () => {
    const guidanceFiles = [
      "README.md",
      "docs/installation.md",
      "docs/release-playbook.zh-CN.md",
      "skills/codetrap-check/SKILL.md",
      "skills/codetrap-search/SKILL.md",
      "plugins/codetrap-agent/templates/AGENTS.codetrap.md",
      "plugins/codetrap-agent/skills/codetrap-check/SKILL.md",
    ];

    for (const file of guidanceFiles) {
      const text = read(file);
      expect(text, file).toContain("Severity alone is not enough");
      expect(text, file).toContain("concrete overlap in target path/module/owner");
      expect(text, file).toContain("no applicable trap");
    }
  });

  test("npm package manifest includes agent first-run assets", () => {
    const manifest = JSON.parse(read("package.json"));
    expect(manifest.files).toEqual(expect.arrayContaining([
      "plugins",
      "skills",
      "README.md",
      "docs/installation.md",
    ]));
  });
});

function read(path: string): string {
  return readFileSync(path, "utf-8");
}
