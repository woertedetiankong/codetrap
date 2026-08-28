import type { TrapStore } from "../lib/store";
import type { TrapOperations } from "../lib/trap-operations";
import { ImproverOperations } from "../lib/improver-operations";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { jsonObjectInput, parseArgs, wantsJson } from "./command-args";

const USAGE = "Usage: codetrap improver <capture|events|run|delete|outcome|metrics>";

export function cmdImprover(args: string[], store: TrapStore, traps: TrapOperations): CommandResult {
  const projectRoot = store.getProjectRoot();
  if (!projectRoot) return errorResult("Not in a project. Run 'codetrap init' first.");
  const operations = new ImproverOperations(projectRoot, traps);
  const sub = args[0];
  const { opts, positionals } = parseArgs(args.slice(1));

  let result: unknown;
  switch (sub) {
    case "capture":
      result = operations.capture(jsonObjectInput(opts));
      break;
    case "events":
      result = operations.events(eventStatus(opts.status));
      break;
    case "run":
      result = operations.run({
        apply: opts.apply !== undefined,
        minSignalWeight: optionalPositiveInteger(opts["min-signal-weight"], "--min-signal-weight"),
      });
      break;
    case "delete":
      result = operations.delete(requiredPosition(positionals, 0, "feedback event id"), opts.apply !== undefined);
      break;
    case "outcome":
      result = operations.outcome(jsonObjectInput(opts));
      break;
    case "metrics":
      result = operations.metrics(optionalPositiveInteger(opts["min-signal-weight"], "--min-signal-weight"));
      break;
    default:
      return errorResult(USAGE);
  }

  if (wantsJson(opts)) return jsonResult(result);
  return textResult(JSON.stringify(result, null, 2));
}

function requiredPosition(positionals: string[], index: number, label: string): string {
  const value = positionals[index];
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function eventStatus(value: string | undefined): "pending" | "handled" | "all" {
  if (value === undefined || value === "pending") return "pending";
  if (value === "handled" || value === "all") return value;
  throw new Error("--status must be pending, handled, or all.");
}

function optionalPositiveInteger(value: string | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${field} must be a positive integer.`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} must be a positive integer.`);
  return parsed;
}
