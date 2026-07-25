import { homedir } from "node:os";
import type { TrapStore } from "../lib/store";
import type { TrapOperations } from "../lib/trap-operations";
import { SessionStore } from "../lib/session-store";
import { SessionOperations } from "../lib/session-operations";
import { LearningOperations } from "../lib/learning-operations";
import { parseSinceDays } from "../lib/learning-sources";
import { parseLearningSourceId, type LearningSourceId } from "../domain/learning-source";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { errorFrom, parseArgs } from "./command-args";

const USAGE = "Usage: codetrap learn <sources|evidence-pack|review|stage|reviews|delete>";

export function cmdLearn(args: string[], store: TrapStore, trapOperations: TrapOperations): CommandResult {
  const sub = args[0];
  const rest = args.slice(1);
  const projectRoot = store.getProjectRoot();
  if (!projectRoot) return errorResult("Not in a project. Run 'codetrap init' first.");

  const home = process.env.CODETRAP_CLIENT_HOME || homedir();
  const learning = new LearningOperations(
    projectRoot,
    home,
    new SessionOperations(new SessionStore(projectRoot), trapOperations),
    trapOperations
  );

  try {
    switch (sub) {
      case "sources":
        return cmdLearnSources(rest, learning);
      // `evidence-pack` and `review` build the same directory; §9.4 names them
      // separately because Mode A and Mode C differ in who reads it next, not
      // in what is produced. One implementation, two names.
      case "evidence-pack":
      case "review":
        return cmdLearnReview(rest, learning);
      case "reviews":
        return cmdLearnReviews(rest, learning);
      case "stage":
        return cmdLearnStage(rest, learning);
      case "delete":
        return cmdLearnDelete(rest, learning);
      default:
        return errorResult(USAGE);
    }
  } catch (error) {
    return errorFrom(error, args);
  }
}

function cmdLearnSources(args: string[], learning: LearningOperations): CommandResult {
  const { opts } = parseArgs(args);
  const inventories = learning.listSources({
    source: optionalSource(opts.source),
    since: parseSinceDays(stringOpt(opts.since), new Date()),
    projectOnly: opts["project-only"] !== undefined,
  });

  if (opts.json !== undefined) return jsonResult({ sources: inventories });
  if (inventories.every((entry) => !entry.available)) {
    return textResult([
      "No client history found.",
      ...inventories.map((entry) => `  ${entry.source}: ${entry.roots.join(", ")} (missing)`),
    ].join("\n"));
  }
  return textResult(inventories.map((entry) => [
    `${entry.source}: ${entry.available ? `${entry.session_count} session(s)` : "not available"}`,
    `  roots: ${entry.roots.join(", ")}`,
    ...(entry.newest_file_modified_at ? [`  newest file modified: ${entry.newest_file_modified_at.slice(0, 10)}`] : []),
    ...(entry.oldest_file_modified_at ? [`  oldest file modified: ${entry.oldest_file_modified_at.slice(0, 10)}`] : []),
  ].join("\n")).join("\n"));
}

function cmdLearnReview(args: string[], learning: LearningOperations): CommandResult {
  const { opts } = parseArgs(args);
  const source = optionalSource(opts.source);
  if (!source) return errorResult("--source is required (codex-sessions or claude-code-sessions).");

  const result = learning.createReview({
    source,
    since: parseSinceDays(stringOpt(opts.since), new Date()),
    limit: intOpt(opts.limit) ?? 10,
    projectOnly: opts["project-only"] !== undefined,
    sessionLimit: intOpt(opts["last-sessions"]),
  });

  if (opts.json !== undefined) return jsonResult(result);
  return textResult([
    `Review ${result.review_id} prepared from ${result.session_count} ${result.source} session(s).`,
    // The scope is stated, not assumed: both --since and the session cap have
    // defaults, and a user must never have to guess how much was read.
    `  scope: since ${result.scope.since.slice(0, 10)}, at most ${result.scope.session_cap} session(s)` +
      `${result.scope.project_only ? ", this project only" : ", all projects"}`,
    `  read ${result.manifest_totals.files_read} file(s)` +
      `${result.manifest_totals.skipped_empty > 0 ? ` (${result.manifest_totals.skipped_empty} had no usable turns)` : ""}` +
      `, ${result.manifest_totals.redactions} redaction(s) applied.`,
    `  ${result.evidence_count} evidence item(s).`,
    `  ${result.review_dir}`,
    "",
    // §4.3: the trust receipt is shown every time, not only on request.
    "staged: 0 candidates    suppressed: 0",
    "durable writes: 0 — nothing was written to traps.db, guidance, skills, agents,",
    "automations, or evals.",
    "",
    `Next: an agent reads ${result.evidence_pack_path} and writes lesson-candidates.json,`,
    `then: ${result.next_action.command}`,
  ].join("\n"));
}

