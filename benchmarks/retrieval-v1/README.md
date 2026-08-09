# codetrap Retrieval Benchmark v1

This benchmark is a released, synthetic retrieval fixture for checking whether
codetrap's search pipeline produces reproducible results. All benchmark traps
and queries were authored for this repository and are available under the
repository's MIT license. They are not copied from user sessions, private trap
stores, project source code, issues, or the internal dogfood fixture.

## Run

From a clean checkout with Bun installed:

```bash
bun install --frozen-lockfile
bun run benchmark:retrieval -- --verify
```

The command is offline: it uses an in-memory SQLite database and a public-only
generic category proxy for semantic retrieval. It does not read `~/.codetrap`, project
databases, API keys, or external embedding services.

Use `--json` for the machine-readable report and `--include-cases` to include
per-query output. Use `--output` to preserve the complete JSON report while
keeping the human-readable result on stdout:

```bash
bun run benchmark:retrieval -- --verify --json
bun run benchmark:retrieval -- --json --include-cases
bun run benchmark:retrieval -- --verify --output artifacts/retrieval-benchmark.json
```

Pull requests and pushes to `main` run the verification from clean GitHub-hosted
Windows and Linux runners with Bun 1.3.14. Each runner uploads its JSON report
as `retrieval-benchmark-Windows` or `retrieval-benchmark-Linux`. A green matrix
proves that both clean runners match the checked-in dataset and expected metrics;
it does not by itself constitute independent third-party validation.

## Method

- Dataset: `dataset.json`, identified in every report by SHA-256.
- Corpus: 12 synthetic coding-pitfall records in three retrieval families.
- Queries: concept paraphrases plus exact API/identifier lookups.
- Metrics: Recall@3, Recall@5, and mean reciprocal rank (MRR).
- Configurations:
  - `default-hybrid-proxy`: the default hybrid policy with public-only,
    deterministic generic category vectors.
  - `fts-only`: lexical retrieval without semantic candidates.
  - `semantic-proxy-only`: proxy semantic retrieval without lexical candidates.
  - `hybrid-fts-fallback`: hybrid mode with semantics unavailable, exercising
    the documented FTS fallback.
- Drift gate: `expected-results.json` fixes the dataset hash, metrics, and named
  failures. `--verify` exits non-zero if they change.

## Claim Boundary

This benchmark measures retrieval behavior on a released synthetic dataset. It
does **not** measure real embedding-provider quality, mined candidate quality,
human approval quality, longitudinal usefulness, or later agent behavior. The
deterministic semantic proxy exists to make fusion and fallback reproducible.
It has its own public-only vocabulary and does not reuse the internal dogfood
embedder; it is not a substitute for an external semantic benchmark.

The weaker configurations are deliberately published. Their failures make the
tradeoff legible and prevent the default result from being presented without a
baseline.
