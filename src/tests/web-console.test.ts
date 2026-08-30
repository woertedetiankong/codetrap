import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTrapInput } from "../domain/trap";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { Phase2Operations } from "../lib/phase2-operations";
import { addWebProject, loadWebProjectRegistry, resolveWebProjectRoot, webProjectsPath } from "../web/project-registry";
import { createWebHandler } from "../web/server";
import { tempDir, tempHome, tempProjectDir } from "./helpers";

const TOKEN = "test-token";

describe("web project registry", () => {
  test("loads, saves, and resolves manually added projects from absolute paths", () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-project-", { realpath: true });
    const nested = join(project, "src", "nested");
    mkdirSync(nested, { recursive: true });

    const added = addWebProject(nested, home, new Date("2026-05-24T12:00:00.000Z"));
    expect(added.root).toBe(project);
    expect(resolveWebProjectRoot(nested, home)).toBe(project);

    const registry = loadWebProjectRegistry(home);
    expect(registry.projects).toEqual([added]);
    expect(existsSync(webProjectsPath(home))).toBe(true);
  });

  test("rejects paths that do not belong to an initialized codetrap project", () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const dir = tempDir("codetrap-web-uninit-", { realpath: true });

    expect(() => addWebProject(dir, home)).toThrow("No initialized codetrap project");
  });
});

