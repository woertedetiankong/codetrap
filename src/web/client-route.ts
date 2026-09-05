export type WorkspaceMainView = "review" | "library" | "learning" | "embeddings" | "impact";
export type WorkspaceImpactView = "overview" | "runs" | "evals";

export interface WorkspaceRoute {
  mainView: WorkspaceMainView;
  impactView: WorkspaceImpactView;
  sessionId: string | null;
  candidateId: string | null;
  runId: string | null;
  projectRef: string | null;
  trapScope: "project" | "global" | null;
  trapId: number | null;
  insightProjectRef: string | null;
  insightId: string | null;
  pane: "list" | "detail";
  invalid: boolean;
}

function emptyWorkspaceRoute(): WorkspaceRoute {
  return { mainView: "review", impactView: "overview", sessionId: null, candidateId: null, runId: null,
    projectRef: null, trapScope: null, trapId: null, insightProjectRef: null, insightId: null, pane: "list", invalid: false };
}
function safeDecodeRouteSegment(value: string | undefined): string | null {
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}
export function parseWorkspaceRoute(hash: string): WorkspaceRoute {
  const route = emptyWorkspaceRoute();
  const path = String(hash || "").replace(/^#\/?/, "");
  const split = path.indexOf("?");
  const query = new URLSearchParams(split < 0 ? "" : path.slice(split + 1));
  const segments = (split < 0 ? path : path.slice(0, split)).split("/").filter(Boolean);
  const project = query.get("project");
  route.projectRef = project;
  if (project !== null && !/^p-[a-f0-9]{24}$/.test(project)) route.invalid = true;
  const mainView = segments[0];
  if (mainView === "library" || mainView === "learning" || mainView === "embeddings") {
    route.mainView = mainView;
    if (mainView === "library" && segments.length > 1) {
      const id = Number(segments[2]);
      if ((segments[1] !== "project" && segments[1] !== "global") || !Number.isSafeInteger(id) || id < 1 || segments.length !== 3) route.invalid = true;
      else { route.trapScope = segments[1]; route.trapId = id; route.pane = "detail"; }
    }
    if (mainView === "learning" && segments.length > 1) {
      const id = safeDecodeRouteSegment(segments[2]);
      if (!segments[1] || !/^p-[a-f0-9]{24}$/.test(segments[1]) || !id || segments.length !== 3) route.invalid = true;
      else { route.insightProjectRef = segments[1]; route.insightId = id; route.pane = "detail"; }
    }
  } else if (mainView === "impact") {
    route.mainView = "impact";
    if (segments[1] === "evals") route.impactView = "evals";
    else if (segments[1] === "runs") { route.impactView = "runs"; route.runId = safeDecodeRouteSegment(segments[2]); }
  } else if (mainView === "review") {
    route.sessionId = safeDecodeRouteSegment(segments[1]);
    route.candidateId = route.sessionId ? safeDecodeRouteSegment(segments[2]) : null;
  }
  if (query.get("pane") === "list") route.pane = "list";
  return route;
}
export function workspaceRouteHash(route: Partial<WorkspaceRoute>): string {
  let path = "#/review";
  if (route.mainView === "library") {
    path = "#/library";
    if ((route.trapScope === "project" || route.trapScope === "global") && Number.isSafeInteger(route.trapId) && route.trapId! > 0) path += `/${route.trapScope}/${route.trapId}`;
  } else if (route.mainView === "learning") {
    path = "#/learning";
    if (route.insightProjectRef && route.insightId) path += `/${encodeURIComponent(route.insightProjectRef)}/${encodeURIComponent(route.insightId)}`;
  } else if (route.mainView === "embeddings") path = "#/embeddings";
  else if (route.mainView === "impact") {
    path = route.impactView === "evals" ? "#/impact/evals" : route.impactView === "runs"
      ? route.runId ? `#/impact/runs/${encodeURIComponent(route.runId)}` : "#/impact/runs" : "#/impact/overview";
  } else if (route.sessionId) {
    path += `/${encodeURIComponent(route.sessionId)}`;
    if (route.candidateId) path += `/${encodeURIComponent(route.candidateId)}`;
  }
  const query = new URLSearchParams();
  if (route.projectRef) query.set("project", route.projectRef);
  if ((route.mainView === "library" && route.trapId || route.mainView === "learning" && route.insightId) && route.pane === "list") query.set("pane", "list");
  return path + (query.size ? "?" + query.toString() : "");
}
