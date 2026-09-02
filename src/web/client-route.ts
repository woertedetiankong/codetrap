export type WorkspaceMainView = "review" | "library" | "learning" | "embeddings" | "impact";
export type WorkspaceImpactView = "overview" | "runs" | "evals";

export interface WorkspaceRoute {
  mainView: WorkspaceMainView;
  impactView: WorkspaceImpactView;
  sessionId: string | null;
  candidateId: string | null;
  runId: string | null;
}

function emptyWorkspaceRoute(): WorkspaceRoute {
  return {
    mainView: "review",
    impactView: "overview",
    sessionId: null,
    candidateId: null,
    runId: null,
  };
}

function safeDecodeRouteSegment(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseWorkspaceRoute(hash: string): WorkspaceRoute {
  const route = emptyWorkspaceRoute();
  const path = String(hash || "").replace(/^#\/?/, "");
  const segments = path.split("/").filter(Boolean);
  const mainView = segments[0];
  if (mainView === "library" || mainView === "learning" || mainView === "embeddings") {
    route.mainView = mainView;
    return route;
  }
  if (mainView === "impact") {
    route.mainView = "impact";
    if (segments[1] === "evals") route.impactView = "evals";
    else if (segments[1] === "runs") {
      route.impactView = "runs";
      route.runId = safeDecodeRouteSegment(segments[2]);
    }
    return route;
  }
  if (mainView === "review") {
    route.sessionId = safeDecodeRouteSegment(segments[1]);
    route.candidateId = route.sessionId ? safeDecodeRouteSegment(segments[2]) : null;
  }
  return route;
}

export function workspaceRouteHash(route: Partial<WorkspaceRoute>): string {
  if (route.mainView === "library" || route.mainView === "learning" || route.mainView === "embeddings") {
    return `#/${route.mainView}`;
  }
  if (route.mainView === "impact") {
    if (route.impactView === "evals") return "#/impact/evals";
    if (route.impactView === "runs") {
      return route.runId ? `#/impact/runs/${encodeURIComponent(route.runId)}` : "#/impact/runs";
    }
    return "#/impact/overview";
  }
  if (route.sessionId) {
    const session = encodeURIComponent(route.sessionId);
    return route.candidateId
      ? `#/review/${session}/${encodeURIComponent(route.candidateId)}`
      : `#/review/${session}`;
  }
  return "#/review";
}

const CLIENT_ROUTE_FUNCTIONS = [
  emptyWorkspaceRoute,
  safeDecodeRouteSegment,
  parseWorkspaceRoute,
  workspaceRouteHash,
];

export const WEB_ROUTE_CLIENT_SCRIPT = CLIENT_ROUTE_FUNCTIONS
  .map((fn) => fn.toString())
  .join("\n\n");
