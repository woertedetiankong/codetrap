import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import {
  candidateContentHash,
  downgradeCandidates,
  migrateCandidate,
  migrateCandidates,
} from "../lib/candidate-envelope";
import { CANDIDATE_SCHEMA_VERSION, statusFromAxes } from "../domain/candidate";
import type { CandidateTrap } from "../domain/session";
import { runCli, tempHome, tempProjectDir } from "./helpers";
import { reviewedSessionCandidates } from "../lib/session-review";
import { candidateTrapKey, createCandidateTrap } from "../lib/session-capture";

// One test per Phase 1B acceptance criterion (§16), plus a fixture for each of
// the four legacy states the §8.3 mapping names.
describe("Phase 1B — candidate envelope migration", () => {
  test("destination candidates use one identity for capture, dedup, edits, and authorization", () => {
    const candidate = createCandidateTrap({
      trap: {
        title: "Keep review guidance current",
        category: "other",
        scope: "project",
        context: "When publishing reviewed guidance.",
        mistake: "Letting identity drift invalidates unchanged drafts.",
        fix: "Use one canonical content hash implementation.",
        severity: "warning",
      },
      evidence: [],
      candidate_kind: "docs_guidance",
      destination_payload: { path: "docs/review.md", content: "Review this first." },
    }, "cand-001");

    expect(candidate.content_hash).toBe(candidateContentHash(candidate));
    expect(candidateTrapKey(candidate)).toBe(candidateContentHash(candidate));
  });

  test("C1: the §8.3 mapping covers every legacy state", () => {
    const migrated = migrateCandidates(
      [
        legacy("cand-001", { status: "proposed" }),
        legacy("cand-002", { status: "rejected", rejected_at: "2026-07-01T00:00:00.000Z", rejection_reason: "Too broad." }),
        legacy("cand-003", { status: "accepted", accepted_trap_id: 7, accepted_scope: "project", accepted_at: "2026-07-02T00:00:00.000Z" }),
        legacy("cand-004", { status: "accepted" }),
      ],
      { trapExists: () => true }
    );

    expect(axes(migrated[0])).toEqual({ review_decision: "pending", delivery_state: "draft" });
    expect(axes(migrated[1])).toEqual({ review_decision: "rejected", delivery_state: "draft" });
    expect(axes(migrated[2])).toEqual({ review_decision: "approved", delivery_state: "committed" });
    // Accepted with no trap link: approved but only staged, and flagged.
    expect(axes(migrated[3])).toEqual({ review_decision: "approved", delivery_state: "staged" });
    expect(migrated[3].migration_warning).toContain("no trap link");
    expect(migrated[0].migration_warning).toBeUndefined();
  });

  test("C1: an accepted record whose trap is gone migrates to staged with a warning", () => {
    const [migrated] = migrateCandidates(
      [legacy("cand-001", { status: "accepted", accepted_trap_id: 9, accepted_scope: "project" })],
      { trapExists: () => false }
    );
    expect(axes(migrated)).toEqual({ review_decision: "approved", delivery_state: "staged" });
    expect(migrated.migration_warning).toContain("#9");
  });

  test("C1: migration is lossless and reversible — v1 -> v2 -> v1 round-trips exactly", () => {
    const originals = [
      legacy("cand-001", { status: "proposed" }),
      legacy("cand-002", { status: "rejected", rejected_at: "2026-07-01T00:00:00.000Z", rejection_reason: "Too broad." }),
      legacy("cand-003", { status: "accepted", accepted_trap_id: 7, accepted_scope: "project", accepted_at: "2026-07-02T00:00:00.000Z" }),
      legacy("cand-004", { status: "accepted" }),
    ];

    const roundTripped = downgradeCandidates(migrateCandidates(originals, { trapExists: () => true }));

    // Byte-identical, not merely equivalent: the envelope adds no information
    // that cannot be discarded cleanly.
    expect(JSON.stringify(roundTripped)).toBe(JSON.stringify(originals));
  });

  test("migration never changes a record's meaning (§8.3)", () => {
    const originals = [
      legacy("cand-001", { status: "proposed" }),
      legacy("cand-002", { status: "rejected" }),
      legacy("cand-003", { status: "accepted", accepted_trap_id: 7, accepted_scope: "project" }),
      legacy("cand-004", { status: "accepted" }),
    ];
    const migrated = migrateCandidates(originals, { trapExists: () => true });
    // Not recomputed from the axes: a legacy accepted-but-unlinked record must
    // stay `accepted` so it does not reappear in the editable inbox.
    expect(migrated.map((c) => c.status)).toEqual(originals.map((c) => c.status));
  });

  test("for records the new code writes, status and the axes agree", () => {
    const { sessions } = harness("codetrap-1b-axes-agree-");
    const captured = capture(sessions, lesson());
    for (const candidate of [captured.candidate]) {
      expect(candidate.status).toBe(
        statusFromAxes(candidate.review_decision!, candidate.delivery_state!)
      );
    }
  });

  test("C1: migration is idempotent", () => {
    const once = migrateCandidate(legacy("cand-001", { status: "proposed" }));
    expect(migrateCandidate(once)).toBe(once);
  });

  test("C2: a legacy accepted record still points at its durable trap", () => {
    const { project, home, sessions, traps } = harness("codetrap-1b-legacy-link-");
    const added = traps.addTrap({
      title: "A trap committed before Phase 1B",
      category: "convention",
      scope: "project",
      severity: "warning",
      context: "When reading a session written by an older codetrap.",
      mistake: "Assuming the accepted link survives a schema change.",
      fix: "Keep accepted_trap_id and accepted_scope through the migration.",
    });
    writeLegacyDocument(project, "2026-07-01-legacy", [
      legacy("cand-001", {
        status: "accepted",
        accepted_trap_id: added.id,
        accepted_scope: "project",
        accepted_at: "2026-07-02T00:00:00.000Z",
      }),
    ]);

    const [candidate] = sessions.candidateDocument("2026-07-01-legacy").candidates;
    expect(candidate.accepted_trap_id).toBe(added.id);
    expect(candidate.accepted_scope).toBe("project");
    expect(candidate.status).toBe("accepted");
    expect(axes(candidate)).toEqual({ review_decision: "approved", delivery_state: "committed" });

    // And the review surface still resolves it to the live trap.
    const cli = runCli(["session", "candidates", "2026-07-01-legacy", "--json"], project, home);
    expect(cli.exitCode).toBe(0);
    expect(JSON.parse(cli.stdout).candidates[0].accepted_trap_id).toBe(added.id);
  });

  test("reading a legacy file does not rewrite it", () => {
    const { project, sessions } = harness("codetrap-1b-read-only-");
    writeLegacyDocument(project, "2026-07-01-legacy", [legacy("cand-001", { status: "proposed" })]);
    const path = join(project, ".codetrap", "sessions", "2026-07-01-legacy", "candidate-traps.json");
    const before = readFileSync(path, "utf-8");

    sessions.candidateDocument("2026-07-01-legacy");

    expect(readFileSync(path, "utf-8")).toBe(before);
    expect(JSON.parse(before).version).toBe(1);
  });

  test("a document from a newer codetrap is refused, not silently downgraded", () => {
    const { project, sessions } = harness("codetrap-1b-forward-guard-");
    writeLegacyDocument(project, "2026-07-01-future", [legacy("cand-001", { status: "proposed" })], 99);

    expect(() => sessions.candidateDocument("2026-07-01-future"))
      .toThrow(/schema version 99, newer than this codetrap build/);
  });

  test("new candidates are born at the current schema version", () => {
    const { sessions } = harness("codetrap-1b-born-v2-");
    const captured = sessions.captureCandidate(lesson());
    expect(captured.suppressed).toBe(false);
    if (captured.suppressed) return;

    expect(captured.candidate.schema_version).toBe(CANDIDATE_SCHEMA_VERSION);
    expect(captured.candidate.revision).toBe(1);
    expect(captured.candidate.candidate_kind).toBe("pitfall_trap");
    expect(axes(captured.candidate)).toEqual({ review_decision: "pending", delivery_state: "draft" });
    expect(captured.candidate.content_hash).toBe(candidateContentHash(captured.candidate));
  });
});

