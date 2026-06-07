#!/usr/bin/env bun

import { tmpdir } from "node:os";
import { join } from "node:path";

const tag = process.argv[2] ?? process.env.RELEASE_TAG;
const packageJson = await Bun.file("package.json").json() as { name?: string; version?: string };
const published = await packageVersionExists(packageJson.name, packageJson.version);

const commands: { name: string; cmd: string[]; optional?: boolean }[] = [
  ...(tag ? [{ name: "check release version", cmd: ["bun", "run", "check:release-version", tag] }] : []),
  { name: "test", cmd: ["bun", "test", "src/tests"] },
  { name: "build", cmd: ["bun", "run", "build"] },
  { name: "build release assets", cmd: ["bun", "run", "build:release"] },
  { name: "smoke test release binary", cmd: [hostBinaryPath(), "--help"] },
  {
    name: "smoke test release binary Codex setup",
    cmd: [
      hostBinaryPath(),
      "setup",
      "codex",
      "--dry-run",
      "--json",
      "--codex-home",
      join(tmpdir(), "codetrap-release-preflight-codex-home"),
    ],
  },
  { name: "npm pack dry-run", cmd: ["npm", "pack", "--dry-run"] },
  ...(!published ? [{ name: "npm publish dry-run", cmd: ["npm", "publish", "--dry-run", "--access", "public"] }] : []),
];

for (const step of commands) {
  console.log(`\n==> ${step.name}`);
  const proc = Bun.spawnSync({
    cmd: step.cmd,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (!proc.success) {
    console.error(`Release preflight failed at: ${step.name}`);
    process.exit(proc.exitCode ?? 1);
  }
}

if (published) {
  console.log(`\nSkipped npm publish dry-run because ${packageJson.name}@${packageJson.version} is already published.`);
}
console.log("\nRelease preflight passed. No package was published and no GitHub release was created.");

function hostBinaryPath(): string {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "darwin" && arch === "arm64") return "./dist/release/codetrap-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "./dist/release/codetrap-darwin-x64";
  if (platform === "linux" && arch === "arm64") return "./dist/release/codetrap-linux-arm64";
  if (platform === "linux" && arch === "x64") return "./dist/release/codetrap-linux-x64";
  if (platform === "win32" && arch === "x64") return "./dist/release/codetrap-windows-x64.exe";
  throw new Error(`Unsupported release smoke-test platform: ${platform}/${arch}`);
}

async function packageVersionExists(name?: string, version?: string): Promise<boolean> {
  if (!name || !version) return false;
  const proc = Bun.spawnSync({
    cmd: ["npm", "view", `${name}@${version}`, "version", "--json"],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!proc.success) return false;
  return new TextDecoder().decode(proc.stdout).trim().replace(/^"|"$/g, "") === version;
}
