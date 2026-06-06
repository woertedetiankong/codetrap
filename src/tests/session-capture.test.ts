import { describe, expect, test } from "bun:test";
import type { SessionMetadata, SessionNote } from "../domain/session";
import { SESSION_VERSION } from "../domain/session";
import {
  capturedCandidateDraft,
  capturedTrapMarkdownInput,
  capturedTrapInput,
  captureGoal,
  proposeCandidateTraps,
} from "../lib/session-capture";

describe("session capture draft", () => {
  test("normalizes captured trap json with strict enum validation", () => {
    const trap = capturedTrapInput({
      title: "Keep captured lessons visible in the candidate inbox",
      context: "When capturing a post-flight lesson after a failed implementation.",
      mistake: "Writing directly to the trap database skips candidate review.",
      fix: "Write a session candidate and require explicit accept or reject review.",
      tags: "session,capture",
      path_globs: ["src/lib/session-*.ts"],
      module: "",
      owner: "",
    });

    expect(trap).toMatchObject({
      title: "Keep captured lessons visible in the candidate inbox",
      category: "other",
      scope: "project",
      severity: "warning",
      tags: ["session", "capture"],
      path_globs: ["src/lib/session-*.ts"],
      module: null,
      owner: null,
    });
    expect(() => capturedTrapInput({ ...trap, scope: "workspace" })).toThrow("Invalid trap scope");
  });

  test("builds capture evidence from the session and note kind", () => {
    const session = sessionMetadata();
    const trap = capturedTrapInput(trapJson());
    const draft = capturedCandidateDraft(session, {
      trap,
      kind: "test_failure",
      relatedFiles: ["src/lib/session-store.ts", "src/lib/session-store.ts", ""],
    });

    expect(draft.evidence).toEqual([{
      source_type: "test_failure",
      source_ref: `session:${session.id}`,
      related_files: ["src/lib/session-store.ts"],
      note: "Captured through session capture (test_failure).",
    }]);
  });

  test("parses markdown trap drafts with multiline fields, lists, and fenced code", () => {
    const parsed = capturedTrapMarkdownInput([
      "Title: Preserve parser examples in trap drafts",
      "Category: bug",
      "Scope: project",
      "Context:",
      "When turning a parser regression into a candidate trap.",
      "",
      "Mistake:",
      "Saving only the failing assertion hides the reusable parsing rule.",
      "Fix:",
      "Keep the explicit parser rule and before/after examples in the candidate.",
      "Severity: error",
      "Tags:",
      "- parser",
      "- capture",
      "Path globs:",
      "- src/parser/**",
      "- src/tests/parser-*.test.ts",
      "Related files:",
      "- src/parser/tokenizer.ts",
      "- src/tests/parser-regression.test.ts",
      "Module:",
      "Owner:",
      "Before code:",
      "```ts",
      "input.split(/,\\s*/)",
      "```",
      "After code:",
      "```ts",
      "tokenize(input)",
      "```",
      "Evidence:",
      "A review found that the original failure output did not explain the reusable rule.",
    ].join("\n"));

    expect(parsed.trap).toMatchObject({
      title: "Preserve parser examples in trap drafts",
      category: "bug",
      scope: "project",
      context: "When turning a parser regression into a candidate trap.",
      mistake: "Saving only the failing assertion hides the reusable parsing rule.",
      fix: "Keep the explicit parser rule and before/after examples in the candidate.",
      severity: "error",
      tags: ["parser", "capture"],
      path_globs: ["src/parser/**", "src/tests/parser-*.test.ts"],
      module: null,
      owner: null,
      before_code: "input.split(/,\\s*/)",
      after_code: "tokenize(input)",
    });
    expect(parsed.relatedFiles).toEqual(["src/parser/tokenizer.ts", "src/tests/parser-regression.test.ts"]);
    expect(parsed.evidenceNote).toContain("original failure output");
  });

  test("requires explicit markdown trap fields and keeps enum validation strict", () => {
    expect(() => capturedTrapMarkdownInput([
      "Title: Missing fix",
      "Context: When parsing Markdown trap drafts.",
      "Mistake: Accepting incomplete candidates.",
    ].join("\n"))).toThrow("trap fix is required");

    expect(() => capturedTrapMarkdownInput([
      "Title: Invalid severity",
      "Context: When parsing Markdown trap drafts.",
      "Mistake: Accepting unsupported severity labels.",
      "Fix: Reject invalid enum values before writing candidates.",
      "Severity: fatal",
    ].join("\n"))).toThrow("Invalid trap severity");
  });

  test("keeps explicit session note extraction lenient while sharing defaults", () => {
    const candidates = proposeCandidateTraps(sessionMetadata(), [sessionNote([
      "Title: Keep explicit candidate notes reviewable",
      "Category: unsupported",
      "Scope: workspace",
      "Context: When closing a session with structured note fields.",
      "Mistake: Failing strict enum validation would drop otherwise useful notes.",
      "Fix: Default unsupported note enums while preserving the candidate draft.",
      "Severity: fatal",
      "Tags: session,capture",
    ].join("\n"))]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].trap).toMatchObject({
      category: "other",
      scope: "project",
      severity: "warning",
      tags: ["session", "capture"],
      module: "session",
      owner: "codetrap",
    });
  });

  test("derives post-flight capture goals from the trap title", () => {
    expect(captureGoal(undefined, "Remember this pitfall")).toBe("capture: Remember this pitfall");
    expect(captureGoal("  explicit goal  ", "Remember this pitfall")).toBe("explicit goal");
  });
});

function trapJson(): Record<string, unknown> {
  return {
    title: "Keep captured lessons visible in the candidate inbox",
    context: "When capturing a post-flight lesson after a failed implementation.",
    mistake: "Writing directly to the trap database skips candidate review.",
    fix: "Write a session candidate and require explicit accept or reject review.",
  };
}

function sessionMetadata(): SessionMetadata {
  return {
    version: SESSION_VERSION,
    id: "20260603-test-session",
    goal: "test session capture",
    status: "active",
    created_at: "2026-06-03T00:00:00.000Z",
    updated_at: "2026-06-03T00:00:00.000Z",
    closed_at: null,
    scope: "project",
    project_path: "/tmp/codetrap",
    module: "session",
    owner: "codetrap",
    spec_ref: null,
    notes_path: "implementation-notes.md",
    recap_path: "recap.md",
    candidate_traps_path: "candidate-traps.json",
  };
}

function sessionNote(text: string): SessionNote {
  return {
    created_at: "2026-06-03T00:00:00.000Z",
    kind: "review",
    text,
    related_files: ["src/lib/session-capture.ts"],
    source_ref: null,
  };
}