describe("Phase 1B — authorization binds to a revision", () => {
  test("C3: a material edit invalidates the approval and commit refuses", async () => {
    const { sessions } = harness("codetrap-1b-invalidate-");
    const captured = capture(sessions, lesson());

    const approved = sessions.approveCandidate({
      candidateId: captured.candidate.id,
      authorizedScope: "this candidate only",
    });
    expect(approved.authorization.revision).toBe(1);

    // Change what the lesson actually says.
    sessions.saveCandidate({
      candidateId: captured.candidate.id,
      edit: { fix: "Something materially different from what the user approved." },
    });

    const edited = sessions.getCandidate(captured.candidate.id).candidate;
    expect(edited.revision).toBe(2);
    expect(edited.authorization).toBeUndefined();

    await expect(
      sessions.acceptCandidate({ candidateId: captured.candidate.id, executor: "agent" })
    ).rejects.toThrow(/no recorded authorization/);
  });

  test("C3: an edit supplied at commit time is checked against the approval too", async () => {
    const { sessions } = harness("codetrap-1b-inline-edit-");
    const captured = capture(sessions, lesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id });

    // The approval is still on the record, but the content being committed is
    // not what was approved.
    await expect(
      sessions.acceptCandidate({
        candidateId: captured.candidate.id,
        executor: "agent",
        edit: { fix: "A different fix smuggled in at commit time." },
      })
    ).rejects.toThrow(/changed materially since it was approved/);
  });

  test("C3: a cosmetic edit preserves the approval", async () => {
    const { sessions } = harness("codetrap-1b-cosmetic-");
    const captured = capture(sessions, lesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id });

    // Tags are not part of the content hash: the lesson still says the same thing.
    sessions.saveCandidate({
      candidateId: captured.candidate.id,
      edit: { tags: ["node", "scratchpad", "esm", "extra-tag"] },
    });

    const edited = sessions.getCandidate(captured.candidate.id).candidate;
    expect(edited.revision).toBe(1);
    expect(edited.authorization).toBeDefined();

    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "agent",
    });
    expect(accepted.success).toBe(true);
  });

  test("C3: an agent cannot commit a candidate the user never approved", async () => {
    const { sessions } = harness("codetrap-1b-no-self-auth-");
    const captured = capture(sessions, lesson());

    await expect(
      sessions.acceptCandidate({ candidateId: captured.candidate.id, executor: "agent" })
    ).rejects.toThrow(/no recorded authorization, so an agent may not commit it/);

    // A human at the CLI is the authorization, so the same commit succeeds.
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "user",
    });
    expect(accepted.success).toBe(true);
  });

  test("approve records a receipt bound to the revision and hash", () => {
    const { sessions } = harness("codetrap-1b-approve-receipt-");
    const captured = capture(sessions, lesson());
    const approved = sessions.approveCandidate({
      candidateId: captured.candidate.id,
      authorizedScope: "cluster C01 only",
    });

    expect(approved.receipt).toMatchObject({
      action: "approve",
      authorized_scope: "cluster C01 only",
      fingerprint: approved.authorization.content_hash,
    });
    expect(approved.authorization.content_hash).toBe(captured.fingerprint);
    expect(axes(approved.candidate)).toEqual({ review_decision: "approved", delivery_state: "staged" });
    // Still shown as pending in the inbox: approved is not committed (§8.3).
    expect(approved.candidate.status).toBe("proposed");
  });

  test("rollback clears the approval so a re-commit needs a fresh decision", async () => {
    const { sessions } = harness("codetrap-1b-rollback-auth-");
    const captured = capture(sessions, lesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id });
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "agent",
    });
    expect(accepted.success).toBe(true);

    const rolledBack = sessions.rollbackCandidate({ candidateId: captured.candidate.id });
    expect(rolledBack.candidate.authorization).toBeUndefined();
    expect(axes(rolledBack.candidate)).toEqual({ review_decision: "pending", delivery_state: "rolled_back" });

    await expect(
      sessions.acceptCandidate({ candidateId: captured.candidate.id, executor: "agent", acceptAnyway: true })
    ).rejects.toThrow(/no recorded authorization/);
  });
});

