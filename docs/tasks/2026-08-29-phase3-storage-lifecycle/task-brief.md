# Task Brief: Phase 3 Storage Lifecycle Foundation

> Created: 2026-08-29
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Make Phase 3 snapshot growth observable and safely reclaim only snapshot objects
that no durable commit can reach, without pretending the current single-host
filesystem design is already a distributed team service.

## Success Criteria

- `phase3 storage` reports commit/snapshot usage, configured limits, referenced
  and orphan objects, invalid entries, and missing required objects without
  mutating legacy version 1 state.
- `phase3 gc` is a dry-run by default; `--apply` rechecks under the Phase 3 lock
  and deletes only valid snapshot objects that no version 1 or version 2 commit
  references.
- Active and reverted commits retain all referenced rollback material.
- Damaged commit metadata, invalid snapshot entries, or missing version 2
  rollback objects make apply fail closed before deletion.
- Applied GC leaves a durable maintenance receipt with the exact deleted ids and
  released bytes.
- Tests reproduce an object written before its commit index entry, prove dry-run
  immutability, prove safe apply, and pin legacy/reverted/corrupt boundaries.
- README and roadmap state that filesystem locks are single-host only and that
  Git/PR coordination is the supported first team-evaluation path.
- Typecheck, targeted tests, full suite, build, diff check, and journal
  validation pass.

## Scope

In scope:

- Phase 3 storage inventory, reachability analysis, and orphan collection.
- Phase 3 CLI status/GC commands and local maintenance receipts.
- Tests and current-facing documentation for the storage and team boundary.
- Reconciliation of the already-pushed `8206618` state and successful remote
  Windows/Linux CI evidence.

Out of scope:

- History retention/pruning, automatic deletion, or removal of referenced
  rollback material.
- Interrupted dual-target install recovery journals.
- Network-share locking, central services, RBAC, SSO, device rollout, or
  automatic team distribution.
- Running GC against live project data, accepting pending candidates, changing
  package version, publishing, releasing, or pushing.

## Constraints

- Dry-run and status paths must remain read-only, including for legacy commits.
- GC must be deterministic from durable commit reachability; model judgment is
  never part of deletion eligibility.
- Invalid or ambiguous state is reported and blocks apply rather than being
  guessed away.
- Existing version 1 commit reads and rollback remain compatible.

## Expected Knowledge Updates

- Rewrite the Phase 3 command/storage section in `README.md`.
- Update the parent roadmap dashboard, task index, and `NEXT-SESSION.md`.
- Supersede the operational state in the 2026-08-28 hardening handoff with a new
  handoff for this slice.
- Task index: update expected.
