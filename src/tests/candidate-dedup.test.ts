import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, tempHome, tempProjectDir, type CliResult } from "./helpers";
import { verifyCoverage } from "../lib/coverage-verify";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { TURN_NORMALIZER_VERSION } from "../domain/learning-source";

function learnCli(args: string[], cwd: string, home: string, clientHome: string): CliResult {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", join(import.meta.dir, "..", "index.ts"), ...args],
    cwd,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      CODETRAP_CLIENT_HOME: clientHome,
      CODETRAP_EMBEDDING_PROVIDER: "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}

describe("Phase 1D — exact duplicates consolidate, semantic ones cluster", () => {
  test("C2: the same lesson from two clients becomes one candidate with both sources", () => {
    const env = project("codetrap-1d-consolidate-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);
    writeCodexSession(env.clientHome, "codex-1", env.cwd);

    const lesson = {
      title: "Long builds exceed the default two-minute Bash timeout",
      trigger: "When running a build or test command that takes longer than two minutes.",
      lesson: "The default timeout kills it and the output looks like a build failure.",
      recommended_action: "Pass an explicit timeout for long-running commands.",
      evidence: [] as { ref: string }[],
    };

    const first = stageOne(env, "claude-code-sessions", lesson);
    expect(first.staged).toHaveLength(1);
    expect(first.consolidated).toHaveLength(0);

    // Same material fields, mined again from the other client.
    const second = stageOne(env, "codex-sessions", lesson);
    expect(second.staged).toHaveLength(0);
    expect(second.consolidated).toHaveLength(1);

    const [entry] = second.consolidated;
    // §13.4: consolidates only identical hashes, and preserves both provenances.
    expect(entry.contributing_sources.sort()).toEqual(["claude-code", "codex"]);

    const candidates = allCandidates(env.cwd);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].contributing_sources.sort()).toEqual(["claude-code", "codex"]);
    // Combined evidence, not replaced evidence.
    expect(candidates[0].evidence.length).toBeGreaterThan(1);
    expect(candidates[0].source_manifest_refs.length).toBeGreaterThan(1);
  }, 60_000);

  test("C3: a near-match stays a separate candidate inside one review cluster", () => {
    const env = project("codetrap-1d-cluster-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);

    const first = stageOne(env, "claude-code-sessions", {
      title: "Long builds exceed the default Bash timeout",
      trigger: "When running a build that takes longer than the default timeout.",
      lesson: "The default timeout kills the build and hides the real output.",
      recommended_action: "Pass an explicit timeout for long-running build commands.",
      evidence: [],
    });
    expect(first.staged).toHaveLength(1);

    // Same lesson, different words: similar but not an exact hash match.
    const second = stageOne(env, "claude-code-sessions", {
      title: "Long builds exceed the default Bash timeout limit",
      trigger: "When running a build that runs past the default timeout window.",
      lesson: "The default timeout terminates the build and masks the real output.",
      recommended_action: "Pass an explicit longer timeout for slow build commands.",
      evidence: [],
    });

    expect(second.consolidated).toHaveLength(0);
    expect(second.staged).toHaveLength(1);

    // Both survive; the CLI advises, it does not merge.
    const candidates = allCandidates(env.cwd);
    expect(candidates).toHaveLength(2);

    const clustered = second.staged[0];
    expect(clustered.review_cluster).toMatch(/^cluster:/);
    expect(clustered.similar_to?.[0].title).toContain("Long builds exceed the default Bash timeout");
    expect(clustered.similar_to?.[0].score).toBeGreaterThanOrEqual(0.5);
  }, 60_000);

  test("C2: a rejected candidate never absorbs new provenance", () => {
    const env = project("codetrap-1d-rejected-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);
    const lesson = {
      title: "A lesson the user rejects",
      trigger: "When the user declines this lesson and it is mined again.",
      lesson: "Consolidating onto a rejected candidate would revive it silently.",
      recommended_action: "Treat a closed decision as closed.",
      evidence: [],
    };

    const first = stageOne(env, "claude-code-sessions", lesson);
    learnCli([
      "session", "reject", first.staged[0].candidate_id,
      "--session", first.staged[0].session_id, "--reason", "no", "--json",
    ], env.cwd, env.home, env.clientHome);

    // It must route to suppression, not to consolidation.
    const second = stageOne(env, "claude-code-sessions", lesson);
    expect(second.consolidated).toHaveLength(0);
    expect(second.staged).toHaveLength(0);
    expect(second.suppressed).toHaveLength(1);
  }, 60_000);
});

describe("Phase 1D — review fixes", () => {
  test("a traversing review id cannot delete anything outside the reviews tree", () => {
    const env = project("codetrap-1d-traversal-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);
    learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], env.cwd, env.home, env.clientHome);

    // Before the guard this rmSync'd the whole .codetrap directory, traps.db included.
    for (const bad of ["../..", "..", ".", "../../../tmp"]) {
      const result = learnCli(["learn", "delete", bad], env.cwd, env.home, env.clientHome);
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain("Invalid review id");
    }
    expect(existsSync(join(env.cwd, ".codetrap", "project.json"))).toBe(true);
    expect(existsSync(join(env.cwd, ".codetrap", "learning", "reviews"))).toBe(true);
  }, 60_000);

  test("C3: both sides of a cluster are labelled, not just the newer one", () => {
    const env = project("codetrap-1d-two-sided-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);

    const first = stageOne(env, "claude-code-sessions", {
      title: "Long builds exceed the default Bash timeout",
      trigger: "When running a build that takes longer than the default timeout.",
      lesson: "The default timeout kills the build and hides the real output.",
      recommended_action: "Pass an explicit timeout for long-running build commands.",
      evidence: [],
    });
    const second = stageOne(env, "claude-code-sessions", {
      title: "Long builds exceed the default Bash timeout limit",
      trigger: "When running a build that runs past the default timeout window.",
      lesson: "The default timeout terminates the build and masks the real output.",
      recommended_action: "Pass an explicit longer timeout for slow build commands.",
      evidence: [],
    });

    const candidates = allCandidates(env.cwd);
    expect(candidates).toHaveLength(2);
    const clusters = candidates.map((c) => c.review_cluster);
    // One shared cluster id on both members.
    expect(clusters[0]).toBeDefined();
    expect(clusters[0]).toBe(clusters[1]);
    for (const candidate of candidates) {
      expect(candidate.similar_to.length).toBeGreaterThan(0);
    }
    expect(second.staged[0].review_cluster).toBe(first.staged[0].session_id ? clusters[0] : clusters[0]);
  }, 60_000);

  test("C2: an already-committed lesson is reported, never silently modified", async () => {
    const env = project("codetrap-1d-committed-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);
    const lesson = {
      title: "A lesson that gets committed before being re-mined",
      trigger: "When the same lesson is mined again after it was already committed.",
      lesson: "Merging evidence onto it would desync the candidate from its trap.",
      recommended_action: "Report it and leave the durable trap alone.",
      evidence: [],
    };

    const first = stageOne(env, "claude-code-sessions", lesson);
    const { candidate_id, session_id } = first.staged[0];
    learnCli(["session", "approve", candidate_id, "--session", session_id, "--json"], env.cwd, env.home, env.clientHome);
    const accepted = learnCli(
      ["session", "accept", candidate_id, "--session", session_id, "--executor", "agent", "--json"],
      env.cwd, env.home, env.clientHome
    );
    expect(accepted.exitCode).toBe(0);
    const trapId = JSON.parse(accepted.stdout).trap_id;

    const second = stageOne(env, "claude-code-sessions", lesson);
    expect(second.consolidated).toHaveLength(0);
    expect(second.staged).toHaveLength(0);
    expect(second.already_committed).toHaveLength(1);
    expect(second.already_committed[0]).toMatchObject({ trap_id: trapId });

    // The durable trap is untouched, and no duplicate candidate appeared.
    expect(allCandidates(env.cwd)).toHaveLength(1);
  }, 60_000);

  test("re-running the same review does not duplicate evidence", () => {
    const env = project("codetrap-1d-evidence-dup-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);

    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], env.cwd, env.home, env.clientHome).stdout
    );
    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify([{
      title: "A lesson staged twice from one review",
      trigger: "When a user re-runs the printed next action after a partial failure.",
      lesson: "Appending evidence unconditionally inflates apparent support.",
      recommended_action: "Dedupe merged evidence by source ref.",
      evidence: [{ ref: pack.items[0].ref }],
    }]));

    const stage = () => learnCli(
      ["learn", "stage", "--review-dir", review.review_dir, "--apply", "--json"],
      env.cwd, env.home, env.clientHome
    );
    stage();
    const afterFirst = allCandidates(env.cwd)[0].evidence.length;
    stage();
    // The first re-run records the re-observation once...
    const afterSecond = allCandidates(env.cwd)[0].evidence.length;
    expect(afterSecond).toBe(afterFirst + 1);
    // ...and every further re-run of the same review adds nothing.
    stage();
    stage();
    expect(allCandidates(env.cwd)[0].evidence.length).toBe(afterSecond);
  }, 60_000);
});

