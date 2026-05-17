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
    });
    const cards = JSON.parse(searchResponse.content[0].text);

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
    expect(details.evidence).toHaveLength(1);
    expect(details.evidence[0]).toMatchObject({
      trap_id: added.id,
      source_type: "commit",
      source_ref: "abc123",
      note: "Captured from a review fix.",
    });
    expect(details.evidence[0].related_files).toEqual(["src/api.ts"]);
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
    const cards = JSON.parse(searchResponse.content[0].text);

    expect(cards).toHaveLength(1);
    expect(cards[0].next_action.details_args).toEqual({ id: added.id, scope: "project" });
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
});
