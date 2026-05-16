import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleToolCall } from "../mcp/server";
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
    expect(details.evidence).toHaveLength(1);
    expect(details.evidence[0]).toMatchObject({
      trap_id: added.id,
      source_type: "commit",
      source_ref: "abc123",
      note: "Captured from a review fix.",
    });
  });
});
