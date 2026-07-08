import { describe, expect, test } from "bun:test";
import { webClientScript } from "../web/client-script";
import { WEB_REVIEW_CLIENT_SCRIPT } from "../web/client-review";
import { WEB_INDEX_HTML } from "../web/static";

/**
 * A5 regression guard. The web console ships its browser script as TypeScript
 * template strings, and `WEB_REVIEW_CLIENT_SCRIPT` is assembled by serializing
 * real functions with `Function.prototype.toString()`. That silently depends on
 * Bun (including `bun build --compile`) preserving function source. If a build
 * step ever mangles or strips a body, the assembled inline script becomes
 * invalid JavaScript and the entire UI breaks at runtime with no compile error.
 *
 * `new Function(source)` compiles the source as a function body without executing
 * it, so it fails loudly on a syntax regression while tolerating the browser
 * globals (document, window, location) that are absent under the test runtime.
 */
describe("web client script", () => {
  test("the assembled inline script is syntactically valid JavaScript", () => {
    const script = webClientScript();
    expect(script.length).toBeGreaterThan(1000);
    expect(() => new Function(script)).not.toThrow();
  });

  test("the toString()-serialized review block parses and retains its functions", () => {
    // Guards the fragile serialization path specifically: if `toString()` ever
    // returned "[native code]" or an empty/mangled body, this block would either
    // fail to parse or drop a named helper.
    expect(WEB_REVIEW_CLIENT_SCRIPT.length).toBeGreaterThan(200);
    expect(WEB_REVIEW_CLIENT_SCRIPT).not.toContain("[native code]");
    for (const name of [
      "reviewCandidateMutationPayload",
      "reviewCandidateTrapDraft",
      "sortedReviewCandidates",
    ]) {
      expect(WEB_REVIEW_CLIENT_SCRIPT).toContain(`function ${name}`);
    }
    // The block is spliced into an async IIFE in the real page; wrap it the same
    // way so a stray top-level statement can't produce a false positive here.
    expect(() => new Function(`(async () => {\n${WEB_REVIEW_CLIENT_SCRIPT}\n})`)).not.toThrow();
  });

  test("the served HTML embeds the assembled script verbatim", () => {
    const script = webClientScript();
    expect(WEB_INDEX_HTML).toContain(script);
  });
});
