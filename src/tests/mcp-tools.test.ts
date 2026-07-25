import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleResourceRead, handleToolCall } from "../mcp/server";
import { TrapStore } from "../lib/store";

describe("MCP tool payloads", () => {
  test("search_traps returns compact cards and get_trap returns details", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-"));
    mkdirSync(join(cwd, ".codetrap"));
    const store = new TrapStore(cwd, undefined);

    const added = store.add({
      title: "Use fetchWrapper for HTTP requests",
      category: "api",
      scope: "project",
      context: "When making network requests, use the project fetchWrapper.",
      mistake: "Calling fetch directly bypasses retry and error handling.",
      fix: "Use fetchWrapper and follow the HTTP request convention.",
      tags: ["http"],
      severity: "error",
      path_globs: ["src/api/**"],
      module: "api",
      owner: "platform",
    });
    store.addEvidence(added.id, {
      source_type: "commit",
      source_ref: "abc123",
      related_files: ["src/api.ts"],
      note: "Captured from a review fix.",
    }, "project");

    const searchResponse = await handleToolCall(store, "search_traps", {
      query: "fetchWrapper",
      scope: "project",
      mode: "fts",
      path: "src/api/client.ts",
      module: "api",
      owner: "platform",
      ranking_signals: true,
    });
    const cards = JSON.parse(searchResponse.content[0].text).results;

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      trap_id: added.id,
      scope: "project",
      title: "Use fetchWrapper for HTTP requests",
      avoid: "Calling fetch directly bypasses retry and error handling.",
      do_instead: "Use fetchWrapper and follow the HTTP request convention.",
      next_action: {
        details_tool: "get_trap",
        details_args: { id: added.id, scope: "project" },
      },
    });
    expect(cards[0].ranking_signals.map((signal: { code: string }) => signal.code)).toContain("path_scope_match");
    expect(cards[0].context).toBeUndefined();
    expect(cards[0].mistake).toBeUndefined();
    expect(cards[0].fix).toBeUndefined();

    const detailResponse = await handleToolCall(store, "get_trap", {
      id: added.id,
      scope: "project",
    });
    const details = JSON.parse(detailResponse.content[0].text);

    expect(details.scope).toBe("project");
    expect(details.trap).toMatchObject({
      id: added.id,
      status: "active",
      context: "When making network requests, use the project fetchWrapper.",
      mistake: "Calling fetch directly bypasses retry and error handling.",
      fix: "Use fetchWrapper and follow the HTTP request convention.",
    });
    expect(details.trap.tags).toEqual(["http"]);
    expect(details.trap.path_globs).toEqual(["src/api/**"]);
    expect(details.trap.module).toBe("api");
    expect(details.trap.owner).toBe("platform");
    expect(details.evidence).toHaveLength(1);
    expect(details.evidence[0]).toMatchObject({
      trap_id: added.id,
      source_type: "commit",
      source_ref: "abc123",
      note: "Captured from a review fix.",
    });
    expect(details.evidence[0].related_files).toEqual(["src/api.ts"]);
  });

  test("get_trap increments the hit count so top-traps resources work for MCP-only clients (L6)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-hit-"));
    mkdirSync(join(cwd, ".codetrap"));
    const store = new TrapStore(cwd, undefined);
    const added = store.add({
      title: "Use fetchWrapper for HTTP requests",
      category: "api",
      scope: "project",
      context: "When making network requests, use the project fetchWrapper.",
      mistake: "Calling fetch directly bypasses retry and error handling.",
      fix: "Use fetchWrapper and follow the HTTP request convention.",
      tags: ["http"],
      severity: "error",
    });

    expect(store.getDetails(added.id, "project")!.trap.hit_count).toBe(0);
    await handleToolCall(store, "get_trap", { id: added.id, scope: "project", cwd });
    await handleToolCall(store, "get_trap", { id: added.id, scope: "project", cwd });
    expect(store.getDetails(added.id, "project")!.trap.hit_count).toBe(2);
  });

  test("tool calls can resolve project scope from an explicit cwd", async () => {
    const serverCwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-server-"));
    const projectCwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-project-"));
    mkdirSync(join(projectCwd, ".codetrap"));

    const serverStore = new TrapStore(serverCwd, undefined);
    const projectStore = new TrapStore(projectCwd, undefined);
    const added = projectStore.add({
      title: "Use fetchWrapper for HTTP requests",
      category: "api",
      scope: "project",
      context: "When making network requests, use the project fetchWrapper.",
      mistake: "Calling fetch directly bypasses retry and error handling.",
      fix: "Use fetchWrapper and follow the HTTP request convention.",
      tags: ["http"],
      severity: "error",
    });

    const searchResponse = await handleToolCall(serverStore, "search_traps", {
      query: "fetchWrapper",
      scope: "project",
      mode: "fts",
      cwd: projectCwd,
    });
    const cards = JSON.parse(searchResponse.content[0].text).results;

    expect(cards).toHaveLength(1);
    expect(cards[0].next_action.details_args).toEqual({ id: added.id, scope: "project" });
  });

  test("get_stats honors the requested scope", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-stats-"));
    mkdirSync(join(cwd, ".codetrap"));
    const store = new TrapStore(cwd, undefined);

    store.add({
      title: "Project stats trap",
      category: "bug",
      scope: "project",
      context: "When requesting scoped stats.",
      mistake: "Returning both scopes ignores the MCP scope argument.",
      fix: "Normalize stats requests through the shared request module.",
    });

    const response = await handleToolCall(store, "get_stats", { scope: "project" });
    const stats = JSON.parse(response.content[0].text);

    expect(stats.project.total).toBe(1);
    expect(stats.global).toBeNull();
  });

  test("resources use the shared normalized JSON contract", () => {
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-resource-"));
    mkdirSync(join(cwd, ".codetrap"));
    const store = new TrapStore(cwd, undefined);

    const added = store.add({
      title: "Normalize JSON fields for agents",
      category: "convention",
      scope: "project",
      context: "When exposing traps to agents, JSON string fields should be arrays.",
      mistake: "Returning SQLite JSON strings makes consumers parse fields twice.",
      fix: "Route MCP resources through the shared JSON presenter.",
      tags: ["json", "mcp"],
      severity: "warning",
    });
    store.addEvidence(added.id, {
      source_type: "manual",
      related_files: ["src/mcp/server.ts"],
    }, "project");

    const recent = handleResourceRead(store, "codetrap://project/recent");
    expect(recent.contents[0].mimeType).toBe("application/json");
    const traps = JSON.parse(recent.contents[0].text);
    expect(traps[0]).toMatchObject({
      id: added.id,
      scope: "project",
      tags: ["json", "mcp"],
    });

    const detail = handleResourceRead(store, `codetrap://project/trap/${added.id}`);
    const details = JSON.parse(detail.contents[0].text);
    expect(details.trap.tags).toEqual(["json", "mcp"]);
    expect(details.evidence[0].related_files).toEqual(["src/mcp/server.ts"]);
  });

  test("resources can resolve project scope from a cwd query parameter", () => {
    const serverCwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-resource-server-"));
    const projectCwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-resource-project-"));
    mkdirSync(join(projectCwd, ".codetrap"));

    const serverStore = new TrapStore(serverCwd, undefined);
    const projectStore = new TrapStore(projectCwd, undefined);
    const added = projectStore.add({
      title: "Resolve resources from cwd",
      category: "convention",
      scope: "project",
      context: "When reading MCP resources across projects.",
      mistake: "Using the server startup cwd can show the wrong project.",
      fix: "Pass cwd as a resource query parameter when the client can provide it.",
      tags: ["mcp", "cwd"],
      severity: "error",
    });

    const uri = `codetrap://project/trap/${added.id}?cwd=${encodeURIComponent(projectCwd)}`;
    const detail = handleResourceRead(serverStore, uri);
    const details = JSON.parse(detail.contents[0].text);
    expect(details.trap.title).toBe("Resolve resources from cwd");
  });

  test("search_traps honors config/env search defaults (M26)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-defaults-"));
    mkdirSync(join(cwd, ".codetrap"));
    const store = new TrapStore(cwd, undefined);
    for (const n of [1, 2, 3]) {
      store.add({
        title: `Shared token trap ${n}`,
        category: "convention",
        scope: "project",
        context: "When testing that search honors the configured default limit.",
        mistake: "Hardcoding the MCP limit ignored the user's configured default.",
        fix: "Read searchDefaultsFromConfig in the MCP handler like the CLI does.",
      });
    }

    const previous = process.env.CODETRAP_SEARCH_LIMIT;
    process.env.CODETRAP_SEARCH_LIMIT = "1";
    try {
      const response = await handleToolCall(store, "search_traps", {
        query: "Shared token trap",
        scope: "project",
        mode: "fts",
      });
      // Without the fix the default limit was hardcoded to 20 and all three matched.
      expect(JSON.parse(response.content[0].text).results).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.CODETRAP_SEARCH_LIMIT;
      else process.env.CODETRAP_SEARCH_LIMIT = previous;
    }
  });

  test("search_traps warns when no project scope resolves, and stays silent once cwd resolves one (M27)", async () => {
    const serverCwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-noproject-"));
    const projectCwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-withproject-"));
    mkdirSync(join(projectCwd, ".codetrap"));
    const store = new TrapStore(serverCwd, undefined);

    const noProject = JSON.parse(
      (await handleToolCall(store, "search_traps", { query: "anything", scope: "project" })).content[0].text
    );
    expect(noProject.warning).toContain("No project scope resolved");

    const resolved = JSON.parse(
      (await handleToolCall(store, "search_traps", { query: "anything", scope: "project", cwd: projectCwd })).content[0].text
    );
    expect(resolved.warning).toBeUndefined();
  });

  test("capture_candidate proposes a candidate without writing to the trap database (M28)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-capture-"));
    mkdirSync(join(cwd, ".codetrap"));
    const store = new TrapStore(cwd, undefined);

    const response = await handleToolCall(store, "capture_candidate", {
      title: "Route agent captures through candidate review",
      category: "convention",
      scope: "project",
      context: "When an agent wants to record a lesson through MCP.",
      mistake: "Writing straight to the trap database skips human review.",
      fix: "Capture a candidate and let a human accept or reject it.",
      kind: "correction",
      related_files: ["src/mcp/server.ts"],
    });
    const payload = JSON.parse(response.content[0].text);
    expect(payload.success).toBe(true);
    expect(payload.status).toBe("proposed");
    expect(payload.candidate_id).toMatch(/^cand-\d+$/);
    expect(payload.candidate_count).toBe(1);

    // The candidate is inbox-only — nothing was committed to traps.db.
    const list = JSON.parse((await handleToolCall(store, "list_traps", { scope: "project" })).content[0].text);
    expect(list).toEqual([]);
  });

  test("capture_candidate requires a resolvable project (M28)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-capture-noproject-"));
    const store = new TrapStore(cwd, undefined);

    const response = await handleToolCall(store, "capture_candidate", {
      title: "No project here",
      category: "convention",
      scope: "project",
      context: "When capturing outside an initialized project.",
      mistake: "Silently dropping the capture confuses the agent.",
      fix: "Return a clear error telling the caller to pass cwd.",
    });
    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0].text).error).toContain("requires a project");
  });

  test("doctor returns a health report for the resolved project (M28)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-doctor-"));
    mkdirSync(join(cwd, ".codetrap"));
    const store = new TrapStore(cwd, undefined);
    store.add({
      title: "Doctor should count this trap",
      category: "bug",
      scope: "project",
      context: "When diagnosing project health over MCP.",
      mistake: "MCP-only clients had no way to run doctor.",
      fix: "Expose a doctor tool that reuses buildDoctorReport.",
    });

    const report = JSON.parse((await handleToolCall(store, "doctor", { cwd })).content[0].text);
    expect(report.project_root).not.toBeNull();
    expect(report.traps.project).toBe(1);
    expect(Array.isArray(report.next_actions)).toBe(true);
  });
});

