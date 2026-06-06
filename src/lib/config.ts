import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  embeddings?: EmbeddingSettings;
};

export type EmbeddingProviderSetting = "ollama" | "jina";

export type EmbeddingSettings = {
  provider?: EmbeddingProviderSetting;
  endpoint?: string;
  model?: string;
  dimensions?: number;
};

export type SearchDefaults = {
  mode: SearchMode;
  limit: number;
  scope?: Scope;
  rerank: boolean;
};

export type ConfigWriteResult = {
  path: string;
  config: CodetrapConfig;
};

const BUILT_IN_SEARCH_DEFAULTS: SearchDefaults = {
  mode: "hybrid",
  limit: 20,
  rerank: true,
};

export function loadCodetrapConfig(home = homedir()): CodetrapConfig {
  const path = codetrapConfigPath(home);
  if (!existsSync(path)) return {};

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return normalizeConfig(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid codetrap config at ${path}: ${message}`);
  }
}

export function codetrapConfigPath(home = homedir()): string {
  return join(home, CODETRAP_DIR, "config.json");
}

export function writeCodetrapConfig(config: CodetrapConfig, home = homedir()): ConfigWriteResult {
  const path = codetrapConfigPath(home);
  mkdirSync(join(home, CODETRAP_DIR), { recursive: true });
  const normalized = normalizeConfig(config);
  writeFileSync(path, `${JSON.stringify(normalized, null, 2)}\n`);
  return { path, config: normalized };
}

export function setCodetrapEmbeddingSettings(
  embeddings: EmbeddingSettings,
  home = homedir()
): ConfigWriteResult {
  const current = loadCodetrapConfig(home);
  return writeCodetrapConfig({ ...current, embeddings }, home);
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
  const embeddings = isRecord(value.embeddings) ? normalizeEmbeddingSettings(value.embeddings) : undefined;
  return {
    ...(search ? { search } : {}),
    ...(embeddings ? { embeddings } : {}),
  };
}

function normalizeSearchConfig(value: Record<string, unknown>): CodetrapConfig["search"] {
  const out: NonNullable<CodetrapConfig["search"]> = {};
  if (typeof value.mode === "string") out.mode = parseSearchMode(value.mode);
  if (typeof value.limit === "number") out.limit = parsePositiveInt(value.limit, "search.limit");
  if (typeof value.scope === "string") out.scope = parseScope(value.scope);
  if (typeof value.rerank === "boolean") out.rerank = value.rerank;
  return out;
}

function normalizeEmbeddingSettings(value: Record<string, unknown>): EmbeddingSettings {
  const out: EmbeddingSettings = {};
  if (typeof value.provider === "string") out.provider = parseEmbeddingProvider(value.provider);
  if (typeof value.endpoint === "string") out.endpoint = value.endpoint;
  if (typeof value.model === "string") out.model = value.model;
  if (typeof value.dimensions === "number") out.dimensions = parsePositiveInt(value.dimensions, "embeddings.dimensions");
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

function parseEmbeddingProvider(value: string): EmbeddingProviderSetting {
  if (value === "ollama" || value === "jina") return value;
  throw new Error("Invalid embeddings.provider: expected one of: ollama, jina");
}

function parsePositiveInt(value: number, label: string): number {
  if (Number.isInteger(value) && value > 0) return value;
  throw new Error(`Invalid ${label}: expected a positive integer.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
