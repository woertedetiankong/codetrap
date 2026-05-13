import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findProjectRoot } from "./lib/scope";
import { TrapStore } from "./lib/store";
import { run } from "./commands/router";

const args = process.argv.slice(2);

if (args.length === 0) {
  showHelp();
} else if (args[0] === "serve") {
  import("./mcp/server").then((m) => m.start());
} else if (args[0] === "init") {
  const cwd = process.cwd();
  if (findProjectRoot(cwd)) {
    console.log("Project already initialized.");
  } else {
    const dir = join(cwd, ".codetrap");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    console.log(`Initialized .codetrap/ in ${cwd}`);
  }
} else {
  const store = new TrapStore(process.cwd());
  run(args, store);
}

function showHelp(): void {
  console.log("codetrap — capture coding pitfalls so AI doesn't repeat mistakes");
  console.log("");
  console.log("Commands:");
  console.log("  init                  Initialize .codetrap/ in current project");
  console.log("  add                   Add a trap (use --json for structured input)");
  console.log("  search <query>        Search traps by keyword");
  console.log("  list [--category X]   List traps");
  console.log("  show <id>             Show trap details");
  console.log("  edit <id> --json '{}' Edit a trap");
  console.log("  delete <id>           Delete a trap");
  console.log("  export                Export traps as JSON");
  console.log("  import <file.json>    Import traps from JSON");
  console.log("  stats                 Show statistics");
  console.log("  serve                 Start MCP server (for Claude Code)");
  console.log("");
  console.log("Flags:");
  console.log("  --scope project|global  Filter by scope");
  console.log("  --category <name>       Filter by category");
  console.log("  --json '{}'             JSON input for add/edit");
}
