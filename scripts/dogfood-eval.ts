#!/usr/bin/env bun

import {
  DEFAULT_SEARCH_EVAL_FIXTURE,
  formatSearchEvalReport,
  recordDogfoodCase,
  reportDogfood,
} from "../src/lib/search-eval";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0];
  const fixturePath = args.opts.fixture ?? DEFAULT_SEARCH_EVAL_FIXTURE;

  try {
    if (command === "record") {
      console.log(JSON.stringify(recordDogfoodCase(fixturePath, args.opts.json), null, 2));
      return;
    }

    if (command === "report") {
      const result = await reportDogfood(fixturePath, args.opts.live === "true");
      console.log(args.opts.json === "true" ? JSON.stringify(result, null, 2) : formatSearchEvalReport(result));
      return;
    }

    throw new Error([
      "Usage:",
      "  bun run eval:dogfood -- report [--live] [--json] [--fixture path]",
      "  bun run eval:dogfood -- record --json '<record>' [--fixture path]",
    ].join("\n"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
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

await main();
