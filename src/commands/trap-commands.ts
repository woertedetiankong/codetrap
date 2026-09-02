import { readFileSync } from "node:fs";
import type { TrapOperations } from "../lib/trap-operations";
import { formatTrapShort, formatTrapDetails, formatTrapActionCard } from "../lib/format";
import { searchDefaultsFromConfig } from "../lib/config";
import {
  toCliSearchJson,
  toListJson,
  toStatsJson,
  toTrapDetailsJson,
} from "../lib/output-json";
import {
  evidenceRequestFromArgs,
  listRequestFromArgs,
  searchRequestFromArgs,
  statsRequestFromArgs,
} from "../lib/command-requests";
import { mutationJsonPayload } from "../lib/trap-mutation-result";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { buildContextPack, formatContextPackMarkdown } from "../lib/context-pack";
import { errorFrom, errorMessage, failureMessage, jsonObjectInput, parseArgs, wantsJson } from "./command-args";
import { observationContextFromArgs } from "../lib/observation-recorder";

export async function cmdAdd(args: string[], operations: TrapOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const input = opts["input-json"];
  if (input !== undefined) {
    if (!input || input === "true") {
      return failureMessage("--input-json requires a JSON string argument", args);
    }
    try {
      const result = operations.addTrap(jsonObjectInput(opts));
      await operations.embedTrapBestEffort(result.id, result.scope);
      return wantsJson(opts)
        ? jsonResult(result)
        : textResult(`Trap #${result.id} added to ${result.scope} scope.`);
    } catch (error) {
      return errorFrom(error, args);
    }
  }

  if (looksLikeJsonPositional(positionals)) {
    return failureMessage([
      "JSON input moved to --input-json; --json now always means JSON output.",
      'Example: codetrap add --input-json \'{"title":"...","category":"convention","scope":"project","context":"...","mistake":"...","fix":"..."}\' [--json]',
    ].join("\n"), args);
  }

  if (positionals.length > 0) {
    return failureMessage([
      "Use --input-json for structured input.",
      `Quick add: codetrap add --input-json '{"title":"${positionals.join(" ")}","category":"other","scope":"global","context":"...","mistake":"...","fix":"..."}'`,
    ].join("\n"), args);
  }

  return failureMessage([
    "add requires --input-json (interactive mode is not implemented).",
    'Example: codetrap add --input-json \'{"title":"...","category":"convention","scope":"project","context":"...","mistake":"...","fix":"..."}\'',
  ].join("\n"), args);
}

function looksLikeJsonPositional(positionals: string[]): boolean {
  return positionals.some((value) => value.trimStart().startsWith("{"));
}

export async function cmdSearch(args: string[], operations: TrapOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const query = readQuery(positionals);
  if (!query) {
    return errorResult("Usage: codetrap search <query> [--category X] [--limit N] [--mode fts|semantic|hybrid] [--status active|superseded|archived|all] [--path file] [--module name] [--owner name] [--json]");
  }

  try {
    const defaults = searchDefaultsFromConfig();
    const { cards, diagnostics } = await operations.searchTrapCards(searchRequestFromArgs(query, opts, defaults));
    if (opts.json !== undefined) {
      return jsonResult({ results: toCliSearchJson(cards), diagnostics });
    }
    const sections = [cards.length > 0 ? cards.map(formatTrapActionCard).join("\n\n") : "No traps found."];
    sections.push(...diagnostics.map((diagnostic) =>
      `note [${diagnostic.code}] (${diagnostic.scope}): ${diagnostic.message}`
    ));
    return textResult(sections.join("\n\n"));
  } catch (error) {
    return errorFrom(error, args);
  }
}

export function cmdList(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  try {
    const groups = operations.listTraps(listRequestFromArgs(opts));
    if (opts.json !== undefined) return jsonResult(toListJson(groups));

    const lines = groups.flatMap((group) =>
      group.traps.map((trap) => formatTrapShort(trap, group.scope))
    );
    return textResult(lines.length > 0 ? lines.join("\n") : "No traps found.");
  } catch (error) {
    return errorFrom(error, args);
  }
}

export function cmdShow(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap show <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.getTrapDetails(id, opts.scope);
  if (!result) return failureMessage(`Trap #${id} not found.`, args);

  operations.hitTrap(id, result.scope);
  return opts.json !== undefined
    ? jsonResult(toTrapDetailsJson(result))
    : textResult(formatTrapDetails(result));
}

