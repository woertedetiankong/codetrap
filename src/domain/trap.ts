import {
  CATEGORIES,
  DEFAULT_SEVERITY,
  EVIDENCE_SOURCE_TYPES,
  SCOPES,
  SEVERITIES,
  TRAP_STATUSES,
  type Scope,
  type TrapStatus,
} from "../lib/constants";

export type { TrapStatus } from "../lib/constants";

export interface Trap {
  id: number;
  title: string;
  category: string;
  tags: string;
  scope: string;
  context: string;
  mistake: string;
  fix: string;
  search_text: string;
  before_code: string | null;
  after_code: string | null;
  severity: string;
  state_key: string | null;
  status: TrapStatus;
  supersedes_id: number | null;
  valid_from: string;
  valid_until: string | null;
  project_path: string | null;
  path_globs: string;
  module: string | null;
  owner: string | null;
  hit_count: number;
  created_at: string;
  updated_at: string;
}

export interface TrapInput {
  title: string;
  category: string;
  tags?: string[];
  scope: string;
  context: string;
  mistake: string;
  fix: string;
  before_code?: string;
  after_code?: string;
  severity?: string;
  project_path?: string | null;
  path_globs?: string[];
  module?: string | null;
  owner?: string | null;
}

export interface TrapSearchResult {
  trap: Trap;
  rank: number;
  sources?: ("fts" | "semantic")[];
  score?: number;
  diagnostics?: TrapSearchDiagnostic[];
  ranking_signals?: RankingSignal[];
}

export interface TrapSearchDiagnostic {
  code: string;
  message: string;
}

export interface RankingSignal {
  code: string;
  weight: number;
  detail?: string;
}

export interface TrapActionCard {
  trap_id: number;
  scope: Scope;
  title: string;
  why_relevant: string;
  avoid: string;
  do_instead: string;
  severity: string;
  score: number | null;
  sources: ("fts" | "semantic")[];
  diagnostics?: TrapSearchDiagnostic[];
  ranking_signals?: RankingSignal[];
}

export type TrapUpdate = Partial<Omit<TrapInput, "scope" | "project_path">>;

export interface TrapEvidence {
  id: number;
  trap_id: number;
  source_type: string;
  source_ref: string | null;
  observed_at: string;
  related_files: string;
  note: string | null;
  created_at: string;
}

export interface TrapEvidenceInput {
  source_type: string;
  source_ref?: string | null;
  observed_at?: string | null;
  related_files?: string[];
  note?: string | null;
}

export interface TrapExportEvidence extends Omit<TrapEvidence, "related_files"> {
  related_files: string[];
}

export interface TrapExportRecord extends Omit<Trap, "path_globs"> {
  path_globs: string[];
  evidence: TrapExportEvidence[];
}

export type TrapImportEvidence = Partial<Omit<TrapEvidence, "related_files">> & {
  source_type: string;
  related_files?: string[] | string | null;
};

export type TrapImportRecord = Omit<TrapInput, "tags" | "before_code" | "after_code" | "project_path" | "path_globs"> & {
  tags?: string[] | string | null;
  before_code?: string | null;
  after_code?: string | null;
  project_path?: string | null;
  path_globs?: string[] | string | null;
  evidence?: TrapImportEvidence[];
};

export interface TrapDetails {
  trap: Trap;
  evidence: TrapEvidence[];
  scope: Scope;
}

export interface ArchiveTrapInput {
  id: number;
  scope?: string;
}

export interface SupersedeTrapInput {
  id: number;
  superseded_by_id: number;
  scope?: string;
  state_key?: string;
}

type JsonSchemaProperty = {
  type: string;
  enum?: string[];
  items?: { type: string };
  description?: string;
};

type JsonSchema = {
  type: string;
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
};

export const TRAP_REQUIRED_INPUT_FIELDS = [
  "title",
  "category",
  "scope",
  "context",
  "mistake",
  "fix",
] as const;

export const TRAP_UPDATE_FIELDS = [
  "title",
  "category",
  "context",
  "mistake",
  "fix",
  "tags",
  "before_code",
  "after_code",
  "severity",
  "path_globs",
  "module",
  "owner",
] as const;

