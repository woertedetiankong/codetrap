# Task Brief: Feedback Improver Loop

> Created: 2026-08-28
> Parent plan: [Agent Experience Compiler Roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Add a proposal-only feedback improvement loop that turns correlated, redacted
human feedback into evidence-weighted Codetrap candidates and records whether
later agent behavior measurably improved.

## Success Criteria

- A project-local CLI accepts idempotent structured feedback events from work
  surfaces without writing a trap, guidance, evaluation fixture, or skill.
- Captured agent output, human feedback, and final changes are bounded and
  redacted before they reach the project store.
- Stored feedback excerpts have a dry-run-first, idempotent deletion path that
  preserves only non-sensitive audit metadata.
- The Improver groups feedback by an explicit stable pattern key, weighs
  detailed/domain-expert feedback above binary feedback, and reports conflicts
  instead of guessing across incompatible destination shapes.
- Dry-run is the default. Applying an eligible run stages reviewable candidates
  through the existing session inbox and leaves durable destination writes at
  zero.
- Repeated workflow evidence can produce a principle-and-rationale
  `skill_candidate`, but only with recurrence, distinct source evidence, and no
  automatic install.
- Behavior outcomes distinguish improvement, no change, and regression using
  an explicit metric direction and sample counts.
- CLI, concurrency, redaction, idempotency, routing, staging, and outcome tests
  pass together with typecheck and the full suite.

## Scope

In scope:

- Feedback event domain model and project-local locked store.
- `codetrap improver capture|events|run|delete|outcome|metrics` CLI surface.
- Deterministic feedback weighting, aggregation, destination routing, and
  candidate generation for existing Codetrap destinations.
- Proposal-only integration with the existing session candidate inbox.
- Behavior outcome storage and summary metrics.
- Current-facing documentation and roadmap reconciliation.

Out of scope:

- Authenticating to GitHub or another remote work surface.
- Background schedulers, daemons, webhooks, or external side effects.
- Automatic candidate approval, trap acceptance, guidance/docs/eval writes, or
  skill installation.
- LLM calls inside the Codetrap CLI or automatic semantic reconciliation of
  contradictory feedback.
- Publishing, releasing, global installation, committing, or pushing.

## Constraints

- Preserve the local-first and explicit human-authorization boundaries in the
  parent roadmap.
- Reuse session candidate hashing, suppression, locking, and approval semantics
  rather than creating a second review system.
- Default to dry-run for every action that can stage candidates.
- Feedback is historical evidence, not authoritative instruction; incompatible
  shapes or destination payloads must block a group for review.
- Preserve the existing pending `cand-001` session candidate unchanged.

## Expected Knowledge Updates

- Rewrite affected CLI, learning-loop, skill-candidate, and metrics sections in
  `README.md`.
- Update the parent roadmap status dashboard, task index, handoff, and
  `NEXT-SESSION.md`.
- Task index: update required because this slice spans domain, store, CLI,
  session staging, tests, and docs.
- Project wiki: not required; no hand-maintained wiki exists.
