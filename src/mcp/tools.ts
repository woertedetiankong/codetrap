import { CATEGORIES, SCOPES, SEARCH_MODES, TRAP_STATUSES } from "../lib/constants";
import { SESSION_NOTE_KINDS } from "../domain/session";
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
const noteKindEnum = [...SESSION_NOTE_KINDS] as string[];
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
        path: { type: "string", description: "Optional file path used to filter path-scoped traps" },
        module: { type: "string", description: "Optional module/subsystem filter" },
        owner: { type: "string", description: "Optional owner/team filter" },
        rerank: { type: "boolean", description: "Whether query-aware reranking is enabled" },
        ranking_signals: { type: "boolean", description: "Include ranking signal diagnostics in returned cards" },
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
    name: "capture_candidate",
    description:
      "Propose a coding pitfall for human review instead of writing it directly. Writes a candidate to the session inbox; a human accepts or rejects it via `codetrap session accept/reject` or the web review console. Prefer this over add_trap when following the capture→review→accept workflow.",
    inputSchema: captureCandidateSchema(),
  },
  {
    name: "edit_candidate",
    description:
      "Edit a proposed candidate through Codetrap's revisioned session store. Use this after translating or improving candidate fields; it updates the content hash and invalidates stale approval safely.",
    inputSchema: editCandidateSchema(),
  },
  {
    name: "update_session_goal",
    description:
      "Update a session goal without changing its stable session id. Codetrap keeps session metadata, index, recap, and implementation-notes header in sync.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Stable session id to update." },
        goal: { type: "string", description: "New human-readable session goal." },
        cwd: cwdProperty,
      },
      required: ["session_id", "goal"],
    },
  },
  {
    name: "doctor",
    description:
      "Diagnose codetrap health for the resolved project: trap and embedding counts, hybrid-search availability, mis-scoped traps, pending candidate review, and recommended next actions. Pass cwd to diagnose a specific project.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: cwdProperty,
      },
    },
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
    name: "mark_trap_useful",
    description:
      "Report that a trap you recalled actually helped on this task — it changed what you did, or caught a mistake before you made it. Call it only when that is true; it is the signal that tells the user which lessons are worth keeping. Viewing a trap already counts as a hit, so do not call this merely for reading one.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Trap ID that helped" },
        scope: { type: "string", enum: scopeEnum, description: "Which scope the trap is in" },
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
        path: { type: "string", description: "Optional file path used to filter path-scoped traps" },
        module: { type: "string", description: "Optional module/subsystem filter" },
        owner: { type: "string", description: "Optional owner/team filter" },
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

function captureCandidateSchema() {
  const base = trapInputSchema();
  return {
    ...base,
    properties: {
      ...base.properties,
      goal: { type: "string", description: "Optional session goal used when a new post-flight session is created." },
      kind: { type: "string", enum: noteKindEnum, description: "Note kind for the capture evidence (default observation)." },
      related_files: { type: "array", items: { type: "string" }, description: "Files related to this pitfall." },
      source_ref: { type: "string", description: "Optional source reference (commit, URL, or conversation id)." },
      evidence_note: { type: "string", description: "Optional note describing the supporting evidence." },
      cwd: cwdProperty,
    },
  };
}

function editCandidateSchema() {
  const base = trapUpdateSchema();
  const editProperties = Object.fromEntries(
    Object.entries(base.properties).filter(([key]) => key !== "id" && key !== "scope")
  );
  return {
    type: "object",
    properties: {
      candidate_id: { type: "string", description: "Candidate id, for example cand-001." },
      session_id: { type: "string", description: "Session containing the candidate." },
      ...editProperties,
      scope: base.properties.scope,
      cwd: cwdProperty,
    },
    required: ["candidate_id", "session_id"],
  };
}
