import { randomUUID } from "node:crypto";
import codetrapStudySkill from "../../plugins/codetrap-agent/skills/codetrap-study/SKILL.md" with { type: "text" };
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  lstatSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findProjectRoot } from "./scope";
import agentsTemplateAsset from "../../plugins/codetrap-agent/templates/AGENTS.codetrap.md" with { type: "text" };
import confirmedMemory from "../../plugins/codetrap-agent/skills/codetrap-capture/references/confirmed-memory.md" with { type: "text" };
import codetrapCaptureSkill from "../../plugins/codetrap-agent/skills/codetrap-capture/SKILL.md" with { type: "text" };
import externalSource from "../../plugins/codetrap-agent/skills/codetrap-study/references/external-source.md" with { type: "text" };
import codetrapCheckSkill from "../../plugins/codetrap-agent/skills/codetrap-check/SKILL.md" with { type: "text" };
import reviewSkill from "../../plugins/codetrap-agent/optional-skills/codetrap-review/SKILL.md" with { type: "text" };
import interactiveHtml from "../../plugins/codetrap-agent/skills/codetrap-study/references/interactive-html.md" with { type: "text" };

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
  withReview?: boolean;
  withoutReview?: boolean;
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
  | "failed"
  | "archived"
  | "would_archive";

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
export type BundledSkill = { name: string; skill: string; resources: Record<string, string> };
export const BUNDLED_SKILLS: BundledSkill[] = [
  { name: "codetrap-check", skill: codetrapCheckSkill, resources: {} },
  { name: "codetrap-capture", skill: codetrapCaptureSkill, resources: { "references/confirmed-memory.md": confirmedMemory } },
  { name: "codetrap-study", skill: codetrapStudySkill, resources: { "references/external-source.md": externalSource, "references/interactive-html.md": interactiveHtml } },
];
export const REVIEW_SKILL: BundledSkill = { name: "codetrap-review", skill: reviewSkill, resources: {} };
export const LEGACY_SKILLS = ["codetrap-add", "codetrap-search", "codetrap-capture-external", "codetrap-learning-review"];
export function skillFiles(entry: BundledSkill): Record<string, string> { return { "SKILL.md": entry.skill, ...entry.resources }; }

export function runClientSetup(client: SetupClient, options: ClientSetupOptions): ClientSetupResult {
  if (options.withReview && options.withoutReview) throw new Error("Choose only one of --with-review or --without-review.");
  const spec = CLIENT_SPECS[client];
  const cwd = resolve(options.cwd);
  const projectRoot = findProjectRoot(cwd) ?? cwd;
  const clientHome = resolveClientHome(client, options.clientHome);
  const pluginRoot = bundledPluginRoot();
  const useEmbeddedAssets = !existsSync(pluginRoot);

  const dryRun = options.dryRun === true;
  const project = ensureProjectCodetrap(projectRoot, dryRun);
  const skills = installSelectedSkills(clientHome, dryRun, options, useEmbeddedAssets ? EMBEDDED_PLUGIN_ROOT : pluginRoot);
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
  for (const skill of result.skills.filter(s => ["archived", "would_archive"].includes(s.status))) lines.push(`${skill.name}: ${skill.status}${skill.backup ? " → " + skill.backup : " (backup outside skills/)"}`);
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

function backupExistingSkill(destination: string, clientHome: string): string {
  const backupDir = join(clientHome, "skill-backups", `${basename(destination)}.${randomUUID()}`);
  mkdirSync(dirname(backupDir), { recursive: true });
  cpSync(destination, backupDir, { recursive: true, dereference: false });
  return backupDir;
}

function installSelectedSkills(clientHome: string, dryRun: boolean, options: ClientSetupOptions, pluginRoot: string): ClientSetupResult["skills"] {
  const root = join(clientHome, "skills");
  const selected = [...BUNDLED_SKILLS];
  if (!options.withoutReview && (options.withReview || existsSync(join(root, REVIEW_SKILL.name)))) selected.push(REVIEW_SKILL);
  const retired = [...LEGACY_SKILLS, ...(options.withoutReview ? [REVIEW_SKILL.name] : [])];
  // Validate all known destinations before changing anything. Never follow a skill-directory link.
  for (const name of [...selected.map(e => e.name), ...retired]) {
    const destination = join(root, name);
    try { if (!lstatSync(destination).isDirectory() || lstatSync(destination).isSymbolicLink()) throw new Error(`Unsafe skill directory: ${destination}`); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
  const results: ClientSetupResult["skills"] = [];
  for (const entry of selected) {
    const destination = join(root, entry.name), files = skillFiles(entry);
    for (const path of Object.keys(files)) {
      let parent = destination;
      for (const segment of path.split("/")) {
        parent = join(parent, segment);
        try { if (lstatSync(parent).isSymbolicLink()) throw new Error(`Unsafe skill resource: ${parent}`); }
        catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
      }
    }
    const exists = existsSync(destination);
    const unchanged = exists && Object.entries(files).every(([path, content]) => existsSync(join(destination, path)) && readFileSync(join(destination, path), "utf8") === content);
    const status: ClientSetupStatus = unchanged ? "unchanged" : exists ? dryRun ? "would_update" : "updated" : dryRun ? "would_install" : "installed";
    let backup: string | undefined;
    if (!dryRun && !unchanged) {
      if (exists) backup = backupExistingSkill(destination, clientHome);
      for (const [path, content] of Object.entries(files)) {
        const target = join(destination, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content);
      }
    }
    results.push({ name: entry.name, source: `${pluginRoot}/${entry.name === REVIEW_SKILL.name ? "optional-skills" : "skills"}/${entry.name}`, destination, status, ...(backup ? { backup } : {}) });
  }
  // Retire only named legacy entries, after their replacement resources are installed.
  for (const name of retired) {
    const destination = join(root, name);
    if (!existsSync(destination)) continue;
    let backup: string | undefined;
    if (!dryRun) {
      backup = join(clientHome, "skill-backups", `${name}.${randomUUID()}`);
      mkdirSync(dirname(backup), { recursive: true }); renameSync(destination, backup);
    }
    results.push({ name, source: destination, destination, status: dryRun ? "would_archive" : "archived", ...(backup ? { backup } : {}) });
  }
  return results;
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