export const TRAP_INPUT_SCHEMA_PROPERTIES = {
  title: { type: "string", description: "Short summary of the pitfall" },
  category: { type: "string", enum: [...CATEGORIES] as string[] },
  scope: {
    type: "string",
    enum: [...SCOPES] as string[],
    description: "project = this project only, global = all projects",
  },
  context: { type: "string", description: "When does this pitfall typically occur?" },
  mistake: { type: "string", description: "What the AI tends to do wrong" },
  fix: { type: "string", description: "What should be done instead" },
  tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" },
  before_code: { type: "string", description: "Example of wrong code (optional)" },
  after_code: { type: "string", description: "Example of correct code (optional)" },
  severity: { type: "string", enum: [...SEVERITIES] as string[], description: "How severe is this pitfall?" },
  path_globs: {
    type: "array",
    items: { type: "string" },
    description: "Optional file globs where this trap applies, for example src/db/**",
  },
  module: { type: "string", description: "Optional module or subsystem where this trap applies" },
  owner: { type: "string", description: "Optional team or owner for this trap" },
} satisfies Record<keyof Omit<TrapInput, "project_path">, JsonSchemaProperty>;

export function trapInputSchema() {
  return {
    type: "object",
    properties: TRAP_INPUT_SCHEMA_PROPERTIES,
    required: [...TRAP_REQUIRED_INPUT_FIELDS],
  };
}

export function trapUpdateSchema() {
  const properties = Object.fromEntries(
    TRAP_UPDATE_FIELDS.map((field) => [field, TRAP_INPUT_SCHEMA_PROPERTIES[field]])
  );
  return {
    type: "object",
    properties: {
      id: { type: "number", description: "Trap ID to update" },
      scope: { type: "string", enum: [...SCOPES] as string[] },
      ...properties,
    },
    required: ["id"],
  };
}

export function trapEvidenceInputSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      id: { type: "number", description: "Trap ID to attach evidence to" },
      scope: { type: "string", enum: [...SCOPES] as string[], description: "Which scope to look in" },
      source_type: {
        type: "string",
        enum: [...EVIDENCE_SOURCE_TYPES] as string[],
        description: "Where this evidence came from",
      },
      source_ref: { type: "string", description: "Optional file path, commit SHA, issue/article URL, or transcript ID" },
      observed_at: { type: "string", description: "When this was observed (ISO-like timestamp, optional)" },
      related_files: {
        type: "array",
        items: { type: "string" },
        description: "Optional related file paths",
      },
      note: { type: "string", description: "Optional short note about the evidence" },
    },
    required: ["id", "source_type"],
  };
}

export function archiveTrapInputSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      id: { type: "number", description: "Trap ID to archive" },
      scope: { type: "string", enum: [...SCOPES] as string[], description: "Which scope to look in" },
    },
    required: ["id"],
  };
}

export function supersedeTrapInputSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      id: { type: "number", description: "Trap ID being superseded" },
      superseded_by_id: { type: "number", description: "Trap ID that replaces the older trap" },
      scope: { type: "string", enum: [...SCOPES] as string[], description: "Which scope to look in" },
      state_key: { type: "string", description: "Optional lifecycle group key for this rule family" },
    },
    required: ["id", "superseded_by_id"],
  };
}

export function buildTrapInput(args: Record<string, any>): TrapInput {
  return {
    title: args.title,
    category: args.category,
    scope: args.scope,
    context: args.context,
    mistake: args.mistake,
    fix: args.fix,
    tags: args.tags,
    before_code: args.before_code,
    after_code: args.after_code,
    severity: args.severity ?? DEFAULT_SEVERITY,
    path_globs: Array.isArray(args.path_globs) ? args.path_globs.map(String) : args.path_globs,
    module: args.module,
    owner: args.owner,
  };
}

export function buildTrapEvidenceInput(args: Record<string, any>): TrapEvidenceInput {
  if (!(EVIDENCE_SOURCE_TYPES as readonly string[]).includes(args.source_type)) {
    throw new Error(`Invalid evidence source_type: ${args.source_type}. Expected one of: ${EVIDENCE_SOURCE_TYPES.join(", ")}`);
  }
  return {
    source_type: args.source_type,
    source_ref: args.source_ref,
    observed_at: args.observed_at,
    related_files: Array.isArray(args.related_files) ? args.related_files.map(String) : undefined,
    note: args.note,
  };
}

export function parseTrapStatus(status?: string): TrapStatus | "all" | undefined {
  if (!status) return undefined;
  if (status === "all") return "all";
  if ((TRAP_STATUSES as readonly string[]).includes(status)) return status as TrapStatus;
  throw new Error(`Invalid trap status: ${status}. Expected one of: ${TRAP_STATUSES.join(", ")}, all`);
}

export function pickTrapUpdate(args: Record<string, any>): TrapUpdate {
  const update: TrapUpdate = {};
  for (const field of TRAP_UPDATE_FIELDS) {
    if (args[field] !== undefined) {
      update[field] = args[field];
    }
  }
  return update;
}
