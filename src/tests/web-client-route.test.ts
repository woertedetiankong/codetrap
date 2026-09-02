import { describe, expect, test } from "bun:test";
import {
  parseWorkspaceRoute,
  WEB_ROUTE_CLIENT_SCRIPT,
  workspaceRouteHash,
} from "../web/client-route";

describe("web workspace routes", () => {
  test("parses addressable views without putting a project path in the route", () => {
    expect(parseWorkspaceRoute("#/impact/evals")).toMatchObject({ mainView: "impact", impactView: "evals", runId: null });
    expect(parseWorkspaceRoute("#/impact/runs/run%2F42")).toMatchObject({ mainView: "impact", impactView: "runs", runId: "run/42" });
    expect(parseWorkspaceRoute("#/review/session%201/cand-001")).toMatchObject({
      mainView: "review",
      sessionId: "session 1",
      candidateId: "cand-001",
    });
    expect(workspaceRouteHash({ mainView: "impact", impactView: "evals" })).toBe("#/impact/evals");
    expect(workspaceRouteHash({ mainView: "impact", impactView: "runs", runId: "run/42" })).toBe("#/impact/runs/run%2F42");
    expect(workspaceRouteHash({ mainView: "review", sessionId: "session 1", candidateId: "cand-001" })).toBe("#/review/session%201/cand-001");
  });

  test("falls back safely for malformed or unsupported hashes", () => {
    expect(parseWorkspaceRoute("#/unknown/place").mainView).toBe("review");
    expect(parseWorkspaceRoute("#/impact/runs/%E0%A4%A").runId).toBeNull();
    expect(parseWorkspaceRoute("")).toMatchObject({ mainView: "review", impactView: "overview" });
  });

  test("ships the route codec as valid browser JavaScript", () => {
    expect(WEB_ROUTE_CLIENT_SCRIPT).toContain("function parseWorkspaceRoute");
    expect(WEB_ROUTE_CLIENT_SCRIPT).toContain("function workspaceRouteHash");
    expect(() => new Function(WEB_ROUTE_CLIENT_SCRIPT)).not.toThrow();
  });
});
