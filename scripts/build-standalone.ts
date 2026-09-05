#!/usr/bin/env bun

import { buildWebClient } from "./build-web";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type StandaloneBuildOptions = {
  entrypoint: string;
  outfile: string;
  target?: Bun.Build.CompileTarget;
  executablePath?: string;
};

/**
 * Compile a self-contained Codetrap binary. Standalone builds use the
 * Transformers.js web bundle so text embeddings run through portable ONNX
 * Runtime WASM instead of native sharp/onnxruntime addons beside the binary.
 */
export async function buildCodetrapStandalone(options: StandaloneBuildOptions): Promise<void> {
  await buildWebClient();
  const nodeEntry = Bun.resolveSync("@huggingface/transformers", process.cwd());
  const webEntry = resolve(dirname(nodeEntry), "transformers.web.js");
  if (!existsSync(webEntry)) {
    throw new Error(
      `The pinned @huggingface/transformers package is missing its web bundle: ${webEntry}`
    );
  }
  const result = await Bun.build({
    entrypoints: [resolve(options.entrypoint)],
    target: "bun",
    compile: {
      ...(options.target ? { target: options.target } : {}),
      ...(options.executablePath ? { executablePath: resolve(options.executablePath) } : {}),
      outfile: resolve(options.outfile),
    },
    define: {
      CODETRAP_STANDALONE_WASM: "true",
    },
    plugins: [{
      name: "codetrap-transformers-wasm",
      setup(build) {
        build.onResolve({ filter: /^@huggingface\/transformers$/ }, () => ({ path: webEntry }));
      },
    }],
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`Failed to build standalone executable: ${options.outfile}`);
  }
}

if (import.meta.main) {
  const [entrypoint, outfile, target] = process.argv.slice(2);
  if (!entrypoint || !outfile) {
    console.error("Usage: bun run scripts/build-standalone.ts <entrypoint> <outfile> [target]");
    process.exit(1);
  }
  await buildCodetrapStandalone({
    entrypoint,
    outfile,
    ...(target ? { target: target as Bun.Build.CompileTarget } : {}),
  });
}
