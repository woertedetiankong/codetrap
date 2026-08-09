#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  DEFAULT_PUBLIC_RETRIEVAL_DATASET,
  DEFAULT_PUBLIC_RETRIEVAL_EXPECTED,
  formatPublicRetrievalBenchmark,
  runPublicRetrievalBenchmark,
  verifyPublicBenchmark,
} from "../src/lib/public-retrieval-benchmark";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  try {
    const report = await runPublicRetrievalBenchmark({
      datasetPath: args.dataset ?? DEFAULT_PUBLIC_RETRIEVAL_DATASET,
      includeCases: args["include-cases"] === "true",
    });
    if (args.output) {
      const outputPath = resolve(args.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    }
    if (args.verify === "true") {
      verifyPublicBenchmark(report, args.expected ?? DEFAULT_PUBLIC_RETRIEVAL_EXPECTED);
    }
    console.log(args.json === "true" ? JSON.stringify(report, null, 2) : formatPublicRetrievalBenchmark(report));
    if (args.verify === "true" && args.json !== "true") console.log("Verification: passed");
    if (args.output && args.json !== "true") console.log(`Report: ${resolve(args.output)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith("--")) throw new Error(`Unknown positional argument: ${arg}`);
    const key = arg.slice(2);
    options[key] = args[index + 1] && !args[index + 1].startsWith("--") ? args[++index] : "true";
  }
  return options;
}

await main();
