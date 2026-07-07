import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TrapStore } from "../lib/store";
import { toolDefinitions } from "./tools";
import { resourceDefinitions } from "./resources";
import { TrapOperations } from "../lib/trap-operations";
import {
  toListJson,
  toMcpResourceJson,
  toMcpResourceText,
  toMcpSearchJson,
  toMcpTextError,
  toMcpTextJson,
  toStatsJson,
  toTrapDetailsJson,
} from "../lib/output-json";
import { storeForScopeContext } from "../lib/scope-context";
import { searchDefaultsFromConfig } from "../lib/config";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { CANDIDATES_FILE, sessionRelativeFile } from "../lib/session-codec";
import { buildDoctorReport } from "../lib/doctor";
import {
  listRequestFromArgs,
  searchRequestFromArgs,
  statsRequestFromArgs,
} from "../lib/command-requests";

type ToolArgs = Record<string, any>;

export async function handleToolCall(store: TrapStore, name: string, args: ToolArgs) {
  const scopedStore = storeForScopeContext(store, args.cwd);
  const operations = new TrapOperations(scopedStore);
  try {
    switch (name) {
      case "search_traps": {
        // Honor user config/env search defaults, same as the CLI (M26).
        const { cards, diagnostics } = await operations.searchTrapCards(
          searchRequestFromArgs(args.query, args, searchDefaultsFromConfig())
        );
        const warning = projectScopeWarning(scopedStore, args.scope);
        return toMcpTextJson({ results: toMcpSearchJson(cards), diagnostics, ...(warning ? { warning } : {}) });
      }

      case "add_trap": {
        const result = operations.addTrap(args);
        await operations.embedTrapBestEffort(result.id, result.scope);
        return toMcpTextJson(result);
      }

      case "capture_candidate": {
        const projectRoot = scopedStore.getProjectRoot();
        if (!projectRoot) {
          return toMcpTextError(
            "capture_candidate requires a project. Pass cwd for a directory initialized with 'codetrap init'."
          );
        }
        const sessions = new SessionOperations(new SessionStore(projectRoot), operations);
        const result = sessions.captureCandidate({
          trap: args,
          goal: args.goal,
          kind: args.kind,
          relatedFiles: args.related_files,
          sourceRef: args.source_ref,
          evidenceNote: args.evidence_note,
        });
        return toMcpTextJson({
          success: true,
          session_id: result.session.id,
          candidate_id: result.candidate.id,
          status: result.candidate.status,
          quality_score: result.candidate.quality_score,
          candidate_count: result.candidate_count,
          created_session: result.created_session,
          closed_session: result.closed_session,
          duplicate: result.duplicate,
          candidate_traps_path: sessionRelativeFile(result.session.id, CANDIDATES_FILE),
          recap_path: result.recap_path,
          review:
            "A human reviews this candidate with 'codetrap session accept/reject' or the web review console; capture never writes directly to the trap database.",
        });
      }

      case "get_trap": {
        const result = operations.getTrapDetails(args.id, args.scope);
        if (!result) {
          return toMcpTextError("not found");
        }
        return toMcpTextJson(toTrapDetailsJson(result));
      }

      case "list_traps": {
        const groups = operations.listTraps(listRequestFromArgs(args));
        return toMcpTextJson(toListJson(groups));
      }

      case "update_trap": {
        const result = operations.updateTrap(args.id, args, args.scope);
        if (result.success) await operations.embedTrapBestEffort(args.id, result.scope);
        return toMcpTextJson(result, !result.success);
      }

      case "delete_trap": {
        const result = operations.deleteTrap(args.id, args.scope);
        return toMcpTextJson(result, !result.success);
      }

      case "add_trap_evidence": {
        const result = operations.addTrapEvidence(args.id, args, args.scope);
        return toMcpTextJson(result, !result.success);
      }

      case "archive_trap": {
        const result = operations.archiveTrap(args.id, args.scope);
        return toMcpTextJson(result, !result.success);
      }

      case "supersede_trap": {
        const result = operations.supersedeTrap(args.id, args.superseded_by_id, args.scope, args.state_key);
        return toMcpTextJson(result, !result.success);
      }

      case "get_stats": {
        const request = statsRequestFromArgs(args);
        const stats = operations.getStats(request.scope);
        const warning = projectScopeWarning(scopedStore, request.scope);
        return toMcpTextJson({
          ...toStatsJson(stats, operations.getEmbeddingStats(request.scope)),
          ...(warning ? { warning } : {}),
        });
      }

      case "doctor": {
        const projectRoot = scopedStore.getProjectRoot();
        const candidateReview = projectRoot
          ? new SessionOperations(new SessionStore(projectRoot), operations).candidateReviewSummary()
          : null;
        const report = await buildDoctorReport(scopedStore, operations, effectiveCwd(args), candidateReview);
        return toMcpTextJson(report);
      }

      default:
        return toMcpTextError(`Unknown tool: ${name}`);
    }
  } catch (e: any) {
    return toMcpTextError(e instanceof Error ? e.message : String(e));
  }
}

