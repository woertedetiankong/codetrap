import type { TrapStore } from "../lib/store";
import type { TrapOperations } from "../lib/trap-operations";
import { SessionStore } from "../lib/session-store";
import { SessionOperations } from "../lib/session-operations";
import { buildDoctorReport, formatDoctorText } from "../lib/doctor";
import { formatEmbedText } from "../lib/embed-output";
import {
  formatEmbeddingProfilesText,
  formatEmbeddingStatusText,
  formatEmbeddingsUseText,
  type EmbeddingsUseResult,
} from "../lib/embedding-management";
import { CLIENT_SPECS, formatClientSetupText, isSetupClient, runClientSetup } from "../lib/client-setup";
import {
  formatScopeMigrationText,
  runScopeMigration,
  type ScopeMigrationCommand,
} from "../lib/scope-migration";
import { embedRequestFromArgs, embeddingsUseRequestFromArgs } from "../lib/command-requests";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { errorFrom, parseArgs } from "./command-args";

export function cmdInit(_args: string[], store: TrapStore): CommandResult {
  if (store.hasProject()) {
    return textResult(`Already in a project: ${store.getProjectRoot()}`);
  }
  return textResult("Project initialized.");
}

export async function cmdDoctor(args: string[], store: TrapStore, operations: TrapOperations): Promise<CommandResult> {
  const { opts } = parseArgs(args);
  const projectRoot = store.getProjectRoot();
  const sessions = projectRoot
    ? new SessionOperations(new SessionStore(projectRoot), operations)
    : null;
  const candidateReview = sessions?.candidateReviewSummary() ?? null;
  const candidateMigration = sessions?.candidateMigrationStatus() ?? null;
  const report = await buildDoctorReport(
    store,
    operations,
    process.cwd(),
    candidateReview,
    candidateMigration,
    sessions?.inboxHealth() ?? null
  );
  return opts.json !== undefined
    ? jsonResult(report)
    : textResult(formatDoctorText(report));
}

export function cmdSetup(args: string[]): CommandResult {
  const sub = args[0];
  const rest = args.slice(1);
  if (!isSetupClient(sub)) {
    return errorResult(
      "Usage: codetrap setup <codex|claude> [--mcp] [--no-agents] [--agents-file <path>] [--codex-home <path> | --claude-home <path>] [--dry-run] [--json]"
    );
  }
  const { opts } = parseArgs(rest);
  try {
    const result = runClientSetup(sub, {
      cwd: process.cwd(),
      clientHome: opts[CLIENT_SPECS[sub].homeFlag],
      agentsFile: opts["agents-file"],
      installMcp: opts.mcp !== undefined,
      skipAgents: opts["no-agents"] !== undefined,
      dryRun: opts["dry-run"] !== undefined,
    });
    if (opts.json !== undefined) return jsonResult(result, result.success ? 0 : 1);
    return result.success
      ? textResult(formatClientSetupText(result))
      : errorResult(formatClientSetupText(result));
  } catch (error) {
    return errorFrom(error, args);
  }
}

export function cmdScopeMigration(
  command: ScopeMigrationCommand,
  args: string[],
  _operations: TrapOperations
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
    return errorFrom(error, args);
  }
}

export async function cmdEmbed(args: string[], store: TrapStore): Promise<CommandResult> {
  const { opts } = parseArgs(args);
  try {
    const result = await store.ensureEmbeddings(embedRequestFromArgs(opts));
    return textResult(formatEmbedText(result));
  } catch (error) {
    return errorFrom(error, args);
  }
}

export async function cmdEmbeddings(args: string[], store: TrapStore): Promise<CommandResult> {
  const sub = args[0] ?? "status";
  const rest = args.length === 0 ? [] : args.slice(1);

  try {
    switch (sub) {
      case "status": {
        const { opts } = parseArgs(rest);
        const status = await store.embeddingStatus({ scope: opts.scope });
        return opts.json !== undefined
          ? jsonResult(status)
          : textResult(formatEmbeddingStatusText(status));
      }
      case "list":
      case "profiles": {
        const { opts } = parseArgs(rest);
        const profiles = store.embeddingProfiles({ scope: opts.scope });
        const payload = {
          active_profile_id: store.embeddingRuntimeStatus().profile_id,
          ...profiles,
        };
        return opts.json !== undefined
          ? jsonResult(payload)
          : textResult(formatEmbeddingProfilesText(profiles));
      }
      case "use": {
        const { opts, positionals } = parseArgs(rest);
        const request = embeddingsUseRequestFromArgs(positionals, opts);
        const written = store.configureEmbeddings(request.embeddings);
        const scope = store.hasProject() ? "project" : "global";
        const result: EmbeddingsUseResult = {
          ...written,
          embeddings: written.config.embeddings ?? request.embeddings,
          next_action: {
            command: `codetrap embeddings reindex --scope ${scope}`,
            reason: "Generate embeddings for the selected profile.",
          },
        };
        return opts.json !== undefined
          ? jsonResult(result)
          : textResult(formatEmbeddingsUseText(result));
      }
      case "reindex":
      case "embed":
        return cmdEmbed(rest, store);
      default:
        return errorResult("Usage: codetrap embeddings <status|list|profiles|use|reindex> [--json]");
    }
  } catch (error) {
    return errorFrom(error, args);
  }
}
