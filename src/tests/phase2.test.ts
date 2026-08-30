import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, tempHome, tempProjectDir } from "./helpers";
import { candidateContentHash, migrateCandidate } from "../lib/candidate-envelope";
import type { CandidateTrap } from "../domain/session";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { Phase2Store } from "../lib/phase2-store";

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
    expect(existsSync(join(cwd, ".codetrap", "phase2", "commits.json"))).toBe(false);

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
    expect(migrated.schema_version).toBe(4);
    expect(migrated.content_hash).not.toBe("legacy-hash");

    const cwd = tempProjectDir("codetrap-p2-insight-");
    const home = tempHome();
    const teachingBody = [
      "Article -> Agent extracts -> User reviews -> Insight shelf",
      "",
      "Example: treat one narrow approval as permission for that revision only.",
    ].join("\n");
    const captured = runJson([
      "phase2", "propose", "--input-json", JSON.stringify(proposal("insight", "Keep authorization narrow", {
        title: "Keep authorization narrow",
        summary: "Authorization should name one revision and destination.",
        body: teachingBody,
        tags: ["authorization"],
      })),
    ], cwd, home);
    runJson(["phase2", "apply", captured.candidate.id, "--session", captured.session.id, "--executor", "user"], cwd, home);
    const insights = runJson(["phase2", "insights"], cwd, home);
    expect(insights).toHaveLength(1);
    expect(insights[0].body).toBe(teachingBody);
    const consulted = runJson(["phase2", "consult", insights[0].id], cwd, home);
    expect(consulted.consulted_count).toBe(1);
    const consultedAgain = runJson(["phase2", "consult", insights[0].id], cwd, home);
    expect(consultedAgain.consulted_count).toBe(1);
    expect(consultedAgain.last_consulted_at).toBe(consulted.last_consulted_at);
    expect(runJson(["phase2", "metrics"], cwd, home).insight_shelf).toEqual({ shelved: 1, consulted: 1 });
  });

  test("phase2 propose reads multiline JSON from stdin for Windows-safe automation", () => {
    const cwd = tempProjectDir("codetrap-p2-stdin-");
    const home = tempHome();
    const input = proposal("insight", "PowerShell-safe proposal", {
      title: "PowerShell-safe proposal",
      summary: "Pipe JSON instead of forwarding quoted native arguments.",
      body: "request -> stdin -> parsed proposal\n\nExample: PowerShell keeps every quote intact.",
      tags: ["windows", "cli"],
      source_refs: ["https://example.com/source"],
    });
    const result = runCli(["phase2", "propose", "--input-json", "-", "--json"], cwd, home, JSON.stringify(input));
    expect(result.exitCode).toBe(0);
    const captured = JSON.parse(result.stdout);
    expect(captured.candidate).toMatchObject({
      candidate_kind: "insight",
      destination_payload: { title: "PowerShell-safe proposal" },
    });
  });

  test("groups legacy insights lazily and materializes only after an explicit collection edit", () => {
    const cwd = tempProjectDir("codetrap-p2-legacy-collections-");
    const phase2Dir = join(cwd, ".codetrap", "phase2");
    mkdirSync(phase2Dir, { recursive: true });
    const path = join(phase2Dir, "insights.json");
    const legacy = {
      version: 1,
      insights: [
        legacyInsight("ins-second", "Second", "2026-08-29T02:00:00.000Z", ["https://example.com/guide/?utm_source=test"]),
        legacyInsight("ins-first", "First", "2026-08-29T01:00:00.000Z", ["https://example.com/guide"]),
        legacyInsight("ins-alone", "Alone", "2026-08-29T03:00:00.000Z", ["manual:note"]),
      ],
    };
    const before = `${JSON.stringify(legacy, null, 2)}\n`;
    writeFileSync(path, before);

    const store = new Phase2Store(cwd);
    const library = store.learningLibrary();
    expect(library.collections).toHaveLength(1);
    expect(library.collections[0]).toMatchObject({
      title: "Guide",
      source_type: "article",
      inferred: true,
      coverage_summary: { status: "unknown" },
    });
    expect(library.collection_items.map((item) => item.insight_id)).toEqual(["ins-first", "ins-second"]);
    expect(readFileSync(path, "utf-8")).toBe(before);

    const renamed = store.updateCollection(library.collections[0].id, { title: "Example guide", topics: ["Web", "web"] });
    expect(renamed).toMatchObject({ title: "Example guide", topics: ["Web"] });
    const persisted = JSON.parse(readFileSync(path, "utf-8"));
    expect(persisted.version).toBe(2);
    expect(persisted.collections[0].inferred).toBeUndefined();
    expect(store.reorderCollection(renamed.id, ["ins-second", "ins-first"]).map((item) => item.insight_id))
      .toEqual(["ins-second", "ins-first"]);
    expect(() => store.reorderCollection(renamed.id, ["ins-first", "ins-first"]))
      .toThrow("every member exactly once");
  });

  test("shelves explicit source collections with stable requested positions", () => {
    const cwd = tempProjectDir("codetrap-p2-explicit-collections-");
    const home = tempHome();
    const collection = {
      id: "col-prompt-cache",
      title: "Prompt caching",
      summary: "A source-ordered guide.",
      source_type: "article",
      source_refs: ["https://example.com/prompt-cache"],
      topics: ["AI engineering"],
      context_sections: [{
        id: "source-background",
        title: "Source background",
        body: "Published during the provider's first rollout.",
        source_unit_refs: ["source-background"],
      }],
      source_coverage: {
        version: 1,
        mode: "full_source",
        source_fingerprint: `sha256:${"a".repeat(64)}`,
        units: [
          { id: "exact-prefixes", title: "Exact prefixes", disposition: "learn" },
          { id: "cache-placement", title: "Cache placement", disposition: "learn" },
          { id: "source-background", title: "Source background", disposition: "learn" },
        ],
      },
    };
    const proposals = ([[2, "Cache placement", "cache-placement"], [1, "Exact prefixes", "exact-prefixes"]] as const)
      .map(([position, title, sourceUnit]) => proposal("insight", title, {
          title,
          summary: `${title} summary`,
          body: `${title} -> example`,
          tags: ["prompt-cache"],
          source_refs: ["https://example.com/prompt-cache"],
          source_type: "article",
          topics: ["context engineering"],
          source_unit_refs: [sourceUnit],
          collection: { ...collection, position },
        }));
    const captured = runJson([
      "phase2", "propose-batch", "--input-json", JSON.stringify({ goal: "Prompt caching study collection", proposals }),
    ], cwd, home);
    for (const [index, candidate] of captured.candidates.entries()) {
      runJson(["phase2", "apply", candidate.id, "--session", captured.session.id, "--executor", "user"], cwd, home);
      expect(new Phase2Store(cwd).learningLibrary().collections[0].coverage_summary).toMatchObject({
        status: index === 0 ? "incomplete" : "complete",
        covered_units: index + 2,
        learn_units: 3,
      });
    }
    const library = new Phase2Store(cwd).learningLibrary();
    expect(library.collections).toEqual([expect.objectContaining({
      id: "col-prompt-cache",
      title: "Prompt caching",
      source_type: "article",
      topics: ["AI engineering"],
      context_sections: [expect.objectContaining({
        id: "source-background",
        source_unit_refs: ["source-background"],
      })],
      coverage_summary: expect.objectContaining({ status: "complete", covered_units: 3, learn_units: 3 }),
    })]);
    const titlesById = new Map(library.insights.map((insight) => [insight.id, insight.title]));
    const orderedTitles = library.collection_items
      .sort((left, right) => left.position - right.position)
      .map((item) => titlesById.get(item.insight_id));
    expect(orderedTitles).toEqual(["Exact prefixes", "Cache placement"]);
  });

  test("normalizes omitted collection topics once for the whole audited batch", () => {
    const cwd = tempProjectDir("codetrap-p2-batch-topics-");
    const home = tempHome();
    const sourceCoverage = {
      version: 1,
      mode: "full_source",
      source_fingerprint: `sha256:${"d".repeat(64)}`,
      units: [
        { id: "cache", title: "Cache mechanics", disposition: "learn" },
        { id: "pricing", title: "Cache pricing", disposition: "learn" },
      ],
    };
    const proposals = ([
      [1, "Cache mechanics", "cache", "caching"],
      [2, "Cache pricing", "pricing", "pricing"],
    ] as const).map(([position, title, sourceUnit, topic]) => proposal("insight", title, {
      title,
      summary: `${title} summary`,
      body: `${title} -> example`,
      source_refs: ["https://example.com/cache"],
      source_type: "article",
      topics: [topic],
      source_unit_refs: [sourceUnit],
      collection: {
        id: "col-template-default",
        title: "Caching guide",
        position,
        source_coverage: sourceCoverage,
      },
    }));

    const captured = runJson([
      "phase2", "propose-batch", "--input-json", JSON.stringify({ goal: "Template-shaped batch", proposals }),
    ], cwd, home);
    expect(captured.candidates.map((item: any) => item.destination_payload.collection.topics))
      .toEqual([["caching", "pricing"], ["caching", "pricing"]]);

    for (const candidate of captured.candidates) {
      runJson(["phase2", "apply", candidate.id, "--session", captured.session.id, "--executor", "user"], cwd, home);
    }
    const library = new Phase2Store(cwd).learningLibrary();
    expect(library.collections).toEqual([expect.objectContaining({
      id: "col-template-default",
      topics: ["caching", "pricing"],
      coverage_summary: expect.objectContaining({ status: "complete", covered_units: 2 }),
    })]);
    expect(library.collection_items).toHaveLength(2);
  });

  test("rejects explicitly conflicting collection topics before creating a batch session", () => {
    const cwd = tempProjectDir("codetrap-p2-explicit-topic-conflict-");
    const home = tempHome();
    const sourceCoverage = {
      version: 1,
      mode: "full_source",
      source_fingerprint: `sha256:${"7".repeat(64)}`,
      units: [
        { id: "first", title: "First section", disposition: "learn" },
        { id: "second", title: "Second section", disposition: "learn" },
      ],
    };
    const proposals = ([
      [1, "first", "caching"],
      [2, "second", "pricing"],
    ] as const).map(([position, sourceUnit, topic]) => proposal("insight", `${sourceUnit} lesson`, {
      title: `${sourceUnit} lesson`,
      summary: `${sourceUnit} summary`,
      body: `${sourceUnit} -> example`,
      source_refs: ["https://example.com/conflict"],
      source_type: "article",
      topics: [topic],
      source_unit_refs: [sourceUnit],
      collection: {
        id: "col-explicit-conflict",
        title: "Explicit conflict",
        topics: [topic],
        position,
        source_coverage: sourceCoverage,
      },
    }));

    const refused = runCli([
      "phase2", "propose-batch", "--input-json", JSON.stringify({ proposals }), "--json",
    ], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("must use identical topics");
    expect(existsSync(join(cwd, ".codetrap", "sessions"))).toBe(false);
  });

  test("derives one collection id from batch-wide refs instead of silently splitting", () => {
    const cwd = tempProjectDir("codetrap-p2-batch-derived-id-");
    const home = tempHome();
    const sourceCoverage = {
      version: 1,
      mode: "full_source",
      source_fingerprint: `sha256:${"e".repeat(64)}`,
      units: [
        { id: "first", title: "First section", disposition: "learn" },
        { id: "second", title: "Second section", disposition: "learn" },
      ],
    };
    const proposals = ([
      [2, "Second section", "second", "https://example.com/guide#second"],
      [1, "First section", "first", "https://example.com/guide#first"],
    ] as const).map(([position, title, sourceUnit, sourceRef]) => proposal("insight", title, {
      title,
      summary: `${title} summary`,
      body: `${title} -> example`,
      source_refs: [sourceRef],
      source_type: "article",
      topics: [sourceUnit],
      source_unit_refs: [sourceUnit],
      collection: {
        title: "Guide without an explicit id",
        position,
        source_coverage: sourceCoverage,
      },
    }));

    const captured = runJson([
      "phase2", "propose-batch", "--input-json", JSON.stringify({ goal: "Derived collection identity", proposals }),
    ], cwd, home);
    const normalizedCollections = captured.candidates.map((item: any) => item.destination_payload.collection);
    expect(new Set(normalizedCollections.map((collection: any) => collection.id)).size).toBe(1);
    expect(normalizedCollections.map((collection: any) => collection.source_refs)).toEqual([
      ["https://example.com/guide#first", "https://example.com/guide#second"],
      ["https://example.com/guide#first", "https://example.com/guide#second"],
    ]);

    for (const candidate of captured.candidates) {
      runJson(["phase2", "apply", candidate.id, "--session", captured.session.id, "--executor", "user"], cwd, home);
    }
    const library = new Phase2Store(cwd).learningLibrary();
    expect(library.collections).toHaveLength(1);
    expect(library.collection_items).toHaveLength(2);
    expect(library.collections[0].coverage_summary).toMatchObject({ status: "complete", covered_units: 2 });
  });

  test("lets legacy staged chapters inherit one existing audited collection contract", () => {
    const cwd = tempProjectDir("codetrap-p2-legacy-audited-batch-");
    const store = new Phase2Store(cwd);
    const sourceCoverage = {
      version: 1,
      mode: "full_source",
      source_fingerprint: `sha256:${"f".repeat(64)}`,
      units: [
        { id: "first", title: "First section", disposition: "learn" },
        { id: "second", title: "Second section", disposition: "learn" },
      ],
    };
    const legacyCandidate = (
      id: string,
      position: number,
      sourceUnit: string,
      sourceRef: string,
      topic: string
    ) => ({
      ...candidate("insight", {
        title: `${sourceUnit} chapter`,
        summary: `${sourceUnit} summary`,
        body: `${sourceUnit} -> example`,
        source_refs: [sourceRef],
        source_type: "article",
        topics: [topic],
        source_unit_refs: [sourceUnit],
        collection: {
          title: "Legacy audited guide",
          position,
          source_coverage: sourceCoverage,
        },
      }),
      id,
    });

    store.apply(
      "session-legacy-audited",
      legacyCandidate("cand-legacy-1", 1, "first", "https://example.com/legacy#first", "first-topic"),
      new Date("2026-08-30T03:00:00.000Z")
    );
    expect(() => store.apply(
      "session-legacy-audited",
      legacyCandidate("cand-legacy-2", 2, "second", "https://example.com/legacy#second", "second-topic"),
      new Date("2026-08-30T03:01:00.000Z")
    )).not.toThrow();

    const library = store.learningLibrary();
    expect(library.collections).toHaveLength(1);
    expect(library.collection_items).toHaveLength(2);
    expect(library.collections[0].coverage_summary).toMatchObject({ status: "complete", covered_units: 2 });
  });

  test("rejects occupied positions and audited source-contract replacement at the store boundary", () => {
    const cwd = tempProjectDir("codetrap-p2-collection-guards-");
    const store = new Phase2Store(cwd);
    const collection = {
      id: "col-guarded",
      title: "Guarded source",
      summary: "One audited source contract.",
      source_type: "article",
      source_refs: ["https://example.com/guarded"],
      topics: ["guardrails"],
      context_sections: [{
        id: "source-background",
        title: "Source background",
        body: "Published during the first rollout.",
        source_unit_refs: ["background"],
      }],
      source_coverage: {
        version: 1,
        mode: "full_source",
        source_fingerprint: `sha256:${"c".repeat(64)}`,
        units: [
          { id: "core", title: "Core lesson", disposition: "learn" },
          { id: "background", title: "Source background", disposition: "learn" },
        ],
      },
    };
    const first = candidate("insight", {
      title: "Core lesson",
      summary: "Core summary",
      body: "core -> learned",
      source_refs: collection.source_refs,
      source_unit_refs: ["core"],
      collection: { ...collection, position: 1 },
    });
    store.apply("session-guarded", first, new Date("2026-08-30T02:00:00.000Z"));
    const shelfPath = join(cwd, ".codetrap", "phase2", "insights.json");
    const before = readFileSync(shelfPath, "utf-8");

    const colliding = {
      ...candidate("insight", {
        title: "Duplicate position",
        summary: "Must not occupy chapter one twice.",
        body: "duplicate -> reject",
        source_refs: collection.source_refs,
        source_unit_refs: ["core"],
        collection: { ...collection, position: 1 },
      }),
      id: "cand-002",
    };
    expect(() => store.apply("session-guarded", colliding, new Date("2026-08-30T02:01:00.000Z")))
      .toThrow(/position 1.*already occupied/i);
    expect(readFileSync(shelfPath, "utf-8")).toBe(before);

    const reducedContract = {
      ...candidate("insight", {
        title: "Reduced contract",
        summary: "Must not shrink the audited manifest.",
        body: "shrink -> reject",
        source_refs: collection.source_refs,
        source_unit_refs: ["core"],
        collection: {
          ...collection,
          position: 2,
          context_sections: [],
          source_coverage: {
            ...collection.source_coverage,
            units: [{ id: "core", title: "Core lesson", disposition: "learn" }],
          },
        },
      }),
      id: "cand-003",
    };
    expect(() => store.apply("session-guarded", reducedContract, new Date("2026-08-30T02:02:00.000Z")))
      .toThrow(/source contract.*cannot be replaced/i);
    expect(readFileSync(shelfPath, "utf-8")).toBe(before);
    expect(store.learningLibrary().collections[0]).toMatchObject({
      context_sections: [expect.objectContaining({ id: "source-background" })],
      coverage_summary: expect.objectContaining({ status: "complete", covered_units: 2, learn_units: 2 }),
    });
  });

  test("refuses a source-covered collection with an unexplained unit before creating a review session", () => {
    const cwd = tempProjectDir("codetrap-p2-source-gap-");
    const home = tempHome();
    const input = proposal("insight", "Only the first section", {
      title: "Only the first section",
      summary: "The second source unit is missing.",
      body: "first -> learned",
      source_unit_refs: ["first"],
      collection: {
        id: "col-gap",
        title: "Gap example",
        position: 1,
        source_coverage: {
          version: 1,
          mode: "full_source",
          source_fingerprint: `sha256:${"b".repeat(64)}`,
          units: [
            { id: "first", title: "First", disposition: "learn" },
            { id: "second", title: "Second", disposition: "learn" },
          ],
        },
      },
    });
    const refused = runCli([
      "phase2", "propose", "--input-json", JSON.stringify(input), "--json",
    ], cwd, home);
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout).error).toContain("unresolved learn units: second");
    expect(existsSync(join(cwd, ".codetrap", "sessions"))).toBe(false);
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
      has_clear_trigger: true, has_clear_mistake: true, has_actionable_fix: true,
      not_too_broad: true, future_reuse_likely: true, proper_scope: true, evidence_count: 1,
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

function legacyInsight(id: string, title: string, shelvedAt: string, sourceRefs: string[]) {
  return {
    id,
    title,
    summary: `${title} summary`,
    body: `${title} body`,
    tags: ["shared"],
    source_refs: sourceRefs,
    shelved_at: shelvedAt,
    consulted_count: 0,
    last_consulted_at: null,
  };
}
