import { randomBytes } from "node:crypto";
import { CATEGORIES, SCOPES, SEVERITIES } from "../lib/constants";
import type { CandidateTrap } from "../domain/session";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { SessionOperations, type SessionAcceptResult } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { toListJson, toTrapDetailsJson } from "../lib/output-json";
import { WEB_INDEX_HTML } from "./static";
import {
  addWebProject,
  loadWebProjectRegistry,
  resolveWebProjectRoot,
  type WebProject,
} from "./project-registry";

export interface WebServerOptions {
  cwd?: string;
  project?: string;
  host?: string;
  port?: number;
  token?: string;
  home?: string;
}

type WebContext = {
  token: string;
  cwd: string;
  home?: string;
  currentProjectRoot: string | null;
};

type WebCandidateReview =
  | { status: "pending"; label: string }
  | {
      status: "accepted";
      label: string;
      trap_id: number;
      scope: string;
      trap_present: true;
      trap_status: string;
      trap_title: string;
    }
  | {
      status: "accepted_missing";
      label: string;
      trap_id?: number;
      scope?: string;
      trap_present: false;
    }
  | {
      status: "rejected";
      label: string;
      rejected_at?: string;
      rejection_reason?: string;
    };

type WebCandidate = CandidateTrap & { review: WebCandidateReview };

export async function startWebServerFromArgs(args: string[], cwd = process.cwd()): Promise<void> {
  const options = webServerOptionsFromArgs(args, cwd);
  const token = options.token ?? randomBytes(18).toString("base64url");
  const currentProjectRoot = registerInitialProject(options);
  const handler = createWebHandler({
    token,
    cwd: options.cwd ?? cwd,
    home: options.home,
    currentProjectRoot,
  });
  const host = options.host ?? "127.0.0.1";
  const server = serveOnAvailablePort({
    host,
    port: options.port ?? 4737,
    fetch: handler,
  });
  const url = `http://${host}:${server.port}/?token=${encodeURIComponent(token)}`;
  console.log(`codetrap web listening on ${url}`);
  setInterval(() => undefined, 60_000);
  await new Promise(() => {});
}

export function createWebHandler(context: WebContext): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) {
        authorize(request, context.token);
        return await routeApi(request, url, context);
      }
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return htmlResponse(WEB_INDEX_HTML);
      }
      if (url.pathname === "/favicon.ico") {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      const status = error instanceof WebHttpError || error instanceof WebPayloadError ? error.status : 500;
      const payload = error instanceof WebPayloadError
        ? error.payload
        : { error: error instanceof Error ? error.message : String(error) };
      return jsonResponse(payload, status);
    }
  };
}

export function webServerOptionsFromArgs(args: string[], cwd = process.cwd()): WebServerOptions {
  const options: WebServerOptions = { cwd };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[index + 1] && !args[index + 1].startsWith("--") ? args[++index] : "true";
    if (key === "project") options.project = value;
    if (key === "host") options.host = value;
    if (key === "port") options.port = parsePort(value);
  }
  return options;
}

