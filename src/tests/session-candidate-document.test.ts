import { describe, expect, test } from "bun:test";
import {
  acceptCandidateInDocument,
  addCandidateToDocument,
  rejectCandidateInDocument,
  saveCandidateTrapInDocument,
} from "../lib/session-candidate-document";
import { capturedTrapInput, type CandidateDraft } from "../lib/session-capture";

describe("session candidate document mutation", () => {
  test("adds candidates by content key and preserves reviewed duplicates", () => {
    const draft = candidateDraft();
    const added = addCandidateToDocument([], draft);
    expect(added).toMatchObject({
      duplicate: false,
      candidate: { id: "cand-001", status: "proposed" },
    });

    const rejected = rejectCandidateInDocument(
      added.candidates,
      "cand-001",
      { sessionId: "session-1", reason: "Already covered." },
      new Date("2026-06-03T00:00:00.000Z")
    );
    const duplicate = addCandidateToDocument(rejected.candidates, draft);

    expect(duplicate).toMatchObject({
      duplicate: true,
      candidate: {
        id: "cand-001",
        status: "rejected",
        rejection_reason: "Already covered.",
      },
    });
    expect(duplicate.candidates).toHaveLength(1);
  });

  test("updates proposed candidates and rejects terminal status changes", () => {
    const added = addCandidateToDocument([], candidateDraft());
    const saved = saveCandidateTrapInDocument(added.candidates, "cand-001", {
      sessionId: "session-1",
      trap: capturedTrapInput({
        ...candidateDraft().trap,
        fix: "Update the candidate draft and verify the review inbox still shows it.",
      }),
    });
    expect(saved.candidate.trap.fix).toBe("Update the candidate draft and verify the review inbox still shows it.");

    const accepted = acceptCandidateInDocument(
      saved.candidates,
      "cand-001",
      {
        sessionId: "session-1",
        trapId: 42,
        scope: "project",
        conflictChecked: true,
        conflictStatus: "none",
        suggestedAction: "accept",
      },
      new Date("2026-06-03T00:01:00.000Z")
    );
    expect(accepted.candidate).toMatchObject({
      status: "accepted",
      accepted_trap_id: 42,
      accepted_scope: "project",
    });

    expect(() => rejectCandidateInDocument(
      accepted.candidates,
      "cand-001",
      { sessionId: "session-1", reason: "Too late." },
      new Date("2026-06-03T00:02:00.000Z")
    )).toThrow("Candidate cand-001 is already accepted");
  });
});

function candidateDraft(): CandidateDraft {
  return {
    trap: capturedTrapInput({
      title: "Keep candidate mutation rules in one document module",
      category: "bug",
      scope: "project",
      context: "When updating candidate inbox state after review actions.",
      mistake: "Scattering status transitions across persistence code makes regressions easier.",
      fix: "Route document mutations through one candidate document module.",
      severity: "error",
      tags: ["session", "candidate"],
      path_globs: ["src/lib/session-*.ts"],
    }),
    evidence: [{
      source_type: "conversation",
      source_ref: "session:session-1",
      related_files: ["src/lib/session-store.ts"],
      note: "Unit test draft.",
    }],
  };
}
