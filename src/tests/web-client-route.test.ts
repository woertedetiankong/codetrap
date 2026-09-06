import { describe, expect, test } from "bun:test";
import {
  parseWorkspaceRoute,
  workspaceRouteHash,
} from "../web/client-route";

describe("web workspace routes", () => {
  const workspace = "p-" + "a".repeat(24);
  const origin = "p-" + "b".repeat(24);

  test("round-trips exact scoped lessons and cross-project Learning origins", () => {
    for (const trapScope of ["project", "global"] as const) {
      const route = { mainView: "library" as const, projectRef: workspace, trapScope, trapId: 42 };
      expect(parseWorkspaceRoute(workspaceRouteHash(route))).toMatchObject({ ...route, pane: "detail", invalid: false });
      expect(parseWorkspaceRoute(workspaceRouteHash({ ...route, pane: "list" }))).toMatchObject({ ...route, pane: "list" });
    }
    const learning = { mainView: "learning" as const, projectRef: workspace, insightProjectRef: origin, insightId: "ins/中文 ?#1" };
    expect(parseWorkspaceRoute(workspaceRouteHash(learning))).toMatchObject({ ...learning, pane: "detail", invalid: false });
    expect(parseWorkspaceRoute(workspaceRouteHash({ ...learning, pane: "list" }))).toMatchObject({ ...learning, pane: "list" });
  });

  test("rejects incomplete or malformed item addresses instead of selecting a different item", () => {
    for (const hash of ["#/library/project", "#/library/team/1", "#/library/global/0", "#/library/global/1/extra", "#/library/project/9007199254740992", "#/learning/unknown/id", "#/learning/" + origin + "/%E0%A4%A", "#/library?project=/private/path"]) {
      expect(parseWorkspaceRoute(hash).invalid).toBe(true);
    }
  });

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


  test("round-trips unicode review identities without treating encoded slashes as hierarchy", () => {
    const route = { mainView: "review" as const, sessionId: "session/经验 ?", candidateId: "cand/#1" };
    expect(parseWorkspaceRoute(workspaceRouteHash(route))).toMatchObject({ ...route, pane: "detail" });
    expect(parseWorkspaceRoute(workspaceRouteHash({ ...route, pane: "list" }))).toMatchObject({ ...route, pane: "list" });
  });
});
