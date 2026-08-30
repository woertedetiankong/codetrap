import { describe, expect, test } from "bun:test";
import {
  collectionContextSourceRefs,
  normalizeCollectionContextSections,
  normalizeSourceCoverage,
  normalizeSourceUnitRefs,
  sourceCoverageSummary,
} from "../domain/source-coverage";

const fingerprint = `sha256:${"c".repeat(64)}`;

describe("source coverage accounting", () => {
  test("derives completeness from covered source-unit refs instead of trusting a writable flag", () => {
    const manifest = normalizeSourceCoverage({
      version: 1,
      mode: "full_source",
      source_fingerprint: fingerprint,
      units: [
        { id: "intro", title: "Introduction", disposition: "learn" },
        { id: "details", title: "Details", disposition: "learn" },
      ],
    })!;

    expect(sourceCoverageSummary(manifest, ["intro"])).toEqual({
      status: "incomplete",
      mode: "full_source",
      total_units: 2,
      learn_units: 2,
      covered_units: 1,
      skipped_units: 0,
      unresolved_units: [{ id: "details", title: "Details" }],
    });
    expect(sourceCoverageSummary(manifest, ["intro", "details"]).status).toBe("complete");
  });

  test("distinguishes intentional curation, sampled evidence, and legacy unknown coverage", () => {
    const curated = normalizeSourceCoverage({
      mode: "full_source",
      source_fingerprint: fingerprint,
      units: [
        { id: "lesson", title: "Lesson", disposition: "learn" },
        { id: "navigation", title: "Navigation", disposition: "skip", reason: "Page chrome, not learning content." },
      ],
    })!;
    const sampled = normalizeSourceCoverage({
      mode: "sampled",
      source_fingerprint: fingerprint,
      units: [{ id: "turn-1", title: "Captured turn", disposition: "learn" }],
    })!;

    expect(sourceCoverageSummary(curated, ["lesson"])).toMatchObject({ status: "curated_subset", skipped_units: 1 });
    expect(sourceCoverageSummary(sampled, ["turn-1"]).status).toBe("sampled");
    expect(sourceCoverageSummary(undefined, [])).toMatchObject({ status: "unknown", mode: null });
  });

  test("rejects unverifiable manifests and refs to skipped or unknown units", () => {
    expect(() => normalizeSourceCoverage({
      mode: "full_source",
      source_fingerprint: "not-a-hash",
      units: [{ id: "x", title: "X", disposition: "learn" }],
    })).toThrow("sha256:<64 hex characters>");
    expect(() => normalizeSourceCoverage({
      mode: "full_source",
      source_fingerprint: fingerprint,
      units: [{ id: "x", title: "X", disposition: "skip" }],
    })).toThrow("reason is required");

    const manifest = normalizeSourceCoverage({
      mode: "full_source",
      source_fingerprint: fingerprint,
      units: [
        { id: "learn", title: "Learn", disposition: "learn" },
        { id: "skip", title: "Skip", disposition: "skip", reason: "Out of scope." },
      ],
    })!;
    expect(() => normalizeSourceUnitRefs(["skip"], manifest)).toThrow("cannot reference skipped");
    expect(() => normalizeSourceUnitRefs(["missing"], manifest)).toThrow("unknown source unit");
  });

  test("preserves source-backed collection context as a coverage destination", () => {
    const manifest = normalizeSourceCoverage({
      mode: "full_source",
      source_fingerprint: fingerprint,
      units: [
        { id: "method", title: "Method", disposition: "learn" },
        { id: "company-background", title: "Company background", disposition: "learn" },
      ],
    })!;
    const sections = normalizeCollectionContextSections([{
      id: "source-background",
      title: "Source background",
      body: "Dated company and case context.",
      source_unit_refs: ["company-background"],
    }], manifest);

    expect(collectionContextSourceRefs(sections)).toEqual(["company-background"]);
    expect(sourceCoverageSummary(manifest, ["method", ...collectionContextSourceRefs(sections)]).status)
      .toBe("complete");
    expect(() => normalizeCollectionContextSections([{
      id: "bad",
      title: "Bad",
      body: "Cannot point at missing units.",
      source_unit_refs: ["missing"],
    }], manifest)).toThrow("unknown source unit");
  });
});
