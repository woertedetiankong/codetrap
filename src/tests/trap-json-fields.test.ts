import { describe, expect, test } from "bun:test";
import {
  encodeEvidenceRelatedFiles,
  encodeTrapTags,
  parseEvidenceRelatedFiles,
  parseOptionalEvidenceRelatedFiles,
  parseOptionalTrapTags,
  parseTrapTags,
} from "../lib/trap-json-fields";

describe("Trap JSON field codec", () => {
  test("parses canonical JSON arrays and array inputs", () => {
    expect(parseTrapTags('["api","fetch"]')).toEqual(["api", "fetch"]);
    expect(parseTrapTags(["api", "fetch"])).toEqual(["api", "fetch"]);
    expect(parseEvidenceRelatedFiles('["src/api.ts"]')).toEqual(["src/api.ts"]);
  });

  test("treats legacy raw strings as one-item arrays", () => {
    expect(parseTrapTags("legacy-tag")).toEqual(["legacy-tag"]);
    expect(parseEvidenceRelatedFiles("src/api.ts")).toEqual(["src/api.ts"]);
  });

  test("normalizes empty values for optional inputs", () => {
    expect(parseTrapTags(null)).toEqual([]);
    expect(parseOptionalTrapTags("")).toBeUndefined();
    expect(parseOptionalEvidenceRelatedFiles(undefined)).toBeUndefined();
  });

  test("encodes fields through the same parser rules", () => {
    expect(encodeTrapTags(["api", 42 as unknown as string])).toBe('["api","42"]');
    expect(encodeTrapTags("legacy-tag")).toBe('["legacy-tag"]');
    expect(encodeEvidenceRelatedFiles(null)).toBe("[]");
  });
});
