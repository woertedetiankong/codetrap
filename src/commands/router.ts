import { readFileSync } from "node:fs";
import { TrapStore } from "../lib/store";
import { formatTrapShort, formatTrapDetails, formatTrapActionCard } from "../lib/format";
import type { Trap } from "../domain/trap";
import { SEARCH_MODES, type SearchMode } from "../lib/constants";
import { TrapOperations } from "../lib/trap-operations";

type ParsedArgs = {
  opts: Record<string, string>;
  positionals: string[];
};

export async function run(strip: string[], store: TrapStore): Promise<void> {
  const sub = strip[0];
  const args = strip.slice(1);
  const operations = new TrapOperations(store);

  switch (sub) {
    case "add":
      return cmdAdd(args, operations);
    case "search":
      return cmdSearch(args, operations);
    case "list":
      return cmdList(args, operations);
    case "show":
      return cmdShow(args, operations);
    case "edit":
      return cmdEdit(args, operations);
    case "delete":
    case "rm":
      return cmdDelete(args, operations);
    case "add_trap_evidence":
    case "add-evidence":
      return cmdAddTrapEvidence(args, operations);
    case "archive_trap":
    case "archive":
      return cmdArchiveTrap(args, operations);
    case "supersede_trap":
    case "supersede":
      return cmdSupersedeTrap(args, operations);
    case "init":
      return cmdInit(args, store);
    case "export":
      return cmdExport(args, operations);
    case "import":
      return cmdImport(args, operations);
    case "stats":
      return cmdStats(args, operations);
    case "embed":
      return cmdEmbed(args, store);
    default:
      console.log(`Unknown command: ${sub}`);
      console.log("Commands: init, add, search, list, show, edit, delete, add_trap_evidence, archive_trap, supersede_trap, export, import, stats, embed");
      process.exit(1);
  }
}

export function parseArgs(args: string[]): ParsedArgs {
  const opts: Record<string, string> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      opts[key] = val;
    } else {
      positionals.push(args[i]);
    }
  }
  return { opts, positionals };
}

// ---- commands ----

function cmdInit(_args: string[], store: TrapStore): void {
  if (store.hasProject()) {
    console.log(`Already in a project: ${store.getProjectRoot()}`);
    return;
  }
  // init is handled by index.ts before creating the store
  console.log("Project initialized.");
}

