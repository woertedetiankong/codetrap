import { CATEGORIES, DEFAULT_SEVERITY, SCOPES, SEVERITIES } from "../lib/constants";

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
  project_path: string | null;
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
}

export interface TrapSearchResult {
  trap: Trap;
  rank: number;
  sources?: ("fts" | "semantic")[];
  score?: number;
  diagnostics?: { code: string; message: string }[];
}

export type TrapUpdate = Partial<Omit<TrapInput, "scope" | "project_path">>;

type JsonSchemaProperty = {
  type: string;
  enum?: string[];
  items?: { type: string };
  description?: string;
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
  };
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
