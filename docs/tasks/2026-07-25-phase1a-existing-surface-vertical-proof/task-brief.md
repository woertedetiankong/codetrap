# Task brief — Phase 1A: existing-surface vertical proof

Parent plan: `docs/agent-experience-compiler-roadmap.md` §16 Phase 1A
Predecessor: `docs/tasks/2026-07-25-phase0-claude-code-proof-point/`
Date opened: 2026-07-25
Status: **not started**

## Goal

Prove the whole loop end-to-end through surfaces that **already exist**. One
real lesson goes in; a searchable, reversible trap comes out; a suppressed
lesson stays suppressed.

```text
agent-submitted pitfall_trap candidate
  -> existing session candidate surface
  -> Web review
  -> user authorizes
  -> agent executes the commit on that explicit instruction
  -> trap is searchable via codetrap search
  -> trap is reversible
  -> one suppressed lesson does not reappear from the same evidence
```

## Explicitly out of scope

Deferred to 1B–1E; building any of it here is scope creep:

- No general `LessonCandidate` schema, no `revision`/`content_hash`, no
  three-axis state migration (1B).
- No `learn` subcommands, no pull adapters, no evidence-pack CLI (1C).
- No `.codetrap/learning/` locks, no coverage machinery, no dedup rules (1D).
- No Inbox UI, no curated context-pack export (1E).
- No destination kinds beyond `pitfall_trap`.

## Input

First candidate: **cluster 1 of the Phase 0 accepted set** — throwaway Node
scripts in the session scratchpad cannot resolve the project's `node_modules`.
Chosen because it was found by all four blind mining runs, has an unambiguous
trigger and action, and carries low misuse risk.

Second candidate, for the suppression half: any cluster the user is willing to
skip, so a `suppressed` decision can be shown to survive a re-run from the same
evidence.

Full sanitized set: `../2026-07-25-phase0-claude-code-proof-point/accepted-candidates.md`

## Acceptance criteria (§16, unchanged)

1. One real candidate is approved by the user.
2. It is committed **by an agent acting on explicit user instruction**, not by
   the user directly — this is the §3.2 authority-vs-execution split, and it is
   the part most likely to be wrong in the current code.
3. The committed trap is findable afterward via `codetrap search`.
4. The commit is reversible, with the rollback path exercised, not just claimed.
5. One suppressed lesson does not reappear from the same evidence.
6. The receipt records authorization scope **and** executor (`user` | `agent`).

## Plan

1. **Discovery first.** Read what already exists before writing anything:
   `src/lib/session-candidate-*.ts`, `session-review.ts`, `trap-operations.ts`,
   `trap-lifecycle.ts`, `src/web/client-review.ts`, `src/commands/*`. Establish
   which acceptance criteria the current code already satisfies. Several
   probably do — this slice should be small.
2. Identify the gap between today's candidate flow and the six criteria above.
   Expect the gaps to be: executor recorded on the receipt, suppression
   fingerprinting, and rollback being genuinely exercised.
3. Implement only those gaps.
4. Regression tests per criterion, including the suppression re-run.
5. Verify by driving the real flow, not only tests.

## Risk carried in from Phase 0 — read this before starting

Phase 0's candidate-quality gate was **waived, not met**: all 16 clusters were
approved in bulk, so 100% approval is 100% by construction. Phase 1A is
therefore *also* the delayed test of candidate quality.

Concretely: if the trap committed here never usefully fires in later work, that
is the §17 falsifier arriving late, and the correct response is to strengthen
mining and re-run a genuine per-item review — **not** to proceed to 1B and build
more architecture on top of it.

## Cheap adjacent items already justified by evidence

Not required for the exit gate, but both are small and already earned:

- Gitignore review artifacts at creation; have `doctor` warn when a review
  directory is tracked in a repo with a public remote (Phase 0 risk 6).
- Re-run mining with assistant reasoning and diffs included, to test whether
  the 1-of-34 codebase-lesson result is an extractor artifact (Phase 0 risk 4).
  Worth doing **before** 1B freezes the envelope.
