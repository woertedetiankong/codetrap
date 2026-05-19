import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrapStore } from "../lib/store";
import { trap } from "./helpers";

describe("import/export and CLI evidence handling", () => {
  test("exported traps preserve evidence when imported with remapped trap ids", () => {
    const source = new TrapStore(tempProjectDir("codetrap-export-source-"), undefined);
    const added = source.add(trap({
      scope: "project",
      path_globs: ["src/api/**"],
      module: "api",
      owner: "platform",
    }));
    source.addEvidence(added.id, {
      source_type: "commit",
      source_ref: "abc123",
      related_files: ["src/api.ts"],
      note: "Captured from review.",
    }, "project");

    const exported = source.exportAll({ scope: "project" });
    expect(exported).toHaveLength(1);
    expect(exported[0].evidence[0]).toMatchObject({
      source_type: "commit",
      source_ref: "abc123",
      related_files: ["src/api.ts"],
      note: "Captured from review.",
    });
    expect(exported[0].path_globs).toEqual(["src/api/**"]);
    expect(exported[0].module).toBe("api");
    expect(exported[0].owner).toBe("platform");

    const destination = new TrapStore(tempProjectDir("codetrap-export-dest-"), undefined);
    destination.add(trap({ scope: "project", title: "Existing destination trap" }));

    expect(destination.importAll(exported)).toBe(1);

    const imported = destination
      .list({ scope: "project", status: "all" })
      .flatMap((group) => group.traps)
      .find((candidate) => candidate.title === "Use fetchWrapper for HTTP requests");

    expect(imported).toBeTruthy();
    expect(imported?.id).not.toBe(added.id);
    expect(JSON.parse(imported?.tags ?? "[]")).toEqual(["http", "fetch"]);
    expect(JSON.parse(imported?.path_globs ?? "[]")).toEqual(["src/api/**"]);
    expect(imported?.module).toBe("api");
    expect(imported?.owner).toBe("platform");

    const details = destination.getDetails(imported!.id, "project");
    expect(details?.evidence).toHaveLength(1);
    expect(details?.evidence[0]).toMatchObject({
      trap_id: imported!.id,
      source_type: "commit",
      source_ref: "abc123",
      note: "Captured from review.",
    });
    expect(JSON.parse(details?.evidence[0].related_files ?? "[]")).toEqual(["src/api.ts"]);
  });

  test("add_trap_evidence --json reports malformed JSON without a stack trace", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const result = Bun.spawnSync({
      cmd: ["bun", "run", join(import.meta.dir, "..", "index.ts"), "add_trap_evidence", "1", "--json", "{"],
      cwd: tempProjectDir("codetrap-cli-json-"),
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = new TextDecoder().decode(result.stderr);

    expect(result.exitCode).toBe(1);
    expect(stderr.trim().startsWith("Error:")).toBe(true);
    expect(stderr).not.toContain(" at ");
  });
});

function tempProjectDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(dir, ".codetrap"));
  return dir;
}