function cmdLearnReviews(args: string[], learning: LearningOperations): CommandResult {
  const { opts } = parseArgs(args);
  const reviews = learning.listReviews();
  if (opts.json !== undefined) return jsonResult({ reviews });
  if (reviews.length === 0) return textResult("No learning reviews yet.");
  return textResult(reviews
    .map((entry) => `${entry.review_id}${entry.deleted ? "  (deleted; audit metadata only)" : ""}`)
    .join("\n"));
}

function cmdLearnDelete(args: string[], learning: LearningOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const reviewId = positionals[0];
  if (!reviewId) return errorResult("Usage: codetrap learn delete <review-id> [--json]");
  const tombstone = learning.deleteReview(reviewId);
  if (opts.json !== undefined) return jsonResult({ success: true, ...tombstone });
  return textResult([
    `Deleted review ${tombstone.review_id}.`,
    "Excerpts removed. Retained for audit only:",
    `  ${tombstone.retained.files_read} file(s) read, ${tombstone.retained.sessions} session(s),`,
    `  ${tombstone.retained.evidence_count} evidence item(s), ${tombstone.retained.file_hashes.length} file hash(es).`,
  ].join("\n"));
}

function cmdLearnStage(args: string[], learning: LearningOperations): CommandResult {
  const { opts } = parseArgs(args);
  const dir = stringOpt(opts["review-dir"]);
  if (!dir) return errorResult("--review-dir is required.");

  const result = learning.stage({ reviewDir: dir, apply: opts.apply !== undefined });
  if (opts.json !== undefined) return jsonResult(result);

  const lines: string[] = [];
  if (result.applied) {
    lines.push(`Staged ${result.staged.length} candidate(s) from review ${result.review_id}.`);
    lines.push(...result.staged.map((entry) => `  ${entry.candidate_id} ${entry.title}`));
  } else {
    lines.push(`Validated review ${result.review_id}. Nothing was staged.`);
  }
  if (result.consolidated.length > 0) {
    lines.push(`Consolidated ${result.consolidated.length} exact duplicate(s) into existing candidates:`);
    lines.push(...result.consolidated.map((entry) =>
      `  ${entry.candidate_id} ${entry.title} (sources: ${entry.contributing_sources.join(", ")})`));
  }
  const clustered = result.staged.filter((entry) => entry.review_cluster);
  if (clustered.length > 0) {
    lines.push(`Grouped ${clustered.length} candidate(s) into review clusters (both kept; you decide):`);
    for (const entry of clustered) {
      lines.push(`  ${entry.candidate_id} ${entry.title} -> ${entry.review_cluster}`);
      lines.push(...(entry.similar_to ?? []).map((match) =>
        `    similar to ${match.candidate_id} "${match.title}" (${match.score}, ${match.reason})`));
    }
  }
  if (result.coverage_flagged.length > 0) {
    lines.push(`Flagged ${result.coverage_flagged.length} candidate(s) with unverified coverage claims:`);
    for (const entry of result.coverage_flagged) {
      lines.push(`  ${entry.candidate_id} ${entry.title}: ${entry.failed_refs.join(", ")}`);
    }
  }
  if (result.suppressed.length > 0) {
    lines.push(`Suppressed ${result.suppressed.length} previously-skipped lesson(s):`);
    lines.push(...result.suppressed.map((entry) => `  ${entry.title}`));
  }
  if (result.rejected.length > 0) {
    lines.push(`Rejected ${result.rejected.length} candidate(s) that failed verification:`);
    for (const rejection of result.rejected) {
      lines.push(`  [${rejection.index}] ${rejection.title ?? "(untitled)"}`);
      lines.push(...rejection.errors.map((error) => `    ${error}`));
    }
  }
  lines.push("");
  lines.push(
    `staged: ${result.staged.length} candidates    consolidated: ${result.consolidated.length}    suppressed: ${result.suppressed.length}`,
    "durable writes: 0 — staging fills the review inbox; a human still approves and commits."
  );
  if (result.next_action) lines.push("", `Next: ${result.next_action.command}`);
  return textResult(lines.join("\n"));
}

function optionalSource(value: unknown): LearningSourceId | undefined {
  const text = stringOpt(value);
  return text === undefined ? undefined : parseLearningSourceId(text);
}

function stringOpt(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

function intOpt(value: unknown): number | undefined {
  const text = stringOpt(value);
  if (text === undefined) return undefined;
  const parsed = Number.parseInt(text, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got: ${text}`);
  }
  return parsed;
}
