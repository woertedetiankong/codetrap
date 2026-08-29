# Implementation Log

> Created: 2026-08-29

## Task

Add the first team-readiness storage slice: observable, governed Phase 3 orphan
snapshot collection without introducing distributed-service claims.

## Assumptions

- The current Phase 3 store is authoritative only on one host; a PID-based
  advisory lock cannot coordinate independent machines through a network share.
- A commit marked reverted still owns its referenced snapshots until a separate,
  explicitly authorized history-retention feature changes that contract.

## Initial Approach

- Separate read-only inventory from locked apply, use commit reachability as the
  only deletion rule, and keep invalid or missing objects outside the automatic
  repair boundary.

## Log

### 2026-08-29

- Chose safe GC before history pruning. All snapshot ids referenced by active or
  reverted version 2 commits, and all identities derivable from legacy inline
  commits, remain reachable. This keeps rollback/audit material intact and
  leaves retention policy for a later user decision.
- Status will diagnose invalid entries instead of crashing on the first one, but
  apply will fail closed if the commit document is corrupt, a version 2
  reference is missing, or any snapshot entry cannot be validated. Automatic
  deletion is limited to valid, regular, content-verified orphan objects.
- The current lock remains explicitly single-host. Team evaluation starts with
  Git/PR review and per-device local apply rather than treating a shared folder
  as a distributed transaction system.
- Chose a per-run atomic maintenance receipt instead of extending the learning
  receipt schema. GC writes `planned` before deletion and rewrites the same
  small per-run record to `completed` or `failed`, so a process interruption leaves a
  visible intent without mixing storage maintenance into candidate decisions.
- Real project validation read the existing version 1 commit through
  `phase3 storage`; its before/after file SHA-256 stayed
  `EFBCCE4D16B854D6B8F4D8042B15216140914FDA0442FFA9190D6C3FD198CE33`,
  proving the status path did not migrate persistent state.
- Final validation passed 441 tests with one configured browser-smoke skip and
  zero failures across 61 files. The four-file Phase 3/lock group passed 27/27;
  typecheck, compiled CLI/MCP builds, and `git diff --check` also passed.
