#!/usr/bin/env bun

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findProjectRoot } from "./lib/scope";
import { TrapStore } from "./lib/store";
import { run } from "./commands/router";

const args = process.argv.slice(2);

if (args.length === 0) {
  showHelp();
} else if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
  showHelp();
} else if (args[0] === "serve") {
  import("./mcp/server").then((m) => m.start());
} else if (args[0] === "web") {
  if (args.slice(1).some(isHelpArg)) {
    showWebHelp();
  } else {
    const { startWebServerFromArgs } = await import("./web/server");
    await startWebServerFromArgs(args.slice(1));
  }
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
  await run(args, store);
}

function isHelpArg(arg: string | undefined): boolean {
  return arg === "--help" || arg === "-h" || arg === "help";
}

function showHelp(): void {
  console.log("codetrap — capture coding pitfalls so AI doesn't repeat mistakes");
  console.log("");
  console.log("Commands:");
  console.log("  init                  Initialize .codetrap/ in current project");
  console.log("  add                   Add a trap (use --json for structured input)");
  console.log("  search <query>        Search traps by keyword/semantic/hybrid mode");
  console.log("  list [--category X]   List traps");
  console.log("  show <id>             Show trap details");
  console.log("  edit <id> --json '{}' Edit a trap");
  console.log("  delete <id>           Delete a trap");
  console.log("  add_trap_evidence     Attach evidence to a trap");
  console.log("  archive_trap          Archive a trap");
  console.log("  supersede_trap        Mark one trap as superseded by another");
  console.log("  embed                 Generate embeddings for semantic search");
  console.log("  session               Record implementation notes and capture candidate traps");
  console.log("  web                   Start local review and trap library console");
  console.log("  export                Export traps as JSON");
  console.log("  import <file.json>    Import traps from JSON");
  console.log("  stats                 Show statistics");
  console.log("  doctor                Diagnose scope, database, and embedding health");
  console.log("  repair-scope          Move mis-scoped project traps into the current project");
  console.log("  migrate-project       Move project traps between initialized projects");
  console.log("  serve                 Start MCP server (for Claude Code)");
  console.log("");
  console.log("Flags:");
  console.log("  --scope project|global  Filter by scope");
  console.log("  --category <name>       Filter by category");
  console.log("  --mode fts|semantic|hybrid  Search mode");
  console.log("  --status active|superseded|archived|all  Lifecycle filter");
  console.log("  --path <file>           Filter/boost traps scoped to a file path");
  console.log("  --module <name>         Filter/boost traps scoped to a module");
  console.log("  --owner <name>          Filter/boost traps scoped to an owner/team");
  console.log("  --source_type <type>    Evidence source: manual, conversation, commit, issue, test_failure, article");
  console.log("  --no-rerank             Disable query-aware search reranking");
  console.log("  --ranking-signals       Include search ranking diagnostics in JSON cards");
  console.log("  --batch-size <n>        Embedding generation batch size");
  console.log("  --project <path>        Project path for web console");
  console.log("  --host <host>           Host for web console (default 127.0.0.1)");
  console.log("  --port <n>              Port for web console (default 4737)");
  console.log("  --json                  JSON output for search/show/list/stats/doctor; JSON input for add/edit");
  console.log("  --output-json           JSON output for add/edit when --json is used as input");
  console.log("  --from-project-path <path>  Source project path for scope repair/migration");
  console.log("  --to-project-path <path>    Destination project path for scope repair/migration");
  console.log("  --dry-run|--apply       Preview or apply scope repair/migration");
}

function showWebHelp(): void {
  console.log("codetrap web — start the local review and trap library console");
  console.log("");
  console.log("Usage:");
  console.log("  codetrap web [--project <path>] [--host <host>] [--port <n>]");
  console.log("");
  console.log("Options:");
  console.log("  --project <path>  Project path to open in the web console");
  console.log("  --host <host>     Host to bind (default 127.0.0.1)");
  console.log("  --port <n>        Port to try first (default 4737; next free port is used if busy)");
  console.log("");
  console.log("Examples:");
  console.log("  codetrap web");
  console.log("  codetrap web --project /path/to/project --port 4789");
}