describe("web API", () => {
  test("requires the launch token for API routes", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-token-", { realpath: true });
    addWebProject(project, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const missing = await handler(new Request("http://codetrap.local/api/bootstrap"));
    expect(missing.status).toBe(401);

    const ok = await api(handler, "/api/bootstrap");
    expect(ok.status).toBe(200);
    const payload = await ok.json();
    expect(payload.projects[0].root).toBe(project);
    expect(payload.options.stale_after_days).toBe(180);
  });

  test("refuses a project param for an initialized project that is not in the session registry (M30)", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-registered-", { realpath: true });
    const outsider = tempProjectDir("codetrap-web-outsider-", { realpath: true });
    addWebProject(project, home);
    // `outsider` is a real initialized codetrap project on disk, but it was
    // never opened in this session, so it must not be reachable via ?project=.
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const blocked = await api(handler, `/api/traps?project=${encodeURIComponent(outsider)}`);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toContain("not open in this codetrap web session");

    // Once it is explicitly added (as the project switcher does), it is allowed.
    addWebProject(outsider, home);
    const allowed = await api(handler, `/api/traps?project=${encodeURIComponent(outsider)}`);
    expect(allowed.status).toBe(200);
  });

  test("accepts offset=0 on the traps listing (L19)", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-offset-", { realpath: true });
    addWebProject(project, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const zero = await api(handler, `/api/traps?project=${encodeURIComponent(project)}&offset=0`);
    expect(zero.status).toBe(200);

    const negative = await api(handler, `/api/traps?project=${encodeURIComponent(project)}&offset=-1`);
    expect(negative.status).toBe(400);
  });

  test("lists trap library entries across project and global scopes with filters", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-library-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));

    const projectActive = traps.addTrap({ ...trapInput({
      title: "Use the shared web API helper",
      category: "api",
      scope: "project",
      context: "When adding browser requests in the web console.",
      mistake: "Calling fetch directly scatters authorization and error handling.",
      fix: "Use the console api helper for every request.",
      tags: ["web", "api"],
      severity: "error",
      module: "web",
      owner: "local",
      path_globs: ["src/web/**"],
    }) });
    traps.addTrapEvidence(projectActive.id, {
      source_type: "manual",
      related_files: ["src/web/static.ts"],
      note: "Seeded from the web library test.",
    }, "project");

    const archived = traps.addTrap({ ...trapInput({
      title: "Old review console behavior",
      category: "api",
      scope: "project",
      context: "When reviewing superseded web console behavior.",
      mistake: "Treating old review-only behavior as current.",
      fix: "Keep archived behavior out of the default library.",
      tags: ["web"],
      severity: "warning",
      module: "web",
      owner: "local",
    }) });
    traps.archiveTrap(archived.id, "project");

    traps.addTrap({ ...trapInput({
      title: "Global review habit",
      category: "convention",
      scope: "global",
      context: "When reviewing traps across projects.",
      mistake: "Assuming only project-local lessons matter.",
      fix: "Include global lessons in the default library view.",
      tags: ["review"],
      severity: "critical",
      module: "habits",
      owner: "local",
    }) });

    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const unauthorized = await handler(new Request(`http://codetrap.local/api/traps?project=${encodeURIComponent(project)}`));
    expect(unauthorized.status).toBe(401);

    const list = await api(handler, `/api/traps?project=${encodeURIComponent(project)}`);
    expect(list.status).toBe(200);
    const payload = await list.json();
    expect(payload.traps.map((trap: any) => [trap.scope, trap.title])).toEqual([
      ["project", "Use the shared web API helper"],
      ["global", "Global review habit"],
    ]);
    expect(payload.traps[0].tags).toEqual(["web", "api"]);
    expect(payload.traps.some((trap: any) => trap.title === "Old review console behavior")).toBe(false);

    const projectOnly = await api(handler, `/api/traps?project=${encodeURIComponent(project)}&scope=project`);
    expect((await projectOnly.json()).traps.map((trap: any) => trap.scope)).toEqual(["project"]);

    const allProject = await api(handler, `/api/traps?project=${encodeURIComponent(project)}&scope=project&status=all`);
    expect((await allProject.json()).traps.map((trap: any) => trap.status).sort()).toEqual(["active", "archived"]);

    const filtered = await api(handler, `/api/traps?project=${encodeURIComponent(project)}&category=api&module=web&owner=local`);
    expect((await filtered.json()).traps.map((trap: any) => trap.title)).toEqual(["Use the shared web API helper"]);

    const detail = await api(handler, `/api/trap?project=${encodeURIComponent(project)}&id=${projectActive.id}&scope=project`);
    expect(detail.status).toBe(200);
    const detailPayload = await detail.json();
    expect(detailPayload.trap.tags).toEqual(["web", "api"]);
    expect(detailPayload.trap.path_globs).toEqual(["src/web/**"]);
    expect(detailPayload.evidence[0].related_files).toEqual(["src/web/static.ts"]);
  });

  test("keeps learning insights separate from traps and consults them explicitly", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-insights-", { realpath: true });
    const outsider = tempProjectDir("codetrap-web-insights-outsider-", { realpath: true });
    addWebProject(project, home);
    new TrapOperations(new TrapStore(project, undefined, home)).addTrap({ ...trapInput({
      title: "A retrieval trap, not a learning insight",
      category: "api",
      scope: "project",
      context: "When the trap library is loaded.",
      mistake: "Mixing the trap library with the learning shelf.",
      fix: "Keep the two stores and APIs separate.",
      tags: ["web"],
      severity: "warning",
      module: "web",
    }) });
    const insightDir = join(project, ".codetrap", "phase2");
    mkdirSync(insightDir, { recursive: true });
    writeFileSync(join(insightDir, "insights.json"), `${JSON.stringify({
      version: 1,
      insights: [{
        id: "ins-web-separation",
        title: "A learning-only reflection",
        summary: "Useful for deliberate study, not retrieval.",
        body: "Review this note and mark it learned only when you intentionally consult it.",
        tags: ["learning", "web"],
        source_refs: ["session:test"],
        shelved_at: "2026-08-09T12:00:00.000Z",
        consulted_count: 0,
        last_consulted_at: null,
      }],
    }, null, 2)}\n`);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const trapPayload = await (await api(handler, `/api/traps?project=${encodeURIComponent(project)}`)).json();
    expect(trapPayload.traps.map((trap: any) => trap.title)).toEqual(["A retrieval trap, not a learning insight"]);
    expect(trapPayload.traps.some((trap: any) => trap.title === "A learning-only reflection")).toBe(false);

    const list = await api(handler, `/api/insights?project=${encodeURIComponent(project)}`);
    expect(list.status).toBe(200);
    const listPayload = await list.json();
    expect(listPayload.insights.map((insight: any) => insight.title)).toEqual(["A learning-only reflection"]);
    expect(listPayload.insights.some((insight: any) => insight.title === "A retrieval trap, not a learning insight")).toBe(false);
    expect(listPayload.insights[0].consulted_count).toBe(0);
    expect(listPayload.insights[0].last_consulted_at).toBeNull();

    const unauthorized = await handler(new Request("http://codetrap.local/api/insight/consult", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectRoot: project, id: "ins-web-separation" }),
    }));
    expect(unauthorized.status).toBe(401);

    const blocked = await api(handler, `/api/insights?project=${encodeURIComponent(outsider)}`);
    expect(blocked.status).toBe(403);

    const consulted = await api(handler, "/api/insight/consult", {
      method: "POST",
      body: { projectRoot: project, id: "ins-web-separation" },
    });
    expect(consulted.status).toBe(200);
    const consultedPayload = await consulted.json();
    expect(consultedPayload.insight.consulted_count).toBe(1);
    expect(consultedPayload.insight.last_consulted_at).toBeString();

    const consultedAgain = await api(handler, "/api/insight/consult", {
      method: "POST",
      body: { projectRoot: project, id: "ins-web-separation" },
    });
    const consultedAgainPayload = await consultedAgain.json();
    expect(consultedAgainPayload.insight.consulted_count).toBe(1);
    expect(consultedAgainPayload.insight.last_consulted_at).toBe(consultedPayload.insight.last_consulted_at);

    const missing = await api(handler, "/api/insight/consult", {
      method: "POST",
      body: { projectRoot: project, id: "ins-missing" },
    });
    expect(missing.status).toBe(404);
  });

  test("aggregates registered learning projects and governs inferred collection edits", async () => {
    const home = tempHome("codetrap-web-learning-all-home-", { realpath: true, initCodetrap: true });
    const projectA = tempProjectDir("codetrap-web-learning-all-a-", { realpath: true });
    const projectB = tempProjectDir("codetrap-web-learning-all-b-", { realpath: true });
    addWebProject(projectA, home);
    addWebProject(projectB, home);
    writeInsightShelf(projectA, [
      webInsight("ins-a2", "A second", "2026-08-29T02:00:00.000Z", "https://example.com/guide"),
      webInsight("ins-a1", "A first", "2026-08-29T01:00:00.000Z", "https://example.com/guide"),
    ]);
    writeInsightShelf(projectB, [
      webInsight("ins-b1", "B standalone", "2026-08-29T03:00:00.000Z", "manual:b"),
    ]);
    const handler = createWebHandler({ token: TOKEN, cwd: projectA, home, currentProjectRoot: projectA });

    const projectOnly = await api(handler, `/api/insights?project=${encodeURIComponent(projectA)}`);
    const projectPayload = await projectOnly.json();
    expect(projectPayload.scope).toBe("project");
    expect(projectPayload.insights).toHaveLength(2);
    expect(projectPayload.collections).toHaveLength(1);
    expect(projectPayload.collections[0].inferred).toBe(true);
    expect(projectPayload.collections[0].coverage_summary).toMatchObject({ status: "unknown", mode: null });

    const all = await api(handler, `/api/insights?project=${encodeURIComponent(projectA)}&scope=all`);
    const allPayload = await all.json();
    expect(allPayload.insights).toHaveLength(3);
    expect(new Set(allPayload.insights.map((insight: any) => insight.origin_project_root)))
      .toEqual(new Set([projectA, projectB]));
    expect(new Set(allPayload.insights.map((insight: any) => insight.library_key)).size).toBe(3);

    const collectionId = projectPayload.collections[0].id;
    const renamed = await api(handler, "/api/learning/collection/update", {
      method: "POST",
      body: { projectRoot: projectA, id: collectionId, title: "Example guide", topics: ["Web"] },
    });
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).collection).toMatchObject({ title: "Example guide", topics: ["Web"] });

    const reordered = await api(handler, "/api/learning/collection/reorder", {
      method: "POST",
      body: { projectRoot: projectA, id: collectionId, insightIds: ["ins-a2", "ins-a1"] },
    });
    expect(reordered.status).toBe(200);
    expect((await reordered.json()).items.map((item: any) => item.insight_id)).toEqual(["ins-a2", "ins-a1"]);

    const invalid = await api(handler, "/api/learning/collection/reorder", {
      method: "POST",
      body: { projectRoot: projectA, id: collectionId, insightIds: ["ins-a1", "ins-a1"] },
    });
    expect(invalid.status).toBe(400);
  });

  test("edits, approves, shelves, and rolls back an insight through purpose-specific Web routes", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-insight-review-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));
    const proposed = new Phase2Operations(project, traps).propose({
      kind: "insight",
      title: "Stable prompt prefixes",
      rationale: "This mental model changes agent tool design.",
      payload: {
        title: "Stable prompt prefixes",
        summary: "The reusable unit is an exact token prefix.",
        body: "[stable prefix] -> [cache hit]",
        tags: ["prompt-cache"],
        source_refs: ["https://example.com/prompt-cache"],
      },
    });
    if (proposed.suppressed) throw new Error("Fresh insight proposal was unexpectedly suppressed.");
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });
    const destinationPayload = {
      ...proposed.candidate.destination_payload,
      summary: "An exact token prefix is reusable; similar meaning is not enough.",
      body: "```text\n[stable prefix] -> [cache hit]\n```\n\nExample: append one page instead of rewriting chapter one.",
    };

    const applied = await api(handler, "/api/candidate/apply-insight", {
      method: "POST",
      body: {
        projectRoot: project,
        sessionId: proposed.session.id,
        candidateId: proposed.candidate.id,
        destinationPayload,
      },
    });
    expect(applied.status).toBe(200);
    const appliedPayload = await applied.json();
    expect(appliedPayload.candidate).toMatchObject({
      status: "accepted",
      candidate_kind: "insight",
      delivery_state: "committed",
    });
    expect(appliedPayload.receipt.destination).toBe("insight");

    const candidates = await api(handler, `/api/candidates?project=${encodeURIComponent(project)}&session=${encodeURIComponent(proposed.session.id)}`);
    expect((await candidates.json()).candidates[0].review).toMatchObject({
      status: "destination_committed",
      destination: "insight",
    });
    const insights = await api(handler, `/api/insights?project=${encodeURIComponent(project)}`);
    expect((await insights.json()).insights[0].summary).toBe(destinationPayload.summary);

    const rolledBack = await api(handler, "/api/candidate/rollback", {
      method: "POST",
      body: {
        projectRoot: project,
        sessionId: proposed.session.id,
        candidateId: proposed.candidate.id,
      },
    });
    expect(rolledBack.status).toBe(200);
    expect((await rolledBack.json()).candidate).toMatchObject({ status: "proposed", delivery_state: "rolled_back" });
    const emptyShelf = await api(handler, `/api/insights?project=${encodeURIComponent(project)}`);
    expect((await emptyShelf.json()).insights).toEqual([]);
  });

  test("rejects invalid source-covered Insight drafts on every Web mutation route", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-source-guard-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));
    const proposed = new Phase2Operations(project, traps).propose({
      kind: "insight",
      title: "Audited lesson",
      rationale: "The source has one declared lesson.",
      payload: {
        title: "Audited lesson",
        summary: "One source unit.",
        body: "source -> lesson",
        source_refs: ["https://example.com/audited"],
        source_unit_refs: ["lesson"],
        collection: {
          id: "col-audited",
          title: "Audited source",
          position: 1,
          source_coverage: {
            version: 1,
            mode: "full_source",
            source_fingerprint: `sha256:${"d".repeat(64)}`,
            units: [{ id: "lesson", title: "Lesson", disposition: "learn" }],
          },
        },
      },
    });
    if (proposed.suppressed) throw new Error("Fresh audited Insight was unexpectedly suppressed.");
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });
    const invalidPayload = { ...proposed.candidate.destination_payload, source_unit_refs: [] };

    for (const route of ["/api/candidate/save", "/api/candidate/approve", "/api/candidate/apply-insight"]) {
      const response = await api(handler, route, {
        method: "POST",
        body: {
          projectRoot: project,
          sessionId: proposed.session.id,
          candidateId: proposed.candidate.id,
          destinationPayload: invalidPayload,
        },
      });
      expect(response.status, route).toBe(400);
      expect((await response.json()).error).toContain("must identify at least one learned source unit");
    }

    const shelf = await api(handler, `/api/insights?project=${encodeURIComponent(project)}`);
    expect((await shelf.json()).insights).toEqual([]);
  });

  test("embedding settings API exposes status and preserves unrelated config on provider switch", async () => {
    const originalJinaApiKey = process.env.JINA_API_KEY;
    delete process.env.JINA_API_KEY;
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-embeddings-use-", { realpath: true });
    addWebProject(project, home);
    writeFileSync(join(home, ".codetrap", "config.json"), JSON.stringify({
      search: {
        mode: "fts",
        limit: 7,
        rerank: false,
      },
    }));
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    try {
      const ollama = await api(handler, "/api/embeddings/use", {
        method: "POST",
        body: {
          projectRoot: project,
          provider: "ollama",
          endpoint: "http://127.0.0.1:1",
        },
      });
      expect(ollama.status).toBe(200);
      const ollamaPayload = await ollama.json();
      expect(ollamaPayload.embeddings).toMatchObject({
        provider: "ollama",
        endpoint: "http://127.0.0.1:1",
        model: "qwen3-embedding:0.6b",
        dimensions: 1024,
      });
      expect(ollamaPayload.status.runtime).toMatchObject({
        available: false,
        provider: "ollama",
        model: "qwen3-embedding:0.6b",
        profile_id: "ollama:qwen3-embedding:0.6b:1024:p1",
      });
      expect(JSON.parse(readFileSync(join(home, ".codetrap", "config.json"), "utf-8"))).toMatchObject({
        search: {
          mode: "fts",
          limit: 7,
          rerank: false,
        },
        embeddings: {
          provider: "ollama",
          endpoint: "http://127.0.0.1:1",
        },
      });

      const jina = await api(handler, "/api/embeddings/use", {
        method: "POST",
        body: {
          projectRoot: project,
          provider: "jina",
        },
      });
      expect(jina.status).toBe(200);
      const jinaPayload = await jina.json();
      expect(jinaPayload.embeddings).toEqual({ provider: "jina" });
      expect(jinaPayload.status.runtime).toMatchObject({
        available: false,
        provider: "jina",
        model: "jina-embeddings-v5-text-small",
        dimensions: 1024,
        profile_id: "jina:jina-embeddings-v5-text-small:1024:p1",
        setup_action: {
          command: "export JINA_API_KEY=<your-jina-api-key>",
        },
      });

      const status = await api(handler, `/api/embeddings?project=${encodeURIComponent(project)}`);
      expect(status.status).toBe(200);
      expect((await status.json()).runtime).toMatchObject({
        available: false,
        provider: "jina",
      });
    } finally {
      if (originalJinaApiKey === undefined) {
        delete process.env.JINA_API_KEY;
      } else {
        process.env.JINA_API_KEY = originalJinaApiKey;
      }
    }
  });

  test("embedding reindex API refreshes project and global profile status", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-embeddings-reindex-", { realpath: true });
    addWebProject(project, home);
    const traps = new TrapOperations(new TrapStore(project, undefined, home));
    traps.addTrap({ ...trapInput({
      title: "Reindex project embeddings",
      category: "api",
      scope: "project",
      context: "When semantic search uses project traps.",
      mistake: "Leaving the active profile empty hides semantic candidates.",
      fix: "Generate project embeddings for the active profile.",
      severity: "warning",
    }) });
    traps.addTrap({ ...trapInput({
      title: "Reindex global embeddings",
      category: "api",
      scope: "global",
      context: "When semantic search includes global traps.",
      mistake: "Forgetting global embeddings leaves shared traps keyword-only.",
      fix: "Generate global embeddings for the active profile.",
      severity: "warning",
    }) });
    const ollama = startFakeOllama();
    try {
      const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });
      await api(handler, "/api/embeddings/use", {
        method: "POST",
        body: {
          projectRoot: project,
          provider: "ollama",
          endpoint: `http://127.0.0.1:${ollama.port}`,
          model: "qwen3-embedding:0.6b",
          dimensions: 3,
        },
      });

      const projectReindex = await api(handler, "/api/embeddings/reindex", {
        method: "POST",
        body: {
          projectRoot: project,
          scope: "project",
        },
      });
      expect(projectReindex.status).toBe(200);
      const projectPayload = await projectReindex.json();
      expect(projectPayload.result).toMatchObject({
        generated: 1,
        skipped: 0,
        batches: 1,
      });
      expect(projectPayload.status.project).toMatchObject({
        total: 1,
        fresh: 1,
        stale: 0,
        missing: 0,
      });
      expect(projectPayload.status.project.profiles).toEqual([
        expect.objectContaining({
          id: "ollama:qwen3-embedding:0.6b:3:p1",
          provider: "ollama",
          model: "qwen3-embedding:0.6b",
          dimensions: 3,
          embedding_count: 1,
        }),
      ]);
      expect(projectPayload.status.global).toMatchObject({
        total: 1,
        fresh: 0,
        missing: 1,
      });

      const globalReindex = await api(handler, "/api/embeddings/reindex", {
        method: "POST",
        body: {
          projectRoot: project,
          scope: "global",
        },
      });
      expect(globalReindex.status).toBe(200);
      const globalPayload = await globalReindex.json();
      expect(globalPayload.result.scopes).toEqual([
        {
          scope: "global",
          generated: 1,
          skipped: 0,
          batches: 1,
        },
      ]);
      expect(globalPayload.status.global).toMatchObject({
        total: 1,
        fresh: 1,
        stale: 0,
        missing: 0,
      });
    } finally {
      ollama.stop();
    }
  });

  test("session list API exposes pending candidate review counts", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-session-review-counts-", { realpath: true });
    addWebProject(project, home);
    const { sessionId } = seedCandidateSession(project, 2, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const response = await api(handler, `/api/sessions?project=${encodeURIComponent(project)}`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.candidate_review).toMatchObject({
      pending_count: 2,
      reviewed_count: 0,
      pending_session_count: 1,
      next_session_id: sessionId,
    });
    expect(payload.sessions[0]).toMatchObject({
      id: sessionId,
      pending_count: 2,
      reviewed_count: 0,
      high_quality_pending_count: 2,
      needs_edit_count: 0,
      candidate_review: {
        session_id: sessionId,
        pending_count: 2,
      },
    });
  });

  test("renames a session through the Web API without changing its stable id", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-session-rename-", { realpath: true });
    addWebProject(project, home);
    const { sessionId } = seedCandidateSession(project, 1, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const renamed = await api(handler, "/api/session/rename", {
      method: "POST",
      body: { projectRoot: project, sessionId, goal: "中文会话名称" },
    });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({
      previous_goal: expect.any(String),
      session: { id: sessionId, goal: "中文会话名称" },
    });

    const listed = await api(handler, `/api/sessions?project=${encodeURIComponent(project)}`);
    expect((await listed.json()).sessions[0]).toMatchObject({ id: sessionId, goal: "中文会话名称" });
  });

  test("saves candidate drafts and resets conflict diagnostics", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-save-", { realpath: true });
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 1, home);
    traps.addTrap({ ...existingProjectTrap() });

    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });
    const blocked = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: {
        projectRoot: project,
        sessionId,
        candidateId: "cand-001",
      },
    });
    expect(blocked.status).toBe(409);
    const blockedPayload = await blocked.json();
    expect(blockedPayload.next_actions).toBeUndefined();

    const afterConflict = JSON.parse(readFileSync(join(
      project,
      ".codetrap",
      "sessions",
      sessionId,
      "candidate-traps.json"
    ), "utf-8"));
    expect(afterConflict.candidates[0].quality).toMatchObject({
      conflict_checked: true,
      conflict_status: "possible",
    });

    const saved = await api(handler, "/api/candidate/save", {
      method: "POST",
      body: {
        projectRoot: project,
        sessionId,
        candidateId: "cand-001",
        trap: {
          ...afterConflict.candidates[0].trap,
          module: "web",
          owner: "",
        },
      },
    });
    expect(saved.status).toBe(200);
    const payload = await saved.json();
    expect(payload.candidate.trap.module).toBe("web");
    expect(payload.candidate.quality).toMatchObject({
      conflict_checked: false,
      conflict_status: "none",
    });
  });

  test("accepts, rejects, accepts anyway, and supersedes through the API", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-actions-", { realpath: true });
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 3, home);
    traps.addTrap({ ...existingProjectTrap() });
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const blocked = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-001" },
    });
    expect(blocked.status).toBe(409);
    const blockedPayload = await blocked.json();
    expect(blockedPayload.next_actions).toBeUndefined();
    expect(blockedPayload.possible_conflicts[0]).toMatchObject({
      trap_id: 1,
      scope: "project",
    });

    const acceptedAnyway = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-001", acceptAnyway: true },
    });
    expect(acceptedAnyway.status).toBe(200);
    expect((await acceptedAnyway.json()).candidate.status).toBe("accepted");

    const superseded = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-002", supersedesId: 1 },
    });
    expect(superseded.status).toBe(200);
    expect((await superseded.json()).superseded_id).toBe(1);
    expect(traps.getTrapDetails(1, "project")?.trap.status).toBe("superseded");

    const rejected = await api(handler, "/api/candidate/reject", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-003", reason: "Too broad." },
    });
    expect(rejected.status).toBe(200);
    const rejectedPayload = await rejected.json();
    expect(rejectedPayload.candidate).toMatchObject({
      id: "cand-003",
      status: "rejected",
      rejection_reason: "Too broad.",
    });
  }, 15_000);

  test("accepts candidate draft edits through the API", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-accept-edit-", { realpath: true });
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 1, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const accepted = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: {
        projectRoot: project,
        sessionId,
        candidateId: "cand-001",
        trap: {
          title: "Accept current web review draft",
          category: "api",
          scope: "project",
          context: "When accepting a polished candidate in the web review console.",
          mistake: "Accepting only the last saved candidate loses visible form edits.",
          fix: "Send the current candidate form as an accept-time edit.",
          severity: "warning",
          tags: ["web", "review"],
          path_globs: ["src/web/**"],
          module: "web",
          owner: "",
        },
      },
    });

    expect(accepted.status).toBe(200);
    const payload = await accepted.json();
    expect(payload.candidate.trap).toMatchObject({
      title: "Accept current web review draft",
      module: "web",
      owner: null,
    });
    const details = traps.getTrapDetails(payload.trap_id, "project");
    expect(details?.trap).toMatchObject({
      title: "Accept current web review draft",
      fix: "Send the current candidate form as an accept-time edit.",
      owner: null,
    });
  });

  test("candidate list reports accepted traps that were later deleted", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-reviewed-", { realpath: true });
    addWebProject(project, home);
    const { sessionId, traps } = seedCandidateSession(project, 1, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const initial = await api(handler, `/api/candidates?project=${encodeURIComponent(project)}&session=${encodeURIComponent(sessionId)}`);
    expect((await initial.json()).candidates[0].review).toMatchObject({
      status: "pending",
    });

    const accepted = await api(handler, "/api/candidate/accept", {
      method: "POST",
      body: { projectRoot: project, sessionId, candidateId: "cand-001" },
    });
    const acceptedPayload = await accepted.json();
    expect(accepted.status).toBe(200);
    expect(traps.deleteTrap(acceptedPayload.trap_id, "project").success).toBe(true);

    const candidates = await api(handler, `/api/candidates?project=${encodeURIComponent(project)}&session=${encodeURIComponent(sessionId)}`);
    const payload = await candidates.json();
    expect(payload.candidates[0].review).toMatchObject({
      status: "accepted_missing",
      label: `accepted -> trap #${acceptedPayload.trap_id} deleted`,
      trap_id: acceptedPayload.trap_id,
      trap_present: false,
    });

    const cleaned = await api(handler, "/api/session/cleanup", {
      method: "POST",
      body: { projectRoot: project, sessionId },
    });
    expect(cleaned.status).toBe(200);
    const cleanedPayload = await cleaned.json();
    expect(cleanedPayload).toMatchObject({
      removed_count: 1,
      removed_candidate_ids: ["cand-001"],
      candidates: [],
    });
  });

  test("deletes sessions through the web API", async () => {
    const home = tempHome("codetrap-web-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-session-delete-", { realpath: true });
    addWebProject(project, home);
    const { sessionId } = seedCandidateSession(project, 1, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const deleted = await api(handler, "/api/session/delete", {
      method: "POST",
      body: { projectRoot: project, sessionId },
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({
      success: true,
      session_id: sessionId,
      deleted: true,
    });

    const list = await api(handler, `/api/sessions?project=${encodeURIComponent(project)}`);
    expect((await list.json()).sessions).toEqual([]);
  });
});

function writeInsightShelf(project: string, insights: Record<string, unknown>[]): void {
  const dir = join(project, ".codetrap", "phase2");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "insights.json"), `${JSON.stringify({ version: 1, insights }, null, 2)}\n`);
}

