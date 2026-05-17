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

type ToolArgs = Record<string, any>;

export async function handleToolCall(store: TrapStore, name: string, args: ToolArgs) {
  const scopedStore = storeForScopeContext(store, args.cwd);
  const operations = new TrapOperations(scopedStore);
  try {
    switch (name) {
      case "search_traps": {
        const cards = await operations.searchTrapCards({
          query: args.query,
          scope: args.scope,
          category: args.category,
          mode: args.mode,
          limit: args.limit ?? 20,
          status: args.status,
          path: args.path,
          module: args.module,
          owner: args.owner,
          rerank: args.rerank,
          includeRankingSignals: args.ranking_signals,
        });
        return toMcpTextJson(toMcpSearchJson(cards));
      }

      case "add_trap": {
        const result = operations.addTrap(args);
        return toMcpTextJson(result);
      }

      case "get_trap": {
        const result = operations.getTrapDetails(args.id, args.scope);
        if (!result) {
          return toMcpTextError("not found");
        }
        return toMcpTextJson(toTrapDetailsJson(result));
      }

      case "list_traps": {
        const groups = operations.listTraps({
          scope: args.scope,
          category: args.category,
          status: args.status,
          limit: args.limit ?? 50,
          path: args.path,
          module: args.module,
          owner: args.owner,
        });
        return toMcpTextJson(toListJson(groups));
      }

      case "update_trap": {
        const result = operations.updateTrap(args.id, args, args.scope);
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
        const stats = operations.getStats();
        return toMcpTextJson(toStatsJson(stats, operations.getEmbeddingStats()));
      }

      default:
        return toMcpTextError(`Unknown tool: ${name}`);
    }
  } catch (e: any) {
    return toMcpTextError(e instanceof Error ? e.message : String(e));
  }
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
