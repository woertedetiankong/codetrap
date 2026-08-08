import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, tempHome, tempProjectDir } from "./helpers";
import { candidateContentHash, migrateCandidate } from "../lib/candidate-envelope";
import type { CandidateTrap } from "../domain/session";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";

function runJson(args: string[], cwd: string, home: string): any {
  const result = runCli([...args, "--json"], cwd, home);
  expect(result.exitCode, `${result.stderr}\n${result.stdout}`).toBe(0);
  return JSON.parse(result.stdout);
}

function proposal(kind: string, title: string, payload: Record<string, unknown>) {
  return {
    kind,
    title,
    rationale: `Durably carry ${title}.`,
    payload,
    source_agent: "codex",
  };
}

describe("Phase 2 low-risk destinations", () => {
  test("authorized convention proposals land equivalent AGENTS/CLAUDE patches and revert exactly", () => {
    const cwd = tempProjectDir("codetrap-p2-convention-");
    const home = tempHome();
    writeFileSync(join(cwd, "AGENTS.md"), "# Agents\n");

    const captured = runJson([
      "phase2", "propose", "--input-json", JSON.stringify(proposal("project_convention", "Safe migrations", {
        section_id: "safe-migrations",
        title: "Safe migrations",
        content: "Run the schema migration and its rollback test together.",
      })),
    ], cwd, home);
    const sessionId = captured.session.id;
    const candidateId = captured.candidate.id;

    const preview = runJson(["phase2", "preview", candidateId, "--session", sessionId], cwd, home);
    expect(preview.files.map((file: { path: string }) => file.path)).toEqual(["AGENTS.md", "CLAUDE.md"]);
    expect(preview.files[1]).toMatchObject({ created: true, changed: true });
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);

    const refused = runCli(["phase2", "apply", candidateId, "--session", sessionId, "--executor", "agent", "--json"], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("no recorded authorization");
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf-8")).toBe("# Agents\n");
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);

    runJson(["session", "approve", candidateId, "--session", sessionId, "--executor", "agent"], cwd, home);
    const applied = runJson(["phase2", "apply", candidateId, "--session", sessionId, "--executor", "agent"], cwd, home);
    const agents = readFileSync(join(cwd, "AGENTS.md"), "utf-8");
    const claude = readFileSync(join(cwd, "CLAUDE.md"), "utf-8");
    const managed = agents.slice(agents.indexOf("<!-- codetrap:convention"));
    expect(claude).toBe(managed);
    expect(applied.candidate.delivery_state).toBe("committed");
    expect(applied.receipt.destination).toBe("project_convention");

    runJson(["phase2", "revert", applied.commit.id, "--executor", "user"], cwd, home);
    expect(readFileSync(join(cwd, "AGENTS.md"), "utf-8")).toBe("# Agents\n");
    expect(existsSync(join(cwd, "CLAUDE.md"))).toBe(false);
  });

  test("material payload edits invalidate authorization and are measured", () => {
    const cwd = tempProjectDir("codetrap-p2-auth-");
    const home = tempHome();
    const captured = runJson([
      "phase2", "propose", "--input-json", JSON.stringify(proposal("docs_guidance", "Review guide", {
        path: "docs/review.md", section_id: "review", title: "Review", content: "First version.",
      })),
    ], cwd, home);
    const sessionId = captured.session.id;
    const candidateId = captured.candidate.id;
    runJson(["session", "approve", candidateId, "--session", sessionId, "--executor", "agent"], cwd, home);
    const edited = runJson([
      "phase2", "edit", candidateId, "--session", sessionId,
      "--input-json", JSON.stringify({ path: "docs/review.md", section_id: "review", title: "Review", content: "Changed after approval." }),
    ], cwd, home);
    expect(edited.authorization).toBeUndefined();
    expect(edited.revision).toBe(2);
    const metrics = runJson(["phase2", "metrics"], cwd, home);
    expect(metrics.authorization_invalidations).toBe(1);
    runJson(["session", "approve", candidateId, "--session", sessionId, "--executor", "agent"], cwd, home);
    const applied = runJson(["phase2", "apply", candidateId, "--session", sessionId, "--executor", "agent"], cwd, home);
    expect(readFileSync(join(cwd, "docs", "review.md"), "utf-8")).toContain("Changed after approval.");
    runJson(["phase2", "revert", applied.commit.id], cwd, home);
    expect(existsSync(join(cwd, "docs", "review.md"))).toBe(false);
  });

  test("search eval proposals commit a fixture case and restore the exact file on revert", () => {
    const cwd = tempProjectDir("codetrap-p2-eval-");
    const home = tempHome();
    const fixturePath = join(cwd, "src", "tests", "fixtures", "search-eval.json");
    mkdirSync(join(cwd, "src", "tests", "fixtures"), { recursive: true });
    const original = '{\n  "traps": [],\n  "cases": []\n}\n';
    writeFileSync(fixturePath, original);
    const captured = runJson([
      "phase2", "propose", "--input-json", JSON.stringify(proposal("search_eval_case", "Recall migration trap", {
        case: { query: "migration rollback", mode: "fts", goldTrapIds: [1], minRecallAt5: 1 },
      })),
    ], cwd, home);
    const applied = runJson(["phase2", "apply", captured.candidate.id, "--session", captured.session.id, "--executor", "user"], cwd, home);
    expect(JSON.parse(readFileSync(fixturePath, "utf-8")).cases).toHaveLength(1);
    runJson(["phase2", "revert", applied.commit.id], cwd, home);
    expect(readFileSync(fixturePath, "utf-8")).toBe(original);
  });

  test("insights migrate from v2 hints, shelf, browse, and record consultation", () => {
    const legacy = candidate("unclassified", { title: "Hinted insight", summary: "A useful pattern", body: "Study this pattern." });
    legacy.schema_version = 2;
    legacy.destination_hint = "insight";
    legacy.content_hash = "legacy-hash";
    const migrated = migrateCandidate(legacy);
    expect(migrated.candidate_kind).toBe("insight");
    expect(migrated.schema_version).toBe(3);
    expect(migrated.content_hash).not.toBe("legacy-hash");

    const cwd = tempProjectDir("codetrap-p2-insight-");
    const home = tempHome();
    const captured = runJson([
      "phase2", "propose", "--input-json", JSON.stringify(proposal("insight", "Keep authorization narrow", {
        title: "Keep authorization narrow",
        summary: "Authorization should name one revision and destination.",
        body: "Study how content hashes invalidate stale approvals.",
        tags: ["authorization"],
      })),
    ], cwd, home);
    runJson(["phase2", "apply", captured.candidate.id, "--session", captured.session.id, "--executor", "user"], cwd, home);
    const insights = runJson(["phase2", "insights"], cwd, home);
    expect(insights).toHaveLength(1);
    const consulted = runJson(["phase2", "consult", insights[0].id], cwd, home);
    expect(consulted.consulted_count).toBe(1);
    expect(runJson(["phase2", "metrics"], cwd, home).insight_shelf).toEqual({ shelved: 1, consulted: 1 });
  });

  test("graduation visibly removes a lesson from default recall and keeps history", () => {
    const cwd = tempProjectDir("codetrap-p2-graduate-");
    const home = tempHome();
    const added = runJson(["add", "--input-json", JSON.stringify({
      title: "Check generated schema deterministically", category: "database", scope: "project",
      context: "When generated schema changes.", mistake: "Manual review misses drift.",
      fix: "Run the schema snapshot test.", severity: "warning",
    })], cwd, home);
    runJson(["phase2", "validate", String(added.id), "--scope", "project"], cwd, home);
    runJson(["phase2", "graduate", String(added.id), "--scope", "project", "--to", "test:schema-snapshot"], cwd, home);
    const defaultSearch = runJson(["search", "generated schema deterministic", "--scope", "project", "--mode", "fts"], cwd, home);
    expect(defaultSearch.results).toEqual([]);
    const history = runJson(["show", String(added.id), "--scope", "project"], cwd, home);
    expect(history.trap).toMatchObject({ status: "archived", graduated_to: "test:schema-snapshot" });
  });

  test("payload participates in hashes and retrieve-vs-curate uses recorded unique usefulness", () => {
    const left = candidate("docs_guidance", { path: "docs/a.md", content: "A" });
    const right = candidate("docs_guidance", { path: "docs/a.md", content: "B" });
    expect(candidateContentHash(left)).not.toBe(candidateContentHash(right));

    const cwd = tempProjectDir("codetrap-p2-decision-");
    const home = tempHome();
    expect(runJson(["phase2", "decision"], cwd, home).decision).toBe("reduce_default_preflight_prominence");
    runJson(["phase2", "outcome", "7", "--channel", "preflight", "--useful", "--scope", "project"], cwd, home);
    expect(runJson(["phase2", "decision"], cwd, home)).toMatchObject({
      decision: "defend_preflight_budget", unique_useful_preflight: 1,
    });

    for (const title of ["First useful committed lesson", "Second useful committed lesson"]) {
      const added = runJson(["add", "--input-json", JSON.stringify({
        title, category: "other", scope: "project", context: "During Phase 2 acceptance.",
        mistake: "Repeat a known failure.", fix: "Apply the committed lesson.", severity: "warning",
      })], cwd, home);
      runJson(["useful", String(added.id), "--scope", "project"], cwd, home);
    }
    expect(runJson(["phase2", "metrics"], cwd, home).useful_recall.committed_lessons_marked_useful).toBe(2);
  });

  test("stale active lessons are downranked and expose the currency signal", async () => {
    const db = openDatabase(":memory:");
    const repo = new TrapRepository(db);
    const staleId = repo.add({
      title: "Migration rollback checklist", category: "database", scope: "project",
      context: "Use the migration rollback checklist.", mistake: "Skipping rollback leaves drift.",
      fix: "Run the rollback checklist.", severity: "warning",
    });
    const freshId = repo.add({
      title: "Migration rollback checklist current", category: "database", scope: "project",
      context: "Use the current migration rollback checklist.", mistake: "Skipping rollback leaves drift.",
      fix: "Run the current rollback checklist.", severity: "warning",
    });
    db.prepare("UPDATE traps SET last_validated = '2020-01-01 00:00:00' WHERE id = ?").run(staleId);
    const results = await repo.search("migration rollback checklist", {
      mode: "fts", limit: 2, includeRankingSignals: true,
    });
    expect(results[0]?.trap.id).toBe(freshId);
    expect(results.find((result) => result.trap.id === staleId)?.ranking_signals?.map((signal) => signal.code))
      .toContain("stale_currency");
  });
});

function candidate(kind: any, payload: Record<string, unknown>): CandidateTrap {
  return {
    id: "cand-001", status: "proposed", quality_score: 100,
    quality: {
      complete: true, actionable: true, proper_scope: true, evidence_count: 1,
      conflict_checked: false, conflict_status: "none", staleness_risk: "low",
      suggested_action: "accept", warnings: [],
    },
    trap: {
      title: "Destination material", category: "other", scope: "project",
      context: "During Phase 2.", mistake: "Leave it transient.", fix: "Commit it.",
    },
    evidence: [], candidate_kind: kind, destination_payload: payload,
    review_decision: "pending", delivery_state: "draft", revision: 1,
  };
}
