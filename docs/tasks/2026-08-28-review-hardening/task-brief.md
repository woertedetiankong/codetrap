# Task Brief: Feedback And Skill Review Hardening

> Created: 2026-08-28
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Close the evidence-backed integrity, portability, privacy, concurrency, and
storage findings from the independent review of the Feedback Improver and
Existing Skill improvement loops.

## Success Criteria

- Deleted feedback cannot be recreated from a retry, and concurrent deletion
  cannot leave surviving feedback resolutions partially applied.
- Behavior outcomes accept only real finite JSON numbers and positive JSON
  integers; CLI integer options reject decimal prefixes.
- Windows-reserved Skill names and quoted valid frontmatter names are handled
  consistently across direct Phase 3 and Improver-generated candidates.
- Every externally supplied Existing Skill source reference is redacted before
  it reaches evidence or candidate provenance.
- A live lock is never reclaimed only because a synchronous critical section
  exceeds five seconds; abandoned-lock recovery is serialized atomically.
- New Phase 3 commits reference bounded content-addressed snapshots instead of
  embedding four base64 directory copies, while legacy v1 commits stay
  readable and rollback-compatible.
- New snapshots preserve regular-file and directory permission modes; the
  documented boundary remains explicit for ACLs and extended attributes.
- Tests prove second-target failure restoration, snapshot deduplication and
  limits, lock-owner safety, legacy migration, and every input fix above.
- Typecheck, targeted tests, the full suite, build, diff check, and journal
  validation pass.

## Scope

In scope:

- Feedback Improver persistence, resolution, source-ref handling, and numeric
  validation.
- Shared Skill artifact validation and Phase 3 snapshot/commit persistence.
- Advisory-lock stale recovery shared by project-local stores.
- Current-facing README/roadmap/task continuity documentation.

Out of scope:

- Remote feedback adapters, unattended scheduling, autonomous approval, and
  execution of candidate scripts.
- Full ACL, ownership, timestamp, or extended-attribute preservation.
- Installing a live Skill, publishing, pushing, releasing, or changing the
  package version.

## Constraints

- Preserve all unrelated working-tree edits and existing pending candidates.
- Preserve rollback compatibility for the existing v1 Phase 3 commit format.
- Candidate scripts remain inert data.
- Review-derived lessons go only to the session candidate inbox and are not
  automatically accepted into confirmed memory.

## Expected Knowledge Updates

- Rewrite the affected Feedback Improver and Phase 3 sections in `README.md`.
- Update the parent roadmap dashboard, task index, and `NEXT-SESSION.md`.
- Link this dossier to both 2026-08-28 predecessor handoffs.
- Task index: update expected.
