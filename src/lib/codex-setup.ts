import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findProjectRoot } from "./scope";
import agentsTemplateAsset from "../../plugins/codetrap-agent/templates/AGENTS.codetrap.md" with { type: "text" };
import codetrapAddSkill from "../../plugins/codetrap-agent/skills/codetrap-add/SKILL.md" with { type: "text" };
import codetrapCaptureSkill from "../../plugins/codetrap-agent/skills/codetrap-capture/SKILL.md" with { type: "text" };
import codetrapCaptureExternalSkill from "../../plugins/codetrap-agent/skills/codetrap-capture-external/SKILL.md" with { type: "text" };
import codetrapCheckSkill from "../../plugins/codetrap-agent/skills/codetrap-check/SKILL.md" with { type: "text" };
import codetrapSearchSkill from "../../plugins/codetrap-agent/skills/codetrap-search/SKILL.md" with { type: "text" };

export type CodexSetupOptions = {
  cwd: string;
  codexHome?: string;
  agentsFile?: string;
  installMcp?: boolean;
  skipAgents?: boolean;
  dryRun?: boolean;
};

export type CodexSetupStatus =
  | "already_present"
  | "created"
  | "appended"
  | "installed"
  | "updated"
  | "unchanged"
  | "skipped"
  | "would_create"
  | "would_append"
  | "would_install"
  | "would_update"
  | "would_run"
  | "failed";

export type CodexSetupResult = {
  success: boolean;
  project_root: string;
  codex_home: string;
  plugin_root: string;
  dry_run: boolean;
  project: {
    codetrap_dir: string;
    status: CodexSetupStatus;
  };
  skills: Array<{
    name: string;
    source: string;
    destination: string;
    status: CodexSetupStatus;
    backup?: string;
  }>;
  agents: {
    path: string | null;
    status: CodexSetupStatus;
  };
  mcp: {
    requested: boolean;
    command: string;
    status: CodexSetupStatus;
    exit_code?: number | null;
    error?: string;
  };
};

const AGENTS_TEMPLATE_PATH = "templates/AGENTS.codetrap.md";
const CODEX_MARKER = "codetrap search \"<keywords>\" --mode hybrid --json";
const MCP_COMMAND = ["codex", "mcp", "add", "codetrap", "--", "codetrap", "serve"];
const EMBEDDED_PLUGIN_ROOT = "embedded://plugins/codetrap-agent";
const EMBEDDED_SKILLS = [
  { name: "codetrap-add", skill: codetrapAddSkill },
  { name: "codetrap-capture", skill: codetrapCaptureSkill },
  { name: "codetrap-capture-external", skill: codetrapCaptureExternalSkill },
  { name: "codetrap-check", skill: codetrapCheckSkill },
  { name: "codetrap-search", skill: codetrapSearchSkill },
];

export function runCodexSetup(options: CodexSetupOptions): CodexSetupResult {
  const cwd = resolve(options.cwd);
  const projectRoot = findProjectRoot(cwd) ?? cwd;
  const codexHome = resolveCodexHome(options.codexHome);
  const pluginRoot = bundledPluginRoot();
  const useEmbeddedAssets = !existsSync(pluginRoot);

  const dryRun = options.dryRun === true;
  const project = ensureProjectCodetrap(projectRoot, dryRun);
  const skills = useEmbeddedAssets
    ? installEmbeddedSkills(codexHome, dryRun)
    : installSkills(pluginRoot, codexHome, dryRun);
  const agents = options.skipAgents
    ? { path: null, status: "skipped" as const }
    : installAgentsTemplate(projectRoot, useEmbeddedAssets ? null : pluginRoot, options.agentsFile ?? "AGENTS.md", dryRun);
  const mcp = setupMcp(options.installMcp === true, dryRun);
  const success = mcp.status !== "failed";

  return {
    success,
    project_root: projectRoot,
    codex_home: codexHome,
    plugin_root: useEmbeddedAssets ? EMBEDDED_PLUGIN_ROOT : pluginRoot,
    dry_run: dryRun,
    project,
    skills,
    agents,
    mcp,
  };
}

export function formatCodexSetupText(result: CodexSetupResult): string {
  const installed = result.skills.filter((skill) =>
    ["installed", "updated", "would_install", "would_update"].includes(skill.status)
  ).length;
  const unchanged = result.skills.filter((skill) => skill.status === "unchanged").length;
  const lines = [
    result.success ? "Codex setup complete." : "Codex setup completed with errors.",
    `Project: ${result.project.status} (${result.project.codetrap_dir})`,
    `Skills: ${installed} changed, ${unchanged} unchanged (${join(result.codex_home, "skills")})`,
    `AGENTS: ${result.agents.status}${result.agents.path ? ` (${result.agents.path})` : ""}`,
  ];
  if (result.mcp.requested) {
    lines.push(`MCP: ${result.mcp.status} (${result.mcp.command})`);
    if (result.mcp.error) lines.push(`MCP error: ${result.mcp.error}`);
  } else {
    lines.push(`MCP: skipped; pass --mcp to run '${result.mcp.command}'.`);
  }
  if (result.dry_run) lines.unshift("Dry run; no files or Codex config were changed.");
  return lines.join("\n");
}