describe("Phase 1B — review fixes", () => {
  test("a conflict check does not strand the content hash and deadlock approval", async () => {
    const { sessions, traps } = harness("codetrap-1b-conflict-hash-");
    // Seed a similar active trap so the first accept trips conflict detection.
    traps.addTrap({
      title: "Scratchpad Node scripts cannot resolve project node_modules",
      category: "convention",
      scope: "project",
      severity: "warning",
      tags: ["node", "scratchpad", "esm"],
      context: "When writing a throwaway script.",
      mistake: "Putting it in the scratchpad.",
      fix: "Write it under the project tree.",
    });
    const captured = capture(sessions, lesson());

    // Conflict path rewrites `trap`; it must refresh content_hash with it.
    const blocked = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      edit: { mistake: "A materially different mistake description for the conflict path." },
    });
    expect(blocked.success).toBe(false);

    const stored = sessions.getCandidate(captured.candidate.id).candidate;
    expect(stored.content_hash).toBe(candidateContentHash(stored));

    // Approve now binds the real content, so the agent commit succeeds rather
    // than deadlocking on a hash of content that no longer exists.
    sessions.approveCandidate({ candidateId: captured.candidate.id });
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "agent",
      acceptAnyway: true,
    });
    expect(accepted.success).toBe(true);
  });

  test("a human may still edit and accept an approved candidate", async () => {
    const { sessions } = harness("codetrap-1b-user-edit-");
    const captured = capture(sessions, lesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id });

    // The user running the command is themselves the authorization, so their
    // own edit must not be blocked by the approval they gave for an agent.
    const accepted = await sessions.acceptCandidate({
      candidateId: captured.candidate.id,
      executor: "user",
      edit: { fix: "A fix the user rewrote at commit time." },
    });
    expect(accepted.success).toBe(true);
  });

  test("an approval does not authorize an agent to retire a different trap", async () => {
    const { sessions, traps } = harness("codetrap-1b-supersede-guard-");
    const victim = traps.addTrap({
      title: "An unrelated trap the user never mentioned",
      category: "convention",
      scope: "project",
      severity: "warning",
      context: "When doing something else entirely.",
      mistake: "Unrelated.",
      fix: "Unrelated.",
    });
    const captured = capture(sessions, lesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id });

    await expect(
      sessions.acceptCandidate({
        candidateId: captured.candidate.id,
        executor: "agent",
        supersedesId: victim.id,
      })
    ).rejects.toThrow(/authorizes committing that lesson, not retiring trap/);

    // The victim is untouched.
    expect(traps.getTrapDetails(victim.id, "project")?.trap.status).toBe("active");
  });

  test("the §8.3 broken-link mapping fires through the real store", () => {
    const { project, sessions, traps } = harness("codetrap-1b-broken-link-");
    const added = traps.addTrap({
      title: "A trap that is about to be deleted",
      category: "convention",
      scope: "project",
      severity: "warning",
      context: "When testing the broken-link mapping.",
      mistake: "Assuming the link always resolves.",
      fix: "Probe the trap store during migration.",
    });
    writeLegacyDocument(project, "2026-07-01-broken", [
      legacy("cand-001", { status: "accepted", accepted_trap_id: added.id, accepted_scope: "project" }),
    ]);
    traps.deleteTrap(added.id, "project");

    const [candidate] = sessions.candidateDocument("2026-07-01-broken").candidates;
    expect(axes(candidate)).toEqual({ review_decision: "approved", delivery_state: "staged" });
    expect(candidate.migration_warning).toContain(`#${added.id}`);
  });

  test("a downgrade reports what v1 cannot carry back", () => {
    const { project, home, sessions } = harness("codetrap-1b-downgrade-loss-");
    const captured = capture(sessions, lesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id });

    const report = sessions.migrateCandidateDocuments({ direction: "down" });
    const warnings = report.sessions.flatMap((entry) => entry.warnings);
    expect(warnings.some((w) => w.includes("authorization is dropped"))).toBe(true);
    expect(report.applied).toBe(false);
    expect(home).toBeTruthy();
  });

  test("an approved candidate is visibly approved in the review payload", () => {
    const { sessions, traps } = harness("codetrap-1b-review-visible-");
    const captured = capture(sessions, lesson());
    sessions.approveCandidate({ candidateId: captured.candidate.id, authorizedScope: "cand-001 only" });

    const [reviewed] = reviewedSessionCandidates(
      sessions.candidateDocument(captured.session.id).candidates,
      traps
    );
    expect(reviewed.review.status).toBe("approved");
    expect(reviewed.review.label).toContain("editing invalidates");

    // And a material edit takes it back to pending, so the console cannot show
    // an approval the commit path would reject.
    sessions.saveCandidate({
      candidateId: captured.candidate.id,
      edit: { fix: "Something else entirely, materially different." },
    });
    const [afterEdit] = reviewedSessionCandidates(
      sessions.candidateDocument(captured.session.id).candidates,
      traps
    );
    expect(afterEdit.review.status).toBe("pending");
  });

  test("a document from a newer build is refused by the migrate path too", () => {
    const { project, home } = cliProject("codetrap-1b-raw-guard-");
    writeLegacyDocument(project, "2026-07-01-future", [legacy("cand-001", { status: "proposed" })], 99);
    const result = runCli(["session", "migrate", "--apply"], project, home);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("newer than this codetrap build");
  });
});

