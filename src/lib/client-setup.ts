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
import codetrapLearningReviewSkill from "../../plugins/codetrap-agent/skills/codetrap-learning-review/SKILL.md" with { type: "text" };
import codetrapSearchSkill from "../../plugins/codetrap-agent/skills/codetrap-search/SKILL.md" with { type: "text" };

// Dual-client symmetry (roadmap §3.1): Codex and Claude Code are co-equal
// first-class clients. One setup core, one guidance template, one skill
// bundle; the per-client differences live entirely in CLIENT_SPECS.
export type SetupClient = "codex" | "claude";

export type ClientSpec = {
  label: string;
  homeEnv: string;
  homeDirName: string;
  homeFlag: string;
  guidanceFile: string;
  mcpCommand: string[];
};

export const CLIENT_SPECS: Record<SetupClient, ClientSpec> = {
  codex: {
    label: "Codex",
    homeEnv: "CODEX_HOME",
    homeDirName: ".codex",
    homeFlag: "codex-home",
    guidanceFile: "AGENTS.md",
    mcpCommand: ["codex", "mcp", "add", "codetrap", "--", "codetrap", "serve"],
  },
  claude: {
    label: "Claude Code",
    homeEnv: "CLAUDE_CONFIG_DIR",
    homeDirName: ".claude",
    homeFlag: "claude-home",
    guidanceFile: "CLAUDE.md",
    mcpCommand: ["claude", "mcp", "add", "codetrap", "--", "codetrap", "serve"],
  },
};

export function isSetupClient(value: string | undefined): value is SetupClient {
  return value === "codex" || value === "claude";
}

export type ClientSetupOptions = {
  cwd: string;
  clientHome?: string;
  agentsFile?: string;
  installMcp?: boolean;
  skipAgents?: boolean;
  dryRun?: boolean;
};

export type ClientSetupStatus =
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

export type ClientSetupResult = {
  success: boolean;
  client: SetupClient;
  project_root: string;
  client_home: string;
  plugin_root: string;
  dry_run: boolean;
  project: {
    codetrap_dir: string;
    status: ClientSetupStatus;
  };
  skills: Array<{
    name: string;
    source: string;
    destination: string;
    status: ClientSetupStatus;
    backup?: string;
  }>;
  agents: {
    path: string | null;
    status: ClientSetupStatus;
  };
  mcp: {
    requested: boolean;
    command: string;
    status: ClientSetupStatus;
    exit_code?: number | null;
    error?: string;
  };
};

const AGENTS_TEMPLATE_PATH = "templates/AGENTS.codetrap.md";
// Idempotency marker: a line from the shared template that survives appends.
export const TEMPLATE_MARKER = "codetrap search \"<keywords>\" --mode hybrid --json";
const EMBEDDED_PLUGIN_ROOT = "embedded://plugins/codetrap-agent";
// Also the doctor's reference copy for per-client skill-currency checks (§13.3).
export const BUNDLED_SKILLS = [
  { name: "codetrap-add", skill: codetrapAddSkill },
  { name: "codetrap-capture", skill: codetrapCaptureSkill },
  { name: "codetrap-capture-external", skill: codetrapCaptureExternalSkill },
  { name: "codetrap-check", skill: codetrapCheckSkill },
  // §3.1/§7.2: the learning-review entry point exists in BOTH clients and both
  // delegate to the identical CLI commands. It ships in the shared bundle so
  // there is no way to install it for one client and not the other.
  { name: "codetrap-learning-review", skill: codetrapLearningReviewSkill },
  { name: "codetrap-search", skill: codetrapSearchSkill },
];

export function runClientSetup(client: SetupClient, options: ClientSetupOptions): ClientSetupResult {
  const spec = CLIENT_SPECS[client];
  const cwd = resolve(options.cwd);
  const projectRoot = findProjectRoot(cwd) ?? cwd;
  const clientHome = resolveClientHome(client, options.clientHome);
  const pluginRoot = bundledPluginRoot();
  const useEmbeddedAssets = !existsSync(pluginRoot);

  const dryRun = options.dryRun === true;
  const project = ensureProjectCodetrap(projectRoot, dryRun);
  const skills = useEmbeddedAssets
    ? installEmbeddedSkills(clientHome, dryRun)
    : installSkills(pluginRoot, clientHome, dryRun);
  const agents = options.skipAgents
    ? { path: null, status: "skipped" as const }
    : installAgentsTemplate(projectRoot, useEmbeddedAssets ? null : pluginRoot, options.agentsFile ?? spec.guidanceFile, dryRun);
  const mcp = setupMcp(spec, options.installMcp === true, dryRun);
  const success = mcp.status !== "failed";

  return {
    success,
    client,
    project_root: projectRoot,
    client_home: clientHome,
    plugin_root: useEmbeddedAssets ? EMBEDDED_PLUGIN_ROOT : pluginRoot,
    dry_run: dryRun,
    project,
    skills,
    agents,
    mcp,
  };
}