function ensureProjectCodetrap(projectRoot: string, dryRun: boolean): CodexSetupResult["project"] {
  const codetrapDir = join(projectRoot, ".codetrap");
  if (existsSync(codetrapDir)) {
    return { codetrap_dir: codetrapDir, status: "already_present" };
  }
  if (!dryRun) mkdirSync(codetrapDir, { recursive: true });
  return { codetrap_dir: codetrapDir, status: dryRun ? "would_create" : "created" };
}

function installSkills(pluginRoot: string, codexHome: string, dryRun: boolean): CodexSetupResult["skills"] {
  const sourceSkillsDir = join(pluginRoot, "skills");
  const targetSkillsDir = join(codexHome, "skills");
  if (!dryRun) mkdirSync(targetSkillsDir, { recursive: true });

  return readdirSync(sourceSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const source = join(sourceSkillsDir, entry.name);
      const destination = join(targetSkillsDir, entry.name);
      const sourceSkill = readFileSync(join(source, "SKILL.md"), "utf-8");
      const destinationSkillPath = join(destination, "SKILL.md");
      const exists = existsSync(destinationSkillPath);
      const unchanged = exists && readFileSync(destinationSkillPath, "utf-8") === sourceSkill;
      let status: CodexSetupStatus = unchanged ? "unchanged" : exists ? "updated" : "installed";
      if (dryRun && status === "installed") status = "would_install";
      if (dryRun && status === "updated") status = "would_update";
      // L17: overwriting a user-edited skill used to discard their changes with
      // no recovery path. Snapshot the existing directory first.
      let backup: string | undefined;
      if (!dryRun && exists && !unchanged) {
        backup = backupExistingSkill(destination, codexHome);
      }
      if (!dryRun && !unchanged) cpSync(source, destination, { recursive: true, force: true });
      return { name: entry.name, source, destination, status, ...(backup ? { backup } : {}) };
    });
}

// L17: copy an about-to-be-overwritten skill directory into a sibling backup
// folder (outside skills/ so it is never mistaken for a skill) and return the path.
function backupExistingSkill(destination: string, codexHome: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(codexHome, "skill-backups", `${basename(destination)}.${stamp}`);
  mkdirSync(dirname(backupDir), { recursive: true });
  cpSync(destination, backupDir, { recursive: true });
  return backupDir;
}

function installEmbeddedSkills(codexHome: string, dryRun: boolean): CodexSetupResult["skills"] {
  const targetSkillsDir = join(codexHome, "skills");
  if (!dryRun) mkdirSync(targetSkillsDir, { recursive: true });

  return EMBEDDED_SKILLS.map((entry) => {
    const destination = join(targetSkillsDir, entry.name);
    const destinationSkillPath = join(destination, "SKILL.md");
    const exists = existsSync(destinationSkillPath);
    const unchanged = exists && readFileSync(destinationSkillPath, "utf-8") === entry.skill;
    let status: CodexSetupStatus = unchanged ? "unchanged" : exists ? "updated" : "installed";
    if (dryRun && status === "installed") status = "would_install";
    if (dryRun && status === "updated") status = "would_update";
    if (!dryRun && !unchanged) {
      mkdirSync(destination, { recursive: true });
      writeFileSync(destinationSkillPath, entry.skill);
    }
    return {
      name: entry.name,
      source: `${EMBEDDED_PLUGIN_ROOT}/skills/${entry.name}`,
      destination,
      status,
    };
  });
}

function installAgentsTemplate(
  projectRoot: string,
  pluginRoot: string | null,
  agentsFile: string,
  dryRun: boolean
): CodexSetupResult["agents"] {
  const target = resolve(projectRoot, agentsFile);
  const template = (pluginRoot
    ? readFileSync(join(pluginRoot, AGENTS_TEMPLATE_PATH), "utf-8")
    : agentsTemplateAsset
  ).trimEnd();
  if (existsSync(target)) {
    const current = readFileSync(target, "utf-8");
    if (current.includes(CODEX_MARKER)) {
      return { path: target, status: "already_present" };
    }
    if (!dryRun) appendFileSync(target, `${current.endsWith("\n") ? "\n" : "\n\n"}${template}\n`);
    return { path: target, status: dryRun ? "would_append" : "appended" };
  }
  if (!dryRun) writeFileSync(target, `${template}\n`);
  return { path: target, status: dryRun ? "would_create" : "created" };
}

function setupMcp(requested: boolean, dryRun: boolean): CodexSetupResult["mcp"] {
  const command = MCP_COMMAND.join(" ");
  if (!requested) return { requested, command, status: "skipped" };
  if (dryRun) return { requested, command, status: "would_run" };

  const result = Bun.spawnSync({
    cmd: MCP_COMMAND,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.success) return { requested, command, status: "installed", exit_code: result.exitCode };

  const stderr = new TextDecoder().decode(result.stderr).trim();
  const stdout = new TextDecoder().decode(result.stdout).trim();
  return {
    requested,
    command,
    status: "failed",
    exit_code: result.exitCode,
    error: stderr || stdout || "codex mcp add failed",
  };
}

function resolveCodexHome(codexHome?: string): string {
  return resolve(codexHome ?? process.env.CODEX_HOME ?? join(process.env.HOME ?? process.env.USERPROFILE ?? homedir(), ".codex"));
}

function bundledPluginRoot(): string {
  return join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "plugins", "codetrap-agent");
}
