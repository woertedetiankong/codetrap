import { describe, expect, test } from "bun:test";
import { allowLoopbackDirect, hostnameOf, isLoopbackHost, noProxyWith } from "../lib/loopback-proxy";

describe("loopback proxy bypass", () => {
  test("recognizes the whole loopback block, not just 127.0.0.1", () => {
    for (const host of ["localhost", "LOCALHOST", "127.0.0.1", "127.1.2.3", "127.255.255.254", "0.0.0.0", "::1", "[::1]"]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
    for (const host of ["example.com", "10.0.0.1", "192.168.1.5", "1.2.3.4", "ollama.internal"]) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });

  test("adds the exact host, because glob forms are what clients ignore", () => {
    // The real-world value that caused this bug: Bun matches `localhost` and
    // the exact string, but not the `127.*` glob.
    expect(noProxyWith("127.*,localhost", "127.0.0.1")).toBe("127.*,localhost,127.0.0.1");
    expect(noProxyWith(undefined, "127.0.0.1")).toBe("127.0.0.1");
    expect(noProxyWith("", "localhost")).toBe("localhost");
  });

  test("does not duplicate an entry that already covers the host", () => {
    expect(noProxyWith("127.0.0.1,localhost", "127.0.0.1")).toBeNull();
    expect(noProxyWith("LOCALHOST", "localhost")).toBeNull();
    // `*` disables proxying entirely.
    expect(noProxyWith("*", "127.0.0.1")).toBeNull();
  });

  test("extracts a hostname and tolerates junk", () => {
    expect(hostnameOf("http://127.0.0.1:11434")).toBe("127.0.0.1");
    expect(hostnameOf("http://[::1]:11434")).toBe("[::1]");
    expect(hostnameOf("not a url")).toBeNull();
  });

  test("excludes a loopback endpoint when a proxy is configured", () => {
    const env: Record<string, string | undefined> = {
      http_proxy: "http://127.0.0.1:7897",
      no_proxy: "127.*,localhost",
      NO_PROXY: "127.*,localhost",
    };
    allowLoopbackDirect("http://127.0.0.1:11434", env);
    expect(env.no_proxy).toContain("127.0.0.1");
    expect(env.NO_PROXY).toContain("127.0.0.1");
  });

  test("does nothing when no proxy is configured", () => {
    const env: Record<string, string | undefined> = { no_proxy: "127.*" };
    allowLoopbackDirect("http://127.0.0.1:11434", env);
    expect(env.no_proxy).toBe("127.*");
  });

  test("never widens the bypass to a remote host", () => {
    const env: Record<string, string | undefined> = {
      HTTP_PROXY: "http://proxy.internal:8080",
      no_proxy: "localhost",
      NO_PROXY: "localhost",
    };
    // A remote Ollama is exactly the case where the proxy SHOULD be used.
    allowLoopbackDirect("https://ollama.example.com", env);
    expect(env.no_proxy).toBe("localhost");
    expect(env.NO_PROXY).toBe("localhost");
  });

  test("a real loopback request survives a proxy that would refuse it", async () => {
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => Response.json({ ok: true }) });
    const saved = { no_proxy: process.env.no_proxy, NO_PROXY: process.env.NO_PROXY, http_proxy: process.env.http_proxy };
    try {
      // Reproduce the shape of the real failure: a proxy is set, and no_proxy
      // uses the glob form that Bun does not honor.
      process.env.http_proxy = "http://127.0.0.1:9";
      process.env.no_proxy = "127.*,localhost";
      process.env.NO_PROXY = "127.*,localhost";

      allowLoopbackDirect(`http://127.0.0.1:${server.port}`);
      // Bounded: without the fix this request goes to a dead proxy and hangs
      // rather than erroring, so an unbounded fetch would stall the suite
      // instead of reporting a regression.
      const response = await fetch(`http://127.0.0.1:${server.port}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
      });
      expect(response.status).toBe(200);
    } finally {
      process.env.no_proxy = saved.no_proxy;
      process.env.NO_PROXY = saved.NO_PROXY;
      process.env.http_proxy = saved.http_proxy;
      server.stop(true);
    }
  });
});