function webInsight(id: string, title: string, shelvedAt: string, sourceRef: string) {
  return {
    id,
    title,
    summary: `${title} summary`,
    body: `${title} body`,
    tags: ["learning"],
    source_refs: [sourceRef],
    shelved_at: shelvedAt,
    consulted_count: 0,
    last_consulted_at: null,
  };
}

function seedCandidateSession(project: string, count: number, home: string): { sessionId: string; traps: TrapOperations } {
  const traps = new TrapOperations(new TrapStore(project, undefined, home));
  const sessions = new SessionOperations(new SessionStore(project), traps);
  const session = sessions.startSession({
    goal: "review web candidates",
    module: "api",
    owner: "local",
  });
  for (let index = 1; index <= count; index++) {
    sessions.addNote({
      kind: "review",
      text: [
        `Title: Prefer stable API client ${index}`,
        "Category: api",
        "Context: When making API requests in this project.",
        "Mistake: Calling fetch directly skips the shared request wrapper.",
        "Fix: Use the stable apiClient helper instead.",
        "Severity: error",
        "Tags: api,fetch",
        "Path globs: src/api/**",
      ].join("\n"),
    });
  }
  sessions.closeSession(session.id, true);
  return { sessionId: session.id, traps };
}

function existingProjectTrap() {
  return trapInput({
    title: "Use stable API client",
    category: "api",
    scope: "project",
    context: "When making API requests in this project.",
    mistake: "Calling fetch directly bypasses retry behavior.",
    fix: "Use the stable API client helper.",
    tags: ["api", "fetch"],
    severity: "error",
    module: "api",
  });
}

function trapInput(args: Record<string, unknown>) {
  return buildTrapInput(args);
}

function api(
  handler: (request: Request) => Promise<Response>,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<Response> {
  const headers = new Headers({ "X-Codetrap-Token": TOKEN });
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }
  return handler(new Request(`http://codetrap.local${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  }));
}

function startFakeOllama(): { port: number; stop: () => void } {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/tags") {
        return Response.json({
          models: [{ name: "qwen3-embedding:0.6b" }],
        });
      }
      if (url.pathname === "/api/embed") {
        const body = await request.json() as { input?: unknown; dimensions?: unknown };
        const inputs = Array.isArray(body.input) ? body.input : [body.input];
        const dimensions = typeof body.dimensions === "number" ? body.dimensions : 3;
        const embeddings = inputs.map((_input, index) =>
          Array.from({ length: dimensions }, (_value, dimension) => dimension === index % dimensions ? 1 : 0)
        );
        return Response.json({ embeddings });
      }
      return Response.json({ error: "not found" }, { status: 404 });
    },
  });
  const port = server.port;
  if (port === undefined) {
    server.stop(true);
    throw new Error("Fake Ollama server did not expose a port.");
  }
  return {
    port,
    stop: () => server.stop(true),
  };
}
