import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CODETRAP_DIR, SCOPES, SEARCH_MODES, type Scope, type SearchMode } from "./constants";

export type CodetrapConfig = {
  search?: {
    mode?: SearchMode;
    limit?: number;
    scope?: Scope;
    rerank?: boolean;
  };
};

export type SearchDefaults = {
  mode: SearchMode;
  limit: number;
  scope?: Scope;
  rerank: boolean;
};

const BUILT_IN_SEARCH_DEFAULTS: SearchDefaults = {
  mode: "hybrid",
  limit: 20,
  rerank: true,
};

export function loadCodetrapConfig(home = homedir()): CodetrapConfig {
  const path = join(home, CODETRAP_DIR, "config.json");
  if (!existsSync(path)) return {};

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return normalizeConfig(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid codetrap config at ${path}: ${message}`);
  }
}

export function searchDefaultsFromConfig(config = loadCodetrapConfig(), env = process.env): SearchDefaults {
  return {
    mode: config.search?.mode ?? parseSearchModeEnv(env.CODETRAP_SEARCH_MODE) ?? BUILT_IN_SEARCH_DEFAULTS.mode,
    limit: config.search?.limit ?? parsePositiveIntEnv(env.CODETRAP_SEARCH_LIMIT) ?? BUILT_IN_SEARCH_DEFAULTS.limit,
    scope: config.search?.scope ?? parseScopeEnv(env.CODETRAP_SEARCH_SCOPE),
    rerank: config.search?.rerank ?? parseBooleanEnv(env.CODETRAP_RERANK) ?? BUILT_IN_SEARCH_DEFAULTS.rerank,
  };
}

function normalizeConfig(value: unknown): CodetrapConfig {
  if (!isRecord(value)) return {};
  const search = isRecord(value.search) ? normalizeSearchConfig(value.search) : undefined;
  return search ? { search } : {};
}

function normalizeSearchConfig(value: Record<string, unknown>): CodetrapConfig["search"] {
  const out: NonNullable<CodetrapConfig["search"]> = {};
  if (typeof value.mode === "string") out.mode = parseSearchMode(value.mode);
  if (typeof value.limit === "number") out.limit = parsePositiveInt(value.limit, "search.limit");
  if (typeof value.scope === "string") out.scope = parseScope(value.scope);
  if (typeof value.rerank === "boolean") out.rerank = value.rerank;
  return out;
}

function parseSearchModeEnv(value?: string): SearchMode | undefined {
  return value ? parseSearchMode(value) : undefined;
}

function parseScopeEnv(value?: string): Scope | undefined {
  return value ? parseScope(value) : undefined;
}

function parsePositiveIntEnv(value?: string): number | undefined {
  if (!value) return undefined;
  return parsePositiveInt(Number.parseInt(value, 10), "CODETRAP_SEARCH_LIMIT");
}

function parseBooleanEnv(value?: string): boolean | undefined {
  if (!value) return undefined;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  throw new Error(`Invalid CODETRAP_RERANK: ${value}. Expected true or false.`);
}

function parseSearchMode(value: string): SearchMode {
  if ((SEARCH_MODES as readonly string[]).includes(value)) return value as SearchMode;
  throw new Error(`Invalid search mode: ${value}. Expected one of: ${SEARCH_MODES.join(", ")}`);
}

function parseScope(value: string): Scope {
  if ((SCOPES as readonly string[]).includes(value)) return value as Scope;
  throw new Error(`Invalid scope: ${value}. Expected one of: ${SCOPES.join(", ")}`);
}

function parsePositiveInt(value: number, label: string): number {
  if (Number.isInteger(value) && value > 0) return value;
  throw new Error(`Invalid ${label}: expected a positive integer.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