// §13.2: the behavioral contract travels in the MCP initialize handshake, so
// an MCP-only client learns the workflow without per-client prompt config.
describe("MCP self-describing contract", () => {
  test("initialize handshake delivers the codetrap usage instructions", async () => {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { createServer } = await import("../mcp/server");
    const { MCP_SERVER_INSTRUCTIONS } = await import("../mcp/instructions");

    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-instructions-"));
    mkdirSync(join(cwd, ".codetrap"));
    const server = createServer(new TrapStore(cwd, undefined));
    const client = new Client({ name: "codetrap-test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const instructions = client.getInstructions();
    expect(instructions).toBe(MCP_SERVER_INSTRUCTIONS);
    // The four contract pillars (roadmap §13.2): pre-flight search, candidate
    // capture, the human review gate, and explicit-trigger-only learning review.
    expect(instructions).toContain("search_traps");
    expect(instructions).toContain("capture_candidate");
    expect(instructions).toContain("reserved for the human");
    expect(instructions).toContain("only when the user explicitly asks");

    await client.close();
    await server.close();
  });

  test("doctor report carries the server version for restart-hint comparison", async () => {
    const { CODETRAP_VERSION } = await import("../lib/version");
    const cwd = mkdtempSync(join(tmpdir(), "codetrap-mcp-doctor-version-"));
    mkdirSync(join(cwd, ".codetrap"));
    const store = new TrapStore(cwd, undefined);

    const report = JSON.parse((await handleToolCall(store, "doctor", { cwd })).content[0].text);
    expect(report.version).toBe(CODETRAP_VERSION);
    expect(Array.isArray(report.clients)).toBe(true);
  });
});
