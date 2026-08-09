import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("CI quality gates", () => {
  test("PRs and main pushes typecheck and run the full suite on Windows and Linux", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("bun-version: 1.3.14");
    expect(workflow).toContain("bun run typecheck");
    expect(workflow).toContain("bun test src/tests");
  });

  test("release paths use the same pinned project typecheck", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    const preflight = readFileSync("scripts/release-preflight.ts", "utf8");
    const release = readFileSync(".github/workflows/release.yml", "utf8");
    const publish = readFileSync(".github/workflows/npm-publish.yml", "utf8");

    expect(manifest.scripts.typecheck).toBe("tsc --noEmit");
    expect(manifest.devDependencies.typescript).toBe("7.0.2");
    expect(preflight).toContain('{ name: "typecheck", cmd: ["bun", "run", "typecheck"] }');
    expect(release).toContain("bun run typecheck");
    expect(publish).toContain("bun run typecheck");
  });
});
