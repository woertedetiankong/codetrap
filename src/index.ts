#!/usr/bin/env bun

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ensureProjectIdentity } from "./lib/project-identity";
import { findProjectRoot } from "./lib/scope";
import { resolveScopePath } from "./lib/scope-path";
import { TrapStore } from "./lib/store";
import { CODETRAP_VERSION } from "./lib/version";
import { executeCommand } from "./commands/workflow";
import { renderCommandResult } from "./commands/command-result";

const args = process.argv.slice(2);

if (args.length === 0) {
  showHelp();
} else if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
  showHelp();
} else if (args[0] === "--version" || args[0] === "-v" || args[0] === "version") {
  console.log(CODETRAP_VERSION);
} else if (args[0] === "serve") {
  if (args.slice(1).some(isHelpArg)) {
    showServeHelp();
  } else {
    // L8: await + catch so a failed MCP startup exits non-zero instead of
    // rejecting an unhandled promise.
    await import("./mcp/server")
      .then((m) => m.start())
      .catch((error) => {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      });
  }
} else if (args[0] === "web") {
  if (args.slice(1).some(isHelpArg)) {
    showWebHelp();
  } else {
    const { startWebServerFromArgs } = await import("./web/server");
    await startWebServerFromArgs(args.slice(1));
  }
} else if (args[0] === "init") {
  const cwd = process.cwd();
  if (resolveScopePath(cwd) === resolveScopePath(homedir())) {
    // L18: `.codetrap` in $HOME *is* the global store, so an init there creates
    // a dir that every project command then ignores. Refuse with guidance.
    console.error(
      "Error: refusing to run 'init' in your home directory — ~/.codetrap is the global trap store, not a project. cd into a project directory first."
    );
    process.exit(1);
  } else {
    const existingRoot = findProjectRoot(cwd);
    if (existingRoot) {
      // A1: lazily mint an identity for projects created before A1 shipped.
      const identity = ensureProjectIdentity(existingRoot);
      console.log("Project already initialized.");
      console.log(`Project id: ${identity.id}`);
    } else {
      const dir = join(cwd, ".codetrap");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const identity = ensureProjectIdentity(cwd);
      console.log(`Initialized .codetrap/ in ${cwd}`);
      console.log(`Project id: ${identity.id}`);
    }
  }
} else {
  try {
    const store = new TrapStore(process.cwd());
    renderCommandResult(await executeCommand(args, store));
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function isHelpArg(arg: string | undefined): boolean {
  return arg === "--help" || arg === "-h" || arg === "help";
}

function showHelp(): void {
  console.log("codetrap — capture coding pitfalls so AI doesn't repeat mistakes");
  console.log("");
  console.log("Commands:");
  console.log("  init                  Initialize .codetrap/ in current project");
  console.log("  add                   Add a trap (use --input-json for structured input)");
  console.log("  search <query>        Search traps by keyword/semantic/hybrid mode");
  console.log("  list [--category X]   List traps");
  console.log("  show <id>             Show trap details");
  console.log("  edit <id> --input-json '{}'  Edit a trap");
  console.log("  delete <id>           Delete a trap");
  console.log("  add_trap_evidence     Attach evidence to a trap");
  console.log("  archive_trap          Archive a trap");
  console.log("  supersede_trap        Mark one trap as superseded by another");
  console.log("  embed                 Generate embeddings for semantic search (Ollama or Jina)");
  console.log("  embeddings            Manage embedding profiles, provider config, and reindexing");
  console.log("  session               Record implementation notes and capture candidate traps");
  console.log("  phase2                Manage authorized patches, insights, currency, and learning metrics");
  console.log("  web                   Start local review and trap library console");
  console.log("  export                Export traps as JSON");
  console.log("  import <file.json>    Import traps from JSON");
  console.log("  stats                 Show statistics");
  console.log("  doctor                Diagnose scope, database, and embedding health");
  console.log("  setup codex           Install Codex skills and AGENTS.md guidance (MCP opt-in)");
  console.log("  setup claude          Install Claude Code skills and CLAUDE.md guidance (MCP opt-in)");
  console.log("  repair-scope          Move mis-scoped project traps into the current project");
  console.log("  migrate-project       Move project traps between initialized projects");
  console.log("  serve                 Start MCP server (for Claude Code)");
  console.log("");
  console.log("  --version, -v         Print the codetrap version");
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
  console.log("  --json                  JSON output (all commands); errors become { success: false, error }");
  console.log("  --input-json <json>     JSON input for add/edit/add_trap_evidence");
  console.log("  --output-json           Alias for --json output (kept for compatibility)");
  console.log("  --from-project-path <path>  Source project path for scope repair/migration");
  console.log("  --to-project-path <path>    Destination project path for scope repair/migration");
  console.log("  --dry-run|--apply       Preview setup/scope migration, or apply scope migration");
  console.log("  --mcp                  With setup, also run: <codex|claude> mcp add codetrap -- codetrap serve");
  console.log("  --codex-home <path>    With setup codex, override CODEX_HOME/default ~/.codex");
  console.log("  --claude-home <path>   With setup claude, override CLAUDE_CONFIG_DIR/default ~/.claude");
  console.log("  --agents-file <path>   With setup, choose the guidance file target (AGENTS.md / CLAUDE.md)");
  console.log("  --no-agents            With setup, install skills without editing the guidance file");
}

function showServeHelp(): void {
  console.log("codetrap serve — start the MCP server (stdio transport, for Claude Code / Codex)");
  console.log("");
  console.log("Usage:");
  console.log("  codetrap serve");
  console.log("");
  console.log("Wire it into an MCP client, e.g.: codex mcp add codetrap -- codetrap serve");
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
