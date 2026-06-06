import { randomBytes } from "node:crypto";
import { DEFAULT_OLLAMA_DIMENSIONS, DEFAULT_OLLAMA_ENDPOINT, DEFAULT_OLLAMA_MODEL, EmbeddingProviderUnavailableError } from "../lib/embedder";
import { CATEGORIES, SCOPES, SEVERITIES } from "../lib/constants";
import { loadCodetrapConfig, type EmbeddingProviderSetting, type EmbeddingSettings } from "../lib/config";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { toListJson, toTrapDetailsJson } from "../lib/output-json";
import {
  reviewedSessionCandidates,
  sessionConflictPayload,
} from "../lib/session-review";
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
    const ops = sessionOperations(projectRoot, context.home);
    const sessions = ops.sessions.listSessions({ status: "all", limit: 100 });
    return jsonResponse({
      project_root: projectRoot,
      candidate_review: ops.sessions.candidateReviewSummary(),
      sessions,
    });
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
      candidates: reviewedSessionCandidates(document.candidates, ops.traps),
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

  if (request.method === "GET" && url.pathname === "/api/embeddings") {
    const projectRoot = projectRootFromQuery(url, context);
    const status = await trapStore(projectRoot, context.home).embeddingStatus();
    return jsonResponse({
      project_root: projectRoot,
      settings: loadCodetrapConfig(context.home).embeddings ?? null,
      ...status,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/embeddings/use") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const embeddings = embeddingSettingsFromBody(body);
    const written = trapStore(projectRoot, context.home).configureEmbeddings(embeddings);
    const refreshed = await trapStore(projectRoot, context.home).embeddingStatus();
    return jsonResponse({
      success: true,
      project_root: projectRoot,
      path: written.path,
      config: written.config,
      embeddings: written.config.embeddings ?? embeddings,
      settings: written.config.embeddings ?? embeddings,
      next_actions: embeddingReindexActions(projectRoot),
      status: refreshed,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/embeddings/reindex") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const scope = scopeBodyField(body, "scope");
    const store = trapStore(projectRoot, context.home);
    try {
      const result = await store.ensureEmbeddings({ scope });
      return jsonResponse({
        success: true,
        project_root: projectRoot,
        scope,
        result,
        status: await store.embeddingStatus(),
      });
    } catch (error) {
      if (error instanceof EmbeddingProviderUnavailableError) {
        throw new WebHttpError(400, error.message);
      }
      throw error;
    }
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
      edit: optionalRecordBodyField(body, "trap"),
      acceptAnyway: booleanBodyField(body, "acceptAnyway"),
      supersedesId: optionalNumberBodyField(body, "supersedesId"),
    });
    if (!result.success) {
      throw new WebPayloadError(409, sessionConflictPayload(result));
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

  if (request.method === "POST" && url.pathname === "/api/session/delete") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const result = sessionOperations(projectRoot, context.home).sessions.deleteSession(
      stringBodyField(body, "sessionId")
    );
    return jsonResponse({ success: true, ...result });
  }

  if (request.method === "POST" && url.pathname === "/api/session/cleanup") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const ops = sessionOperations(projectRoot, context.home);
    const result = ops.sessions.cleanupDeletedTrapCandidates(
      optionalStringBodyField(body, "sessionId")
    );
    return jsonResponse({
      success: true,
      session: result.session,
      removed_count: result.removed_count,
      removed_candidate_ids: result.removed_candidate_ids,
      candidates: reviewedSessionCandidates(result.candidates, ops.traps),
    });
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
  return new TrapOperations(trapStore(projectRoot, home));
}

function trapStore(projectRoot: string, home?: string): TrapStore {
  return new TrapStore(projectRoot, undefined, home);
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

function scopeBodyField(body: Record<string, unknown>, key: string): "project" | "global" {
  const value = stringBodyField(body, key);
  if (value === "project" || value === "global") return value;
  throw new WebHttpError(400, `${key} must be project or global.`);
}

function embeddingSettingsFromBody(body: Record<string, unknown>): EmbeddingSettings {
  const provider = embeddingProviderBodyField(body, "provider");
  if (provider === "jina") {
    return { provider };
  }
  return {
    provider,
    endpoint: optionalStringBodyField(body, "endpoint") ?? DEFAULT_OLLAMA_ENDPOINT,
    model: optionalStringBodyField(body, "model") ?? DEFAULT_OLLAMA_MODEL,
    dimensions: optionalNumberBodyField(body, "dimensions") ?? DEFAULT_OLLAMA_DIMENSIONS,
  };
}

function embeddingProviderBodyField(body: Record<string, unknown>, key: string): EmbeddingProviderSetting {
  const value = stringBodyField(body, key);
  if (value === "ollama" || value === "jina") return value;
  throw new WebHttpError(400, `${key} must be ollama or jina.`);
}

function embeddingReindexActions(_projectRoot: string): { scope: "project" | "global"; command: string; reason: string }[] {
  return [
    {
      scope: "project",
      command: "codetrap embeddings reindex --scope project",
      reason: "Generate project embeddings for the selected profile.",
    },
    {
      scope: "global",
      command: "codetrap embeddings reindex --scope global",
      reason: "Generate global embeddings for the selected profile.",
    },
  ];
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

function optionalRecordBodyField(body: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new WebHttpError(400, `${key} must be an object.`);
  return value;
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
