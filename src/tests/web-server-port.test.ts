import { describe, expect, test } from "bun:test";
import { isAddressInUseError, serveOnAvailablePort } from "../web/server";

describe("web server port fallback (M32)", () => {
  test("isAddressInUseError matches Bun's code and message, not unrelated errors", () => {
    expect(isAddressInUseError({ code: "EADDRINUSE" })).toBe(true);
    // Bun.serve's actual message carries no EADDRINUSE token — only the phrasing.
    expect(isAddressInUseError(new Error("Failed to start server. Is port 4737 in use?"))).toBe(true);
    expect(isAddressInUseError(new Error("some other startup failure"))).toBe(false);
    expect(isAddressInUseError(null)).toBe(false);
  });

  test("serveOnAvailablePort skips a port already bound instead of throwing", () => {
    const host = "127.0.0.1";
    const fetch = async () => new Response("ok");

    // Let the OS pick a free ephemeral port (port 0) for the first server, then
    // start the second at that exact port to force a real in-use collision. This
    // avoids depending on any fixed port number, which can be leftover-bound on
    // busy machines (the original test hardcoded 47380 and flaked there).
    const first = serveOnAvailablePort({ host, port: 0, fetch });
    try {
      // Starting at first.port forces an in-use collision; the old dead-code
      // check would rethrow here, so reaching the assertion proves the fallback.
      const second = serveOnAvailablePort({ host, port: first.port, fetch });
      try {
        expect(second.port).toBeGreaterThan(first.port);
      } finally {
        second.server.stop(true);
      }
    } finally {
      first.server.stop(true);
    }
  });
});