/**
 * §16 1E: the runtime-proof signal. An agent that recalled a lesson and found it
 * genuinely useful says so here. Kept separate from `show`'s hit counter — a
 * view is not evidence of help, and merging them would make every search look
 * like a success and the §17 falsifier unfalsifiable.
 */
export function cmdUseful(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap useful <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const details = operations.getTrapDetails(id, opts.scope);
  if (!details) return failureMessage(`Trap #${id} not found.`, args);

  const marked = operations.markTrapUseful(id, details.scope, new Date(), observationContextFromArgs(opts));
  if (!marked.success) return failureMessage(`Trap #${id} could not be marked useful.`, args);

  const updated = operations.getTrapDetails(id, details.scope);
  const payload = {
    success: true,
    id,
    scope: details.scope,
    useful_count: updated?.trap.useful_count ?? 0,
    last_useful_at: updated?.trap.last_useful_at ?? null,
    title: details.trap.title,
    ...(marked.observation_warning ? { observation_warning: marked.observation_warning } : {}),
  };
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult(
    `Marked trap #${id} useful (${payload.useful_count} time(s)): ${details.trap.title}`
  );
}

/**
 * §12.1 / §16 1E: a curated context pack. Only *committed* lessons are eligible
 * (§12.2), and the user chooses which — that is the whole point of the surface.
 */
export function cmdPack(args: string[], operations: TrapOperations, projectPath: string | null): CommandResult {
  const sub = args[0];
  if (sub !== "export") return errorResult("Usage: codetrap pack export --traps <id,id,...> [--scope <s>] [--json]");

  const { opts } = parseArgs(args.slice(1));
  const raw = typeof opts.traps === "string" ? opts.traps.trim() : "";
  if (!raw) return errorResult("--traps is required: a comma-separated list of committed trap ids.");

  // Every token must be a clean id. Dropping the unparseable ones would hand
  // the user a pack quietly missing lessons they asked for.
  const tokens = raw.split(",").map((value) => value.trim()).filter((value) => value !== "");
  const invalid = tokens.filter((token) => !/^\d+$/.test(token));
  if (invalid.length > 0) {
    return errorResult(
      `Invalid trap id(s) in --traps: ${invalid.join(", ")}. Expected a comma-separated list like 2,5 (no spaces).`
    );
  }
  const ids = [...new Set(tokens.map((token) => Number.parseInt(token, 10)))];

  const details = [];
  const missing: number[] = [];
  const retired: string[] = [];
  for (const id of ids) {
    const found = operations.getTrapDetails(id, opts.scope);
    if (!found) {
      missing.push(id);
      continue;
    }
    // §12.2: only committed, runtime-eligible lessons belong in a pack. An
    // archived or superseded trap pasted into planning context reads as
    // current advice when it is precisely the opposite.
    if (found.trap.status !== "active") {
      retired.push(`#${id} (${found.trap.status})`);
      continue;
    }
    details.push(found);
  }
  if (missing.length > 0) {
    return errorResult(`No such trap(s): ${missing.join(", ")}. A context pack contains committed lessons only.`);
  }
  if (retired.length > 0) {
    return errorResult(
      `Not active: ${retired.join(", ")}. A context pack carries current lessons only; archived and superseded traps are excluded.`
    );
  }

  const pack = buildContextPack({ details, projectPath, now: new Date() });
  if (opts.json !== undefined) return jsonResult(pack);
  return textResult(formatContextPackMarkdown(pack));
}

