export const CATEGORIES = [
  "api",
  "database",
  "auth",
  "convention",
  "security",
  "performance",
  "bug",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  api: "API",
  database: "DB",
  auth: "Auth",
  convention: "Conv",
  security: "Sec",
  performance: "Perf",
  bug: "Bug",
  other: "Other",
};

export const SEVERITIES = ["warning", "error", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_ICONS: Record<Severity, string> = {
  warning: "WARN",
  error: "ERR!",
  critical: "CRIT",
};

export const SCOPES = ["project", "global"] as const;
export type Scope = (typeof SCOPES)[number];

export const DEFAULT_SEVERITY: Severity = "warning";
export const DEFAULT_CATEGORY: Category = "other";

// Increment this when schema changes in a breaking way.
// Migrations are stored in src/db/migrations.ts
export const SCHEMA_VERSION = 1;

// Directory and file names
export const CODETRAP_DIR = ".codetrap";
export const TRAPS_DB_FILE = "traps.db";
