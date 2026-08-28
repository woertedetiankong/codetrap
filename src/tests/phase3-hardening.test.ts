import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { CandidateTrap } from "../domain/session";
import { Phase3Store } from "../lib/phase3-store";
import { finishSkillSnapshot, type SkillDirectorySnapshot } from "../lib/skill-artifact";
import { tempDir, tempProjectDir } from "./helpers";

describe("Phase 3 review hardening", () => {
  test("deduplicates snapshot objects, keeps commit metadata light, and preserves modes", () => {
    const cwd = tempProjectDir("codetrap-p3-snapshot-store-");
    const homes = { codex: tempDir("codetrap-p3-store-codex-"), claude: tempDir("codetrap-p3-store-claude-") };
    writeSharedSkill(homes.codex);
    writeSharedSkill(homes.claude);
    const store = new Phase3Store(cwd);
    const candidate = improvementCandidate(store, homes);
    const preview = store.preview(candidate, homes);

    const commit = store.apply("session-hardening", candidate, homes, preview);
    expect(commit.targets[0].before_snapshot_id).toBe(commit.targets[1].before_snapshot_id);
    expect(commit.targets[0].after_snapshot_id).toBe(commit.targets[1].after_snapshot_id);
    const snapshotDir = join(cwd, ".codetrap", "phase3", "snapshots");
    expect(readdirSync(snapshotDir).filter((name) => name.endsWith(".json"))).toHaveLength(2);

    const commitText = readFileSync(join(cwd, ".codetrap", "phase3", "skill-commits.json"), "utf-8");
    expect(JSON.parse(commitText).version).toBe(2);
    expect(commitText).not.toContain("content_base64");
    expect(Buffer.byteLength(commitText)).toBeLessThan(10_000);

    if (process.platform !== "win32") {
      for (const home of Object.values(homes)) {
        expect(statSync(join(skillTarget(home), "scripts", "run.sh")).mode & 0o777).toBe(0o755);
        expect(statSync(join(skillTarget(home), "scripts")).mode & 0o777).toBe(0o710);
        expect(statSync(skillTarget(home)).mode & 0o777).toBe(0o750);
      }
    }

    store.revert(commit.id);
    for (const home of Object.values(homes)) {
      expect(readFileSync(join(skillTarget(home), "SKILL.md"), "utf-8")).not.toContain("Hardened review step");
      if (process.platform !== "win32") {
        expect(statSync(join(skillTarget(home), "scripts", "run.sh")).mode & 0o777).toBe(0o755);
        expect(statSync(join(skillTarget(home), "scripts")).mode & 0o777).toBe(0o710);
        expect(statSync(skillTarget(home)).mode & 0o777).toBe(0o750);
      }
    }
  });

  test("restores both clients when the second target write fails", () => {
    const cwd = tempProjectDir("codetrap-p3-second-target-");
    const homes = { codex: tempDir("codetrap-p3-fail-codex-"), claude: tempDir("codetrap-p3-fail-claude-") };
    writeSharedSkill(homes.codex);
    writeSharedSkill(homes.claude);
    const before = Object.fromEntries(Object.entries(homes).map(([client, home]) => [client, directoryState(skillTarget(home))]));
    const store = new Phase3Store(cwd, {
      beforeTargetWrite: (_target, index) => {
        if (index === 1) throw new Error("injected second target failure");
      },
    });
    const candidate = improvementCandidate(store, homes);
    const preview = store.preview(candidate, homes);

    expect(() => store.apply("session-failure", candidate, homes, preview)).toThrow("injected second target failure");
    expect(directoryState(skillTarget(homes.codex))).toEqual(before.codex);
    expect(directoryState(skillTarget(homes.claude))).toEqual(before.claude);
    const snapshotDir = join(cwd, ".codetrap", "phase3", "snapshots");
    expect(existsSync(snapshotDir) ? readdirSync(snapshotDir).filter((name) => name.endsWith(".json")) : []).toEqual([]);
    expect(existsSync(join(cwd, ".codetrap", "phase3", "skill-commits.json"))).toBe(false);
  });

  test("refuses a snapshot-store overflow before changing either target", () => {
    const cwd = tempProjectDir("codetrap-p3-store-limit-");
    const homes = { codex: tempDir("codetrap-p3-limit-codex-"), claude: tempDir("codetrap-p3-limit-claude-") };
    writeSharedSkill(homes.codex);
    writeSharedSkill(homes.claude);
    const before = directoryState(skillTarget(homes.codex));
    const store = new Phase3Store(cwd, { maxSnapshotStoreBytes: 1 });
    const candidate = improvementCandidate(store, homes);
    const preview = store.preview(candidate, homes);

    expect(() => store.apply("session-limit", candidate, homes, preview)).toThrow("byte limit");
    expect(directoryState(skillTarget(homes.codex))).toEqual(before);
    expect(directoryState(skillTarget(homes.claude))).toEqual(before);
    expect(existsSync(join(cwd, ".codetrap", "phase3", "snapshots"))).toBe(false);
  });

  test("refuses a corrupt deduplicated snapshot before changing either target", () => {
    const cwd = tempProjectDir("codetrap-p3-corrupt-snapshot-");
    const homes = { codex: tempDir("codetrap-p3-corrupt-codex-"), claude: tempDir("codetrap-p3-corrupt-claude-") };
    writeSharedSkill(homes.codex);
    writeSharedSkill(homes.claude);
    const store = new Phase3Store(cwd);
    const firstCandidate = improvementCandidate(store, homes);
    const firstCommit = store.apply("session-corrupt-first", firstCandidate, homes, store.preview(firstCandidate, homes));
    store.revert(firstCommit.id);
    const before = directoryState(skillTarget(homes.codex));
    const corruptId = firstCommit.targets[0].after_snapshot_id;
    writeFileSync(join(cwd, ".codetrap", "phase3", "snapshots", `${corruptId}.json`), "not json");

    const retryCandidate = improvementCandidate(store, homes);
    expect(() => store.apply(
      "session-corrupt-retry",
      retryCandidate,
      homes,
      store.preview(retryCandidate, homes)
    )).toThrow("Corrupt Phase 3 snapshot");
    expect(directoryState(skillTarget(homes.codex))).toEqual(before);
    expect(directoryState(skillTarget(homes.claude))).toEqual(before);
  });

  test("migrates a legacy inline commit lazily and keeps it rollback-compatible", () => {
    const cwd = tempProjectDir("codetrap-p3-legacy-migration-");
    const homes = { codex: tempDir("codetrap-p3-legacy-codex-"), claude: tempDir("codetrap-p3-legacy-claude-") };
    const before = textSnapshot("legacy-skill", "Before legacy install\n");
    const after = textSnapshot("legacy-skill", "After legacy install\n");
    for (const home of Object.values(homes)) writeSnapshotDirectory(skillTarget(home, "legacy-skill"), after);
    const phase3Dir = join(cwd, ".codetrap", "phase3");
    mkdirSync(phase3Dir, { recursive: true });
    writeFileSync(join(phase3Dir, "skill-commits.json"), `${JSON.stringify({
      version: 1,
      commits: [{
        id: "p3-legacy-inline",
        candidate_id: "cand-legacy",
        session_id: "session-legacy",
        destination: "skill_candidate",
        skill_name: "legacy-skill",
        committed_at: "2026-08-09T00:00:00.000Z",
        reverted_at: null,
        targets: (["codex", "claude"] as const).map((client) => ({
          client,
          client_home: homes[client],
          path: skillTarget(homes[client], "legacy-skill"),
          before,
          after,
        })),
      }],
    }, null, 2)}\n`);

    const store = new Phase3Store(cwd);
    expect(store.listCommits()[0].id).toBe("p3-legacy-inline");
    store.revert("p3-legacy-inline");
    for (const home of Object.values(homes)) {
      expect(readFileSync(join(skillTarget(home, "legacy-skill"), "SKILL.md"), "utf-8")).toContain("Before legacy install");
    }
    const migrated = readFileSync(join(phase3Dir, "skill-commits.json"), "utf-8");
    expect(JSON.parse(migrated).version).toBe(2);
    expect(migrated).not.toContain("content_base64");
    expect(readdirSync(join(phase3Dir, "snapshots")).filter((name) => name.endsWith(".json"))).toHaveLength(2);
  });
});

