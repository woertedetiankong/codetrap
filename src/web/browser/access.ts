import { ApiError, createApiClient, parseBootstrapPayload, showBootstrapFailure, type BootstrapPayload, type Translate } from "./platform";
import type { WebLocale } from "../client-text";

/** Read a credential locally. Never navigate to, or fetch, a pasted address. */
export function launchCredential(value: string, origin: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("auth.badLink"); }
  if (url.origin !== origin || url.username || url.password) throw new Error("auth.wrongServer");
  const tokens = url.searchParams.getAll("token");
  if (!["/", "/index.html"].includes(url.pathname) || tokens.length !== 1 || !tokens[0] || /[\s\x00-\x1f\x7f]/.test(tokens[0])) throw new Error("auth.badLink");
  return tokens[0];
}

export function createAccessRecovery(deps: {
  token: string; t: Translate; locale(): WebLocale; ready(): boolean;
  connected(data: BootstrapPayload): Promise<void>;
}) {
  let token = deps.token, retryToken = token, epoch = 0, blocked = false, busy = false, failure: unknown;
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const client = createApiClient(() => token, deps.t);
  const input = el<HTMLInputElement>("bootstrap-link");
  function message(value = "") { const node = el("bootstrap-connect-error"); if (node) node.textContent = value; }
  function controls() {
    for (const id of ["bootstrap-connect", "bootstrap-retry"]) { const button = el<HTMLButtonElement>(id); if (button) button.disabled = busy; }
    if (input) input.disabled = busy;
  }
  function show(error: unknown, hasToken = Boolean(token)) {
    failure = error;
    const first = !blocked; blocked = true;
    showBootstrapFailure(document, deps.locale(), deps.t, error, { hasToken, retained: deps.ready(), port: location.port });
    // A modal dialog otherwise remains above the recovery panel. Closing it does
    // not submit its form or discard the underlying candidate draft.
    document.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach(dialog => dialog.close());
    if (first) { message(); (error instanceof ApiError && error.status === 401 ? input : el("bootstrap-retry"))?.focus(); }
    controls();
  }
  async function api<T = unknown>(path: string, options?: RequestInit): Promise<T> {
    if (blocked) throw failure;
    const sentEpoch = epoch;
    try { return await client<T>(path, options); }
    catch (error) {
      // An old request cannot reopen recovery after another credential succeeds.
      if (error instanceof ApiError && error.status === 401 && sentEpoch === epoch) show(error);
      throw error;
    }
  }
  async function reconnect(value?: string) {
    if (busy) return;
    let nextToken = retryToken;
    if (value !== undefined) {
      try { nextToken = launchCredential(value, location.origin); }
      catch (error) { message(deps.t(error instanceof Error ? error.message : "auth.badLink")); return; }
      if (input) input.value = "";
      retryToken = nextToken;
    }
    if (!nextToken) { show(new ApiError(deps.t("auth.missingCopy"), 401, null)); return; }
    busy = true; controls(); message(deps.t("auth.connecting"));
    try {
      // Validate before replacing this tab's credential. Recovery is a read, and
      // neither the pasted URL nor its route can redirect this tab or the request.
      const probe = createApiClient(nextToken, deps.t);
      const data = parseBootstrapPayload(await probe("/api/bootstrap", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) }));
      token = nextToken;
      epoch++;
      try { sessionStorage.setItem("codetrap-token", token); } catch { /* Current tab still works without storage. */ }
      blocked = false;
      await deps.connected(data);
      if (!blocked) { message(); el("bootstrap-failure")!.hidden = true; el("bootstrap-failure")!.classList.add("hidden"); }
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      show(timedOut ? new TypeError("Connection timed out") : error, Boolean(nextToken));
      message(deps.t(error instanceof ApiError && error.status === 401 ? "auth.rejected" : "auth.retryFailed"));
    } finally { busy = false; controls(); }
  }
  el("bootstrap-auth-form")?.addEventListener("submit", event => { event.preventDefault(); void reconnect(input?.value || ""); });
  el("bootstrap-retry")?.addEventListener("click", () => { void reconnect(); });
  return { api, show, reconnect, get blocked() { return blocked; } };
}
