---
title: Handoff 2026-08-09 - Phase 4A public retrieval benchmark
status: Complete
updated: 2026-08-09
---

# Handoff

## Summary

Phase 4A implementation is complete: codetrap now has an offline, synthetic,
MIT-licensed retrieval benchmark with four honest configurations, stable
SHA-256/metric drift verification, packaged methodology, one-command output,
and a pinned-Bun Windows/Linux clean-runner gate with JSON artifacts. Overall
Phase 4 remains open for the first remote workflow run, independent reproduction,
and privacy-safe longitudinal evidence.

## Current State

The benchmark implementation passes local validation, is package-ready, and is
merged into local `main`. The CI workflow has not run because local `main` has
not been pushed; nothing has been externally published or independently
reproduced.

## Git And Persistent State

- Branch: local `main`; the completed `phase4-public-benchmark` branch was
  fast-forwarded into `main` and deleted locally.
- Local `main` contains the Phase 4A commit and is ahead of `origin/main` until
  an explicitly authorized push succeeds.
- No user trap store, session record, embedding service, or external system was
  mutated; benchmark execution is in-memory and offline.

## Key Decisions

- The internal eval fixture stays private-facing because it mixes regression,
  dogfood, and project-shaped content; the public dataset is newly authored.
- `EvalEmbedder` is labeled a deterministic semantic proxy, never a production
  embedding score.
- Phase 4A measures retrieval only. Candidate quality, approval quality,
  longitudinal usefulness, and behavior change remain explicitly unmeasured.

## Changed Surfaces

- `benchmarks/retrieval-v1/`: dataset, method, claim boundary, expected summary.
- `src/lib/public-retrieval-benchmark.ts`: four-run report and drift gate.
- `scripts/public-retrieval-benchmark.ts`: text/JSON/verify CLI.
- `.github/workflows/retrieval-benchmark.yml`: pinned Bun 1.3.14 matrix for
  clean Windows/Linux verification and per-runner report upload.
- `src/tests/public-retrieval-benchmark.test.ts`: package, drift, and isolated-
  home proofs, report persistence, and workflow contract.
- `.gitignore`, `package.json`, `README.md`: generated report, npm surface, and
  operator workflow.

## Cross-Module References

- Depends on: [Phase 3 handoff](../2026-08-08-phase3-skill-candidate-lifecycle/handoff.md) - prior roadmap gate.
- Reuses: `search-eval.ts`, `search-policy.ts`, and the in-memory repository;
  internal fixture content is not reused.
- Referenced by: [parent roadmap](../../agent-experience-compiler-roadmap.md) - Phase 4 status and claim boundary.

## Validation

- `bun run benchmark:retrieval -- --verify` -> passed; dataset SHA-256
  `2f180e09...fcefc8e`.
- Focused evaluation suite -> 17 passed, 0 failed.
- `bun test src/tests/public-retrieval-benchmark.test.ts` -> 6 passed, 0 failed.
- `bun test` -> 386 passed, 1 intentional browser-smoke skip, 0 failed. One
  earlier rerun saw a transient unrelated Windows `EPERM` rename in the Phase 3
  fixture; that file passed twice in isolation and the final full run is green.
- `npm pack --dry-run --json` -> benchmark data, docs, runner, and library included.
- Extracted npm tarball -> `bun run benchmark:retrieval -- --verify` passed
  outside the workspace on the same machine.
- `bun run build` -> Windows CLI and MCP executables built.
- `bunx tsc --noEmit` -> three pre-existing Phase 2 errors; no Phase 4A file is
  named by the diagnostics.

## Restart Verify

```bash
git status --short --branch
# expected: clean main ahead of origin/main by the Phase 4A commit; mismatch means inspect repository state.
bun run benchmark:retrieval -- --verify
# expected: verification passed and SHA-256 2f180e09...fcefc8e; mismatch means dataset or retrieval drift.
bun test src/tests/public-retrieval-benchmark.test.ts
# expected: 6 passed, 0 failed; mismatch means package, isolation, workflow, or drift contract regressed.
```

## Next Steps

1. After an authorized push, inspect both clean-runner workflow legs and retain
   their JSON artifacts; seek independent reproduction before claiming external
   validation.
2. Keep Phase 4B blocked from publication until privacy-safe longitudinal
   metrics exist; do not synthesize them.

## Red Lines And Gotchas

- Do not publish the internal eval fixture or user-derived evidence.
- Do not call deterministic proxy scores real embedding quality.
- Do not push, publish npm artifacts, or create a release without user approval.

## Docs And Wiki

- README, roadmap, task index, dossier, and next-session entry are reconciled.
- No project wiki exists, so none was created.

## Implementation Log

- [implementation-log.md](implementation-log.md) records privacy, claims,
  reproducibility, packaging, and validation decisions.
