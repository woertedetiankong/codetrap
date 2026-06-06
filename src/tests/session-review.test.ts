import { describe, expect, test } from "bun:test";
import {
  sessionCliConflictPayload,
  sessionConflictPayload,
  sessionConflictText,
} from "../lib/session-review";

describe("session review contract", () => {
  test("keeps conflict payload neutral and renders CLI next actions separately", () => {
    const payload = sessionConflictPayload({
      session_id: "session-1",
      candidate_id: "cand-001",
      possible_conflicts: [
        {
          trap_id: 7,
          scope: "project",
          title: "Use stable API client",
          context: "When changing API calls.",
          reason: "same module",
          fix: "Use apiClient.fetch.",
        },
      ],
    });

    expect(payload).toMatchObject({
      success: false,
      error: "Possible active trap conflict found.",
      session_id: "session-1",
      candidate_id: "cand-001",
    });
    expect(payload).not.toHaveProperty("next_actions");
    expect(sessionConflictText(payload)).toContain("#7 Use stable API client");

    expect(sessionCliConflictPayload(payload).next_actions).toEqual([
      "codetrap session accept cand-001 --session session-1 --accept-anyway",
      "codetrap session accept cand-001 --session session-1 --supersedes <trap-id>",
      "codetrap session reject cand-001 --session session-1 --reason <reason>",
    ]);
  });
});
