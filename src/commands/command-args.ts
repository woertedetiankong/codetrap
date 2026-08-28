import { readFileSync } from "node:fs";
import { errorResult, jsonResult, type CommandResult } from "./command-result";

export type ParsedArgs = {
  opts: Record<string, string>;
  positionals: string[];
};

// Flags that never take a value. Without this allowlist, a boolean flag
// placed before a positional swallows it ("search --json timeout" losing
// the query). Use --flag=value to force a value onto any flag.
const BOOLEAN_FLAGS = new Set([
  "json",
  "output-json",
  "no-rerank",
  "rerank",
  "ranking-signals",
  "ranking_signals",
  "force",
  "apply",
  "dry-run",
  "propose-traps",
  "accept-anyway",
  "deleted-trap-candidates",
  "deleted_trap_candidates",
  "stdin",
  "mcp",
  "no-agents",
  "useful",
  "not-useful",
]);

export function parseArgs(args: string[]): ParsedArgs {
  const opts: Record<string, string> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      opts[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    if (BOOLEAN_FLAGS.has(body)) {
      opts[body] = "true";
      continue;
    }
    const next = args[i + 1];
    opts[body] = next !== undefined && !next.startsWith("--") ? args[++i] : "true";
  }
  return { opts, positionals };
}

export function wantsJson(opts: Record<string, string>): boolean {
  return opts.json !== undefined || opts["output-json"] !== undefined;
}

export function wantsJsonRaw(args: string[]): boolean {
  return args.some((arg) =>
    arg === "--json" || arg === "--output-json" || arg.startsWith("--json=") || arg.startsWith("--output-json=")
  );
}

/**
 * Read a JSON object from a CLI option. Passing `--input-json -` reads stdin,
 * which avoids the quote-rewriting performed by Windows PowerShell when a
 * multiline JSON value is forwarded to a native executable.
 */
export function jsonObjectInput(
  opts: Record<string, string>,
  key = "input-json"
): Record<string, unknown> {
  const option = opts[key];
  if (!option || option === "true") throw new Error(`--${key} requires a JSON object.`);
  if (option === "-" && process.stdin.isTTY === true) {
    throw new Error(`--${key} - requires piped JSON input.`);
  }
  const input = option === "-" ? readFileSync(0, "utf-8") : option;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid --${key}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`--${key} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

export function errorFrom(error: unknown, rawArgs?: string[]): CommandResult {
  return failureMessage(errorMessage(error), rawArgs);
}

// M25: when the caller asked for JSON, failures are JSON too — a uniform
// { success: false, error } envelope on stdout with exit 1.
export function failureMessage(message: string, rawArgs?: string[]): CommandResult {
  if (rawArgs && wantsJsonRaw(rawArgs)) {
    return jsonResult({ success: false, error: message }, 1);
  }
  return errorResult(message.startsWith("Error:") ? message : `Error: ${message}`);
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // M7: a raw SQLite CHECK/constraint failure is meaningless to a user; enum
  // fields are validated upstream, so this is a safety net for the rest.
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")) {
    return `Invalid trap field (${error.message}).`;
  }
  return error.message;
}
