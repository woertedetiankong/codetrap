import { CATEGORIES, SCOPES, SEARCH_MODES, TRAP_STATUSES } from "../lib/constants";
import {
  archiveTrapInputSchema,
  supersedeTrapInputSchema,
  trapEvidenceInputSchema,
  trapInputSchema,
  trapUpdateSchema,
} from "../domain/trap";

const categoryEnum = [...CATEGORIES] as string[];
const scopeEnum = [...SCOPES] as string[];
const searchModeEnum = [...SEARCH_MODES] as string[];
const statusEnum = [...TRAP_STATUSES, "all"] as string[];
const cwdProperty = {
  type: "string",
  description: "Optional working directory used to resolve project scope for this tool call.",
};

export const toolDefinitions = [
  {
    name: "search_traps",
    description:
      "Search for relevant coding pitfalls. Returns compact action cards by default; call get_trap with the returned id and scope before making code changes when details or examples are needed.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for full-text search" },
        scope: { type: "string", enum: scopeEnum, description: "Limit to a specific scope" },
        category: { type: "string", enum: categoryEnum, description: "Filter by category" },
        mode: { type: "string", enum: searchModeEnum, description: "Search mode (default hybrid)" },
        limit: { type: "number", description: "Max results (default 20)" },
        status: { type: "string", enum: statusEnum, description: "Lifecycle filter (default active; use all for history)" },
        cwd: cwdProperty,
      },
      required: ["query"],
    },
  },
  {
    name: "add_trap",
    description:
      "Record a new coding pitfall. Call this when the user wants to save a lesson learned: an AI mistake pattern and the correct approach.",
    inputSchema: withCwd(trapInputSchema()),
  },
  {
    name: "get_trap",
    description: "Drill down into a trap returned by search_traps. Use the id and scope from the action card to get full details, examples, lifecycle, and evidence.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Trap ID" },
        scope: { type: "string", enum: scopeEnum, description: "Which scope to look in" },
        cwd: cwdProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "list_traps",
    description: "List traps with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: scopeEnum },
        category: { type: "string", enum: categoryEnum },
        status: { type: "string", enum: statusEnum, description: "Lifecycle filter (default active; use all for history)" },
        limit: { type: "number", description: "Max results (default 50)" },
        cwd: cwdProperty,
      },
    },
  },
  {
    name: "update_trap",
    description: "Update an existing trap's fields.",
    inputSchema: withCwd(trapUpdateSchema()),
  },
  {
    name: "delete_trap",
    description: "Delete a trap by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Trap ID to delete" },
        scope: { type: "string", enum: scopeEnum },
        cwd: cwdProperty,
      },
      required: ["id"],
    },
  },
  {
    name: "add_trap_evidence",
    description: "Attach traceable evidence/source metadata to an existing trap.",
    inputSchema: withCwd(trapEvidenceInputSchema()),
  },
  {
    name: "archive_trap",
    description: "Archive an active trap so default search no longer returns it while history remains recoverable.",
    inputSchema: withCwd(archiveTrapInputSchema()),
  },
  {
    name: "supersede_trap",
    description: "Mark one trap as superseded by another trap in the same scope.",
    inputSchema: withCwd(supersedeTrapInputSchema()),
  },
  {
    name: "get_stats",
    description: "Get statistics about the trap database: total counts, breakdown by category and severity.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: scopeEnum },
        cwd: cwdProperty,
      },
    },
  },
];

function withCwd<T extends { properties: Record<string, unknown> }>(schema: T): T {
  return {
    ...schema,
    properties: {
      ...schema.properties,
      cwd: cwdProperty,
    },
  };
}
