import { existsSync, realpathSync } from "node:fs";
import { posix, win32 } from "node:path";

export type ScopePathFlavor = "posix" | "win32";

export type ScopePathFs = {
  exists(path: string): boolean;
  realpath(path: string): string;
};

export type ScopePathResolverOptions = {
  fs?: ScopePathFs;
  platform?: NodeJS.Platform;
};

const nodeFs: ScopePathFs = {
  exists: existsSync,
  realpath: realpathSync,
};

export class ScopePathResolver {
  private readonly fs: ScopePathFs;
  private readonly platform: NodeJS.Platform;

  constructor(options: ScopePathResolverOptions = {}) {
    this.fs = options.fs ?? nodeFs;
    this.platform = options.platform ?? process.platform;
  }

  resolve(path: string, relatedPath = path): string {
    return this.resolveWithFlavor(path, this.flavorFor(path, relatedPath));
  }

  canonical(path: string, relatedPath = path): string {
    const flavor = this.flavorFor(path, relatedPath);
    const resolved = this.resolveWithFlavor(path, flavor);
    const real = this.fs.exists(resolved) ? this.fs.realpath(resolved) : resolved;
    const normalized = pathApi(flavor).normalize(real);
    return flavor === "win32" ? normalized.toLowerCase() : normalized;
  }

  same(left: string, right: string): boolean {
    const flavor = this.flavorFor(left, right);
    return this.canonicalWithFlavor(left, flavor) === this.canonicalWithFlavor(right, flavor);
  }

  join(base: string, ...segments: string[]): string {
    return pathApi(this.flavorFor(base)).join(base, ...segments);
  }

  exists(path: string): boolean {
    return this.fs.exists(path);
  }

  dirname(path: string): string {
    return pathApi(this.flavorFor(path)).dirname(path);
  }

  flavorFor(...paths: string[]): ScopePathFlavor {
    if (this.platform === "win32") return "win32";
    return paths.some((path) => isWindowsAbsolutePath(path) || isMsysAbsolutePath(path)) ? "win32" : "posix";
  }

  private canonicalWithFlavor(path: string, flavor: ScopePathFlavor): string {
    const resolved = this.resolveWithFlavor(path, flavor);
    const real = this.fs.exists(resolved) ? this.fs.realpath(resolved) : resolved;
    const normalized = pathApi(flavor).normalize(real);
    return flavor === "win32" ? normalized.toLowerCase() : normalized;
  }

  private resolveWithFlavor(path: string, flavor: ScopePathFlavor): string {
    return pathApi(flavor).resolve(flavor === "win32" ? msysToWindowsPath(path) : path);
  }
}

export const defaultScopePathResolver = new ScopePathResolver();

export function resolveScopePath(path: string, relatedPath = path): string {
  return defaultScopePathResolver.resolve(path, relatedPath);
}

function pathApi(flavor: ScopePathFlavor): typeof posix {
  return flavor === "win32" ? win32 : posix;
}

function msysToWindowsPath(path: string): string {
  const match = path.match(/^\/([a-zA-Z])(?:\/(.*))?$/);
  if (!match) return path;
  const [, drive, rest = ""] = match;
  return `${drive.toUpperCase()}:\\${rest.replaceAll("/", "\\")}`;
}

function isWindowsAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || /^\\\\/.test(path);
}

function isMsysAbsolutePath(path: string): boolean {
  return /^\/[a-zA-Z](?:\/|$)/.test(path);
}