// When the server can't resolve a project (its startup cwd isn't inside a
// codetrap project and the caller passed no cwd), project-scoped traps are
// silently skipped. Surface a warning so callers know to pass cwd (M27).
function projectScopeWarning(scopedStore: TrapStore, scope?: unknown): string | undefined {
  if (scope === "global") return undefined;
  if (scopedStore.hasProject()) return undefined;
  return "No project scope resolved for this call: the server's working directory is not inside a codetrap project, so only global traps were considered. Pass `cwd` (the absolute path of the active project) to include project-scoped traps.";
}

function effectiveCwd(args: ToolArgs): string {
  return typeof args.cwd === "string" && args.cwd.trim() !== "" ? args.cwd : process.cwd();
}

export function handleResourceRead(store: TrapStore, uri: string) {
  const parsed = parseResourceUri(uri);
  const scopedStore = storeForScopeContext(store, parsed.cwd);
  const operations = new TrapOperations(scopedStore);
  try {
    switch (parsed.baseUri) {
      case "codetrap://project/recent":
        return toMcpResourceJson(uri, toListJson(operations.listTraps({ scope: "project", limit: 10 })));
      case "codetrap://global/recent":
        return toMcpResourceJson(uri, toListJson(operations.listTraps({ scope: "global", limit: 10 })));
      case "codetrap://project/top":
        return toMcpResourceJson(uri, toListJson(operations.topTraps("project", 20)));
      case "codetrap://global/top":
        return toMcpResourceJson(uri, toListJson(operations.topTraps("global", 20)));
      default: {
        const match = parsed.baseUri.match(/^codetrap:\/\/(project|global)\/trap\/(\d+)$/);
        if (match) {
          const details = operations.getTrapDetails(Number.parseInt(match[2], 10), match[1]);
          return toMcpResourceJson(uri, details ? toTrapDetailsJson(details) : { error: "not found" });
        }
        return toMcpResourceText(uri, "Unknown resource");
      }
    }
  } catch (e: any) {
    return toMcpResourceText(uri, e instanceof Error ? e.message : String(e));
  }
}

function parseResourceUri(uri: string): { baseUri: string; cwd?: string } {
  try {
    const parsed = new URL(uri);
    return {
      baseUri: `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`,
      cwd: parsed.searchParams.get("cwd") ?? undefined,
    };
  } catch {
    return { baseUri: uri };
  }
}

export async function start(): Promise<void> {
  const store = new TrapStore(process.cwd());

  const server = new Server(
    { name: "codetrap", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as ToolArgs;
    return handleToolCall(store, name, args);
  });

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourceDefinitions,
  }));

  // Read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return handleResourceRead(store, request.params.uri);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
