# Implementation Log

> Created: 2026-08-28

## Task

Harden the two uncommitted 2026-08-28 improvement-loop milestones against the
findings confirmed by independent review.

## Assumptions

- Linux and macOS distribution make POSIX permission preservation part of the
  supported product surface even though validation is running on Windows.
- Existing Phase 3 v1 commit data is persistent rollback state and cannot be
  discarded or rewritten without a compatible migration path.

## Initial Approach

- Split the work into an Improver integrity unit and a shared lock/Phase 3
  persistence unit, then reconcile user contracts after both pass targeted
  tests.

## Log

### 2026-08-28

- Chose tombstone-aware idempotent capture rather than event resurrection or a
  generic retry error: a repeated capture may acknowledge deletion but must not
  restore the deleted excerpts.
- Chose PID-aware stale-lock reclamation with atomic directory quarantine. A
  timer heartbeat is not sufficient because the affected critical sections use
  synchronous JSON serialization and filesystem writes that can block timers.
- Chose a versioned content-addressed Phase 3 snapshot store with hard object,
  aggregate, and commit-count bounds. Legacy version 1 inline commits will be
  migrated lazily inside the existing Phase 3 lock so rollback material remains
  available without keeping new history in one ever-growing JSON document.
- Permission modes will participate in new snapshot identity and restoration.
  Legacy snapshots have no mode evidence, so their old content-only rollback
  comparison remains compatible; ACLs and extended attributes stay explicitly
  unsupported rather than being claimed as preserved.
- Windows validation showed `chmod(0644)` and `chmod(0755)` both read back as
  mode `0666`. New permission identity is therefore POSIX-only; Windows retains
  content/path identity rather than recording metadata it cannot verify.
- The first reserved-name regression test exposed a duplicate validator in the
  target-path preflight. `parseSkillName` now owns both payload and target-path
  validation, and Improver workflow generation uses the same function.
- Verified work units: strict/tombstone/redaction tests pass 15/15; advisory
  lock, legacy migration, content-addressed storage, bounds, permission, and
  dual-target recovery tests pass 22/22; TypeScript typecheck passes.
- Final validation passed 437 tests with one configured browser-smoke skip and
  zero failures across 61 files. Build, typecheck, `git diff --check`, real v1
  commit listing, and the review-candidate round trip also passed. The work is
  intentionally uncommitted, so no implementation commit hash exists yet.
