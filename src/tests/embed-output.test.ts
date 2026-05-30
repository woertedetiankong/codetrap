import { describe, expect, test } from "bun:test";
import { formatEmbedText } from "../lib/embed-output";

describe("embed output", () => {
  test("suggests hybrid search after generating embeddings", () => {
    const text = formatEmbedText({
      generated: 2,
      skipped: 1,
      batches: 1,
      scopes: [{ scope: "project", generated: 2, skipped: 1, batches: 1 }],
    });

    expect(text).toContain("[project] embeddings generated: 2, skipped: 1, batches: 1");
    expect(text).toContain('Next: codetrap search "<query>" --mode hybrid');
  });

  test("suggests doctor when embeddings are already fresh", () => {
    const text = formatEmbedText({
      generated: 0,
      skipped: 3,
      batches: 0,
      scopes: [{ scope: "project", generated: 0, skipped: 3, batches: 0 }],
    });

    expect(text).toContain("Next: embeddings are already fresh; run codetrap doctor to verify hybrid search.");
  });

  test("explains the empty-store case", () => {
    const text = formatEmbedText({
      generated: 0,
      skipped: 0,
      batches: 0,
      scopes: [{ scope: "project", generated: 0, skipped: 0, batches: 0 }],
    });

    expect(text).toContain("Next: add traps first");
  });
});
