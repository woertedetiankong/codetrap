import type { TrapStore } from "../lib/store";
import type { TrapOperations } from "../lib/trap-operations";
import { Phase3Operations } from "../lib/phase3-operations";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { jsonObjectInput, parseArgs, wantsJson } from "./command-args";

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
    case "improve":
      result = operations.improve(jsonObjectInput(opts), homes(opts));
      break;
    case "edit":
      result = operations.edit(requiredOpt(opts, "session"), requiredPosition(positionals, 0, "candidate id"), jsonObjectInput(opts));
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
    case "storage":
      result = operations.storage();
      break;
    case "gc":
      if (opts.apply !== undefined && opts["dry-run"] !== undefined) {
        return errorResult("Choose either --dry-run or --apply, not both.");
      }
      result = operations.gc(opts.apply !== undefined, opts.executor);
      break;
    default:
      return errorResult("Usage: codetrap phase3 <propose|improve|edit|preview|install|rollback|commits|storage|gc>");
  }

  if (wantsJson(opts)) return jsonResult(result);
  return textResult(JSON.stringify(result, null, 2));
}

function homes(opts: Record<string, string>) {
  return { codexHome: requiredOpt(opts, "codex-home"), claudeHome: requiredOpt(opts, "claude-home") };
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
