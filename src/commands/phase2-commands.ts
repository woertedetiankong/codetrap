import type { TrapStore } from "../lib/store";
import type { TrapOperations } from "../lib/trap-operations";
import { Phase2Operations } from "../lib/phase2-operations";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { jsonObjectInput, parseArgs, wantsJson } from "./command-args";

export function cmdPhase2(args: string[], store: TrapStore, traps: TrapOperations): CommandResult {
  const projectRoot = store.getProjectRoot();
  if (!projectRoot) return errorResult("Not in a project. Run 'codetrap init' first.");
  const operations = new Phase2Operations(projectRoot, traps);
  const sub = args[0];
  const rest = args.slice(1);
  const { opts, positionals } = parseArgs(rest);

  let result: unknown;
  switch (sub) {
    case "propose":
      result = operations.propose(jsonObjectInput(opts));
      break;
    case "edit":
      result = operations.edit(requiredOpt(opts, "session"), requiredPosition(positionals, 0, "candidate id"), jsonObjectInput(opts));
      break;
    case "preview":
      result = operations.preview(requiredOpt(opts, "session"), requiredPosition(positionals, 0, "candidate id"));
      break;
    case "apply":
      result = operations.apply(requiredOpt(opts, "session"), requiredPosition(positionals, 0, "candidate id"), opts.executor);
      break;
    case "revert":
      result = operations.revert(requiredPosition(positionals, 0, "commit id"), opts.executor);
      break;
    case "insights":
      result = operations.insights();
      break;
    case "consult":
      result = operations.consultInsight(requiredPosition(positionals, 0, "insight id"));
      break;
    case "commits":
      result = operations.commits();
      break;
    case "validate":
      result = operations.validateTrap(positiveId(positionals[0]), opts.scope);
      break;
    case "graduate":
      result = operations.graduateTrap(positiveId(positionals[0]), requiredOpt(opts, "to"), opts.scope);
      break;
    case "outcome": {
      const channel = requiredOpt(opts, "channel");
      if (channel !== "preflight" && channel !== "curated") throw new Error("--channel must be preflight or curated.");
      if ((opts.useful !== undefined) === (opts["not-useful"] !== undefined)) {
        throw new Error("Choose exactly one of --useful or --not-useful.");
      }
      result = operations.recordOutcome(channel, positiveId(positionals[0]), opts.useful !== undefined, opts.scope);
      break;
    }
    case "metrics":
      result = operations.metrics();
      break;
    case "decision":
      result = operations.retrieveVsCurateDecision();
      break;
    case "migrate-insights":
      result = operations.migrateInsightCandidates(opts.session, opts.apply !== undefined);
      break;
    default:
      return errorResult("Usage: codetrap phase2 <propose|edit|preview|apply|revert|insights|consult|commits|validate|graduate|outcome|metrics|decision|migrate-insights>");
  }

  if (wantsJson(opts)) return jsonResult(result);
  return textResult(JSON.stringify(result, null, 2));
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

function positiveId(value: string | undefined): number {
  const id = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) throw new Error("A positive trap id is required.");
  return id;
}