describe("Phase 1D — coverage claims are verified, not trusted", () => {
  test("a claimed trap id, file and anchor are each checked", () => {
    const cwd = tempProjectDir("codetrap-1d-coverage-");
    const home = tempHome();
    mkdirSync(join(cwd, "docs"), { recursive: true });
    writeFileSync(join(cwd, "docs", "guide.md"), "# Title\n\n## Testing\n\nsome guidance\n");
    const traps = new TrapOperations(new TrapStore(cwd, undefined, home));
    const added = traps.addTrap({
      title: "An existing trap",
      category: "convention",
      scope: "project",
      severity: "warning",
      context: "When something happens.",
      mistake: "Doing the wrong thing.",
      fix: "Do the right thing.",
    });

    const coverage = verifyCoverage(
      {
        claim: "extends",
        covered_by: [`trap:${added.id}`, "trap:9999"],
        overlaps: ["docs/guide.md#testing", "docs/guide.md#nonexistent", "docs/missing.md", "../../etc/passwd"],
      },
      { projectRoot: cwd, traps, knownCandidateIds: new Set(["s1/cand-001", "s2/cand-001", "s1/cand-007"]) }
    );

    expect(coverage?.claim).toBe("extends");
    expect(coverage?.verified_all).toBe(false);
    const byRef = Object.fromEntries((coverage?.refs ?? []).map((ref) => [ref.ref, ref]));

    expect(byRef[`trap:${added.id}`]).toMatchObject({ kind: "trap", verified: true });
    expect(byRef["trap:9999"]).toMatchObject({ kind: "trap", verified: false });
    expect(byRef["docs/guide.md#testing"]).toMatchObject({ kind: "file", verified: true });
    expect(byRef["docs/guide.md#nonexistent"]).toMatchObject({ kind: "file", verified: false });
    expect(byRef["docs/missing.md"]).toMatchObject({ kind: "file", verified: false });
    // A coverage ref is a pointer into the project, not a way to probe the disk.
    expect(byRef["../../etc/passwd"]).toMatchObject({ verified: false });
    expect(byRef["../../etc/passwd"].detail).toContain("outside the project");
  });

  test("a bare candidate ref is only accepted when it is unambiguous", () => {
    const cwd = tempProjectDir("codetrap-1d-cand-ref-");
    const home = tempHome();
    const traps = new TrapOperations(new TrapStore(cwd, undefined, home));
    const context = {
      projectRoot: cwd,
      traps,
      // Candidate ids are per-session, so `cand-001` exists in both.
      knownCandidateIds: new Set(["s1/cand-001", "s2/cand-001", "s1/cand-007"]),
    };

    const coverage = verifyCoverage(
      { covered_by: ["cand-007", "cand-001", "s2/cand-001", "cand-999"] },
      context
    );
    const byRef = Object.fromEntries((coverage?.refs ?? []).map((ref) => [ref.ref, ref]));

    expect(byRef["cand-007"]).toMatchObject({ verified: true });
    // Ambiguous: present in two sessions, so it proves nothing.
    expect(byRef["cand-001"]).toMatchObject({ verified: false });
    expect(byRef["cand-001"].detail).toContain("ambiguous");
    expect(byRef["s2/cand-001"]).toMatchObject({ verified: true });
    expect(byRef["cand-999"]).toMatchObject({ verified: false });
  });

  test("an unverified claim flags the candidate instead of dropping it", () => {
    const env = project("codetrap-1d-coverage-flag-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);

    const result = stageOne(env, "claude-code-sessions", {
      title: "A lesson claiming coverage that does not exist",
      trigger: "When an agent claims a trap id it never checked.",
      lesson: "An unverified claim must be visible, not silently accepted.",
      recommended_action: "Verify every claimed ref at staging.",
      evidence: [],
      coverage: { claim: "duplicates", covered_by: ["trap:4242"] },
    });

    // §8.4: reported, not dropped.
    expect(result.staged).toHaveLength(1);
    expect(result.coverage_flagged).toHaveLength(1);
    expect(result.coverage_flagged[0].failed_refs).toEqual(["trap:4242"]);

    const candidate = allCandidates(env.cwd)[0];
    expect(candidate.coverage.verified_all).toBe(false);
    expect(candidate.coverage.refs[0].detail).toContain("no trap #4242");
  }, 60_000);
});

describe("Phase 1D — retention and normalizer drift", () => {
  test("deleting a review removes excerpts and keeps audit metadata", () => {
    const env = project("codetrap-1d-delete-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);
    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], env.cwd, env.home, env.clientHome).stdout
    );

    const deleted = JSON.parse(
      learnCli(["learn", "delete", review.review_id, "--json"], env.cwd, env.home, env.clientHome).stdout
    );

    // The excerpt-bearing artifacts are gone.
    expect(existsSync(review.evidence_pack_path)).toBe(false);
    expect(existsSync(review.source_manifest_path)).toBe(false);
    expect(existsSync(review.prompt_path)).toBe(false);

    // §3.2: only non-sensitive audit metadata survives.
    expect(deleted.retained.files_read).toBe(1);
    expect(deleted.retained.file_hashes[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(deleted.retained.roots.length).toBeGreaterThan(0);
    expect(JSON.stringify(deleted)).not.toContain("timing out");

    const listed = JSON.parse(
      learnCli(["learn", "reviews", "--json"], env.cwd, env.home, env.clientHome).stdout
    );
    expect(listed.reviews[0]).toMatchObject({ review_id: review.review_id, deleted: true });
  }, 60_000);

  test("a pack from a different normalizer is refused rather than mis-resolved", () => {
    const env = project("codetrap-1d-normalizer-");
    writeClaudeSession(env.clientHome, "claude-1", env.cwd);
    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], env.cwd, env.home, env.clientHome).stdout
    );

    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    expect(pack.normalizer_version).toBe(TURN_NORMALIZER_VERSION);
    pack.normalizer_version = 99;
    writeFileSync(review.evidence_pack_path, JSON.stringify(pack, null, 2));
    writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify([{
      title: "Anything",
      trigger: "When the pack predates the current turn indexing.",
      lesson: "Refs would resolve to different turns.",
      recommended_action: "Rebuild the review.",
      evidence: [{ ref: pack.items[0].ref }],
    }]));

    const result = learnCli(
      ["learn", "stage", "--review-dir", review.review_dir, "--apply"],
      env.cwd, env.home, env.clientHome
    );
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("turn normalizer v99");
  }, 60_000);
});

