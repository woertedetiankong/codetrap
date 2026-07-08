import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CODETRAP_DIR, PROJECT_META_FILE } from "./constants";

// A1: project identity should not be an absolute path string. Each initialized
// project mints a stable UUID once (at `init`, or lazily on first write) and
// records it in `.codetrap/project.json`. The recorded `path` is display
// metadata — the `id` is what stays stable across renames and symlinked cwds.

export const PROJECT_IDENTITY_VERSION = 1;

export type ProjectIdentity = {
  version: number;
  id: string;
  created_at: string;
  path: string;
};

export function projectMetaDir(root: string): string {
  return join(root, CODETRAP_DIR);
}

export function projectIdentityPath(root: string): string {
  return join(projectMetaDir(root), PROJECT_META_FILE);
}

// Returns null when the project has no identity file yet. Throws a clear error
// (rather than silently minting a fresh id) if the file exists but is corrupt,
// so a truncated write is surfaced instead of losing the original identity.
export function readProjectIdentity(root: string): ProjectIdentity | null {
  const path = projectIdentityPath(root);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Corrupt project identity file ${path}: ${message}. Fix or delete the file, then retry.`);
  }
  return normalizeIdentity(parsed, path);
}

// Read the identity, minting and persisting one when it is missing. Never
// overwrites an existing id (so the identity stays stable), but the file is
// created inside .codetrap/ which must already exist for an initialized project;
// the directory is created defensively so a lazy mint cannot fail on a partially
// set up project.
export function ensureProjectIdentity(root: string, now = new Date()): ProjectIdentity {
  const existing = readProjectIdentity(root);
  if (existing) return existing;

  const identity: ProjectIdentity = {
    version: PROJECT_IDENTITY_VERSION,
    id: randomUUID(),
    created_at: now.toISOString(),
    path: root,
  };
  mkdirSync(projectMetaDir(root), { recursive: true });
  writeProjectIdentityAtomic(projectIdentityPath(root), identity);
  return identity;
}

function normalizeIdentity(parsed: unknown, path: string): ProjectIdentity {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Corrupt project identity file ${path}: expected a JSON object.`);
  }
  const record = parsed as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== "string" || id.trim() === "") {
    throw new Error(`Corrupt project identity file ${path}: missing "id". Fix or delete the file, then retry.`);
  }
  return {
    version: typeof record.version === "number" ? record.version : PROJECT_IDENTITY_VERSION,
    id,
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    path: typeof record.path === "string" ? record.path : "",
  };
}

function writeProjectIdentityAtomic(path: string, identity: ProjectIdentity): void {
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(identity, null, 2)}\n`);
  renameSync(tmp, path);
}
