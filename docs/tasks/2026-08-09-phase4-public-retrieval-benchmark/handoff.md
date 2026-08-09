---
title: Handoff 2026-08-09 - Phase 4A benchmark audit hardening
status: Complete
updated: 2026-08-09
---

# Handoff

## Summary

Phase 4A remains locally complete and is now hardened against the confirmed
audit findings: scope migration preserves lifecycle fields, candidate identity
has one implementation, Phase 2 authorization precedes destination writes,
the public benchmark has no dogfood vocabulary dependency, Windows atomic
writes retry bounded contention, and typecheck/full-suite CI gates cover PRs,
main, and releases. Overall Phase 4 still needs remote CI evidence, independent
reproduction, and privacy-safe longitudinal data.

## Current State

The audit-hardening implementation is complete locally, committed on its
temporary branch, and all quality gates listed below are green. It has not been
merged, pushed, or run in remote CI.

## Git And Persistent State

- Branch: `phase4-audit-hardening`, based on `767daf0` (`main` and
  `origin/main` at the start of this work).
- HEAD commit: `fix: harden phase 4 audit findings`.
- All audit-hardening changes are committed locally; nothing was pushed,
  merged, released, or published during this task.
- User stores and external services were not modified.

## Key Decisions

- One shared module owns candidate hashes and trap identity across capture,
  deduplication, approval, edit, and destination authorization.
- The public semantic proxy uses generic public categories only. It is still a
  deterministic retrieval proxy, not a production embedding measurement.
- Destination authorization is checked before Phase 2 apply and again at
  commit, so an unauthorized attempt cannot create its commit ledger.
- Existing HTTP security tests already cover token and project isolation. MCP
  cwd semantics, advisory-lock leases, and broad redaction were not changed
  without a reproduced boundary failure or a separately scoped design.

## Changed Surfaces

- Candidate lifecycle: `candidate-identity.ts`, candidate/session operations,
  Phase 2 operations, trap transfer, and their regression tests.
- Reliability: `fs-json.ts`, explicit Recall@5 with a rank-six boundary test,
  and focused tests.
- Benchmark: public-only embedder, expected results, methodology, and tests.
- Quality gates: pinned TypeScript, PR/main CI, release/npm workflows, and
  release preflight.

## Validation

- `bun run typecheck` -> passed.
- `bun test` -> 395 passed, 1 configured browser-smoke skip, 0 failed, and 1661
  assertions across 56 files.
- `bun run benchmark:retrieval -- --verify` -> passed; default hybrid MRR
  0.9028 and semantic proxy-only MRR 0.875.
- `bun run build` -> Windows CLI and MCP builds passed.
- `npm pack --dry-run --json` -> passed with the new packaged source files.
- All four GitHub workflow files parse as YAML; `git diff --check` has no
  whitespace errors.

## Next Steps

1. Review the commit, then fast-forward it into `main` only when the user
   requests that Git operation.
2. Push only with explicit authorization, then inspect the Windows/Linux CI
   results and retain benchmark artifacts.
3. Obtain an independent reproduction before claiming external validation;
   keep Phase 4B publication blocked until real privacy-safe evidence exists.

## Restart Verify

```bash
git status --short --branch
# expected: clean phase4-audit-hardening branch at the audit-hardening commit.
bun run typecheck
# expected: exit 0 with no TypeScript diagnostics.
bun test
# expected: 395 passed, 1 configured browser-smoke skip, 0 failed.
bun run benchmark:retrieval -- --verify
# expected: verification passed; hybrid MRR 0.9028, semantic proxy MRR 0.875.
```

Expected state: clean branch `phase4-audit-hardening` at the audit-hardening
commit, green typecheck, 395 pass/1 skip/0 fail, and benchmark verification
passed. A mismatch means inspect the working tree or the failing gate before
merging; do not update the recorded expectations to hide drift.

## Red Lines

- Do not publish the internal eval fixture or call proxy scores real embedding
  quality.
- Do not claim remote or independent evidence before it exists.
- Do not push, publish npm artifacts, or create a release without approval.

## References

- [Parent roadmap](../../agent-experience-compiler-roadmap.md)

## Implementation Log

- [implementation-log.md](implementation-log.md) records the reproduced audit
  findings, fix boundaries, and validation evidence.
