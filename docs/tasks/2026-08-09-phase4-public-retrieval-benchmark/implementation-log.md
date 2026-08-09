# Implementation Log

> Created: 2026-08-09

## Task

Implement the Phase 4 readiness gate and public reproducible retrieval
benchmark without exposing internal evidence or overstating product quality.

## Assumptions

- The user's approval covers Phase 4A implementation, not external publication
  or a claim that all Phase 4 longitudinal evidence already exists.

## Initial Approach

- Reuse the deterministic in-memory evaluation engine, but isolate a new public
  dataset and a stable benchmark/report contract from the internal dogfood
  fixture.

## Log

### 2026-08-09

- Readiness discovery: `src/tests/fixtures/search-eval.json` is useful for
  internal regression but contains real dogfood and project-shaped StickS3
  entries. Treating it as public would create an avoidable privacy/provenance
  ambiguity, so Phase 4A uses a newly authored synthetic dataset instead.
- Claims decision: `EvalEmbedder` is a deterministic category proxy, not a real
  embedding benchmark. The public report will label it explicitly and will
  separate retrieval metrics from candidate quality and behavior change.
- Reproducibility decision: the default path is offline and deterministic;
  dataset SHA-256 plus a checked-in expected summary detect silent fixture or
  metric drift. Weak configurations remain first-class report rows.
- Verification discovery: the first drift-gate test exposed aliasing because
  the expected-summary projection reused report metric objects. The projection
  now copies claims, metrics, and failure lists, so modifying an expected value
  cannot also mutate the actual report and hide drift.
- Packaging discovery: npm's allowlist already included `scripts` but not the
  new benchmark data. `benchmarks` is now an explicit package surface, and
  `npm pack --dry-run --json` confirms the dataset, methodology, expected
  result, runner, and benchmark library are included.
- Final measurements: default hybrid proxy R@3=1, R@5=1, MRR=0.9028; FTS-only
  and hybrid fallback R@3/R@5/MRR=0.8333 with two named failures each; semantic
  proxy-only R@3=1, R@5=1, MRR=0.7083. Publishing the weaker rows is deliberate.
- Validation passed 17 focused eval tests, 384 full-suite tests with one
  intentional browser-smoke skip, isolated-home CLI verification, expected-
  result drift checks, npm package dry-run, and Windows CLI/MCP builds.
- A real `npm pack` tarball was extracted into a system temporary directory and
  ran `bun run benchmark:retrieval -- --verify` successfully without workspace
  files. This proves package completeness on the same machine; it is not labeled
  independent external reproduction.
- `bunx tsc --noEmit` remains non-green because of three pre-existing Phase 2
  type errors in `trap-transfer.ts`, `phase2.test.ts`, and `runtime-proof.test.ts`;
  none overlaps this slice, so they were recorded rather than folded into the
  Phase 4A scope.
- Clean-runner decision: `.github/workflows/retrieval-benchmark.yml` pins Bun
  1.3.14 and verifies the checked-in result on both Windows and Linux. Each
  matrix leg uploads a JSON report; passing both legs proves clean-runner
  agreement with the drift gate, not independent third-party validation.
- Diagnostic decision: `--output <path>` writes the actual report before
  verification. A drift failure therefore exits non-zero while still leaving
  the evidence that explains the mismatch for CI artifact upload.
- CI implementation is local only: no workflow was triggered because the
  branch has not been pushed. Official runner evidence remains pending.
- Validation after the CI addition: six Phase 4A tests pass, the benchmark
  verifies, builds and npm dry-run pass, and the final full suite completes with
  386 passes, one intentional browser skip, and zero failures. An earlier rerun
  hit one transient Windows `EPERM` rename in an unrelated Phase 3 fixture; that
  focused file passed twice consecutively before the final green full run.
