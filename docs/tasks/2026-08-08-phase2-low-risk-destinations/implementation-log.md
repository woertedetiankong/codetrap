# Implementation Log

> Created: 2026-08-08

## Task

Implement Phase 2 low-risk destinations, insight study, lesson currency, and
longitudinal validation as one compatible milestone.

## Assumptions

- The Phase 2 roadmap acceptance block is authoritative; unsupported Phase 3
  destinations remain unshipped.
- CLI-first mutation surfaces are acceptable when the acceptance criteria do not
  require a Web mutation, while Web reads must not break on widened records.

## Initial Approach

- Stabilize destination and persistence contracts first, then build CLI flows,
  then exercise real acceptance evidence before closing docs.

## Log

### 2026-08-08

- Compatibility discovery: candidate schema v2 and `CandidateAuthorization`
  restrict destination to `pitfall_trap/unclassified`, while receipts restrict
  it further to `pitfall_trap`. Phase 2 must introduce a new candidate version
  and additive destination contract rather than reinterpret stored v2 records.
- Storage discovery: every durable lesson currently shares the `traps` model.
  Patch proposals and insights have different lifecycle semantics, so forcing
  them into trap columns would make search eligibility and rollback ambiguous.
  Use purpose-specific Phase 2 stores while keeping shared authorization and
  receipt semantics explicit.
- Decision: candidate schema v3 is additive. Pitfall hashes remain stable;
  destination candidates hash kind + payload, so Phase 1 suppression remains
  compatible while Phase 2 approvals cannot go stale silently.
- Implemented `project_convention`, `docs_guidance`, `search_eval_case`, and
  `insight` commits behind the existing Inbox approval contract. Targets are
  allowlisted, commits keep exact snapshots, and revert refuses to overwrite a
  later edit.
- Implemented the insight shelf and consultation counters. V2 `unclassified`
  records carrying an `insight` hint migrate to the stable kind without
  reinterpreting other v2 records.
- Added schema v9 currency (`last_validated`, `graduated_at`, `graduated_to`),
  stale ranking diagnostics/penalty, validation, and deterministic-check
  graduation.
- Added metrics for suppression, useful recall, authorization invalidation,
  Inbox health, cross-client provenance, insight consultation, validation, and
  graduation, plus the recorded retrieve-vs-curate decision.
- Acceptance tests exercise real CLI subprocesses for authorization refusal,
  apply/revert, insight consultation, two useful lessons, and default-recall
  exit. Existing Phase 1 dedup/suppression suites remain regression coverage.
- Compatibility fixes updated two schema-version expectations and made the v9
  migration tolerate deliberately minimal historical embedding schemas.
- Final verification: `bun test` passed 374 tests with 1 intentional browser
  smoke skip and 0 failures (375 total); `bun run build` produced both Windows
  CLI and MCP executables; `git diff --check` passed.
