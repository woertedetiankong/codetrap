---
title: Handoff 2026-08-28 - Improvement-loop review hardening
status: Complete
updated: 2026-08-28
supersedes: ../2026-08-28-existing-skill-improvement/handoff.md
---

# Handoff

## Summary

Independent-review findings in the Feedback Improver and Existing Skill loop
are fixed: deletion cannot resurrect content, inputs and Skill names are strict,
provenance is redacted consistently, live locks survive long synchronous work,
and Phase 3 now uses bounded content-addressed rollback snapshots with portable
POSIX permission metadata and proven dual-target recovery.

## Current State

The combined uncommitted improvement loops are hardened, documented, and fully
validated; no live Skill, remote account, release, or confirmed trap changed.

## Git And Persistent State

- Branch: `main`; base `d5d22c5`; all 2026-08-28 work remains uncommitted and unpushed.
- Ignored `dist/codetrap.exe` and `dist/codetrap-serve.exe` were rebuilt.
- Live Phase 3 state remains version 1 with current commit
  `p3-20260809044652-b3sa2k`; read-only compatibility did not migrate or modify it.
- Review candidate `cand-001` is pending in session
  `2026-08-28-capture-do-not-pair-unbounded-synchronous-persistence-with-age-o`.
- Follow-up review candidate `cand-001` is pending in session
  `2026-08-28-capture-bound-content-addressed-stores-need-reachability-gc-and`;
  it records the need for reachability GC and an explicit retention policy.
  Session status is 38 candidates, 8 pending, across 17 sessions.

## Key Decisions

- Tombstone retries succeed as deleted duplicates without restoring excerpts.
- Stale age never overrides a live owner PID; atomic quarantine elects one reclaimer.
- Phase 3 v2 commits hold refs only. Snapshot objects are deduplicated and bounded;
  v1 inline history migrates lazily under the Phase 3 lock.
- Permission identity is POSIX-only because Windows cannot verify chmod modes.
  ACLs, ownership, timestamps, and extended attributes remain unsupported.

## Changed Surfaces

- `src/lib/improver-*`, `src/lib/source-ref.ts`: retention, race settlement,
  strict metrics, and shared provenance redaction.
- `src/lib/advisory-lock.ts`: owner-liveness and atomic stale reclaim.
- `src/lib/skill-artifact.ts`, `src/lib/phase3-*`: shared name/frontmatter rules,
  mode-aware snapshots, v1/v2 persistence, limits, and recovery.
- `src/tests/*hardening*`, Improver/Phase 3/concurrency tests: review regressions.

## Cross-Module References

- Depends on: [Feedback Improver](../2026-08-28-feedback-improver-loop/handoff.md) - event and outcome contract.
- Depends on: [Existing Skill improvement](../2026-08-28-existing-skill-improvement/handoff.md) - patch lifecycle.
- Depends on: [Phase 1D locking](../2026-07-25-phase1d-locking-coverage-and-dedup/handoff.md) - shared advisory lock.

## Red Lines And Gotchas

- Do not push, publish, release, install globally, change version, migrate live
  Phase 3 state, install a Skill, or accept pending candidates without explicit approval.
- Candidate scripts remain inert; mode preservation does not authorize execution.

## Validation

- `bun test --timeout 15000 src/tests`: 437 pass, 1 configured skip, 0 fail.
- Restart hardening group: 16 pass; broader Phase 3/lock group: 22 pass.
- `bun run typecheck`, `bun run build`, `git diff --check`: pass.
- Real `phase3 commits --json`: legacy current commit maps to lightweight refs read-only.

## Docs And Wiki

- Rewritten: README retention, numeric, source-ref, Phase 3 storage/mode/limit contracts.
- Reconciled: parent roadmap, task index, and `NEXT-SESSION.md`.
- No hand-maintained wiki exists, so none was created.

## Known Risks

- POSIX filesystem mode assertions run only on non-Windows runners; local proof is Windows plus pure snapshot logic.
- Crash recovery between two live-directory mutations remains rollback-on-error,
  not a journaled transaction surviving process termination.

## Restart Verify

```bash
bun run typecheck  # expected: exit 0; mismatch means a shared contract drifted
bun test --timeout 30000 src/tests/phase3-hardening.test.ts src/tests/improver.test.ts  # expected: 16 pass; mismatch means review hardening regressed
```

## Next Steps

1. Review the pending locking/storage candidates; accept, edit, reject, or supersede each explicitly.
2. Review the combined uncommitted diff and commit only with user authorization.
3. Let the normal Windows/Linux CI verify the POSIX mode branch after an authorized push.

## Implementation Log

- [implementation-log.md](implementation-log.md) records migration, lock, mode, and validation decisions.
