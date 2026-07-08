#!/usr/bin/env bun

const tag = process.argv[2] ?? process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME;

if (!tag) {
  console.error("Release tag is required. Pass v<package.version> as an argument.");
  process.exit(1);
}

const packageJson = await Bun.file("package.json").json() as { version?: string };
const expected = `v${packageJson.version}`;

if (tag !== expected) {
  console.error(`Release tag ${tag} does not match package version ${expected}.`);
  process.exit(1);
}

// L7/L9: CODETRAP_VERSION is the CLI/MCP version string. tsconfig rootDir keeps
// package.json out of src, so this release gate is what keeps them in lockstep.
const { CODETRAP_VERSION } = await import("../src/lib/version");
if (CODETRAP_VERSION !== packageJson.version) {
  console.error(
    `src/lib/version.ts CODETRAP_VERSION (${CODETRAP_VERSION}) does not match package version ${packageJson.version}.`
  );
  process.exit(1);
}

console.log(`Release tag ${tag} matches package version ${packageJson.version}.`);