describe("Phase 1B — the migrate command", () => {
  test("C1: dry run reports the work and writes nothing", () => {
    const { project, home } = cliProject("codetrap-1b-migrate-dry-");
    writeLegacyDocument(project, "2026-07-01-legacy", [
      legacy("cand-001", { status: "proposed" }),
      legacy("cand-002", { status: "accepted" }),
    ]);
    const path = join(project, ".codetrap", "sessions", "2026-07-01-legacy", "candidate-traps.json");
    const before = readFileSync(path, "utf-8");

    const dry = runCli(["session", "migrate", "--json"], project, home);
    expect(dry.exitCode).toBe(0);
    const report = JSON.parse(dry.stdout);
    expect(report).toMatchObject({ applied: false, direction: "up", target_version: CANDIDATE_SCHEMA_VERSION });
    expect(report.sessions[0]).toMatchObject({ session_id: "2026-07-01-legacy", from_version: 1, to_version: CANDIDATE_SCHEMA_VERSION });
    expect(report.sessions[0].warnings[0]).toContain("no trap link");
    expect(report.next_action.command).toBe("codetrap session migrate --apply");

    expect(readFileSync(path, "utf-8")).toBe(before);
  });

  test("C1: apply then --down round-trips the file byte-for-byte", () => {
    const { project, home } = cliProject("codetrap-1b-migrate-roundtrip-");
    writeLegacyDocument(project, "2026-07-01-legacy", [
      legacy("cand-001", { status: "proposed" }),
      legacy("cand-002", { status: "rejected", rejected_at: "2026-07-01T00:00:00.000Z", rejection_reason: "No." }),
      legacy("cand-003", { status: "accepted", accepted_trap_id: 7, accepted_scope: "project", accepted_at: "2026-07-02T00:00:00.000Z" }),
    ]);
    const path = join(project, ".codetrap", "sessions", "2026-07-01-legacy", "candidate-traps.json");
    const original = readFileSync(path, "utf-8");

    const up = runCli(["session", "migrate", "--apply", "--json"], project, home);
    expect(up.exitCode).toBe(0);
    const migrated = JSON.parse(readFileSync(path, "utf-8"));
    expect(migrated.version).toBe(CANDIDATE_SCHEMA_VERSION);
    expect(migrated.candidates[0].review_decision).toBe("pending");

    const down = runCli(["session", "migrate", "--apply", "--down", "--json"], project, home);
    expect(down.exitCode).toBe(0);
    expect(JSON.parse(down.stdout).direction).toBe("down");

    // Reversible in the strong sense: the transform inverts, not just a backup.
    expect(readFileSync(path, "utf-8")).toBe(original);
  });

  test("--dry-run and --apply together is refused", () => {
    const { project, home } = cliProject("codetrap-1b-migrate-both-");
    writeLegacyDocument(project, "2026-07-01-legacy", [legacy("cand-001", { status: "proposed" })]);
    const result = runCli(["session", "migrate", "--dry-run", "--apply"], project, home);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("not both");
  });

  test("doctor reports records that need migrating and names the command", () => {
    const { project, home } = cliProject("codetrap-1b-doctor-");
    writeLegacyDocument(project, "2026-07-01-legacy", [legacy("cand-001", { status: "proposed" })]);

    const doctor = runCli(["doctor", "--json"], project, home);
    expect(doctor.exitCode).toBe(0);
    const report = JSON.parse(doctor.stdout);
    expect(report.candidate_migration).toMatchObject({
      pending_records: 1,
      pending_sessions: ["2026-07-01-legacy"],
    });
    expect(report.next_actions.map((a: { command: string }) => a.command))
      .toContain("codetrap session migrate --json");
  });

  test("a project with nothing to migrate says so", () => {
    const { project, home } = cliProject("codetrap-1b-migrate-noop-");
    const result = runCli(["session", "migrate"], project, home);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No candidate records need migrating");
  });
});