function cmdAdd(args: string[], operations: TrapOperations): void {
  const { opts, positionals } = parseArgs(args);
  // --json mode for AI/script usage
  if (opts.json !== undefined) {
    if (!opts.json || opts.json === "true") {
      console.error("Error: --json requires a JSON string argument");
      process.exit(1);
    }
    try {
      const input = JSON.parse(opts.json);
      const result = operations.addTrap(input);
      console.log(`Trap #${result.id} added to ${result.scope} scope.`);
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  // Quick mode: codetrap add "title"
  if (positionals.length > 0) {
    console.log(`Use --json mode for structured input.`);
    console.log(`Quick add: codetrap add --json '{"title":"${positionals.join(" ")}","category":"other","scope":"global","context":"...","mistake":"...","fix":"..."}'`);
    return;
  }

  // Interactive mode
  console.log("Interactive mode not yet implemented. Use --json for now.");
  console.log('Example: codetrap add --json \'{"title":"...","category":"convention","scope":"project","context":"...","mistake":"...","fix":"..."}\'');
}

async function cmdSearch(args: string[], operations: TrapOperations): Promise<void> {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) {
    console.error("Usage: codetrap search <query> [--category X] [--limit N] [--mode fts|semantic|hybrid] [--status active|superseded|archived|all]");
    process.exit(1);
  }
  let cards: Awaited<ReturnType<TrapOperations["searchTrapCards"]>>;
  try {
    const mode = opts.mode ? parseSearchMode(opts.mode) : undefined;
    cards = await operations.searchTrapCards({
      query: positionals.join(" "),
      category: opts.category,
      scope: opts.scope,
      limit: opts.limit ? parseInt(opts.limit) : 20,
      mode,
      status: opts.status,
    });
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  let count = 0;
  for (const card of cards) {
    console.log(formatTrapActionCard(card));
    console.log("");
    count++;
  }
  if (count === 0) console.log("No traps found.");
}

function cmdList(args: string[], operations: TrapOperations): void {
  const { opts } = parseArgs(args);

  let groups: { traps: Trap[]; scope: string }[];
  try {
    groups = operations.listTraps({
      category: opts.category,
      scope: opts.scope,
      status: opts.status,
      limit: opts.limit ? parseInt(opts.limit) : 50,
    });
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  let count = 0;
  for (const group of groups) {
    for (const t of group.traps) {
      console.log(formatTrapShort(t, group.scope));
      count++;
    }
  }
  if (count === 0) console.log("No traps found.");
}

function cmdShow(args: string[], operations: TrapOperations): void {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) {
    console.error("Usage: codetrap show <id> [--scope project|global]");
    process.exit(1);
  }

  const id = parseInt(positionals[0]);
  if (isNaN(id)) {
    console.error("Error: id must be a number");
    process.exit(1);
  }

  const result = operations.getTrapDetails(id, opts.scope);
  if (!result) {
    console.error(`Trap #${id} not found.`);
    process.exit(1);
  }

  operations.hitTrap(id, result.scope);
  console.log(formatTrapDetails(result));
}

function cmdEdit(args: string[], operations: TrapOperations): void {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) {
    console.error("Usage: codetrap edit <id> --json '{\"title\":\"new title\"}' [--scope project|global]");
    process.exit(1);
  }

  const id = parseInt(positionals[0]);
  if (isNaN(id)) {
    console.error("Error: id must be a number");
    process.exit(1);
  }

  if (!opts.json) {
    console.error("Error: edit requires --json for now.");
    console.error("Example: codetrap edit 1 --json '{\"title\":\"new title\"}' [--scope project|global]");
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(opts.json);
    const result = operations.updateTrap(id, parsed, opts.scope);
    if (result.success) {
      console.log(`Trap #${id} updated in ${result.scope} scope.`);
    } else {
      console.error(`Trap #${id} not found or no fields changed.`);
      process.exit(1);
    }
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

function cmdDelete(args: string[], operations: TrapOperations): void {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) {
    console.error("Usage: codetrap delete <id> [--scope project|global]");
    process.exit(1);
  }

  const id = parseInt(positionals[0]);
  if (isNaN(id)) {
    console.error("Error: id must be a number");
    process.exit(1);
  }

  const result = operations.deleteTrap(id, opts.scope);
  if (result.success) {
    console.log(`Trap #${id} deleted from ${result.scope} scope.`);
  } else {
    console.error(`Trap #${id} not found.`);
    process.exit(1);
  }
}

function cmdAddTrapEvidence(args: string[], operations: TrapOperations): void {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) {
    console.error("Usage: codetrap add_trap_evidence <id> --source_type manual|conversation|commit|issue|test_failure [--scope project|global] [--source_ref X] [--related_files a,b] [--note X]");
    process.exit(1);
  }

  const id = parseInt(positionals[0]);
  if (isNaN(id)) {
    console.error("Error: id must be a number");
    process.exit(1);
  }

  try {
    const input = opts.json ? JSON.parse(opts.json) : {
      source_type: opts.source_type ?? opts["source-type"],
      source_ref: opts.source_ref ?? opts["source-ref"],
      observed_at: opts.observed_at ?? opts["observed-at"],
      related_files: parseCsv(opts.related_files ?? opts["related-files"]),
      note: opts.note,
    };
    const result = operations.addTrapEvidence(id, input, opts.scope);
    if (!result.success) {
      console.error(`Trap #${id} not found.`);
      process.exit(1);
    }
    console.log(`Evidence #${result.evidence_id} added to trap #${id} in ${result.scope} scope.`);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

function cmdArchiveTrap(args: string[], operations: TrapOperations): void {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) {
    console.error("Usage: codetrap archive_trap <id> [--scope project|global]");
    process.exit(1);
  }

  const id = parseInt(positionals[0]);
  if (isNaN(id)) {
    console.error("Error: id must be a number");
    process.exit(1);
  }

  const result = operations.archiveTrap(id, opts.scope);
  if (result.success) {
    console.log(`Trap #${id} archived in ${result.scope} scope.`);
  } else {
    console.error(`Trap #${id} not found.`);
    process.exit(1);
  }
}

function cmdSupersedeTrap(args: string[], operations: TrapOperations): void {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length < 2) {
    console.error("Usage: codetrap supersede_trap <old_id> <new_id> [--scope project|global] [--state_key key]");
    process.exit(1);
  }

  const id = parseInt(positionals[0]);
  const supersededById = parseInt(positionals[1]);
  if (isNaN(id) || isNaN(supersededById)) {
    console.error("Error: ids must be numbers");
    process.exit(1);
  }

  const result = operations.supersedeTrap(id, supersededById, opts.scope, opts.state_key ?? opts["state-key"]);
  if (result.success) {
    console.log(`Trap #${id} superseded by #${supersededById} in ${result.scope} scope.`);
  } else {
    console.error(`Trap #${id} or #${supersededById} not found in the same scope.`);
    process.exit(1);
  }
}

function cmdExport(args: string[], operations: TrapOperations): void {
  const { opts } = parseArgs(args);
  const traps = operations.exportTraps(opts.scope);
  console.log(JSON.stringify(traps, null, 2));
}

function cmdImport(args: string[], operations: TrapOperations): void {
  const { positionals } = parseArgs(args);
  if (positionals.length === 0) {
    console.error("Usage: codetrap import <file.json>");
    process.exit(1);
  }

  const data = readFileSync(positionals[0], "utf-8");
  const traps = JSON.parse(data);
  if (!Array.isArray(traps)) {
    console.error("Error: JSON file must contain an array of traps");
    process.exit(1);
  }

  const count = operations.importTraps(traps);
  console.log(`Imported ${count} traps.`);
}

function cmdStats(_args: string[], operations: TrapOperations): void {
  const stats = operations.getStats();

  if (stats.project) {
    console.log("── Project ──");
    printStats(stats.project);
  }
  console.log("── Global ──");
  printStats(stats.global);
}

async function cmdEmbed(args: string[], store: TrapStore): Promise<void> {
  const { opts } = parseArgs(args);
  try {
    const result = await store.ensureEmbeddings({
      scope: opts.scope,
      category: opts.category,
      limit: opts.limit ? parseInt(opts.limit) : undefined,
      force: opts.force === "true",
      batchSize: opts["batch-size"] ? parseInt(opts["batch-size"]) : undefined,
    });
    for (const scoped of result.scopes) {
      console.log(`[${scoped.scope}] embeddings generated: ${scoped.generated}, skipped: ${scoped.skipped}, batches: ${scoped.batches}`);
    }
    console.log(`Total generated: ${result.generated}, skipped: ${result.skipped}, batches: ${result.batches}`);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

function printStats(s: { total: number; byCategory: Record<string, number>; bySeverity: Record<string, number> }): void {
  console.log(`  Total: ${s.total}`);
  console.log("  By category:");
  for (const [cat, count] of Object.entries(s.byCategory)) {
    console.log(`    ${cat}: ${count}`);
  }
  console.log("  By severity:");
  for (const [sev, count] of Object.entries(s.bySeverity)) {
    console.log(`    ${sev}: ${count}`);
  }
}

function parseSearchMode(mode: string): SearchMode {
  if ((SEARCH_MODES as readonly string[]).includes(mode)) return mode as SearchMode;
  throw new Error(`Invalid search mode: ${mode}. Expected one of: ${SEARCH_MODES.join(", ")}`);
}

function parseCsv(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