export function formatClientSetupText(result: ClientSetupResult): string {
  const label = CLIENT_SPECS[result.client].label;
  const installed = result.skills.filter((skill) =>
    ["installed", "updated", "would_install", "would_update"].includes(skill.status)
  ).length;
  const unchanged = result.skills.filter((skill) => skill.status === "unchanged").length;
  const guidanceName = CLIENT_SPECS[result.client].guidanceFile;
  const lines = [
    result.success ? `${label} setup complete.` : `${label} setup completed with errors.`,
    `Project: ${result.project.status} (${result.project.codetrap_dir})`,
    `Skills: ${installed} changed, ${unchanged} unchanged (${join(result.client_home, "skills")})`,
    `${guidanceName}: ${result.agents.status}${result.agents.path ? ` (${result.agents.path})` : ""}`,
  ];
  if (result.mcp.requested) {
    lines.push(`MCP: ${result.mcp.status} (${result.mcp.command})`);
    if (result.mcp.error) lines.push(`MCP error: ${result.mcp.error}`);
  } else {
    lines.push(`MCP: skipped; pass --mcp to run '${result.mcp.command}'.`);
  }
  if (result.dry_run) lines.unshift(`Dry run; no files or ${label} config were changed.`);
  return lines.join("\n");
}

function ensureProjectCodetrap(projectRoot: string, dryRun: boolean): ClientSetupResult["project"] {
  const codetrapDir = join(projectRoot, ".codetrap");
  if (existsSync(codetrapDir)) {
    return { codetrap_dir: codetrapDir, status: "already_present" };
  }
  if (!dryRun) mkdirSync(codetrapDir, { recursive: true });
  return { codetrap_dir: codetrapDir, status: dryRun ? "would_create" : "created" };
}

function installSkills(pluginRoot: string, clientHome: string, dryRun: boolean): ClientSetupResult["skills"] {
  const sourceSkillsDir = join(pluginRoot, "skills");
  const targetSkillsDir = join(clientHome, "skills");
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
      let status: ClientSetupStatus = unchanged ? "unchanged" : exists ? "updated" : "installed";
      if (dryRun && status === "installed") status = "would_install";
      if (dryRun && status === "updated") status = "would_update";
      // L17: overwriting a user-edited skill used to discard their changes with
      // no recovery path. Snapshot the existing directory first.
      let backup: string | undefined;
      if (!dryRun && exists && !unchanged) {
        backup = backupExistingSkill(destination, clientHome);
      }
      if (!dryRun && !unchanged) cpSync(source, destination, { recursive: true, force: true });
      return { name: entry.name, source, destination, status, ...(backup ? { backup } : {}) };
    });
}

// L17: copy an about-to-be-overwritten skill directory into a sibling backup
// folder (outside skills/ so it is never mistaken for a skill) and return the path.
function backupExistingSkill(destination: string, clientHome: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(clientHome, "skill-backups", `${basename(destination)}.${stamp}`);
  mkdirSync(dirname(backupDir), { recursive: true });
  cpSync(destination, backupDir, { recursive: true });
  return backupDir;
}

function installEmbeddedSkills(clientHome: string, dryRun: boolean): ClientSetupResult["skills"] {
  const targetSkillsDir = join(clientHome, "skills");
  if (!dryRun) mkdirSync(targetSkillsDir, { recursive: true });

  return BUNDLED_SKILLS.map((entry) => {
    const destination = join(targetSkillsDir, entry.name);
    const destinationSkillPath = join(destination, "SKILL.md");
    const exists = existsSync(destinationSkillPath);
    const unchanged = exists && readFileSync(destinationSkillPath, "utf-8") === entry.skill;
    let status: ClientSetupStatus = unchanged ? "unchanged" : exists ? "updated" : "installed";
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
): ClientSetupResult["agents"] {
  const target = resolve(projectRoot, agentsFile);
  const template = (pluginRoot
    ? readFileSync(join(pluginRoot, AGENTS_TEMPLATE_PATH), "utf-8")
    : agentsTemplateAsset
  ).trimEnd();
  if (existsSync(target)) {
    const current = readFileSync(target, "utf-8");
    if (current.includes(TEMPLATE_MARKER)) {
      return { path: target, status: "already_present" };
    }
    if (!dryRun) appendFileSync(target, `${current.endsWith("\n") ? "\n" : "\n\n"}${template}\n`);
    return { path: target, status: dryRun ? "would_append" : "appended" };
  }
  if (!dryRun) writeFileSync(target, `${template}\n`);
  return { path: target, status: dryRun ? "would_create" : "created" };
}

function setupMcp(spec: ClientSpec, requested: boolean, dryRun: boolean): ClientSetupResult["mcp"] {
  const command = spec.mcpCommand.join(" ");
  if (!requested) return { requested, command, status: "skipped" };
  if (dryRun) return { requested, command, status: "would_run" };

  const result = Bun.spawnSync({
    cmd: spec.mcpCommand,
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
    error: stderr || stdout || `${spec.mcpCommand[0]} mcp add failed`,
  };
}

export function resolveClientHome(client: SetupClient, clientHome?: string): string {
  const spec = CLIENT_SPECS[client];
  return resolve(
    clientHome ??
      process.env[spec.homeEnv] ??
      join(process.env.HOME ?? process.env.USERPROFILE ?? homedir(), spec.homeDirName)
  );
}

function bundledPluginRoot(): string {
  return join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "plugins", "codetrap-agent");
}
