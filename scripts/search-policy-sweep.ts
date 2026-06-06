#!/usr/bin/env bun

import {
  formatPolicySweepReport,
  readLiveEvalCases,
  runFixturePolicySweep,
  runLivePolicySweep,
  type GoldTarget,
  type LiveEvalCase,
  type PolicySweepReport,
  type SweepCandidateReport,
} from "../src/lib/search-policy-sweep";
import { SEARCH_MODES, SCOPES, type Scope, type SearchMode } from "../src/lib/constants";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "fixture";

  try {
    if (command === "fixture") {
      const report = await runFixturePolicySweep({ fixturePath: args.opts.fixture });
      print(report, args.opts.json === "true", args.opts["include-cases"] === "true");
      return;
    }

    if (command === "live") {
      const cases = liveCasesFromArgs(args);
      const report = await runLivePolicySweep({
        cwd: args.opts.cwd ?? process.cwd(),
        cases,
        defaultScope: scopeField(args.opts.scope, "scope") ?? "project",
      });
      print(report, args.opts.json === "true", args.opts["include-cases"] === "true");
      return;
    }

    throw new Error(usage());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function print(report: PolicySweepReport, json: boolean, includeCases: boolean): void {
  console.log(json ? JSON.stringify(includeCases ? report : compactReport(report), null, 2) : formatPolicySweepReport(report));
}

function compactReport(report: PolicySweepReport): Omit<PolicySweepReport, "baseline" | "best" | "candidates"> & {
  baseline: Omit<SweepCandidateReport, "cases">;
  best: Omit<SweepCandidateReport, "cases">;
  candidates: Omit<SweepCandidateReport, "cases">[];
} {
  return {
    ...report,
    baseline: compactCandidate(report.baseline),
    best: compactCandidate(report.best),
    candidates: report.candidates.map(compactCandidate),
  };
}

function compactCandidate(candidate: SweepCandidateReport): Omit<SweepCandidateReport, "cases"> {
  const { cases: _cases, ...rest } = candidate;
  return rest;
}

function liveCasesFromArgs(args: { opts: Record<string, string>; positionals: string[] }): LiveEvalCase[] {
  if (args.opts.queries) return readLiveEvalCases(args.opts.queries);
  if (!args.opts.query) throw new Error(usage());
  const gold = goldFromArgs(args.opts);
  return [{
    query: args.opts.query,
    mode: modeField(args.opts.mode, "mode") ?? "hybrid",
    scope: scopeField(args.opts.scope, "scope") ?? "project",
    gold: gold.length > 0 ? gold : undefined,
  }];
}

function goldFromArgs(opts: Record<string, string>): GoldTarget[] {
  if (!opts["gold-id"] && !opts["gold-title"]) return [];
  const id = opts["gold-id"] ? Number(opts["gold-id"]) : undefined;
  if (id !== undefined && (!Number.isInteger(id) || id <= 0)) throw new Error("--gold-id must be a positive integer.");
  const title = opts["gold-title"]?.trim() || undefined;
  return [{
    id,
    title,
    scope: scopeField(opts.scope, "scope"),
  }];
}

function modeField(value: string | undefined, key: string): SearchMode | undefined {
  if (value === undefined) return undefined;
  if (!(SEARCH_MODES as readonly string[]).includes(value)) {
    throw new Error(`--${key} must be one of: ${SEARCH_MODES.join(", ")}`);
  }
  return value as SearchMode;
}

function scopeField(value: string | undefined, key: string): Scope | undefined {
  if (value === undefined) return undefined;
  if (!(SCOPES as readonly string[]).includes(value)) {
    throw new Error(`--${key} must be one of: ${SCOPES.join(", ")}`);
  }
  return value as Scope;
}

function parseArgs(args: string[]): { opts: Record<string, string>; positionals: string[] } {
  const opts: Record<string, string> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      opts[key] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
    } else {
      positionals.push(arg);
    }
  }
  return { opts, positionals };
}

function usage(): string {
  return [
    "Usage:",
    "  bun run eval:search-policy -- fixture [--fixture path] [--json]",
    "  bun run eval:search-policy -- live --cwd /path/to/project --queries live-queries.json [--scope project|global] [--json]",
    "  bun run eval:search-policy -- live --cwd /path/to/project --query '<query>' [--gold-id n] [--gold-title '<title>'] [--scope project|global] [--mode fts|semantic|hybrid] [--json]",
    "  Add --include-cases with --json to include full per-case output.",
  ].join("\n");
}

await main();
