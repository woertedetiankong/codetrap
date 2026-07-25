import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildClientHealth, clientNextActions } from "../lib/client-health";
import { BUNDLED_SKILLS, TEMPLATE_MARKER } from "../lib/client-setup";
import { runCli, tempDir, tempHome } from "./helpers";

describe("per-client integration health (roadmap §13.3)", () => {
  test("an undetected client is reported but never produces a next action", () => {
    const base = tempDir("codetrap-health-");
    const health = buildClientHealth("codex", null, join(base, "codex-home"));

    expect(health.detected).toBe(false);
    expect(health.skills.missing).toHaveLength(BUNDLED_SKILLS.length);
    expect(health.skills.current).toHaveLength(0);
    expect(health.guidance).toBeNull();
    expect(health.mcp.registered).toBe("unknown");
    expect(clientNextActions([health])).toHaveLength(0);
  });

  test("classifies current, outdated, and missing skills and stale guidance into one refresh action", () => {
    const base = tempDir("codetrap-health-");
    const clientHome = join(base, "claude-home");
    const currentSkill = BUNDLED_SKILLS.find((entry) => entry.name === "codetrap-check")!;
    mkdirSync(join(clientHome, "skills", "codetrap-check"), { recursive: true });
    writeFileSync(join(clientHome, "skills", "codetrap-check", "SKILL.md"), currentSkill.skill);
    mkdirSync(join(clientHome, "skills", "codetrap-add"), { recursive: true });
    writeFileSync(join(clientHome, "skills", "codetrap-add", "SKILL.md"), "locally edited\n");
    const projectRoot = join(base, "project");
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(join(projectRoot, "CLAUDE.md"), "# my project, no codetrap section\n");

    const health = buildClientHealth("claude", projectRoot, clientHome);

    expect(health.detected).toBe(true);
    expect(health.skills.current).toEqual(["codetrap-check"]);
    expect(health.skills.outdated).toEqual(["codetrap-add"]);
    expect(health.skills.missing).toHaveLength(BUNDLED_SKILLS.length - 2);
    expect(health.guidance).toMatchObject({ present: true, current: false });

    const actions = clientNextActions([health]);
    expect(actions).toHaveLength(1);
    expect(actions[0].command).toBe("codetrap setup claude");
    expect(actions[0].reason).toContain("Claude Code");
  });

  test("a complete install reports current guidance and no next action", () => {
    const base = tempDir("codetrap-health-");
    const clientHome = join(base, "codex-home");
    for (const entry of BUNDLED_SKILLS) {
      mkdirSync(join(clientHome, "skills", entry.name), { recursive: true });
      writeFileSync(join(clientHome, "skills", entry.name, "SKILL.md"), entry.skill);
    }
    const projectRoot = join(base, "project");
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(join(projectRoot, "AGENTS.md"), `# project\n\n${TEMPLATE_MARKER}\n`);

    const health = buildClientHealth("codex", projectRoot, clientHome);

    expect(health.skills.current).toHaveLength(BUNDLED_SKILLS.length);
    expect(health.skills.outdated).toHaveLength(0);
    expect(health.skills.missing).toHaveLength(0);
    expect(health.guidance).toMatchObject({ present: true, current: true });
    expect(clientNextActions([health])).toHaveLength(0);
  });

  test("MCP registration probe reads the client config when present", () => {
    const base = tempDir("codetrap-health-");
    const codexHome = join(base, "codex-home");
    mkdirSync(codexHome, { recursive: true });

    writeFileSync(join(codexHome, "config.toml"), '[mcp_servers.codetrap]\ncommand = "codetrap"\n');
    expect(buildClientHealth("codex", null, codexHome).mcp.registered).toBe("yes");

    writeFileSync(join(codexHome, "config.toml"), "[mcp_servers.other]\n");
    expect(buildClientHealth("codex", null, codexHome).mcp.registered).toBe("no");
  });

  test("doctor --json carries the CLI version and both clients' health", () => {
    const cwd = tempDir("codetrap-doctor-clients-");
    mkdirSync(join(cwd, ".codetrap"));
    const home = tempHome();

    const result = runCli(["doctor", "--json"], cwd, home);
    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);

    expect(typeof report.version).toBe("string");
    expect(report.version.length).toBeGreaterThan(0);
    const clients = report.clients.map((entry: { client: string }) => entry.client).sort();
    expect(clients).toEqual(["claude", "codex"]);
    for (const entry of report.clients) {
      expect(entry.setup_command).toBe(`codetrap setup ${entry.client}`);
      expect(entry.skills).toHaveProperty("current");
      expect(entry.skills).toHaveProperty("outdated");
      expect(entry.skills).toHaveProperty("missing");
      expect(["yes", "no", "unknown"]).toContain(entry.mcp.registered);
    }
  });

  test("doctor text output includes the Clients section", () => {
    const cwd = tempDir("codetrap-doctor-clients-text-");
    mkdirSync(join(cwd, ".codetrap"));
    const home = tempHome();

    const result = runCli(["doctor"], cwd, home);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Clients:");
    expect(result.stdout).toContain("codex:");
    expect(result.stdout).toContain("claude:");
  });
});
