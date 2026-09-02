import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { withAdvisoryLock } from "./advisory-lock";
import { readJsonFile, writeFileAtomic } from "./fs-json";
import type { AgentObservationClient } from "./agent-observation";

export type ObservationIntegrationAction = "enable" | "disable";

export type ObservationIntegrationResult = {
  success: true;
  client: AgentObservationClient;
  action: ObservationIntegrationAction | "status";
  applied: boolean;
  enabled: boolean;
  resulting_enabled: boolean;
  client_trust_required: boolean;
  config_path: string;
  changed_events: string[];
  backup_path: string | null;
  privacy: "metadata-only";
};

const EVENTS = ["UserPromptSubmit", "Stop", "SessionEnd"] as const;

export function observationIntegrationStatus(
  projectRoot: string,
  client: AgentObservationClient
): ObservationIntegrationResult {
  const path = configPath(projectRoot, client);
  const config = readConfig(path);
  return {
    success: true,
    client,
    action: "status",
    applied: false,
    enabled: EVENTS.every((event) => hasOwnedHandler(config, event, client)),
    resulting_enabled: EVENTS.every((event) => hasOwnedHandler(config, event, client)),
    client_trust_required: client === "codex" && EVENTS.every((event) => hasOwnedHandler(config, event, client)),
    config_path: path,
    changed_events: [],
    backup_path: null,
    privacy: "metadata-only",
  };
}

export function configureObservationIntegration(
  projectRoot: string,
  client: AgentObservationClient,
  action: ObservationIntegrationAction,
  apply: boolean,
  now = new Date()
): ObservationIntegrationResult {
  const path = configPath(projectRoot, client);
  const original = readConfig(path);
  const preview = transformConfig(original, client, action);
  if (!apply) {
    return integrationResult(client, action, false, original, preview.config, preview.changedEvents, path, null);
  }

  mkdirSync(dirname(path), { recursive: true });
  return withAdvisoryLock(join(dirname(path), ".codetrap-observation-config.lock"), () => {
    // Re-read under the lock so a concurrent user/client config edit is merged
    // instead of being replaced by the stale preview read above.
    const current = readConfig(path);
    const transformed = transformConfig(current, client, action);
    let backupPath: string | null = null;
    if (transformed.changedEvents.length > 0) {
      if (existsSync(path)) {
        backupPath = uniqueBackupPath(path, now);
        copyFileSync(path, backupPath);
      }
      writeFileAtomic(path, `${JSON.stringify(transformed.config, null, 2)}\n`);
    }
    return integrationResult(
      client,
      action,
      true,
      transformed.config,
      transformed.config,
      transformed.changedEvents,
      path,
      backupPath
    );
  }).value;
}

function transformConfig(
  config: Record<string, unknown>,
  client: AgentObservationClient,
  action: ObservationIntegrationAction
): { config: Record<string, unknown>; changedEvents: string[] } {
  const next = cloneJson(config);
  const changedEvents: string[] = [];
  for (const event of EVENTS) {
    const changed = action === "enable"
      ? addOwnedHandler(next, event, client)
      : removeOwnedHandler(next, event, client);
    if (changed) changedEvents.push(event);
  }
  return { config: next, changedEvents };
}

function integrationResult(
  client: AgentObservationClient,
  action: ObservationIntegrationAction,
  applied: boolean,
  effective: Record<string, unknown>,
  resulting: Record<string, unknown>,
  changedEvents: string[],
  path: string,
  backupPath: string | null
): ObservationIntegrationResult {
  return {
    success: true,
    client,
    action,
    applied,
    enabled: EVENTS.every((event) => hasOwnedHandler(effective, event, client)),
    resulting_enabled: EVENTS.every((event) => hasOwnedHandler(resulting, event, client)),
    client_trust_required: client === "codex" && EVENTS.every((event) => hasOwnedHandler(resulting, event, client)),
    config_path: path,
    changed_events: changedEvents,
    backup_path: backupPath,
    privacy: "metadata-only",
  };
}