function improvementCandidate(store: Phase3Store, homes: Record<"codex" | "claude", string>): CandidateTrap {
  const prepared = store.prepareImprovement("hardening-skill", [{
    op: "append_text",
    path: "SKILL.md",
    content: "\nHardened review step.\n",
  }], homes);
  return {
    id: "cand-hardening",
    candidate_kind: "skill_candidate",
    destination_payload: prepared.payload,
  } as CandidateTrap;
}

function skillTarget(home: string, name = "hardening-skill"): string {
  return join(home, "skills", name);
}

function writeSharedSkill(home: string): void {
  const target = skillTarget(home);
  mkdirSync(join(target, "scripts"), { recursive: true });
  writeFileSync(join(target, "SKILL.md"), [
    "---",
    "name: hardening-skill",
    "description: Exercise Phase 3 hardening.",
    "---",
    "",
    "# Hardening Skill",
    "",
  ].join("\n"));
  writeFileSync(join(target, "scripts", "run.sh"), "#!/bin/sh\necho hardening\n");
  if (process.platform !== "win32") {
    chmodSync(join(target, "scripts", "run.sh"), 0o755);
    chmodSync(join(target, "scripts"), 0o710);
    chmodSync(target, 0o750);
  }
}

function textSnapshot(name: string, body: string): SkillDirectorySnapshot {
  const content = Buffer.from([
    "---",
    `name: ${name}`,
    "description: Legacy snapshot fixture.",
    "---",
    "",
    body,
  ].join("\n"));
  return finishSkillSnapshot([], [{
    path: "SKILL.md",
    content_base64: content.toString("base64"),
    sha256: createHash("sha256").update(content).digest("hex"),
  }]);
}

function writeSnapshotDirectory(path: string, snapshot: SkillDirectorySnapshot): void {
  mkdirSync(path, { recursive: true });
  for (const file of snapshot.files) writeFileSync(join(path, file.path), Buffer.from(file.content_base64, "base64"));
}

function directoryState(path: string): Array<{ path: string; type: "dir" | "file"; bytes?: string; mode?: number }> {
  if (!existsSync(path)) return [];
  const state: Array<{ path: string; type: "dir" | "file"; bytes?: string; mode?: number }> = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        state.push({ path: itemPath, type: "dir", ...(process.platform === "win32" ? {} : { mode: statSync(absolute).mode & 0o777 }) });
        walk(absolute, itemPath);
      } else {
        state.push({
          path: itemPath,
          type: "file",
          bytes: readFileSync(absolute).toString("base64"),
          ...(process.platform === "win32" ? {} : { mode: statSync(absolute).mode & 0o777 }),
        });
      }
    }
  };
  walk(path, "");
  return state;
}