async function routeApi(request: Request, url: URL, context: WebContext): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    const registry = loadWebProjectRegistry(context.home);
    return jsonResponse({
      projects: registry.projects,
      current_project_root: context.currentProjectRoot,
      options: {
        categories: [...CATEGORIES],
        severities: [...SEVERITIES],
        scopes: [...SCOPES],
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    return jsonResponse(loadWebProjectRegistry(context.home));
  }

  if (request.method === "POST" && url.pathname === "/api/projects") {
    const body = await readJsonBody(request);
    const path = stringBodyField(body, "path");
    const project = addWebProject(path, context.home);
    return jsonResponse({ project, projects: loadWebProjectRegistry(context.home).projects });
  }

  if (request.method === "GET" && url.pathname === "/api/sessions") {
    const projectRoot = projectRootFromQuery(url, context);
    const sessions = sessionOperations(projectRoot, context.home).sessions.listSessions({ status: "all", limit: 100 });
    return jsonResponse({ project_root: projectRoot, sessions });
  }

  if (request.method === "GET" && url.pathname === "/api/candidates") {
    const projectRoot = projectRootFromQuery(url, context);
    const sessionId = requiredQuery(url, "session");
    const ops = sessionOperations(projectRoot, context.home);
    const session = ops.sessions.showSession(sessionId).session;
    const document = ops.sessions.candidateDocument(sessionId);
    return jsonResponse({
      project_root: projectRoot,
      session,
      candidates: webCandidates(document.candidates, ops.traps),
    });
  }

  if (request.method === "GET" && url.pathname === "/api/traps") {
    const projectRoot = projectRootFromQuery(url, context);
    const groups = trapOperations(projectRoot, context.home).listTraps({
      category: optionalQuery(url, "category"),
      scope: optionalQuery(url, "scope"),
      status: optionalQuery(url, "status"),
      module: optionalQuery(url, "module"),
      owner: optionalQuery(url, "owner"),
      limit: optionalNumberQuery(url, "limit"),
      offset: optionalNumberQuery(url, "offset"),
    });
    return jsonResponse({
      project_root: projectRoot,
      traps: toListJson(groups),
    });
  }

  if (request.method === "GET" && url.pathname === "/api/trap") {
    const projectRoot = projectRootFromQuery(url, context);
    const id = numberQuery(url, "id");
    const scope = url.searchParams.get("scope") ?? undefined;
    const details = trapOperations(projectRoot, context.home).getTrapDetails(id, scope);
    if (!details) throw new WebHttpError(404, `Trap #${id} not found.`);
    return jsonResponse(toTrapDetailsJson(details));
  }

  if (request.method === "POST" && url.pathname === "/api/candidate/save") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const result = sessionOperations(projectRoot, context.home).sessions.saveCandidate({
      candidateId: stringBodyField(body, "candidateId"),
      sessionId: optionalStringBodyField(body, "sessionId"),
      edit: recordBodyField(body, "trap"),
    });
    return jsonResponse({ success: true, session: result.session, candidate: result.candidate });
  }

  if (request.method === "POST" && url.pathname === "/api/candidate/accept") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const result = await sessionOperations(projectRoot, context.home).sessions.acceptCandidate({
      candidateId: stringBodyField(body, "candidateId"),
      sessionId: optionalStringBodyField(body, "sessionId"),
      acceptAnyway: booleanBodyField(body, "acceptAnyway"),
      supersedesId: optionalNumberBodyField(body, "supersedesId"),
    });
    if (!result.success) {
      throw new WebPayloadError(409, conflictPayload(result));
    }
    return jsonResponse({
      success: true,
      session: result.session,
      candidate: result.candidate,
      trap_id: result.trap_id,
      scope: result.scope,
      evidence_id: result.evidence_id,
      superseded_id: result.superseded_id,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/candidate/reject") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const result = sessionOperations(projectRoot, context.home).sessions.rejectCandidate({
      candidateId: stringBodyField(body, "candidateId"),
      sessionId: optionalStringBodyField(body, "sessionId"),
      reason: optionalStringBodyField(body, "reason"),
    });
    return jsonResponse({ success: true, session: result.session, candidate: result.candidate });
  }

  throw new WebHttpError(404, "Not found");
}

function sessionOperations(projectRoot: string, home?: string): { traps: TrapOperations; sessions: SessionOperations } {
  const traps = trapOperations(projectRoot, home);
  return {
    traps,
    sessions: new SessionOperations(new SessionStore(projectRoot), traps),
  };
}

function trapOperations(projectRoot: string, home?: string): TrapOperations {
  return new TrapOperations(new TrapStore(projectRoot, undefined, home));
}

function webCandidates(candidates: CandidateTrap[], traps: TrapOperations): WebCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    review: candidateReview(candidate, traps),
  }));
}

function candidateReview(candidate: CandidateTrap, traps: TrapOperations): WebCandidateReview {
  if (candidate.status === "proposed") {
    return { status: "pending", label: "pending review" };
  }

  if (candidate.status === "rejected") {
    return {
      status: "rejected",
      label: "rejected",
      rejected_at: candidate.rejected_at,
      rejection_reason: candidate.rejection_reason,
    };
  }

  const trapId = candidate.accepted_trap_id;
  const scope = candidate.accepted_scope ?? acceptedScopeFallback(candidate);
  if (trapId === undefined) {
    return {
      status: "accepted_missing",
      label: "accepted -> trap link missing",
      scope,
      trap_present: false,
    };
  }

  const details = traps.getTrapDetails(trapId, scope);
  if (!details) {
    return {
      status: "accepted_missing",
      label: `accepted -> trap #${trapId} deleted`,
      trap_id: trapId,
      scope,
      trap_present: false,
    };
  }

  return {
    status: "accepted",
    label: `accepted -> trap #${trapId}`,
    trap_id: trapId,
    scope: details.scope,
    trap_present: true,
    trap_status: details.trap.status,
    trap_title: details.trap.title,
  };
}