function cliProject(prefix: string): { project: string; home: string } {
  return { project: tempProjectDir(prefix), home: tempHome() };
}

function axes(candidate: CandidateTrap) {
  return { review_decision: candidate.review_decision, delivery_state: candidate.delivery_state };
}

function harness(prefix: string) {
  const project = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(project, ".codetrap"));
  const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
  const traps = new TrapOperations(new TrapStore(project, undefined, home));
  return { project, home, traps, sessions: new SessionOperations(new SessionStore(project), traps) };
}

function capture(sessions: SessionOperations, request: Parameters<SessionOperations["captureCandidate"]>[0]) {
  const result = sessions.captureCandidate(request);
  if (result.suppressed) throw new Error("Expected a proposed candidate.");
  return result;
}

/** A v1-shaped record: exactly the fields Phase 0/1A wrote, and nothing else. */
function legacy(id: string, overrides: Partial<CandidateTrap>): CandidateTrap {
  return {
    id,
    status: "proposed",
    quality_score: 0.85,
    quality: {
      has_clear_trigger: true,
      has_clear_mistake: true,
      has_actionable_fix: true,
      not_too_broad: true,
      future_reuse_likely: true,
      proper_scope: true,
      evidence_count: 1,
      conflict_checked: false,
      conflict_status: "none",
      staleness_risk: "low",
      suggested_action: "accept",
      warnings: [],
    },
    trap: {
      title: `Legacy lesson ${id}`,
      category: "convention",
      scope: "project",
      severity: "warning",
      tags: ["legacy"],
      context: "When reading a candidate written before Phase 1B.",
      mistake: "Assuming the old shape can be dropped.",
      fix: "Migrate it into the envelope without losing anything.",
    },
    evidence: [{
      source_type: "conversation",
      source_ref: "session:2026-07-01-legacy",
      related_files: [],
      note: "Captured before the envelope existed.",
    }],
    ...overrides,
  } as CandidateTrap;
}

