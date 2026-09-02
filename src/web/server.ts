import { randomBytes } from "node:crypto";
import { DEFAULT_OLLAMA_DIMENSIONS, DEFAULT_OLLAMA_ENDPOINT, DEFAULT_OLLAMA_MODEL, EmbeddingProviderUnavailableError } from "../lib/embedder";
import { CATEGORIES, SCOPES, SEVERITIES } from "../lib/constants";
import { loadCodetrapConfig, type EmbeddingProviderSetting, type EmbeddingSettings } from "../lib/config";
import { DEFAULT_LOCAL_EMBEDDING_MODEL_ID, resolveLocalEmbeddingModel } from "../lib/local-embedding-models";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { SessionOperations } from "../lib/session-operations";
import { parseExecutor, type Executor } from "../domain/learning";
import { SessionStore } from "../lib/session-store";
import { Phase2Store, type InsightRecord } from "../lib/phase2-store";
import { Phase2Operations } from "../lib/phase2-operations";
import { DEFAULT_RANKING_CONFIG } from "../lib/search-policy";
import { toListJson, toTrapDetailsJson } from "../lib/output-json";
import { isRecord } from "../lib/value-types";
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
import {
  observationOverviewWebPayload,
  observationRunsWebPayload,
  observationRunWebPayload,
} from "./observation-view";
import { observationEvalsWebPayload } from "./evals-view";
import { GovernedEvalOperations } from "../lib/governed-eval-operations";
import { ControlledEvalOperations, type ControlledEvalProfile } from "../lib/controlled-eval";
import { LearningImpactOperations, type LearningImpactState } from "../lib/learning-impact";

