import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixturePathKey, runCli, tempHome, tempProjectDir, type CliResult } from "./helpers";
import { CANDIDATE_SCHEMA_VERSION } from "../domain/candidate";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { Phase2Operations } from "../lib/phase2-operations";
import { Phase2Store } from "../lib/phase2-store";

// `learn` reads the *client* home, which is separate from the codetrap home the
// CLI harness isolates. CODETRAP_CLIENT_HOME points it at a fixture instead of
// the developer's real ~/.claude and ~/.codex.
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

describe("Phase 1C — learn CLI", () => {
  test("sources reports both clients without opening a transcript", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-sources-");
    writeClaudeSession(clientHome, "s1", cwd);

    const result = learnCli(["learn", "sources", "--json"], cwd, home, clientHome);
    expect(result.exitCode).toBe(0);
    const sources = JSON.parse(result.stdout).sources;
    expect(sources.map((s: { source: string }) => s.source).sort())
      .toEqual(["claude-code-sessions", "codex-sessions"]);

    const claude = sources.find((s: { source: string }) => s.source === "claude-code-sessions");
    const codex = sources.find((s: { source: string }) => s.source === "codex-sessions");
    expect(claude).toMatchObject({ available: true, session_count: 1 });
    // Both clients are always reported, present or not — a missing one is a
    // fact about the machine, not a reason to hide the row (§3.1).
    expect(codex).toMatchObject({ available: false, session_count: 0 });
  });

  test("review writes the three artifacts and no durable state", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-review-");
    writeClaudeSession(clientHome, "s1", cwd);

    const result = learnCli(
      ["learn", "review", "--source", "claude-code-sessions", "--json"],
      cwd, home, clientHome
    );
    expect(result.exitCode).toBe(0);
    const review = JSON.parse(result.stdout);

    expect(existsSync(review.source_manifest_path)).toBe(true);
    expect(existsSync(review.evidence_pack_path)).toBe(true);
    expect(existsSync(review.prompt_path)).toBe(true);
    expect(review.durable_writes).toBe(0);

    const prompt = readFileSync(review.prompt_path, "utf-8");
    expect(prompt).toContain("用ASCII流程图结合通俗易懂的例子讲解");
    expect(prompt).toContain("concrete, plain-language example");
    expect(prompt).toContain("This format applies only to insights");
    expect(prompt).toContain("`collection.position`");
    expect(prompt).toContain("`candidate_kind: insight`");
    expect(prompt).toContain("source_coverage");
    expect(prompt).toContain("source_unit_refs");
    expect(prompt).toContain("context_sections");
    expect(prompt).toContain("sampled");

    // §3.2: pointers and capped excerpts, never the transcript.
    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    expect(pack.items.length).toBeGreaterThan(0);
    expect(pack.source_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(prompt).toContain(pack.source_fingerprint);
    for (const item of pack.items) expect(item.excerpt.length).toBeLessThanOrEqual(500);

    // Nothing reached the trap store or the candidate inbox.
    const traps = learnCli(["list", "--status", "all", "--json"], cwd, home, clientHome);
    expect(JSON.parse(traps.stdout)).toHaveLength(0);
  });

  test("review refuses a source with no history rather than writing an empty pack", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-empty-");
    const result = learnCli(
      ["learn", "review", "--source", "codex-sessions", "--json"],
      cwd, home, clientHome
    );
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("No codex-sessions history found");
  });

  test("an unknown source is refused with the valid list", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-bad-source-");
    const result = learnCli(["learn", "sources", "--source", "gemini", "--json"], cwd, home, clientHome);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("codex-sessions");
  });

  test("stage verifies every evidence ref and reports each rejection", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-stage-");
    writeClaudeSession(clientHome, "s1", cwd);
    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome).stdout
    );
    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    const goodRef = pack.items[0].ref;

    writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify([
      {
        title: "A well-formed lesson",
        trigger: "When the build times out at the default two minutes.",
        lesson: "The default Bash timeout kills long builds.",
        recommended_action: "Pass an explicit timeout for long builds.",
        rationale: "Otherwise the failure looks like a build bug rather than a harness limit.",
        evidence: [{ ref: goodRef }],
      },
      {
        title: "Invented evidence",
        trigger: "When an agent cites something it never read.",
        lesson: "Paraphrase is not evidence.",
        recommended_action: "Cite real refs.",
        evidence: [{ ref: "no-such-session#42" }],
      },
      {
        title: "No trigger",
        lesson: "Something.",
        recommended_action: "Something else.",
        evidence: [{ ref: goodRef }],
      },
      {
        title: "No evidence at all",
        trigger: "When a lesson arrives with no support.",
        lesson: "Unsupported.",
        recommended_action: "Support it.",
        evidence: [],
      },
    ], null, 2));

    const dry = learnCli(["learn", "stage", "--review-dir", review.review_dir, "--json"], cwd, home, clientHome);
    expect(dry.exitCode).toBe(0);
    const dryReport = JSON.parse(dry.stdout);
    expect(dryReport.applied).toBe(false);
    expect(dryReport.staged).toHaveLength(0);
    expect(dryReport.rejected).toHaveLength(3);

    const reasons = dryReport.rejected.flatMap((r: { errors: string[] }) => r.errors).join(" ");
    expect(reasons).toContain("does not appear in evidence-pack.json");
    expect(reasons).toContain("trigger is required");
    expect(reasons).toContain("evidence is required");

    const applied = JSON.parse(
      learnCli(["learn", "stage", "--review-dir", review.review_dir, "--apply", "--json"], cwd, home, clientHome).stdout
    );
    expect(applied.applied).toBe(true);
    expect(applied.staged).toHaveLength(1);
    expect(applied.durable_trap_writes).toBe(0);

    // Staging fills the inbox and writes no trap.
    expect(JSON.parse(learnCli(["list", "--status", "all", "--json"], cwd, home, clientHome).stdout)).toHaveLength(0);

    const candidates = JSON.parse(
      learnCli(["session", "candidates", applied.staged[0].session_id, "--json"], cwd, home, clientHome).stdout
    ).candidates;
    expect(candidates[0]).toMatchObject({
      status: "proposed",
      candidate_kind: "pitfall_trap",
      source_agent: "claude-code",
      schema_version: CANDIDATE_SCHEMA_VERSION,
    });
    expect(candidates[0].source_manifest_refs).toEqual([goodRef]);
    expect(candidates[0].rationale).toContain("harness limit");
  });

  test("stage refuses a review directory that has no candidates yet", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-no-candidates-");
    writeClaudeSession(clientHome, "s1", cwd);
    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome).stdout
    );
    const result = learnCli(["learn", "stage", "--review-dir", review.review_dir], cwd, home, clientHome);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("lesson-candidates.json");
  });

  test("a previously suppressed lesson is not re-staged by a new review", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-suppressed-");
    writeClaudeSession(clientHome, "s1", cwd);
    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome).stdout
    );
    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    const candidate = {
      title: "A lesson the user will skip",
      trigger: "When the same lesson keeps coming back from mining.",
      lesson: "Suppression must survive a new review, not just a new session.",
      recommended_action: "Consult the project suppression index before staging.",
      evidence: [{ ref: pack.items[0].ref }],
    };
    writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify([candidate]));

    const first = JSON.parse(
      learnCli(["learn", "stage", "--review-dir", review.review_dir, "--apply", "--json"], cwd, home, clientHome).stdout
    );
    expect(first.staged).toHaveLength(1);

    learnCli([
      "session", "reject", first.staged[0].candidate_id,
      "--session", first.staged[0].session_id,
      "--reason", "Not useful.",
    ], cwd, home, clientHome);

    const second = JSON.parse(
      learnCli(["learn", "stage", "--review-dir", review.review_dir, "--apply", "--json"], cwd, home, clientHome).stdout
    );
    expect(second.staged).toHaveLength(0);
    expect(second.suppressed).toHaveLength(1);
    expect(second.suppressed[0].reason).toBe("Not useful.");
  });

  test("an unclassified insight is not silently relabelled a pitfall trap", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-kind-");
    writeClaudeSession(clientHome, "s1", cwd);
    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome).stdout
    );
    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify([{
      title: "Why the default timeout exists",
      candidate_kind: "unclassified",
      destination_hint: "insight",
      trigger: "When wondering why long builds are killed at two minutes.",
      lesson: "The cap is a harness default, not a project setting.",
      recommended_action: "Understand the boundary before changing build config.",
      evidence: [{ ref: pack.items[0].ref }],
    }]));

    const applied = JSON.parse(
      learnCli(["learn", "stage", "--review-dir", review.review_dir, "--apply", "--json"], cwd, home, clientHome).stdout
    );
    const candidate = JSON.parse(
      learnCli(["session", "candidates", applied.staged[0].session_id, "--json"], cwd, home, clientHome).stdout
    ).candidates[0];

    // §8.1: the agent said this is not a trap. Relabelling it would make the
    // Phase 1B approval bind a destination the user never saw.
    expect(candidate.candidate_kind).toBe("unclassified");
    expect(candidate.destination_hint).toBe("insight");
  });

  test("a study insight keeps conversation collection metadata through staging", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-insight-collection-");
    writeClaudeSession(clientHome, "s1", cwd);
    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome).stdout
    );
    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify([{
      title: "Understand tool approval",
      candidate_kind: "insight",
      trigger: "When learning how an agent tool call becomes authorized.",
      lesson: "A proposal and an authorized write are separate states.",
      recommended_action: "proposal -> review -> approval -> apply\n\nExample: reading a draft does not save it.",
      rationale: "The separation is the core trust model.",
      tags: ["authorization"],
      source_type: "conversation",
      topics: ["Agent safety"],
      source_unit_refs: ["approval-boundary"],
      collection: {
        id: "conversation-s1",
        title: "Agent authorization basics",
        source_type: "conversation",
        context_sections: [{
          id: "review-background",
          title: "Review background",
          body: "This review came from a bounded conversation sample.",
          source_unit_refs: ["review-background"],
        }],
        source_coverage: {
          version: 1,
          mode: "sampled",
          source_fingerprint: pack.source_fingerprint,
          units: [
            { id: "approval-boundary", title: "Tool approval boundary", disposition: "learn" },
            { id: "review-background", title: "Review background", disposition: "learn" },
          ],
        },
        position: 1,
      },
      evidence: [{ ref: pack.items[0].ref }],
    }]));

    const applied = JSON.parse(
      learnCli(["learn", "stage", "--review-dir", review.review_dir, "--apply", "--json"], cwd, home, clientHome).stdout
    );
    const candidate = JSON.parse(
      learnCli(["session", "candidates", applied.staged[0].session_id, "--json"], cwd, home, clientHome).stdout
    ).candidates[0];
    expect(candidate.candidate_kind).toBe("insight");
    expect(candidate.destination_payload).toMatchObject({
      title: "Understand tool approval",
      source_type: "conversation",
      topics: ["Agent safety"],
      source_unit_refs: ["approval-boundary"],
      collection: {
        id: "conversation-s1",
        title: "Agent authorization basics",
        position: 1,
        context_sections: [expect.objectContaining({
          id: "review-background",
          source_unit_refs: ["review-background"],
        })],
      },
    });
    expect(candidate.destination_payload.source_refs).toEqual([pack.items[0].ref]);
  });

  test("stamps one contract on a multi-chapter conversation before Web edit and reverse apply", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-conversation-batch-");
    writeClaudeSession(clientHome, "s1", cwd);
    const reviewResult = learnCli(
      ["learn", "review", "--source", "claude-code-sessions", "--json"],
      cwd, home, clientHome
    );
    expect(reviewResult.exitCode, reviewResult.stderr).toBe(0);
    const review = JSON.parse(reviewResult.stdout);
    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    expect(pack.items.length).toBeGreaterThanOrEqual(2);
    const sourceCoverage = {
      version: 1,
      mode: "sampled",
      source_fingerprint: pack.source_fingerprint,
      units: [
        { id: "timeout", title: "Timeout symptom", disposition: "learn" },
        { id: "override", title: "Timeout override", disposition: "learn" },
      ],
    };
    const candidates = ([
      [2, "Override the timeout", "override", "configuration", pack.items[1].ref],
      [1, "Recognize the timeout", "timeout", "diagnosis", pack.items[0].ref],
    ] as const).map(([position, title, sourceUnit, topic, evidenceRef]) => ({
      title,
      candidate_kind: "insight",
      trigger: "When learning why an agent command stops early.",
      lesson: `${title} is one part of the same conversation lesson.`,
      recommended_action: `${sourceUnit} -> explain -> apply`,
      rationale: "Both chapters belong in one ordered learning collection.",
      source_type: "conversation",
      topics: [topic],
      source_unit_refs: [sourceUnit],
      collection: {
        id: "conversation-timeout-guide",
        title: "Conversation timeout guide",
        source_coverage: sourceCoverage,
        position,
      },
      evidence: [{ ref: evidenceRef }],
    }));
    writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify(candidates));

    const stageResult = learnCli(
      ["learn", "stage", "--review-dir", review.review_dir, "--apply", "--json"],
      cwd, home, clientHome
    );
    expect(stageResult.exitCode, `${stageResult.stderr}\n${stageResult.stdout}`).toBe(0);
    const staged = JSON.parse(stageResult.stdout);
    expect(staged.rejected).toEqual([]);
    expect(staged.staged).toHaveLength(2);
    const sessionId = staged.staged[0].session_id;
    const sessionResult = learnCli(
      ["session", "candidates", sessionId, "--json"],
      cwd, home, clientHome
    );
    expect(sessionResult.exitCode, sessionResult.stderr).toBe(0);
    const stagedCandidates = JSON.parse(sessionResult.stdout).candidates;
    const expectedRefs = [pack.items[0].ref, pack.items[1].ref];
    for (const candidate of stagedCandidates) {
      expect(candidate.destination_payload.collection).toMatchObject({
        id: "conversation-timeout-guide",
        source_type: "conversation",
        source_refs: expectedRefs,
        topics: ["diagnosis", "configuration"],
      });
    }

    const traps = new TrapOperations(new TrapStore(cwd, undefined, home));
    const phase2 = new Phase2Operations(cwd, traps);
    expect(() => phase2.edit(
      sessionId,
      stagedCandidates[0].id,
      stagedCandidates[0].destination_payload
    )).not.toThrow();

    const reverseReadingOrder = [...stagedCandidates].sort((left: any, right: any) =>
      right.destination_payload.collection.position - left.destination_payload.collection.position
    );
    for (const candidate of reverseReadingOrder) {
      const approved = learnCli(
        ["session", "approve", candidate.id, "--session", sessionId, "--executor", "user", "--json"],
        cwd, home, clientHome
      );
      expect(approved.exitCode, `${approved.stderr}\n${approved.stdout}`).toBe(0);
      const applied = learnCli(
        ["phase2", "apply", candidate.id, "--session", sessionId, "--executor", "user", "--json"],
        cwd, home, clientHome
      );
      expect(applied.exitCode, `${applied.stderr}\n${applied.stdout}`).toBe(0);
    }

    const library = new Phase2Store(cwd).learningLibrary();
    expect(library.collections).toHaveLength(1);
    expect(library.collection_items).toHaveLength(2);
    expect(library.collections[0]).toMatchObject({
      id: "conversation-timeout-guide",
      source_refs: expectedRefs,
      topics: ["diagnosis", "configuration"],
      coverage_summary: { status: "sampled", covered_units: 2, learn_units: 2 },
    });
  });

  test("rejects every candidate in a study collection when one learnable source unit is unaccounted for", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-insight-gap-");
    writeClaudeSession(clientHome, "s1", cwd);
    const review = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome).stdout
    );
    const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
    const manifest = {
      version: 1,
      mode: "sampled",
      source_fingerprint: pack.source_fingerprint,
      units: [
        { id: "unit-1", title: "First sampled idea", disposition: "learn" },
        { id: "unit-2", title: "Second sampled idea", disposition: "learn" },
      ],
    };
    const candidates = [1, 2].map((position) => ({
      title: `Partial lesson ${position}`,
      candidate_kind: "insight",
      trigger: "When reviewing a sampled conversation.",
      lesson: "Only the first source unit was assigned.",
      recommended_action: "sample -> inventory -> account",
      rationale: "A partial batch must not look complete.",
      source_type: "conversation",
      source_unit_refs: ["unit-1"],
      collection: {
        id: "conversation-gap",
        title: "Conversation gap",
        source_type: "conversation",
        source_coverage: manifest,
        position,
      },
      evidence: [{ ref: pack.items[0].ref }],
    }));
    writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify(candidates));

    const dry = JSON.parse(
      learnCli(["learn", "stage", "--review-dir", review.review_dir, "--json"], cwd, home, clientHome).stdout
    );
    expect(dry.rejected).toHaveLength(2);
    expect(dry.rejected.every((entry: { errors: string[] }) =>
      entry.errors.some((error) => error.includes("unresolved learn units: unit-2"))
    )).toBe(true);
  });

  test("review artifacts are gitignored at creation", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-gitignore-");
    writeClaudeSession(clientHome, "s1", cwd);
    learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome);

    const ignore = join(cwd, ".codetrap", "learning", ".gitignore");
    expect(existsSync(ignore)).toBe(true);
    expect(readFileSync(ignore, "utf-8")).toContain("*");
  });

  test("review states the scope it actually used", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-scope-");
    writeClaudeSession(clientHome, "s1", cwd);
    const result = JSON.parse(
      learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome).stdout
    );
    // Defaults are bounded and reported, never left implicit.
    expect(result.scope.session_cap).toBe(20);
    expect(result.scope.project_only).toBe(false);
    expect(Date.parse(result.scope.since)).toBeLessThan(Date.now());
    expect(result.manifest_totals.files_read).toBe(1);
  });

  test("reviews lists what has been prepared", () => {
    const { cwd, home, clientHome } = project("codetrap-1c-reviews-");
    writeClaudeSession(clientHome, "s1", cwd);
    learnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome);
    const listed = JSON.parse(learnCli(["learn", "reviews", "--json"], cwd, home, clientHome).stdout);
    expect(listed.reviews).toHaveLength(1);
    expect(listed.reviews[0].review_id).toContain("claude-code-sessions");
    expect(listed.reviews[0].deleted).toBe(false);
  });
});

function project(prefix: string): { cwd: string; home: string; clientHome: string } {
  return { cwd: tempProjectDir(prefix), home: tempHome(), clientHome: tempHome("codetrap-client-home-") };
}

function writeClaudeSession(clientHome: string, sessionId: string, cwd: string): void {
  const dir = join(clientHome, ".claude", "projects", fixturePathKey(cwd));
  mkdirSync(dir, { recursive: true });
  const base = { sessionId, cwd, version: "2.1.204", gitBranch: "main" };
  const lines = [
    JSON.stringify({ ...base, type: "user", timestamp: "2026-07-01T10:00:00.000Z", message: { role: "user", content: [{ type: "text", text: "The build keeps timing out at two minutes." }] } }),
    JSON.stringify({ ...base, type: "assistant", timestamp: "2026-07-01T10:00:05.000Z", message: { role: "assistant", content: [{ type: "text", text: "That is the default Bash timeout; pass an explicit timeout." }] } }),
  ];
  writeFileSync(join(dir, `${sessionId}.jsonl`), `${lines.join("\n")}\n`);
}