function writeLegacyDocument(
  project: string,
  sessionId: string,
  candidates: CandidateTrap[],
  version = 1
): void {
  const dir = join(project, ".codetrap", "sessions", sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "session.json"),
    `${JSON.stringify({
      version: 1,
      id: sessionId,
      goal: "a session from before Phase 1B",
      status: "closed",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      closed_at: "2026-07-01T01:00:00.000Z",
      scope: "project",
      project_path: project,
      module: null,
      owner: null,
      spec_ref: null,
      notes_path: "implementation-notes.md",
      recap_path: "recap.md",
      candidate_traps_path: "candidate-traps.json",
    }, null, 2)}\n`
  );
  writeFileSync(
    join(dir, "candidate-traps.json"),
    `${JSON.stringify({ version, session_id: sessionId, candidates }, null, 2)}\n`
  );
}

function lesson() {
  return {
    trap: {
      title: "Scratchpad Node scripts cannot resolve project node_modules",
      category: "convention",
      scope: "project",
      severity: "warning",
      tags: ["node", "scratchpad", "esm"],
      context: "When writing a throwaway .mjs script that imports a project dependency.",
      mistake: "Writing it into the session scratchpad, where Node never reaches the repo's node_modules.",
      fix: "Write it under the project tree, or run it with NODE_PATH pointed at the repo.",
    } as Record<string, unknown>,
    sourceRef: "phase0:C01",
  };
}
