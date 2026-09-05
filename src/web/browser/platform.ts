import { parseWorkspaceRoute, type WorkspaceRoute } from "../client-route";
import { WEB_TEXT, type WebLocale } from "../client-text";

export type Translate = (key: string, params?: Record<string, unknown>) => string;
export interface BrowserBoot {
  token: string;
  initialLocale: WebLocale;
  savedSidebarCollapsed: boolean;
  savedQueueCollapsed: boolean;
  initialRoute: WorkspaceRoute;
}
type BrowserSession = Pick<Window, "location" | "history" | "sessionStorage" | "localStorage">;

function stored(storage: () => Storage, key: string): string | null {
  try { return storage().getItem(key); } catch { return null; }
}

export function browserLocale(browser: BrowserSession): WebLocale {
  return stored(() => browser.localStorage, "codetrap-locale") === "zh" ? "zh" : "en";
}

export function readBrowserBoot(browser: BrowserSession): BrowserBoot {
  const qs = new URLSearchParams(browser.location.search);
  const token = qs.get("token") || stored(() => browser.sessionStorage, "codetrap-token") || "";
  if (token) {
    try { browser.sessionStorage.setItem("codetrap-token", token); } catch { /* Keep this tab usable when storage is unavailable. */ }
  }
  if (qs.has("token")) {
    qs.delete("token");
    const query = qs.toString();
    browser.history.replaceState(null, "", browser.location.pathname + (query ? "?" + query : "") + browser.location.hash);
  }
  const queue = stored(() => browser.localStorage, "codetrap-queue-collapsed");
  return {
    token, initialLocale: browserLocale(browser),
    savedSidebarCollapsed: stored(() => browser.localStorage, "codetrap-sidebar-collapsed") === "true",
    savedQueueCollapsed: queue === null || queue === "true",
    initialRoute: parseWorkspaceRoute(browser.location.hash),
  };
}

export function translate(locale: WebLocale, key: string, params: Record<string, unknown> = {}): string {
  const dictionary: Readonly<Record<string, string>> = WEB_TEXT[locale];
  const fallback: Readonly<Record<string, string>> = WEB_TEXT.en;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll("{" + name + "}", String(replacement)), dictionary[key] ?? fallback[key] ?? key);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly payload: unknown) { super(message); this.name = "ApiError"; }
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export type BrowserFetch = (path: string, options?: RequestInit) => Promise<Response>;
export function createApiClient(token: string, t: Translate, request: BrowserFetch = fetch) {
  return async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    if (!path.startsWith("/api/")) throw new Error("Expected a local API path.");
    const headers = new Headers(options.headers);
    headers.set("X-Codetrap-Token", token);
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await request(path, { ...options, headers });
    const text = await response.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; }
    catch {
      if (response.ok) throw new ApiError(t("error.invalidResponse"), response.status, null);
    }
    if (!response.ok) {
      throw new ApiError(response.status === 401 ? t("error.sessionExpired")
        : record(data) && typeof data.error === "string" ? data.error : response.statusText || t("error.invalidResponse"), response.status, data);
    }
    return data as T;
  };
}

export interface BootstrapPayload {
  projects: Array<{ root: string; name: string; route_ref: string }>;
  current_project_root: string | null;
  options: { categories: string[]; severities: string[]; scopes: string[]; stale_after_days: number };
}

export function parseBootstrapPayload(value: unknown): BootstrapPayload {
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === "string");
  if (!record(value) || !Array.isArray(value.projects) || !value.projects.every(p => record(p) && typeof p.root === "string" && typeof p.name === "string" && typeof p.route_ref === "string")
    || value.current_project_root !== null && typeof value.current_project_root !== "string"
    || !record(value.options) || !strings(value.options.categories) || !strings(value.options.severities) || !strings(value.options.scopes)
    || typeof value.options.stale_after_days !== "number" || !Number.isFinite(value.options.stale_after_days)) {
    throw new Error("Invalid workspace bootstrap response.");
  }
  return value as unknown as BootstrapPayload;
}

export function showBootstrapFailure(doc: Document, locale: WebLocale, t: Translate, error: unknown): void {
  doc.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  doc.title = "codetrap · " + t("auth.title");
  doc.getElementById("app-shell")?.remove();
  const status = doc.getElementById("status");
  if (status) status.className = "status";
  const labels = {
    "bootstrap-failure-kicker": t("auth.kicker"), "bootstrap-failure-title": t("auth.title"),
    "bootstrap-failure-copy": error instanceof ApiError && error.status === 401 ? t("error.sessionExpired") : t("auth.copy"),
    "bootstrap-command-label": t("auth.commandLabel"), "bootstrap-command": "codetrap web --open",
    "bootstrap-privacy": t("auth.privacy"), "bootstrap-retry": t("auth.retry"),
  };
  for (const [id, text] of Object.entries(labels)) { const node = doc.getElementById(id); if (node) node.textContent = text; }
  const panel = doc.getElementById("bootstrap-failure");
  if (panel) { panel.classList.remove("hidden"); panel.hidden = false; }
}