// --- helpers ------------------------------------------------------------

type Env = { cwd: string; home: string; clientHome: string };

function project(prefix: string): Env {
  const env = { cwd: tempProjectDir(prefix), home: tempHome(), clientHome: tempHome("codetrap-client-home-") };
  runCli(["init"], env.cwd, env.home);
  return env;
}

function stageOne(env: Env, source: string, lesson: Record<string, unknown>) {
  const review = JSON.parse(
    learnCli(["learn", "review", "--source", source, "--json"], env.cwd, env.home, env.clientHome).stdout
  );
  const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
  writeFileSync(
    join(review.review_dir, "lesson-candidates.json"),
    JSON.stringify([{ ...lesson, evidence: [{ ref: pack.items[0].ref }] }], null, 2)
  );
  const staged = learnCli(
    ["learn", "stage", "--review-dir", review.review_dir, "--apply", "--json"],
    env.cwd, env.home, env.clientHome
  );
  if (staged.exitCode !== 0) throw new Error(`stage failed: ${staged.stdout}${staged.stderr}`);
  return JSON.parse(staged.stdout);
}

function allCandidates(cwd: string): any[] {
  const root = join(cwd, ".codetrap", "sessions");
  if (!existsSync(root)) return [];
  const { readdirSync } = require("node:fs");
  return readdirSync(root, { withFileTypes: true })
    .filter((entry: { isDirectory: () => boolean; name: string }) => entry.isDirectory() && !entry.name.startsWith("."))
    .flatMap((entry: { name: string }) => {
      const path = join(root, entry.name, "candidate-traps.json");
      return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")).candidates : [];
    });
}