function acceptedScopeFallback(candidate: CandidateTrap): string {
  return candidate.trap.scope === "global" ? "global" : "project";
}

function registerInitialProject(options: WebServerOptions): string | null {
  const path = options.project ?? options.cwd;
  if (!path) return null;
  try {
    return addWebProject(path, options.home).root;
  } catch (error) {
    if (options.project) throw error;
    return null;
  }
}

function serveOnAvailablePort(args: {
  host: string;
  port: number;
  fetch: (request: Request) => Promise<Response>;
}): { port: number; server: ReturnType<typeof Bun.serve> } {
  for (let port = args.port; port < args.port + 50; port++) {
    try {
      const server = Bun.serve({
        hostname: args.host,
        port,
        fetch: args.fetch,
      });
      return { port: server.port ?? port, server };
    } catch (error) {
      if (String(error).includes("EADDRINUSE")) continue;
      throw error;
    }
  }
  throw new Error(`No available port found starting at ${args.port}.`);
}

function authorize(request: Request, token: string): void {
  if (request.headers.get("X-Codetrap-Token") !== token) {
    throw new WebHttpError(401, "Unauthorized");
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null);
  if (!isRecord(value)) throw new WebHttpError(400, "JSON object body is required.");
  return value;
}

function projectRootFromQuery(url: URL, context: WebContext): string {
  const project = url.searchParams.get("project") ?? context.currentProjectRoot;
  if (!project) throw new WebHttpError(400, "project is required.");
  return resolveWebProjectRoot(project, context.home);
}

function projectRootFromBody(body: Record<string, unknown>, context: WebContext): string {
  const project = optionalStringBodyField(body, "projectRoot") ?? context.currentProjectRoot;
  if (!project) throw new WebHttpError(400, "projectRoot is required.");
  return resolveWebProjectRoot(project, context.home);
}

function requiredQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (!value) throw new WebHttpError(400, `${key} is required.`);
  return value;
}

function numberQuery(url: URL, key: string): number {
  const value = Number.parseInt(requiredQuery(url, key), 10);
  if (Number.isNaN(value)) throw new WebHttpError(400, `${key} must be a number.`);
  return value;
}

function optionalQuery(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key)?.trim();
  return value || undefined;
}

function optionalNumberQuery(url: URL, key: string): number | undefined {
  const value = optionalQuery(url, key);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new WebHttpError(400, `${key} must be a positive integer.`);
  return parsed;
}

function stringBodyField(body: Record<string, unknown>, key: string): string {
  const value = optionalStringBodyField(body, key);
  if (!value) throw new WebHttpError(400, `${key} is required.`);
  return value;
}

function optionalStringBodyField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new WebHttpError(400, `${key} must be a string.`);
  const trimmed = value.trim();
  return trimmed || undefined;
}

function numberBodyField(body: Record<string, unknown>, key: string): number {
  const value = optionalNumberBodyField(body, key);
  if (value === undefined) throw new WebHttpError(400, `${key} is required.`);
  return value;
}

function optionalNumberBodyField(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new WebHttpError(400, `${key} must be an integer.`);
  }
  return value;
}

function booleanBodyField(body: Record<string, unknown>, key: string): boolean {
  const value = body[key];
  return typeof value === "boolean" ? value : false;
}

function recordBodyField(body: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = body[key];
  if (!isRecord(value)) throw new WebHttpError(400, `${key} must be an object.`);
  return value;
}

function conflictPayload(result: Exclude<SessionAcceptResult, { success: true }>): Record<string, unknown> {
  return {
    success: false,
    error: "Possible active trap conflict found.",
    session_id: result.session_id,
    candidate_id: result.candidate_id,
    possible_conflicts: result.possible_conflicts,
  };
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid --port: ${value}`);
  }
  return port;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function htmlResponse(value: string): Response {
  return new Response(value, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

class WebHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

class WebPayloadError extends Error {
  constructor(public readonly status: number, public readonly payload: Record<string, unknown>) {
    super(String(payload.error ?? "Request failed"));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
