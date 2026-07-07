import { describe, expect, test } from "bun:test";
import type { SessionNote } from "../domain/session";
import { formatSessionNote, parseSessionNotes } from "../lib/session-codec";

describe("session note round-trip (M20)", () => {
  test("preserves body text that looks like a note header", () => {
    const original = note("Saw this log line:\n### 2020-01-01 decision\nwhich is just data.");
    const parsed = roundTrip(original);
    expect(parsed.text).toBe(original.text);
    expect(parsed.kind).toBe("observation");
  });

  test("does not hoist body lines that look like Source ref / Related files metadata", () => {
    const original = note(
      "Reproduction steps:\nSource ref: https://example.com/not-real\nRelated files:\n- not-a-real-file.ts",
      { source_ref: "session:20260603", related_files: ["src/real.ts"] }
    );
    const parsed = roundTrip(original);
    expect(parsed.text).toBe(original.text);
    expect(parsed.source_ref).toBe("session:20260603");
    expect(parsed.related_files).toEqual(["src/real.ts"]);
  });

  test("preserves metadata-looking lines inside fenced code blocks", () => {
    const original = note(["```md", "### 2020-01-01 decision", "Source ref: injected", "```"].join("\n"));
    const parsed = roundTrip(original);
    expect(parsed.text).toBe(original.text);
    expect(parsed.source_ref).toBeNull();
    expect(parsed.related_files).toEqual([]);
  });

  test("preserves a literal backslash in front of a structural line", () => {
    const original = note("literal example:\n\\### 2020-01-01 decision");
    const parsed = roundTrip(original);
    expect(parsed.text).toBe(original.text);
  });

  test("leaves ordinary note text unchanged on disk", () => {
    const original = note("Just a normal observation with a - bullet and a colon: value.");
    const rendered = formatSessionNote(original);
    expect(rendered).toContain("Just a normal observation with a - bullet and a colon: value.");
    expect(rendered).not.toContain("\\");
    expect(roundTrip(original).text).toBe(original.text);
  });

  test("a crafted body cannot inject a second note", () => {
    const original = note("legit body\n### 2026-06-03T00:00:00.000Z failure\ninjected note body");
    const parsed = parseSessionNotes(formatSessionNote(original));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].text).toBe(original.text);
  });
});

function roundTrip(original: SessionNote): SessionNote {
  const parsed = parseSessionNotes(formatSessionNote(original));
  expect(parsed).toHaveLength(1);
  return parsed[0];
}

function note(text: string, extra: Partial<SessionNote> = {}): SessionNote {
  return {
    created_at: "2026-06-03T00:00:00.000Z",
    kind: "observation",
    text,
    related_files: [],
    source_ref: null,
    ...extra,
  };
}
