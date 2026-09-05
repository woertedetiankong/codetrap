import { describe, expect, test } from "bun:test";
import { ApiError, createApiClient, parseBootstrapPayload, readBrowserBoot, translate } from "../web/browser/platform";

function session(search = "", hash = "#/impact/evals", denied = false) {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const browser = {
    location: { pathname: "/", search, hash },
    history: { replaceState: (_data: unknown, _unused: string, url: string) => { browser.location.search = new URL(url, "http://localhost").search; } },
    get sessionStorage() { if (denied) throw new Error("Storage denied"); return storage; },
    get localStorage() { if (denied) throw new Error("Storage denied"); return storage; },
  };
  return { values, browser: browser as unknown as Window };
}
const t = (key: string) => translate("zh", key);

describe("typed browser platform", () => {
  test("launch token wins over old tab storage, leaves the URL and survives refresh without changing the route", () => {
    const { values, browser } = session("?token=fresh&display=full", "#/library/global/7");
    values.set("codetrap-token", "expired");
    values.set("codetrap-locale", "zh");
    values.set("codetrap-queue-collapsed", "false");
    const first = readBrowserBoot(browser);
    expect(first).toMatchObject({ token: "fresh", initialLocale: "zh", savedQueueCollapsed: false, initialRoute: { mainView: "library", trapScope: "global", trapId: 7 } });
    expect(browser.location.search).toBe("?display=full");
    expect(values.get("codetrap-token")).toBe("fresh");
    expect(readBrowserBoot(browser)).toEqual(first);
  });

  test("denied browser storage still permits an explicitly launched tab and strips the credential", () => {
    const { browser } = session("?token=one-tab", "#/impact/evals", true);
    expect(readBrowserBoot(browser)).toMatchObject({ token: "one-tab", initialLocale: "en", savedSidebarCollapsed: false, savedQueueCollapsed: true });
    expect(browser.location.search).toBe("");
    expect(readBrowserBoot(browser).token).toBe("");
  });

  test("API transport preserves Headers and the exact reviewed body while binding the launch credential", async () => {
    let observed: RequestInit | undefined;
    const api = createApiClient("launch", t, (async (_path, init) => { observed = init; return Response.json({ receipt: "commit-1" }); }));
    const body = JSON.stringify({ projectRoot: "/project", executor: "user", digest: "reviewed" });
    expect(await api<{ receipt: string }>("/api/eval-suite/case-accept", { method: "POST", body, headers: new Headers({ "X-Review": "abc", "X-Codetrap-Token": "wrong" }) })).toEqual({ receipt: "commit-1" });
    const headers = new Headers(observed?.headers);
    expect(headers.get("X-Codetrap-Token")).toBe("launch");
    expect(headers.get("X-Review")).toBe("abc");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(observed?.body).toBe(body);
    await expect(api("https://example.invalid/api/private")).rejects.toThrow("local API path");
  });

  test("a non-JSON unauthorized response keeps its 401 identity and localized recovery message", async () => {
    const api = createApiClient("old", t, (async () => new Response("<html>expired</html>", { status: 401 })));
    try { await api("/api/bootstrap"); throw new Error("Expected rejection"); }
    catch (error) { expect(error).toBeInstanceOf(ApiError); expect(error).toMatchObject({ status: 401, payload: null, message: t("error.sessionExpired") }); }
  });

  test("conflict details survive transport and malformed success JSON becomes an actionable error", async () => {
    const payload = { error: "stale", blockers: ["changed-digest"] };
    const conflict = createApiClient("token", t, (async () => Response.json(payload, { status: 409 })));
    await expect(conflict("/api/eval-suite/create")).rejects.toMatchObject({ status: 409, payload, message: "stale" });
    const broken = createApiClient("token", t, (async () => new Response("invalid", { status: 200 })));
    await expect(broken("/api/bootstrap")).rejects.toMatchObject({ status: 200, message: t("error.invalidResponse") });
  });

  test("bootstrap rejects partial contracts before installing project state and preserves extra server metadata", () => {
    const payload = { projects: [{ root: "/p", name: "P", route_ref: "p-" + "a".repeat(24), last_opened_at: "2026-09-04" }], current_project_root: "/p", options: { categories: ["general"], severities: ["warning"], scopes: ["project", "global"], stale_after_days: 180 } };
    expect(parseBootstrapPayload(payload)).toEqual(payload);
    for (const invalid of [null, [], {}, { ...payload, projects: [{}] }, { ...payload, options: { ...payload.options, scopes: [1] } }, { ...payload, current_project_root: 42 }]) expect(() => parseBootstrapPayload(invalid)).toThrow("bootstrap response");
  });
});
