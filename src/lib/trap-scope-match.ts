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
  const normalized = normalizePath(path);
  return globs.some((glob) => globMatchesPath(glob, normalized));
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
  return globs.length > 0 && globs.some((glob) => globMatchesPath(glob, normalizePath(path)));
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function globMatchesPath(glob: string, path: string): boolean {
  const normalizedGlob = normalizePath(glob);
  return new RegExp(`^${globToRegExp(normalizedGlob)}$`).test(path);
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
