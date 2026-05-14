import { readFileSync } from "node:fs";
import { TrapStore } from "../lib/store";
import { formatTrapShort, formatTrapDetail } from "../lib/format";
import { pickTrapUpdate, type TrapSearchResult } from "../domain/trap";
import { SEARCH_MODES, type SearchMode } from "../lib/constants";

type ParsedArgs = {
  opts: Record<string, string>;
  positionals: string[];
};

export async function run(strip: string[], store: TrapStore): Promise<void> {
  const sub = strip[0];
  const args = strip.slice(1);

  switch (sub) {
    case "add":
      return cmdAdd(args, store);
    case "search":
      return cmdSearch(args, store);
    case "list":
      return cmdList(args, store);
    case "show":
      return cmdShow(args, store);
    case "edit":
      return cmdEdit(args, store);
    case "delete":
    case "rm":
      return cmdDelete(args, store);
    case "init":
      return cmdInit(args, store);
    case "export":
      return cmdExport(args, store);
    case "import":
      return cmdImport(args, store);
    case "stats":
      return cmdStats(args, store);
    case "embed":
      return cmdEmbed(args, store);
    default:
      console.log(`Unknown command: ${sub}`);
      console.log("Commands: init, add, search, list, show, edit, delete, export, import, stats, embed");
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

function cmdAdd(args: string[], store: TrapStore): void {
  const { opts, positionals } = parseArgs(args);
  // --json mode for AI/script usage
  if (opts.json !== undefined) {
    if (!opts.json || opts.json === "true") {
      console.error("Error: --json requires a JSON string argument");
      process.exit(1);
    }
    try {
      const input = JSON.parse(opts.json);
      const result = store.add(input);
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

async function cmdSearch(args: string[], store: TrapStore): Promise<void> {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) {
    console.error("Usage: codetrap search <query> [--category X] [--limit N] [--mode fts|semantic|hybrid]");
    process.exit(1);
  }
  let results: { results: TrapSearchResult[]; scope: string }[];
  try {
    const mode = opts.mode ? parseSearchMode(opts.mode) : undefined;
    results = await store.search(positionals.join(" "), {
      category: opts.category,
      scope: opts.scope,
      limit: opts.limit ? parseInt(opts.limit) : 20,
      mode,
    });
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  let count = 0;
  for (const group of results) {
    for (const r of group.results) {
      console.log(formatTrapShort(r.trap, group.scope));
      count++;
    }
  }
  if (count === 0) console.log("No traps found.");
}

function cmdList(args: string[], store: TrapStore): void {
  const { opts } = parseArgs(args);

  const groups = store.list({
    category: opts.category,
    scope: opts.scope,
    limit: opts.limit ? parseInt(opts.limit) : 50,
  });

  let count = 0;
  for (const group of groups) {
    for (const t of group.traps) {
      console.log(formatTrapShort(t, group.scope));
      count++;
    }
  }
  if (count === 0) console.log("No traps found.");
}

function cmdShow(args: string[], store: TrapStore): void {
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

  const result = store.get(id, opts.scope);
  if (!result) {
    console.error(`Trap #${id} not found.`);
    process.exit(1);
  }

  store.hit(id, result.scope);
  console.log(formatTrapDetail(result.trap, result.scope));
}

function cmdEdit(args: string[], store: TrapStore): void {
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
    const update = pickTrapUpdate(parsed);
    const result = store.update(id, update, opts.scope);
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

function cmdDelete(args: string[], store: TrapStore): void {
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

  const result = store.delete(id, opts.scope);
  if (result.success) {
    console.log(`Trap #${id} deleted from ${result.scope} scope.`);
  } else {
    console.error(`Trap #${id} not found.`);
    process.exit(1);
  }
}

function cmdExport(args: string[], store: TrapStore): void {
  const { opts } = parseArgs(args);
  const traps = store.exportAll({ scope: opts.scope });
  console.log(JSON.stringify(traps, null, 2));
}

function cmdImport(args: string[], store: TrapStore): void {
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

  const count = store.importAll(traps);
  console.log(`Imported ${count} traps.`);
}

function cmdStats(_args: string[], store: TrapStore): void {
  const stats = store.stats();

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
