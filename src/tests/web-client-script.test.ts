import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { webClientScript } from "../web/client-script";
import { WEB_INDEX_HTML } from "../web/static";

describe("browser build delivery", () => {
  test("the delivered browser artifact is valid self-contained JavaScript", () => {
    const script = webClientScript();
    expect(script.length).toBeGreaterThan(1000);
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toMatch(/<\/script/i);
    expect(script).not.toContain("[native code]");
  });

  test("source Web embeds exactly the same artifact that the standalone imports", () => {
    const scripts = [...WEB_INDEX_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]![1]).toBe(webClientScript());
    expect(WEB_INDEX_HTML).not.toMatch(/<script\s+src=/);
  });

  test("the checked-in artifact matches current browser inputs and its own content hash", async () => {
    const child = Bun.spawn([process.execPath, "run", "scripts/build-web.ts", "--check"], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)), stdout: "pipe", stderr: "pipe",
    });
    const error = await new Response(child.stderr).text();
    expect(await child.exited, error).toBe(0);
  });
});
