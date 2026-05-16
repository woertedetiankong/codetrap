#!/usr/bin/env bun

import { chmod, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

type ReleaseTarget = {
  target: string;
  name: string;
  windows?: boolean;
};

const releaseDir = join(process.cwd(), "dist", "release");

const targets: ReleaseTarget[] = [
  { target: "bun-darwin-arm64", name: "codetrap-darwin-arm64" },
  { target: "bun-darwin-x64", name: "codetrap-darwin-x64" },
  { target: "bun-linux-x64-baseline", name: "codetrap-linux-x64" },
  { target: "bun-linux-arm64", name: "codetrap-linux-arm64" },
  { target: "bun-windows-x64-baseline", name: "codetrap-windows-x64.exe", windows: true },
];

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

for (const item of targets) {
  const outfile = join(releaseDir, item.name);
  console.log(`Building ${item.name} (${item.target})`);
  const proc = Bun.spawnSync({
    cmd: [
      "bun",
      "build",
      "--compile",
      `--target=${item.target}`,
      "./src/index.ts",
      "--outfile",
      outfile,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });

  if (!proc.success) {
    process.exit(proc.exitCode ?? 1);
  }

  if (!item.windows) {
    await chmod(outfile, 0o755);
  }
}

const files = (await readdir(releaseDir)).filter((file) => file !== "sha256sums.txt").sort();
const lines: string[] = [];

for (const file of files) {
  const path = join(releaseDir, file);
  const bytes = await Bun.file(path).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  lines.push(`${hex}  ${file}`);
}

await writeFile(join(releaseDir, "sha256sums.txt"), `${lines.join("\n")}\n`);
console.log(`Release assets written to ${releaseDir}`);

