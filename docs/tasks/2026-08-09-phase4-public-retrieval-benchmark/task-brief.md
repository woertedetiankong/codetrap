# Task Brief: Phase 4A Public Retrieval Benchmark

> Created: 2026-08-09
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done (implementation; external publication remains separate)

## Goal

Ship a privacy-safe, one-command, reproducible retrieval benchmark with a
released synthetic dataset, stable expected results, honest weak
configurations, and claims that stay separate from candidate quality and later
behavior change.

## Success Criteria

- A versioned benchmark dataset has explicit synthetic provenance and MIT reuse
  terms, with no copied session, trap-store, or user-project content.
- One command runs the benchmark without network access, external embedding
  services, or access to the user's codetrap home.
- The report identifies the dataset by SHA-256, records Recall@3, Recall@5, MRR,
  failures, and includes named weaker FTS/semantic/fallback configurations.
- A verification mode compares the run with a checked-in stable expected result
  and fails on dataset or metric drift.
- Tests exercise the library, CLI, isolated-home execution, tamper detection,
  and honest claim boundaries.
- A pinned-toolchain Windows/Linux CI matrix runs the drift gate from a clean
  checkout and uploads the actual JSON report, including on verification drift.
- README and roadmap distinguish deterministic retrieval reproducibility from
  real-provider semantic quality, candidate quality, and behavior change.

## Scope

In scope:

- Phase 4 readiness decision and Phase 4A retrieval benchmark.
- Public-safe dataset, methodology, runner, expected result, and regression
  tests.
- Deterministic weak-configuration comparisons.
- Clean-runner CI automation and machine-readable report artifacts.

Out of scope:

- Publishing the current internal `src/tests/fixtures/search-eval.json`.
- Claiming the deterministic semantic proxy measures a production embedding
  model.
- Publishing longitudinal flywheel metrics before privacy-safe real-use data is
  sufficient.
- New custom-agent or automation destinations.

## Constraints

- The benchmark must be deterministic and offline by default.
- Internal dogfood evidence remains internal; public data is authored from
  scratch and contains no private identifiers or copied project wording.
- Weak configurations are reported, not tuned away or hidden.
- Do not push or publish externally without explicit user authorization.

## Expected Knowledge Updates

- Parent roadmap Phase 4 status and evidence link.
- README benchmark instructions and claims boundary.
- `docs/tasks/INDEX.md` and `docs/tasks/NEXT-SESSION.md`.
- No wiki exists; do not create one.
