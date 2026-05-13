import { start } from "./mcp/server";

start().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
