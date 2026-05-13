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
import { buildTrapInput, pickTrapUpdate } from "../domain/trap";

type ToolArgs = Record<string, any>;

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
    try {
      switch (name) {
        case "search_traps": {
          const results = store.search(args.query, {
            scope: args.scope,
            category: args.category,
            limit: args.limit ?? 20,
          });
          const flat = results.flatMap((g) =>
            g.results.map((r) => ({
              ...r.trap,
              scope: g.scope,
              rank: r.rank,
            }))
          );
          return { content: [{ type: "text", text: JSON.stringify(flat, null, 2) }] };
        }

        case "add_trap": {
          const result = store.add(buildTrapInput(args));
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }

        case "get_trap": {
          const result = store.get(args.id, args.scope);
          if (!result) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "not found" }) }], isError: true };
          }
          return { content: [{ type: "text", text: JSON.stringify({ ...result.trap, scope: result.scope }, null, 2) }] };
        }

        case "list_traps": {
          const groups = store.list({
            scope: args.scope,
            category: args.category,
            limit: args.limit ?? 50,
          });
          const flat = groups.flatMap((g) =>
            g.traps.map((t) => ({ ...t, scope: g.scope }))
          );
          return { content: [{ type: "text", text: JSON.stringify(flat, null, 2) }] };
        }

        case "update_trap": {
          const result = store.update(args.id, pickTrapUpdate(args), args.scope);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }

        case "delete_trap": {
          const result = store.delete(args.id, args.scope);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }

        case "get_stats": {
          const stats = store.stats();
          const out: Record<string, unknown> = { global: stats.global };
          if (stats.project) out.project = stats.project;
          return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
        }

        default:
          return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }
    } catch (e: any) {
      return { content: [{ type: "text", text: e.message }], isError: true };
    }
  });

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourceDefinitions,
  }));

  // Read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    try {
      switch (uri) {
        case "codetrap://project/recent": {
          const groups = store.list({ scope: "project", limit: 10 });
          const traps = groups.flatMap((g) => g.traps);
          return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(traps, null, 2) }] };
        }
        case "codetrap://global/recent": {
          const groups = store.list({ scope: "global", limit: 10 });
          const traps = groups.flatMap((g) => g.traps);
          return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(traps, null, 2) }] };
        }
        case "codetrap://project/top": {
          const traps = store.topTraps("project", 20);
          return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(traps, null, 2) }] };
        }
        case "codetrap://global/top": {
          const traps = store.topTraps("global", 20);
          return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(traps, null, 2) }] };
        }
        default: {
          // Handle codetrap://{scope}/trap/{id}
          const match = uri.match(/^codetrap:\/\/(project|global)\/trap\/(\d+)$/);
          if (match) {
            const result = store.get(parseInt(match[2]), match[1]);
            if (!result) {
              return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ error: "not found" }) }] };
            }
            return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(result.trap, null, 2) }] };
          }
          return { contents: [{ uri, mimeType: "text/plain", text: "Unknown resource" }] };
        }
      }
    } catch (e: any) {
      return { contents: [{ uri, mimeType: "text/plain", text: e.message }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
