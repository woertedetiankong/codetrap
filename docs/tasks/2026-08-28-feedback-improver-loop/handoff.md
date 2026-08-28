---
title: Handoff 2026-08-28 - Feedback improver loop
status: Complete
updated: 2026-08-28
---

# Handoff

## Summary

Codetrap now has a proposal-only feedback improvement loop. Structured
work-surface feedback is captured idempotently, redacted and bounded, grouped by
a stable pattern key, weighted by feedback quality, routed into existing
candidate destinations, and optionally staged in the normal Candidate Inbox.
Stored excerpts have an explicit tombstone-preserving deletion path. Later
numeric behavior outcomes are recorded separately from recall hits and
subjective usefulness.

## Current State

The local Feedback Improver vertical slice is implemented, documented, and
validated; its changes remain uncommitted and no remote adapter, scheduler,
installation, release, or destination write was performed.

## Git And Persistent State

- Branch: `main`; task changes are uncommitted and unpushed.
- Persistent state: no Improver feedback was written into this checkout. The
  pre-existing `cand-001` in session `2026-08-27-capture-windows-bun-json`
  remains staged and unreviewed. Build outputs under `dist/` are ignored.

## Key Decisions

- The core accepts generic correlated feedback events; GitHub and other work
  surfaces remain permissioned adapters outside this slice.
- Dry-run is the default. `--apply` stages candidates only and reports zero
  durable destination writes.
- Feedback quality is weighted explicitly; workflow skills additionally need
  recurrence, distinct source refs, rationale, and concrete steps.
- Conflicting shapes or docs/evaluation payloads block a group. Codetrap does
  not semantically guess which feedback is correct.
- Concurrent apply runs converge on one logical candidate and do not leave an
  empty duplicate batch session.

## Changed Surfaces

- `src/domain/improver.ts`: feedback, resolution, and behavior-outcome model.
- `src/lib/improver-store.ts`: locked, atomic, symlink-refusing project state.
- `src/lib/improver-operations.ts`: redaction, weighting, grouping, routing,
  candidate generation/staging, retention deletion, concurrency convergence,
  and metrics.
- `src/commands/improver-commands.ts`, `src/commands/workflow.ts`,
  `src/index.ts`: `improver capture|events|run|outcome|metrics` CLI.
- `src/tests/improver.test.ts`: nine end-to-end and concurrency cases.
- `README.md`, parent roadmap, task index, and next-session entry: current user
  contract and milestone status.

## Cross-Module References

- Depends on: [Phase 1D hardening](../2026-07-25-phase1d-locking-coverage-and-dedup/handoff.md) - advisory locking and candidate dedup discipline.
- Depends on: [Phase 2 destinations](../2026-08-08-phase2-low-risk-destinations/handoff.md) - conventions, docs, eval, and insight carriers.
- Depends on: [Phase 3 skill lifecycle](../2026-08-08-phase3-skill-candidate-lifecycle/handoff.md) - reviewed skill preview/install/rollback boundary.
- Referenced by: [README](../../../README.md) and the [parent roadmap](../../agent-experience-compiler-roadmap.md).

## Red Lines And Gotchas

- Do not describe this as an autonomous closed loop: there is no live remote
  adapter or scheduler, and destination approval/install remains manual.
- Do not treat adapter-supplied lesson hypotheses as truth; blockers and the
  Candidate Inbox are load-bearing review boundaries.
- Do not push, install globally, publish, release, or change the package version
  without explicit user authorization.

## Validation

- `bun test --timeout 15000 src/tests`: 424 pass, 1 configured Windows browser-smoke skip, 0 fail.
- `bun test src/tests/improver.test.ts`: 9 pass, 0 fail.
- Existing session/Phase 2/Phase 3 regression group: 31 pass, 0 fail.
- `bun run typecheck`: pass.
- `bun run build`: both compiled CLI binaries built successfully.
- Root `--help`: exposes the `improver` command.
- `git diff --check`: pass.

## Docs And Wiki

- Rewritten: `README.md` feedback loop, CLI, skill-source, and behavior-outcome guidance.
- Reconciled: parent roadmap status/source contract, task index, and
  `NEXT-SESSION.md`.
- No hand-maintained project wiki exists, so none was created.

## Restart Verify

```bash
bun run typecheck  # expected: exit 0; mismatch means the new domain/CLI contract drifted
bun test src/tests/improver.test.ts  # expected: 9 pass, 0 fail; mismatch means the feedback loop regressed
```

## Next Steps

1. Run an organic pilot by feeding real, user-approved PR/session feedback into
   the generic contract and review every generated candidate.
2. If the user authorizes remote access, add a read-only GitHub adapter that
   emits this contract and preserves source/run/skill-revision correlation.
3. Add scheduling only after organic candidate quality and outcome data justify
   it; keep scheduling proposal-only.

## Implementation Log

- [implementation-log.md](implementation-log.md) records the adapter boundary,
  evidence gates, metric semantics, and concurrency convergence decision.