function writeClaudeSession(clientHome: string, sessionId: string, cwd: string): void {
  const dir = join(clientHome, ".claude", "projects", cwd.replace(/[\\/]/g, "-"));
  mkdirSync(dir, { recursive: true });
  const base = { sessionId, cwd, version: "2.1.204", gitBranch: "main" };
  writeFileSync(join(dir, `${sessionId}.jsonl`), `${[
    JSON.stringify({ ...base, type: "user", timestamp: "2026-07-01T10:00:00.000Z", message: { role: "user", content: [{ type: "text", text: "The build keeps timing out at two minutes." }] } }),
    JSON.stringify({ ...base, type: "assistant", timestamp: "2026-07-01T10:00:05.000Z", message: { role: "assistant", content: [{ type: "text", text: "That is the default Bash timeout." }] } }),
  ].join("\n")}\n`);
}

function writeCodexSession(clientHome: string, sessionId: string, cwd: string): void {
  const dir = join(clientHome, ".codex", "sessions", "2026", "07", "01");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `rollout-2026-07-01T10-00-00-${sessionId}.jsonl`), `${[
    JSON.stringify({ timestamp: "2026-07-01T10:00:00.000Z", type: "session_meta", payload: { id: sessionId, cwd, cli_version: "0.42.0" } }),
    JSON.stringify({ timestamp: "2026-07-01T10:00:01.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "The build keeps timing out at two minutes." }] } }),
  ].join("\n")}\n`);
}