export async function cmdEdit(args: string[], operations: TrapOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap edit <id> --input-json '{\"title\":\"new title\"}' [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const input = opts["input-json"];
  if (!input || input === "true") {
    const hint = looksLikeJsonPositional(positionals)
      ? "JSON input moved to --input-json; --json now always means JSON output."
      : "edit requires --input-json.";
    return failureMessage([
      hint,
      "Example: codetrap edit 1 --input-json '{\"title\":\"new title\"}' [--scope project|global] [--json]",
    ].join("\n"), args);
  }

  try {
    const result = operations.updateTrap(id, jsonObjectInput(opts), opts.scope);
    if (!result.success) {
      return failureMessage(result.error ?? `Trap #${id} not found or no fields changed.`, args);
    }
    await operations.embedTrapBestEffort(id, result.scope);
    return wantsJson(opts)
      ? jsonResult({ id, ...result })
      : textResult(`Trap #${id} updated in ${result.scope} scope.`);
  } catch (error) {
    return errorFrom(error, args);
  }
}

export function cmdDelete(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap delete <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.deleteTrap(id, opts.scope);
  if (opts.json !== undefined) {
    return mutationJsonResult({ id, ...result }, `Trap #${id} not found.`);
  }
  return result.success
    ? textResult(`Trap #${id} deleted from ${result.scope} scope.`)
    : errorResult(result.error ?? `Trap #${id} not found.`);
}

export function cmdAddTrapEvidence(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(
    positionals[0],
    "Usage: codetrap add_trap_evidence <id> --source_type manual|conversation|commit|issue|test_failure|article [--scope project|global] [--source_ref X] [--related_files a,b] [--note X]"
  );
  if (typeof id !== "number") return id;

  if (looksLikeJsonPositional(positionals)) {
    return failureMessage([
      "JSON input moved to --input-json; --json now always means JSON output.",
      "Example: codetrap add_trap_evidence 1 --input-json '{\"source_type\":\"commit\"}' [--json]",
    ].join("\n"), args);
  }

  try {
    const inputJson = opts["input-json"];
    const input = inputJson !== undefined ? jsonObjectInput(opts) : evidenceRequestFromArgs(opts);
    const result = operations.addTrapEvidence(id, input, opts.scope);
    if (wantsJson(opts)) {
      return mutationJsonResult({ id, ...result }, `Trap #${id} not found.`);
    }
    return result.success
      ? textResult(`Evidence #${result.evidence_id} added to trap #${id} in ${result.scope} scope.`)
      : errorResult(result.error ?? `Trap #${id} not found.`);
  } catch (error) {
    return errorFrom(error, args);
  }
}

export function cmdArchiveTrap(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap archive_trap <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.archiveTrap(id, opts.scope);
  if (opts.json !== undefined) {
    return mutationJsonResult({ id, ...result, status: result.success ? "archived" : undefined }, `Trap #${id} not found.`);
  }
  return result.success
    ? textResult(`Trap #${id} archived in ${result.scope} scope.`)
    : errorResult(result.error ?? `Trap #${id} not found.`);
}

export function cmdSupersedeTrap(args: string[], operations: TrapOperations): CommandResult {
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
    : errorResult(result.error ?? `Trap #${id} or #${supersededById} not found in the same scope.`);
}

export function cmdExport(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  return jsonResult(operations.exportTraps(opts.scope));
}

export function cmdImport(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) return errorResult("Usage: codetrap import <file.json>");

  try {
    const traps = JSON.parse(readFileSync(positionals[0], "utf-8"));
    if (!Array.isArray(traps)) {
      const message = "Error: JSON file must contain an array of traps";
      return opts.json !== undefined ? jsonResult({ success: false, error: message }, 1) : errorResult(message);
    }
    const result = operations.importTraps(traps);
    const exitCode = result.skipped.length > 0 ? 1 : 0;
    if (opts.json !== undefined) {
      return jsonResult({
        success: result.skipped.length === 0,
        imported: result.imported,
        total: result.total,
        skipped: result.skipped,
      }, exitCode);
    }
    const lines = [`Imported ${result.imported} of ${result.total} traps.`];
    if (result.skipped.length > 0) {
      lines.push(`Skipped ${result.skipped.length} record(s):`);
      lines.push(...result.skipped.map((skip) =>
        `- [${skip.index}] ${skip.title ?? "(untitled)"}: ${skip.error}`
      ));
    }
    return { exitCode, [exitCode === 0 ? "stdout" : "stderr"]: lines.join("\n") };
  } catch (error) {
    if (opts.json !== undefined) {
      return jsonResult({ success: false, error: errorMessage(error) }, 1);
    }
    return errorFrom(error, args);
  }
}

export function cmdStats(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  const request = statsRequestFromArgs(opts);
  const stats = operations.getStats(request.scope);
  const embeddingStats = operations.getEmbeddingStats(request.scope);
  return opts.json !== undefined
    ? jsonResult(toStatsJson(stats, embeddingStats))
    : textResult(formatStatsText(stats));
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

function mutationJsonResult<T extends Record<string, unknown> & { success: boolean; error?: string }>(
  value: T,
  error: string
): CommandResult {
  return jsonResult(mutationJsonPayload(value, error), value.success ? 0 : 1);
}
