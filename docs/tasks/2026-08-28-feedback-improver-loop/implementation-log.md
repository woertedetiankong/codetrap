# Implementation Log

> Created: 2026-08-28

## Task

Build a Warp-inspired, proposal-only feedback improvement loop on top of
Codetrap's existing candidate governance model.

## Assumptions

- The user authorized the product upgrade discussed in the immediately
  preceding comparison, but did not authorize remote account connections,
  background services, publishing, installation, commits, or pushes.

## Initial Approach

- Land one complete local vertical slice: normalized feedback ingress,
  evidence-weighted grouping and routing, candidate staging, and behavior
  outcomes.

## Log

### 2026-08-28

- Chose a generic structured feedback contract instead of a GitHub-specific
  authenticated adapter. This makes PR/Issue adapters possible without adding
  remote permissions or making one work surface the core domain model.
- Kept Improver dry-run by default and reused the session Candidate Inbox for
  `--apply`. The Improver may persist redacted feedback and stage proposals,
  but it cannot approve, commit, patch, or install a destination.
- Repeated workflows require recurrence and distinct evidence before becoming
  `skill_candidate` drafts. Exact operational pitfalls may use the lower
  weighted-signal threshold; this preserves the distinction between atomic
  guardrails and principle-level procedural skills.
- Behavior measurement uses caller-named numeric metrics with an explicit
  `higher_is_better` or `lower_is_better` direction. This avoids hard-coding
  assumptions such as whether latency, acceptance rate, or edit rate should
  rise or fall.
- Concurrency review found a cross-store idempotency edge: two simultaneous
  apply runs can both read pending feedback, while the session lock correctly
  makes the second observe the first candidate as an exact duplicate. Feedback
  resolution therefore treats `staged`, `existing`, and `already_committed` as
  the same logical outcome only when session, candidate, and destination all
  match. Batch sessions are created lazily so the duplicate-only runner leaves
  no empty review session.
- Documentation reconciliation surfaced that feedback excerpts are review
  artifacts under the roadmap's retention/delete red line. Added a
  dry-run-first, idempotent event deletion that removes all feedback and lesson
  text while retaining only ids, pattern/source metadata, dates, and candidate
  resolution in a tombstone. Deleting evidence never deletes or rolls back a
  separately authorized destination.
