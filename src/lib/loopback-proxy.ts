/**
 * Keeps loopback traffic off the user's HTTP proxy.
 *
 * A local model server lives on `127.0.0.1`, and codetrap's default Ollama
 * endpoint is `http://127.0.0.1:11434`. Many developer machines also export
 * `http_proxy` — corporate setups, and local proxies like Clash/mihomo. Those
 * users conventionally exclude loopback with `no_proxy=127.*,localhost`, but
 * that glob form is not understood by every client: Bun's `fetch` matches
 * `localhost` and the exact string `127.0.0.1`, and ignores `127.*`.
 *
 * The result is that a request to a model server on the same machine is sent
 * to the proxy, which refuses it — surfacing as a bare `403` with no body and
 * no hint that a proxy was ever involved.
 *
 * Rather than depend on the user's `no_proxy` syntax, codetrap adds the exact
 * loopback host of any endpoint it is about to call. It never removes entries
 * and never adds a non-loopback host, so it cannot widen what bypasses a proxy
 * beyond the machine itself.
 */

const LOOPBACK_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1", "[::1]"]);

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (LOOPBACK_HOSTNAMES.has(host) || LOOPBACK_HOSTNAMES.has(`[${host}]`)) return true;
  // The whole 127.0.0.0/8 block is loopback, not just 127.0.0.1.
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

export function hostnameOf(endpoint: string): string | null {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return null;
  }
}

/** The `no_proxy` value that additionally excludes `hostname`, or null if already covered. */
export function noProxyWith(current: string | undefined, hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return null;
  const entries = (current ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  // `*` disables proxying entirely; an exact match already covers us. Glob
  // forms like `127.*` are deliberately NOT treated as covering, because the
  // clients that ignore them are the reason this exists.
  if (entries.includes("*") || entries.includes(host)) return null;
  return [...entries, host].join(",");
}

/**
 * Ensures the endpoint's loopback host bypasses the proxy for this process.
 * A no-op for non-loopback endpoints and when no proxy is configured.
 */
export function allowLoopbackDirect(endpoint: string, env: Record<string, string | undefined> = process.env): void {
  const proxyConfigured = Boolean(env.http_proxy || env.HTTP_PROXY || env.https_proxy || env.HTTPS_PROXY);
  if (!proxyConfigured) return;

  const hostname = hostnameOf(endpoint);
  if (!hostname || !isLoopbackHost(hostname)) return;

  for (const key of ["no_proxy", "NO_PROXY"] as const) {
    const updated = noProxyWith(env[key], hostname);
    if (updated !== null) env[key] = updated;
  }
}
