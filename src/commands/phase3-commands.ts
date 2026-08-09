import type { TrapStore } from "../lib/store";
import type { TrapOperations } from "../lib/trap-operations";
import { Phase3Operations } from "../lib/phase3-operations";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { parseArgs, wantsJson } from "./command-args";

export function cmdPhase3(args: string[], store: TrapStore, traps: TrapOperations): CommandResult {
  const projectRoot = store.getProjectRoot();
  if (!projectRoot) return errorResult("Not in a project. Run 'codetrap init' first.");
  const operations = new Phase3Operations(projectRoot, traps);
  const sub = args[0];
  const { opts, positionals } = parseArgs(args.slice(1));

  let result: unknown;
  switch (sub) {
    case "propose":
      result = operations.proposePreset(requiredOpt(opts, "preset"));
      break;
    case "edit":
      result = operations.edit(requiredOpt(opts, "session"), requiredPosition(positionals, 0, "candidate id"), inputJson(opts));
      break;
    case "preview":
      result = operations.preview(requiredOpt(opts, "session"), requiredPosition(positionals, 0, "candidate id"), homes(opts));
      break;
    case "install":
      result = operations.install(requiredOpt(opts, "session"), requiredPosition(positionals, 0, "candidate id"), homes(opts), opts.executor);
      break;
    case "rollback":
      result = operations.rollback(requiredPosition(positionals, 0, "commit id"), opts.executor);
      break;
    case "commits":
      result = operations.commits();
      break;
    default:
      return errorResult("Usage: codetrap phase3 <propose|edit|preview|install|rollback|commits>");
  }

  if (wantsJson(opts)) return jsonResult(result);
  return textResult(JSON.stringify(result, null, 2));
}

function homes(opts: Record<string, string>) {
  return { codexHome: requiredOpt(opts, "codex-home"), claudeHome: requiredOpt(opts, "claude-home") };
}

function inputJson(opts: Record<string, string>): Record<string, unknown> {
  const input = requiredOpt(opts, "input-json");
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch (error) {
    throw new Error(`Invalid --input-json: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("--input-json must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function requiredOpt(opts: Record<string, string>, name: string): string {
  const value = opts[name];
  if (!value || value === "true") throw new Error(`--${name} is required.`);
  return value;
}

function requiredPosition(positionals: string[], index: number, label: string): string {
  const value = positionals[index];
  if (!value) throw new Error(`${label} is required.`);
  return value;
}