function uniqueBackupPath(path: string, now: Date): string {
  const base = `${path}.codetrap-backup-${now.toISOString().replace(/[:.]/g, "-")}`;
  if (!existsSync(base)) return base;
  return `${base}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatObservationIntegration(result: ObservationIntegrationResult): string {
  if (result.action === "status") {
    return `${label(result.client)} automatic observation: ${result.enabled ? "enabled" : "disabled"}\nConfig: ${result.config_path}\nPrivacy: metadata-only`;
  }
  const mode = result.applied ? "Applied" : "Preview only";
  const change = result.changed_events.length > 0 ? result.changed_events.join(", ") : "no changes";
  return `${mode}: ${result.action} ${label(result.client)} automatic observation (${change}).\nConfig: ${result.config_path}\nPrivacy: metadata-only${result.applied ? "" : "\nRun again with --apply to change this project."}`;
}

function configPath(projectRoot: string, client: AgentObservationClient): string {
  return client === "codex"
    ? join(projectRoot, ".codex", "hooks.json")
    : join(projectRoot, ".claude", "settings.json");
}

function readConfig(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const value = readJsonFile<unknown>(path, "Agent hook configuration");
  if (!plainObject(value)) throw new Error(`Agent hook configuration ${path} must contain a JSON object.`);
  if (value.hooks !== undefined && !plainObject(value.hooks)) {
    throw new Error(`Agent hook configuration ${path} field hooks must be a JSON object.`);
  }
  return value;
}

function addOwnedHandler(
  config: Record<string, unknown>,
  event: typeof EVENTS[number],
  client: AgentObservationClient
): boolean {
  if (hasOwnedHandler(config, event, client)) return false;
  const hooks = ensureObject(config, "hooks");
  const groups = ensureArray(hooks, event);
  groups.push({
    hooks: [{
      type: "command",
      command: ownedCommand(client),
      timeout: 3,
    }],
  });
  return true;
}

function removeOwnedHandler(
  config: Record<string, unknown>,
  event: typeof EVENTS[number],
  client: AgentObservationClient
): boolean {
  if (!plainObject(config.hooks)) return false;
  const groups = config.hooks[event];
  if (!Array.isArray(groups)) return false;
  let changed = false;
  const nextGroups: unknown[] = [];
  for (const group of groups) {
    if (!plainObject(group) || !Array.isArray(group.hooks)) {
      nextGroups.push(group);
      continue;
    }
    const nextHandlers = group.hooks.filter((handler) => {
      const owned = isOwnedHandler(handler, client);
      if (owned) changed = true;
      return !owned;
    });
    if (nextHandlers.length > 0) nextGroups.push({ ...group, hooks: nextHandlers });
  }
  if (changed) config.hooks[event] = nextGroups;
  return changed;
}

function hasOwnedHandler(
  config: Record<string, unknown>,
  event: typeof EVENTS[number],
  client: AgentObservationClient
): boolean {
  if (!plainObject(config.hooks)) return false;
  const groups = config.hooks[event];
  return Array.isArray(groups) && groups.some((group) =>
    plainObject(group) && Array.isArray(group.hooks) && group.hooks.some((handler) => isOwnedHandler(handler, client))
  );
}

function isOwnedHandler(value: unknown, client: AgentObservationClient): boolean {
  return plainObject(value)
    && value.type === "command"
    && typeof value.command === "string"
    && isOwnedCommand(value.command, client);
}

function ownedCommand(client: AgentObservationClient): string {
  const executableName = basename(process.execPath).toLowerCase();
  const launcher = executableName === "codetrap" || executableName === "codetrap.exe"
    ? quoteCommand(process.execPath)
    : "codetrap";
  return `${launcher} observe hook --client ${client}`;
}

function isOwnedCommand(command: string, client: AgentObservationClient): boolean {
  const suffix = ` observe hook --client ${client}`;
  if (!command.endsWith(suffix)) return false;
  const rawLauncher = command.slice(0, -suffix.length).trim();
  const launcher = rawLauncher.startsWith('"') && rawLauncher.endsWith('"')
    ? rawLauncher.slice(1, -1)
    : rawLauncher;
  const executableName = basename(launcher.replace(/\\/g, "/")).toLowerCase();
  return executableName === "codetrap" || executableName === "codetrap.exe";
}

function quoteCommand(path: string): string {
  return /\s/.test(path) ? `"${path.replace(/"/g, '\\"')}"` : path;
}

function ensureObject(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  if (parent[key] === undefined) parent[key] = {};
  if (!plainObject(parent[key])) throw new Error(`Agent hook configuration field ${key} must be a JSON object.`);
  return parent[key] as Record<string, unknown>;
}

function ensureArray(parent: Record<string, unknown>, key: string): unknown[] {
  if (parent[key] === undefined) parent[key] = [];
  if (!Array.isArray(parent[key])) throw new Error(`Agent hook configuration field ${key} must be an array.`);
  return parent[key] as unknown[];
}

function cloneJson(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function label(client: AgentObservationClient): string {
  return client === "codex" ? "Codex" : "Claude Code";
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
