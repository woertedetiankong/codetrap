import { describe, expect, test } from "bun:test";
import {
  bunMissingWarning,
  isBunInstalled,
  warnIfBunMissing,
} from "../../scripts/postinstall.mjs";

describe("postinstall Bun-missing warning (C9b)", () => {
  test("stays silent when Bun is installed", () => {
    const messages: string[] = [];
    const warned = warnIfBunMissing({ installed: true, warn: (m) => messages.push(m) });
    expect(warned).toBe(false);
    expect(messages).toEqual([]);
  });

  test("warns with install + binary-download guidance when Bun is missing", () => {
    const messages: string[] = [];
    const warned = warnIfBunMissing({ installed: false, warn: (m) => messages.push(m) });
    expect(warned).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("Bun runtime");
    expect(messages[0]).toContain("bun.sh/install");
    expect(messages[0]).toContain("github.com/woertedetiankong/codetrap/releases");
  });

  test("detects Bun presence from the spawn result", () => {
    const present = isBunInstalled(() => ({ error: undefined, status: 0 }));
    expect(present).toBe(true);

    const missing = isBunInstalled(() => ({ error: new Error("spawn bun ENOENT"), status: null }));
    expect(missing).toBe(false);

    const nonZero = isBunInstalled(() => ({ error: undefined, status: 127 }));
    expect(nonZero).toBe(false);
  });

  test("warning text is stable and non-empty", () => {
    expect(bunMissingWarning().trim().length).toBeGreaterThan(0);
  });
});
