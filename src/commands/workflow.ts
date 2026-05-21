import { readFileSync } from "node:fs";
import { TrapStore } from "../lib/store";
import { formatTrapShort, formatTrapDetails, formatTrapActionCard } from "../lib/format";
import type { Trap } from "../domain/trap";
import {
  formatScopeMigrationText,
  runScopeMigration,
  type ScopeMigrationCommand,
} from "../lib/scope-migration";
import { TrapOperations } from "../lib/trap-operations";
import { buildDoctorReport, formatDoctorText } from "../lib/doctor";
import { searchDefaultsFromConfig } from "../lib/config";
import {
  toCliSearchJson,
  toListJson,
  toStatsJson,
  toTrapDetailsJson,
} from "../lib/output-json";
import {
  errorResult,
  jsonResult,
  textResult,
  type CommandResult,
} from "./command-result";
import { mutationJsonPayload } from "../lib/trap-mutation-result";
import {
  embedRequestFromArgs,
  evidenceRequestFromArgs,
  listRequestFromArgs,
  searchRequestFromArgs,
  statsRequestFromArgs,
} from "../lib/command-requests";

type ParsedArgs = {
  opts: Record<string, string>;
  positionals: string[];
};

export async function executeCommand(strip: string[], store: TrapStore): Promise<CommandResult> {
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
    case "doctor":
      return cmdDoctor(args, store, operations);
    case "repair-scope":
      return cmdScopeMigration("repair-scope", args, operations);
    case "migrate-project":
      return cmdScopeMigration("migrate-project", args, operations);
    case "embed":
      return cmdEmbed(args, store);
    default:
      return errorResult([
        `Unknown command: ${sub}`,
        "Commands: init, add, search, list, show, edit, delete, add_trap_evidence, archive_trap, supersede_trap, export, import, stats, doctor, repair-scope, migrate-project, embed",
      ].join("\n"));
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

function cmdInit(_args: string[], store: TrapStore): CommandResult {
  if (store.hasProject()) {
    return textResult(`Already in a project: ${store.getProjectRoot()}`);
  }
  return textResult("Project initialized.");
}

function cmdAdd(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  if (opts.json !== undefined) {
    if (!opts.json || opts.json === "true") {
      return errorResult("Error: --json requires a JSON string argument");
    }
    try {
      const result = operations.addTrap(JSON.parse(opts.json));
      return opts["output-json"] !== undefined
        ? jsonResult(result)
        : textResult(`Trap #${result.id} added to ${result.scope} scope.`);
    } catch (error) {
      return errorFrom(error);
    }
  }

  if (positionals.length > 0) {
    return textResult([
      "Use --json mode for structured input.",
      `Quick add: codetrap add --json '{"title":"${positionals.join(" ")}","category":"other","scope":"global","context":"...","mistake":"...","fix":"..."}'`,
    ].join("\n"));
  }

  return textResult([
    "Interactive mode not yet implemented. Use --json for now.",
    'Example: codetrap add --json \'{"title":"...","category":"convention","scope":"project","context":"...","mistake":"...","fix":"..."}\'',
  ].join("\n"));
}

async function cmdSearch(args: string[], operations: TrapOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const query = readQuery(positionals);
  if (!query) {
    return errorResult("Usage: codetrap search <query> [--category X] [--limit N] [--mode fts|semantic|hybrid] [--status active|superseded|archived|all] [--path file] [--module name] [--owner name] [--json]");
  }

  try {
    const defaults = searchDefaultsFromConfig();
    const cards = await operations.searchTrapCards(searchRequestFromArgs(query, opts, defaults));
    if (opts.json !== undefined) return jsonResult(toCliSearchJson(cards));
    return textResult(cards.length > 0 ? cards.map(formatTrapActionCard).join("\n\n") : "No traps found.");
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdList(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  try {
    const groups = operations.listTraps(listRequestFromArgs(opts));
    if (opts.json !== undefined) return jsonResult(toListJson(groups));

    const lines = groups.flatMap((group) =>
      group.traps.map((trap) => formatTrapShort(trap, group.scope))
    );
    return textResult(lines.length > 0 ? lines.join("\n") : "No traps found.");
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdShow(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap show <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.getTrapDetails(id, opts.scope);
  if (!result) return errorResult(`Trap #${id} not found.`);

  operations.hitTrap(id, result.scope);
  return opts.json !== undefined
    ? jsonResult(toTrapDetailsJson(result))
    : textResult(formatTrapDetails(result));
}

function cmdEdit(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap edit <id> --json '{\"title\":\"new title\"}' [--scope project|global]");
  if (typeof id !== "number") return id;

  if (!opts.json) {
    return errorResult([
      "Error: edit requires --json for now.",
      "Example: codetrap edit 1 --json '{\"title\":\"new title\"}' [--scope project|global]",
    ].join("\n"));
  }

  try {
    const result = operations.updateTrap(id, JSON.parse(opts.json), opts.scope);
    if (!result.success) return errorResult(`Trap #${id} not found or no fields changed.`);
    return opts["output-json"] !== undefined
      ? jsonResult({ id, ...result })
      : textResult(`Trap #${id} updated in ${result.scope} scope.`);
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdDelete(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap delete <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.deleteTrap(id, opts.scope);
  if (opts.json !== undefined) {
    return mutationJsonResult({ id, ...result }, `Trap #${id} not found.`);
  }
  return result.success
    ? textResult(`Trap #${id} deleted from ${result.scope} scope.`)
    : errorResult(`Trap #${id} not found.`);
}

function cmdAddTrapEvidence(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(
    positionals[0],
    "Usage: codetrap add_trap_evidence <id> --source_type manual|conversation|commit|issue|test_failure|article [--scope project|global] [--source_ref X] [--related_files a,b] [--note X]"
  );
  if (typeof id !== "number") return id;

  try {
    const input = opts.json ? JSON.parse(opts.json) : evidenceRequestFromArgs(opts);
    const result = operations.addTrapEvidence(id, input, opts.scope);
    if (opts["output-json"] !== undefined) {
      return mutationJsonResult({ id, ...result }, `Trap #${id} not found.`);
    }
    return result.success
      ? textResult(`Evidence #${result.evidence_id} added to trap #${id} in ${result.scope} scope.`)
      : errorResult(`Trap #${id} not found.`);
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdArchiveTrap(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap archive_trap <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.archiveTrap(id, opts.scope);
  if (opts.json !== undefined) {
    return mutationJsonResult({ id, ...result, status: result.success ? "archived" : undefined }, `Trap #${id} not found.`);
  }
  return result.success
    ? textResult(`Trap #${id} archived in ${result.scope} scope.`)
    : errorResult(`Trap #${id} not found.`);
}

function cmdSupersedeTrap(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length < 2) {
    return errorResult("Usage: codetrap supersede_trap <old_id> <new_id> [--scope project|global] [--state_key key] [--json]");
  }
  const id = Number.parseInt(positionals[0], 10);
  const supersededById = Number.parseInt(positionals[1], 10);
  if (Number.isNaN(id) || Number.isNaN(supersededById)) {
    return errorResult("Error: ids must be numbers");
  }

  const result = operations.supersedeTrap(id, supersededById, opts.scope, opts.state_key ?? opts["state-key"]);
  if (opts.json !== undefined) {
    return mutationJsonResult(
      { id, superseded_by_id: supersededById, ...result },
      `Trap #${id} or #${supersededById} not found in the same scope.`
    );
  }
  return result.success
    ? textResult(`Trap #${id} superseded by #${supersededById} in ${result.scope} scope.`)
    : errorResult(`Trap #${id} or #${supersededById} not found in the same scope.`);
}

function cmdExport(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  return jsonResult(operations.exportTraps(opts.scope));
}

function cmdImport(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) return errorResult("Usage: codetrap import <file.json>");

  try {
    const traps = JSON.parse(readFileSync(positionals[0], "utf-8"));
    if (!Array.isArray(traps)) {
      const message = "Error: JSON file must contain an array of traps";
      return opts.json !== undefined ? jsonResult({ success: false, error: message }, 1) : errorResult(message);
    }
    const imported = operations.importTraps(traps);
    return opts.json !== undefined
      ? jsonResult({ imported, success: true })
      : textResult(`Imported ${imported} traps.`);
  } catch (error) {
    if (opts.json !== undefined) {
      return jsonResult({ success: false, error: errorMessage(error) }, 1);
    }
    return errorFrom(error);
  }
}

function cmdStats(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  const request = statsRequestFromArgs(opts);
  const stats = operations.getStats(request.scope);
  const embeddingStats = operations.getEmbeddingStats(request.scope);
  return opts.json !== undefined
    ? jsonResult(toStatsJson(stats, embeddingStats))
    : textResult(formatStatsText(stats));
}

function cmdDoctor(args: string[], store: TrapStore, operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  const report = buildDoctorReport(store, operations);
  return opts.json !== undefined
    ? jsonResult(report)
    : textResult(formatDoctorText(report));
}

function cmdScopeMigration(
  command: ScopeMigrationCommand,
  args: string[],
  operations: TrapOperations
): CommandResult {
  const { opts } = parseArgs(args);
  if (opts.apply !== undefined && opts["dry-run"] !== undefined) {
    return errorResult("Error: choose either --dry-run or --apply, not both.");
  }
  if (command === "migrate-project" && (!opts["from-project-path"] || !opts["to-project-path"])) {
    return errorResult("Usage: codetrap migrate-project --from-project-path <path> --to-project-path <path> [--dry-run|--apply] [--json]");
  }

  try {
    const result = runScopeMigration({
      command,
      fromProjectPath: opts["from-project-path"],
      toProjectPath: opts["to-project-path"],
      apply: opts.apply !== undefined,
      cwd: process.cwd(),
    });
    return opts.json !== undefined
      ? jsonResult(result)
      : textResult(formatScopeMigrationText(result));
  } catch (error) {
    return errorFrom(error);
  }
}

async function cmdEmbed(args: string[], store: TrapStore): Promise<CommandResult> {
  const { opts } = parseArgs(args);
  try {
    const result = await store.ensureEmbeddings(embedRequestFromArgs(opts));
    return textResult([
      ...result.scopes.map((scoped) =>
        `[${scoped.scope}] embeddings generated: ${scoped.generated}, skipped: ${scoped.skipped}, batches: ${scoped.batches}`
      ),
      `Total generated: ${result.generated}, skipped: ${result.skipped}, batches: ${result.batches}`,
    ].join("\n"));
  } catch (error) {
    return errorFrom(error);
  }
}

function formatStatsText(stats: ReturnType<TrapOperations["getStats"]>): string {
  const sections: string[] = [];
  if (stats.project) {
    sections.push("── Project ──", formatStatsBlock(stats.project));
  }
  if (stats.global) {
    sections.push("── Global ──", formatStatsBlock(stats.global));
  }
  return sections.join("\n");
}

function formatStatsBlock(stats: { total: number; byCategory: Record<string, number>; bySeverity: Record<string, number> }): string {
  return [
    `  Total: ${stats.total}`,
    "  By category:",
    ...Object.entries(stats.byCategory).map(([category, count]) => `    ${category}: ${count}`),
    "  By severity:",
    ...Object.entries(stats.bySeverity).map(([severity, count]) => `    ${severity}: ${count}`),
  ].join("\n");
}

function parseId(value: string | undefined, usage: string): number | CommandResult {
  if (value === undefined) return errorResult(usage);
  const id = Number.parseInt(value, 10);
  return Number.isNaN(id) ? errorResult("Error: id must be a number") : id;
}

function readQuery(positionals: string[]): string {
  if (positionals.length > 0) return positionals.join(" ").trim();
  if (process.stdin.isTTY) return "";
  return readFileSync(0, "utf-8").trim();
}

function mutationJsonResult<T extends Record<string, unknown> & { success: boolean }>(
  value: T,
  error: string
): CommandResult {
  return jsonResult(mutationJsonPayload(value, error), value.success ? 0 : 1);
}

function errorFrom(error: unknown): CommandResult {
  return errorResult(`Error: ${errorMessage(error)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
