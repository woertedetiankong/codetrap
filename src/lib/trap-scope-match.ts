import { realpathSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import type { Trap } from "../domain/trap";
import { parseTrapPathGlobs } from "./trap-json-fields";

export type ApplicabilityFilter = {
  path?: string;
  module?: string;
  owner?: string;
};

export function trapMatchesApplicability(trap: Trap, filter: ApplicabilityFilter): boolean {
  return (
    trapAppliesToPath(trap, filter.path) &&
    trapAppliesToModule(trap, filter.module) &&
    trapAppliesToOwner(trap, filter.owner)
  );
}

export function trapAppliesToPath(trap: Trap, path?: string): boolean {
  if (!path) return true;
  const globs = parseTrapPathGlobs(trap.path_globs);
  if (globs.length === 0) return true;
  const candidates = pathCandidates(trap, path);
  return globs.some((glob) => candidates.some((candidate) => globMatchesPath(glob, candidate)));
}

export function trapAppliesToModule(trap: Trap, module?: string): boolean {
  if (!module || !trap.module) return true;
  return trap.module === module;
}

export function trapAppliesToOwner(trap: Trap, owner?: string): boolean {
  if (!owner || !trap.owner) return true;
  return trap.owner === owner;
}

export function hasSpecificPathMatch(trap: Trap, path?: string): boolean {
  if (!path) return false;
  const globs = parseTrapPathGlobs(trap.path_globs);
  const candidates = pathCandidates(trap, path);
  return globs.length > 0 && globs.some((glob) => candidates.some((candidate) => globMatchesPath(glob, candidate)));
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function globMatchesPath(glob: string, path: string): boolean {
  const normalizedGlob = normalizePath(glob);
  return new RegExp(`^${globToRegExp(normalizedGlob)}$`).test(path);
}

function pathCandidates(trap: Trap, path: string): string[] {
  const candidates = new Set([normalizePath(path)]);
  if (trap.project_path && isAbsolute(path)) {
    for (const root of projectPathAliases(trap.project_path)) {
      const relativePath = relative(root, path);
      const normalizedRelative = normalizePath(relativePath);
      if (
        normalizedRelative &&
        normalizedRelative !== ".." &&
        !normalizedRelative.startsWith("../") &&
        !isAbsolute(relativePath)
      ) {
        candidates.add(normalizedRelative);
      }
    }
  }
  return [...candidates];
}

function projectPathAliases(projectPath: string): string[] {
  const roots = new Set([projectPath]);
  try {
    roots.add(realpathSync(projectPath));
  } catch {
    // The project may have moved since the trap was recorded; use the stored path.
  }

  for (const root of [...roots]) {
    if (root.startsWith("/private/var/")) {
      roots.add(root.replace(/^\/private\/var\//, "/var/"));
    } else if (root.startsWith("/var/")) {
      roots.add(`/private${root}`);
    }
  }
  return [...roots];
}

function globToRegExp(glob: string): string {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    const next = glob[i + 1];
    if (char === "*" && next === "*") {
      out += ".*";
      i++;
    } else if (char === "*") {
      out += "[^/]*";
    } else if (char === "?") {
      out += "[^/]";
    } else {
      out += escapeRegExp(char);
    }
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
