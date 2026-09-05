import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { CODETRAP_DIR } from "../lib/constants";
import { findProjectRoot } from "../lib/scope";
import { resolveScopePath } from "../lib/scope-path";
import { isRecord } from "../lib/value-types";

export const WEB_PROJECTS_FILE = "web-projects.json";
export const WEB_PROJECTS_VERSION = 1;

export interface WebProject {
  root: string;
  name: string;
  last_opened_at: string;
}

export interface WebProjectRegistry {
  version: typeof WEB_PROJECTS_VERSION;
  projects: WebProject[];
}

export function webProjectsPath(home = homedir()): string {
  return join(home, CODETRAP_DIR, WEB_PROJECTS_FILE);
}

export function loadWebProjectRegistry(home = homedir()): WebProjectRegistry {
  const path = webProjectsPath(home);
  if (!existsSync(path)) return emptyRegistry();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return normalizeRegistry(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid codetrap web project registry at ${path}: ${message}`);
  }
}

export function saveWebProjectRegistry(registry: WebProjectRegistry, home = homedir()): void {
  const dir = join(home, CODETRAP_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(webProjectsPath(home), `${JSON.stringify(normalizeRegistry(registry), null, 2)}\n`);
}

export function resolveWebProjectRoot(path: string, home = homedir()): string {
  const resolved = resolveScopePath(path);
  const root = findProjectRoot(resolved, home);
  if (!root) {
    throw new Error(`No initialized codetrap project found at or above ${resolved}. Run 'codetrap init' first.`);
  }
  return root;
}

export function addWebProject(path: string, home = homedir(), now = new Date()): WebProject {
  const root = resolveWebProjectRoot(path, home);
  const registry = loadWebProjectRegistry(home);
  const project: WebProject = {
    root,
    name: basename(root) || root,
    last_opened_at: now.toISOString(),
  };
  const projects = [
    project,
    ...registry.projects.filter((item) => item.root !== root),
  ].sort((a, b) => b.last_opened_at.localeCompare(a.last_opened_at));
  saveWebProjectRegistry({ version: WEB_PROJECTS_VERSION, projects }, home);
  return project;
}

function emptyRegistry(): WebProjectRegistry {
  return { version: WEB_PROJECTS_VERSION, projects: [] };
}

function normalizeRegistry(value: unknown): WebProjectRegistry {
  if (!isRecord(value) || !Array.isArray(value.projects)) return emptyRegistry();
  const projects = value.projects
    .map(normalizeProject)
    .filter((project): project is WebProject => project !== null);
  return {
    version: WEB_PROJECTS_VERSION,
    projects: uniqueProjects(projects).sort((a, b) => b.last_opened_at.localeCompare(a.last_opened_at)),
  };
}

function normalizeProject(value: unknown): WebProject | null {
  if (!isRecord(value) || typeof value.root !== "string") return null;
  const root = resolveScopePath(value.root);
  return {
    root,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : basename(root) || root,
    last_opened_at: typeof value.last_opened_at === "string" ? value.last_opened_at : new Date(0).toISOString(),
  };
}

function uniqueProjects(projects: WebProject[]): WebProject[] {
  const seen = new Set<string>();
  const out: WebProject[] = [];
  for (const project of projects) {
    if (seen.has(project.root)) continue;
    seen.add(project.root);
    out.push(project);
  }
  return out;
}

/** Local route identity; never used as authorization or persisted to the registry. */
export function webProjectRouteRef(root: string): string {
  return "p-" + createHash("sha256").update(resolveScopePath(root)).digest("hex").slice(0, 24);
}

export function webProjectForClient(project: WebProject) {
  return { ...project, route_ref: webProjectRouteRef(project.root) };
}