export interface WebServerOptions {
  cwd?: string;
  project?: string;
  host?: string;
  port?: number;
  token?: string;
  home?: string;
  open?: boolean;
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
  if (options.open) {
    try {
      launchWebBrowser(url);
    } catch (error) {
      console.warn(`Could not open the browser automatically: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
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
    if (key === "open") options.open = value !== "false";
  }
  return options;
}

export function webBrowserCommand(url: string, platform = process.platform): string[] {
  if (platform === "win32") return ["cmd.exe", "/d", "/s", "/c", "start", "", url];
  if (platform === "darwin") return ["open", url];
  return ["xdg-open", url];
}

export function launchWebBrowser(url: string, platform = process.platform): void {
  const child = Bun.spawn({
    cmd: webBrowserCommand(url, platform),
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
    windowsHide: true,
  });
  void child.exited.catch(() => undefined);
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
        stale_after_days: DEFAULT_RANKING_CONFIG.staleAfterDays,
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
      offset: optionalNumberQuery(url, "offset", 0),
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

  if (request.method === "GET" && url.pathname === "/api/observations/overview") {
    const projectRoot = projectRootFromQuery(url, context);
    return jsonResponse(observationOverviewWebPayload(projectRoot, optionalNumberQuery(url, "limit") ?? 50));
  }

  if (request.method === "GET" && url.pathname === "/api/observations/runs") {
    const projectRoot = projectRootFromQuery(url, context);
    return jsonResponse(observationRunsWebPayload(projectRoot, optionalNumberQuery(url, "limit") ?? 100));
  }

  if (request.method === "GET" && url.pathname === "/api/observations/run") {
    const projectRoot = projectRootFromQuery(url, context);
    const payload = observationRunWebPayload(projectRoot, requiredQuery(url, "id"));
    if (payload.availability === "ready" && payload.run === null) {
      throw new WebHttpError(404, "Observation Run not found.");
    }
    return jsonResponse(payload);
  }

  if (request.method === "GET" && url.pathname === "/api/observations/evals") {
    const projectRoot = projectRootFromQuery(url, context);
    return jsonResponse(await observationEvalsWebPayload(
      projectRoot,
      governedEvalOperations(projectRoot, context.home)
    ));
  }

  if (request.method === "POST" && url.pathname === "/api/observations/eval-candidate/draft") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runGovernedEvalAction(() => governedEvalOperations(projectRoot, context.home).draft(
      stringBodyField(body, "observationCandidateId"),
      recordBodyField(body, "draft")
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/observations/eval-candidate/accept") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runGovernedEvalAction(() => governedEvalOperations(projectRoot, context.home).accept(
      stringBodyField(body, "observationCandidateId"),
      recordBodyField(body, "draft")
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/observations/eval-candidate/reject") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runGovernedEvalAction(() => governedEvalOperations(projectRoot, context.home).reject(
      stringBodyField(body, "observationCandidateId"),
      optionalStringBodyField(body, "reason")
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/observations/eval-candidate/rollback") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runGovernedEvalAction(() => governedEvalOperations(projectRoot, context.home).rollback(
      stringBodyField(body, "observationCandidateId")
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/observations/controlled-evals/run") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    try {
      const experiment = await new ControlledEvalOperations(projectRoot).run({
        profile: stringBodyField(body, "profile") as ControlledEvalProfile,
        trials: optionalNumberBodyField(body, "trials"),
        seed: optionalStringBodyField(body, "seed"),
      });
      return jsonResponse({ success: true, experiment });
    } catch (error) {
      throw new WebHttpError(400, error instanceof Error ? error.message : String(error));
    }
  }

  if (request.method === "GET" && url.pathname === "/api/insights") {
    const projectRoot = projectRootFromQuery(url, context);
    const scope = learningScopeQuery(url);
    const registry = loadWebProjectRegistry(context.home);
    const projects = scope === "all"
      ? registry.projects
      : [registry.projects.find((project) => project.root === projectRoot) ?? {
        root: projectRoot,
        name: projectRoot,
        last_opened_at: new Date(0).toISOString(),
      }];
    return jsonResponse(learningLibraryPayload(projects, projectRoot, scope, context.home));
  }

  if (request.method === "POST" && url.pathname === "/api/insight/consult") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const id = stringBodyField(body, "id");
    const store = new Phase2Store(projectRoot);
    if (!store.listInsights().some((insight) => insight.id === id)) {
      throw new WebHttpError(404, `Insight ${id} not found.`);
    }
    const impact = learningImpactOperations(projectRoot, context.home).updateStatus(id, "learned");
    return jsonResponse({
      success: true,
      project_root: projectRoot,
      insight: decorateLearningInsight(
        store.listInsights().find((insight) => insight.id === id)!,
        projectRoot,
        learningProjectName(projectRoot, context),
        impact
      ),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/learning/progress/status") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runLearningImpactAction(() => learningImpactOperations(projectRoot, context.home).updateStatus(
      stringBodyField(body, "id"),
      stringBodyField(body, "status")
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/learning/feedback") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runLearningImpactAction(() => learningImpactOperations(projectRoot, context.home).updateFeedback(
      stringBodyField(body, "id"),
      stringBodyField(body, "feedback")
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/learning/run-link") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runLearningImpactAction(() => learningImpactOperations(projectRoot, context.home).linkRun(
      stringBodyField(body, "id"),
      body.linkedRunId
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/learning/candidate/preview") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runLearningImpactAction(() => learningImpactOperations(projectRoot, context.home).preview(
      stringBodyField(body, "id"),
      optionalRecordBodyField(body, "draft")
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/learning/candidate/create") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    return jsonResponse(runLearningImpactAction(() => learningImpactOperations(projectRoot, context.home).createCandidate(
      stringBodyField(body, "id"),
      recordBodyField(body, "draft")
    )));
  }

  if (request.method === "POST" && url.pathname === "/api/learning/collection/update") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const id = stringBodyField(body, "id");
    const store = new Phase2Store(projectRoot);
    if (!store.learningLibrary().collections.some((collection) => collection.id === id)) {
      throw new WebHttpError(404, `Insight collection ${id} not found.`);
    }
    const collection = store.updateCollection(id, {
      title: optionalStringBodyField(body, "title"),
      summary: optionalStringBodyField(body, "summary"),
      topics: optionalStringArrayBodyField(body, "topics"),
    });
    return jsonResponse({ success: true, project_root: projectRoot, collection });
  }

  if (request.method === "POST" && url.pathname === "/api/learning/collection/reorder") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const id = stringBodyField(body, "id");
    const store = new Phase2Store(projectRoot);
    if (!store.learningLibrary().collections.some((collection) => collection.id === id)) {
      throw new WebHttpError(404, `Insight collection ${id} not found.`);
    }
    try {
      const items = store.reorderCollection(id, stringArrayBodyField(body, "insightIds"));
      return jsonResponse({ success: true, project_root: projectRoot, collection_id: id, items });
    } catch (error) {
      throw new WebHttpError(400, error instanceof Error ? error.message : String(error));
    }
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
    const operations = sessionOperations(projectRoot, context.home);
    const result = saveCandidateDraftFromBody(
      operations,
      stringBodyField(body, "candidateId"),
      optionalStringBodyField(body, "sessionId"),
      body
    );
    if (!result) throw new WebHttpError(400, "trap or destinationPayload is required.");
    return jsonResponse({ success: true, session: result.session, candidate: result.candidate });
  }

  if (request.method === "POST" && url.pathname === "/api/session/rename") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const result = sessionOperations(projectRoot, context.home).sessions.updateSessionGoal(
      stringBodyField(body, "sessionId"),
      stringBodyField(body, "goal")
    );
    return jsonResponse({ success: true, ...result });
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
      // The review console is the user driving the decision themselves; an
      // agent posting to this route must say so explicitly (§3.2).
      executor: executorBodyField(body),
      authorizedScope: optionalStringBodyField(body, "authorizedScope"),
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
      receipt: result.receipt,
    });
  }

  // §16 1E / Phase 1B risk 2: without this a console-only user cannot record an
  // authorization at all, so an agent-executed commit is unreachable without
  // dropping to a terminal.
  if (request.method === "POST" && url.pathname === "/api/candidate/approve") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const operations = sessionOperations(projectRoot, context.home);
    const ops = operations.sessions;
    const candidateId = stringBodyField(body, "candidateId");
    const sessionId = optionalStringBodyField(body, "sessionId");
    // Persist the draft first so the authorization binds to the content the
    // user is looking at, not a stored revision they have since edited.
    saveCandidateDraftFromBody(operations, candidateId, sessionId, body);
    const result = ops.approveCandidate({
      candidateId,
      sessionId,
      executor: executorBodyField(body),
      authorizedScope: optionalStringBodyField(body, "authorizedScope"),
    });
    return jsonResponse({
      success: true,
      session: result.session,
      candidate: result.candidate,
      authorization: result.authorization,
      receipt: result.receipt,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/candidate/apply-insight") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const operations = sessionOperations(projectRoot, context.home);
    const candidateId = stringBodyField(body, "candidateId");
    const requestedSessionId = optionalStringBodyField(body, "sessionId");
    saveCandidateDraftFromBody(operations, candidateId, requestedSessionId, body);
    const current = operations.sessions.getCandidate(candidateId, requestedSessionId);
    if (current.candidate.candidate_kind !== "insight") {
      throw new WebHttpError(400, `Candidate ${candidateId} is not a learning insight.`);
    }
    const executor = executorBodyField(body);
    const approval = operations.sessions.approveCandidate({
      candidateId,
      sessionId: current.session.id,
      executor,
      authorizedScope: optionalStringBodyField(body, "authorizedScope"),
    });
    const applied = new Phase2Operations(projectRoot, operations.traps).apply(
      current.session.id,
      candidateId,
      executor
    );
    return jsonResponse({
      ...applied,
      approval_receipt: approval.receipt,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/candidate/rollback") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const operations = sessionOperations(projectRoot, context.home);
    const candidateId = stringBodyField(body, "candidateId");
    const sessionId = optionalStringBodyField(body, "sessionId");
    const current = operations.sessions.getCandidate(candidateId, sessionId);
    if ((current.candidate.candidate_kind ?? "pitfall_trap") !== "pitfall_trap") {
      const commitId = current.candidate.destination_commit_id;
      if (!commitId) throw new WebHttpError(409, `Candidate ${candidateId} has no destination commit to roll back.`);
      const result = new Phase2Operations(projectRoot, operations.traps).revert(
        commitId,
        executorBodyField(body)
      );
      return jsonResponse(result);
    }
    const result = operations.sessions.rollbackCandidate({
      candidateId,
      sessionId,
      executor: executorBodyField(body),
      authorizedScope: optionalStringBodyField(body, "authorizedScope"),
    });
    return jsonResponse({
      success: true,
      session: result.session,
      candidate: result.candidate,
      trap_id: result.trap_id,
      trap_deleted: result.trap_deleted,
      receipt: result.receipt,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/candidate/reject") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const result = sessionOperations(projectRoot, context.home).sessions.rejectCandidate({
      candidateId: stringBodyField(body, "candidateId"),
      sessionId: optionalStringBodyField(body, "sessionId"),
      reason: optionalStringBodyField(body, "reason"),
      executor: executorBodyField(body),
      authorizedScope: optionalStringBodyField(body, "authorizedScope"),
    });
    return jsonResponse({
      success: true,
      session: result.session,
      candidate: result.candidate,
      suppression: result.suppression,
      receipt: result.receipt,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/suppression/undo") {
    const body = await readJsonBody(request);
    const projectRoot = projectRootFromBody(body, context);
    const result = sessionOperations(projectRoot, context.home).sessions.unsuppress({
      fingerprint: stringBodyField(body, "fingerprint"),
      executor: executorBodyField(body),
      authorizedScope: optionalStringBodyField(body, "authorizedScope"),
    });
    return jsonResponse(result);
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

// An unrecognized executor is bad input from the caller, so surface it as a
// 400 like every other body-field validator rather than letting the generic
// handler report a 500 server fault.
function executorBodyField(body: Record<string, unknown>): Executor {
  try {
    return parseExecutor(optionalStringBodyField(body, "executor"));
  } catch (error) {
    throw new WebHttpError(400, error instanceof Error ? error.message : String(error));
  }
}

type WebOperations = { traps: TrapOperations; sessions: SessionOperations; phase2: Phase2Operations };

function sessionOperations(projectRoot: string, home?: string): WebOperations {
  const traps = trapOperations(projectRoot, home);
  return {
    traps,
    sessions: new SessionOperations(new SessionStore(projectRoot), traps),
    phase2: new Phase2Operations(projectRoot, traps),
  };
}

function saveCandidateDraftFromBody(
  operations: WebOperations,
  candidateId: string,
  sessionId: string | undefined,
  body: Record<string, unknown>
): { session: ReturnType<SessionOperations["getCandidate"]>["session"]; candidate: ReturnType<SessionOperations["getCandidate"]>["candidate"] } | null {
  const destinationPayload = optionalRecordBodyField(body, "destinationPayload");
  if (destinationPayload) {
    const current = operations.sessions.getCandidate(candidateId, sessionId);
    if ((current.candidate.candidate_kind ?? "pitfall_trap") === "pitfall_trap") {
      throw new WebHttpError(400, `Candidate ${candidateId} is a pitfall trap and has no destination payload.`);
    }
    try {
      operations.phase2.edit(current.session.id, candidateId, destinationPayload);
    } catch (error) {
      throw new WebHttpError(400, error instanceof Error ? error.message : String(error));
    }
    return operations.sessions.getCandidate(candidateId, current.session.id);
  }
  const trap = optionalRecordBodyField(body, "trap");
  return trap ? operations.sessions.saveCandidate({ candidateId, sessionId, edit: trap }) : null;
}

function trapOperations(projectRoot: string, home?: string): TrapOperations {
  return new TrapOperations(trapStore(projectRoot, home));
}

function governedEvalOperations(projectRoot: string, home?: string): GovernedEvalOperations {
  return new GovernedEvalOperations(projectRoot, trapOperations(projectRoot, home));
}

function learningImpactOperations(projectRoot: string, home?: string): LearningImpactOperations {
  return new LearningImpactOperations(projectRoot, sessionOperations(projectRoot, home).sessions);
}

function runGovernedEvalAction<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw new WebHttpError(400, error instanceof Error ? error.message : String(error));
  }
}

function runLearningImpactAction<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw new WebHttpError(400, error instanceof Error ? error.message : String(error));
  }
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

// M32: Bun.serve throws a "Failed to start server. Is port <n> in use?" error
// whose port-in-use signal lives on error.code, not in the message — so the old
// String(error).includes("EADDRINUSE") check never matched and the fallback was
// dead code. Test the code (with a message fallback for older Bun builds).
export function isAddressInUseError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "EADDRINUSE") return true;
  return /EADDRINUSE|port \d+ (is |already )?in use|in use\?/i.test(String(error));
}

export function serveOnAvailablePort(args: {
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
      if (isAddressInUseError(error)) continue;
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
  return assertRegisteredProject(resolveWebProjectRoot(project, context.home), context);
}

function projectRootFromBody(body: Record<string, unknown>, context: WebContext): string {
  const project = optionalStringBodyField(body, "projectRoot") ?? context.currentProjectRoot;
  if (!project) throw new WebHttpError(400, "projectRoot is required.");
  return assertRegisteredProject(resolveWebProjectRoot(project, context.home), context);
}

// M30: resolveWebProjectRoot() will happily resolve any initialized project on
// disk, so a token-bearing caller could read/mutate a project that was never
// opened in this session just by passing its path in `?project=`. Constrain
// data routes to the session's project set: the launch project plus anything
// explicitly added through POST /api/projects (which is what the UI ever sends).
function assertRegisteredProject(root: string, context: WebContext): string {
  if (root === context.currentProjectRoot) return root;
  const registry = loadWebProjectRegistry(context.home);
  if (registry.projects.some((project) => project.root === root)) return root;
  throw new WebHttpError(
    403,
    `Project ${root} is not open in this codetrap web session. Add it from the project switcher first.`
  );
}

function learningLibraryPayload(
  projects: WebProject[],
  selectedProjectRoot: string,
  scope: "project" | "all",
  home?: string
) {
  const insights: Record<string, unknown>[] = [];
  const collections: Record<string, unknown>[] = [];
  const collectionItems: Record<string, unknown>[] = [];
  for (const project of projects) {
    const library = new Phase2Store(project.root).learningLibrary();
    const impact = learningImpactOperations(project.root, home);
    for (const insight of library.insights) {
      insights.push(decorateLearningInsight(insight, project.root, project.name, impact.state(insight)));
    }
    for (const collection of library.collections) {
      collections.push({
        ...collection,
        library_key: learningKey(project.root, collection.id),
        origin_project_root: project.root,
        origin_project_name: project.name,
      });
    }
    for (const item of library.collection_items) {
      collectionItems.push({
        ...item,
        collection_key: learningKey(project.root, item.collection_id),
        insight_key: learningKey(project.root, item.insight_id),
        origin_project_root: project.root,
      });
    }
  }
  return {
    project_root: selectedProjectRoot,
    scope,
    insights,
    collections,
    collection_items: collectionItems,
  };
}

function decorateLearningInsight(
  insight: InsightRecord,
  projectRoot: string,
  projectName: string,
  impact: LearningImpactState
) {
  const learned = impact.progress.status === "learned";
  return {
    ...insight,
    // Preserve the Web response shape while personal progress moves out of the
    // shared Insight record.
    consulted_count: learned ? 1 : 0,
    last_consulted_at: learned ? impact.progress.updated_at : null,
    learning_impact: impact,
    library_key: learningKey(projectRoot, insight.id),
    origin_project_root: projectRoot,
    origin_project_name: projectName,
  };
}

function learningKey(projectRoot: string, id: string): string {
  return `${projectRoot}::${id}`;
}

function learningProjectName(projectRoot: string, context: WebContext): string {
  return loadWebProjectRegistry(context.home).projects.find((project) => project.root === projectRoot)?.name
    ?? projectRoot;
}

function learningScopeQuery(url: URL): "project" | "all" {
  const scope = optionalQuery(url, "scope") ?? "project";
  if (scope === "project" || scope === "all") return scope;
  throw new WebHttpError(400, "scope must be project or all.");
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

function optionalNumberQuery(url: URL, key: string, min = 1): number | undefined {
  const value = optionalQuery(url, key);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  // L19: offset legitimately starts at 0; only limit needs to be positive.
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new WebHttpError(400, `${key} must be an integer >= ${min}.`);
  }
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

function stringArrayBodyField(body: Record<string, unknown>, key: string): string[] {
  const value = optionalStringArrayBodyField(body, key);
  if (!value) throw new WebHttpError(400, `${key} is required.`);
  return value;
}

function optionalStringArrayBodyField(body: Record<string, unknown>, key: string): string[] | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new WebHttpError(400, `${key} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
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
  if (provider === "huggingface") {
    let model;
    try {
      model = resolveLocalEmbeddingModel(
        optionalStringBodyField(body, "model") ?? DEFAULT_LOCAL_EMBEDDING_MODEL_ID
      );
    } catch (error) {
      throw new WebHttpError(400, error instanceof Error ? error.message : String(error));
    }
    return {
      provider,
      model: model.id,
    };
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
  if (value === "local") return "huggingface";
  if (value === "huggingface" || value === "ollama" || value === "jina") return value;
  throw new WebHttpError(400, `${key} must be huggingface, ollama, or jina.`);
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
