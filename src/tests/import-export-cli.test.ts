import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { TrapStore } from "../lib/store";
import { runCli, tempHome, tempProjectDir, trap } from "./helpers";

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
      source_type: "article",
      source_ref: "https://vllm.ai/blog/2025-10-28-kimi-k2-accuracy",
      related_files: ["src/api.ts"],
      note: "Captured from an external article.",
    }, "project");

    const exported = source.exportAll({ scope: "project" });
    expect(exported).toHaveLength(1);
    expect(exported[0].evidence[0]).toMatchObject({
      source_type: "article",
      source_ref: "https://vllm.ai/blog/2025-10-28-kimi-k2-accuracy",
      related_files: ["src/api.ts"],
      note: "Captured from an external article.",
    });
    expect(exported[0].path_globs).toEqual(["src/api/**"]);
    expect(exported[0].module).toBe("api");
    expect(exported[0].owner).toBe("platform");

    const destination = new TrapStore(tempProjectDir("codetrap-export-dest-"), undefined);
    destination.add(trap({ scope: "project", title: "Existing destination trap" }));

    expect(destination.importAll(exported)).toMatchObject({ imported: 1, total: 1, skipped: [] });

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
      source_type: "article",
      source_ref: "https://vllm.ai/blog/2025-10-28-kimi-k2-accuracy",
      note: "Captured from an external article.",
    });
    expect(JSON.parse(details?.evidence[0].related_files ?? "[]")).toEqual(["src/api.ts"]);
  });

  test("export→import preserves lifecycle fields and the supersede chain", () => {
    const source = new TrapStore(tempProjectDir("codetrap-lifecycle-source-"), undefined);
    const old = source.add(trap({ scope: "project", title: "Old superseded trap" }));
    const replacement = source.add(trap({ scope: "project", title: "Replacement trap" }));
    const archived = source.add(trap({ scope: "project", title: "Archived trap" }));
    source.supersede(old.id, replacement.id, "project");
    source.archive(archived.id, "project");
    source.hit(replacement.id, "project");
    source.hit(replacement.id, "project");

    const exported = source.exportAll({ scope: "project" });
    expect(exported).toHaveLength(3);

    const destination = new TrapStore(tempProjectDir("codetrap-lifecycle-dest-"), undefined);
    // Offset destination ids so a preserved chain proves remapping, not luck.
    destination.add(trap({ scope: "project", title: "Existing destination trap" }));
    expect(destination.importAll(exported)).toMatchObject({ imported: 3, total: 3, skipped: [] });

    const traps = destination.list({ scope: "project", status: "all" }).flatMap((group) => group.traps);
    const importedOld = traps.find((item) => item.title === "Old superseded trap");
    const importedReplacement = traps.find((item) => item.title === "Replacement trap");
    const importedArchived = traps.find((item) => item.title === "Archived trap");

    expect(importedOld).toMatchObject({ status: "superseded" });
    expect(importedArchived).toMatchObject({ status: "archived" });
    expect(importedReplacement).toMatchObject({
      status: "active",
      hit_count: 2,
      supersedes_id: importedOld?.id,
    });

    const sourceReplacement = source.get(replacement.id, "project");
    expect(importedReplacement?.created_at).toBe(sourceReplacement!.trap.created_at);
    expect(importedReplacement?.updated_at).toBe(sourceReplacement!.trap.updated_at);
  });

  test("import reports skipped records instead of silently dropping them", () => {
    const cwd = tempProjectDir("codetrap-import-skips-");
    const home = tempHome();
    const archive = [
      trap({ scope: "global", title: "Valid imported trap" }),
      { title: "Broken record with no required fields" },
      { ...trap({ scope: "global", title: "Bad category record" }), category: "not-a-category" },
    ];
    const file = join(cwd, "archive.json");
    writeFileSync(file, JSON.stringify(archive));

    const text = runCli(["import", file], cwd, home);
    expect(text.exitCode).toBe(1);
    expect(text.stderr).toContain("Imported 1 of 3 traps.");
    expect(text.stderr).toContain("Skipped 2 record(s):");
    expect(text.stderr).toContain("[1] Broken record with no required fields");
    expect(text.stderr).toContain("[2] Bad category record");

    const json = runCli(["import", file, "--json"], cwd, home);
    expect(json.exitCode).toBe(1);
    const payload = JSON.parse(json.stdout);
    expect(payload).toMatchObject({ success: false, imported: 1, total: 3 });
    expect(payload.skipped).toHaveLength(2);
    expect(payload.skipped[0]).toMatchObject({ index: 1, title: "Broken record with no required fields" });
    expect(typeof payload.skipped[0].error).toBe("string");
  });

  test("add_trap_evidence --input-json reports malformed JSON without a stack trace", () => {
    const home = tempHome();
    const result = runCli(["add_trap_evidence", "1", "--input-json", "{"], tempProjectDir("codetrap-cli-json-"), home);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.trim().startsWith("Error:")).toBe(true);
    expect(result.stderr).not.toContain(" at ");
  });

  test("legacy --json input gets a migration hint instead of silent misbehavior", () => {
    const home = tempHome();
    const result = runCli(
      ["add_trap_evidence", "1", "--json", '{"source_type":"commit"}'],
      tempProjectDir("codetrap-cli-json-"),
      home
    );

    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("JSON input moved to --input-json");
  });
});
