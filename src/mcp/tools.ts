import { CATEGORIES, SCOPES } from "../lib/constants";
import { trapInputSchema, trapUpdateSchema } from "../domain/trap";

const categoryEnum = [...CATEGORIES] as string[];
const scopeEnum = [...SCOPES] as string[];

export const toolDefinitions = [
  {
    name: "search_traps",
    description:
      "Search the trap database for coding pitfalls matching the query. Searches both project and global scopes by default. Use this before writing code in a new area to check for known mistakes.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for full-text search" },
        scope: { type: "string", enum: scopeEnum, description: "Limit to a specific scope" },
        category: { type: "string", enum: categoryEnum, description: "Filter by category" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "add_trap",
    description:
      "Record a new coding pitfall. Call this when the user wants to save a lesson learned: an AI mistake pattern and the correct approach.",
    inputSchema: trapInputSchema(),
  },
  {
    name: "get_trap",
    description: "Get full details of a specific trap by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Trap ID" },
        scope: { type: "string", enum: scopeEnum, description: "Which scope to look in" },
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
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "update_trap",
    description: "Update an existing trap's fields.",
    inputSchema: trapUpdateSchema(),
  },
  {
    name: "delete_trap",
    description: "Delete a trap by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Trap ID to delete" },
        scope: { type: "string", enum: scopeEnum },
      },
      required: ["id"],
    },
  },
  {
    name: "get_stats",
    description: "Get statistics about the trap database: total counts, breakdown by category and severity.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: scopeEnum },
      },
    },
  },
];
