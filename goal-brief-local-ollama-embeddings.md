# Goal Brief: Local Ollama Embeddings for codetrap

> Prepared for Codex `/goal` mode.
> Created: 2026-06-06
> Source conversation: same thread
> Owner: superstorm

## Goal Objective

Add a local Ollama embedding provider to codetrap so semantic and hybrid search can run locally with `qwen3-embedding:0.6b`, while preserving the existing Jina provider and current SQLite BLOB exact-scan storage path.

## /goal Command

```text
/goal Add a local Ollama embedding provider to codetrap so semantic and hybrid search can run locally with qwen3-embedding:0.6b, while preserving the existing Jina provider and current SQLite BLOB exact-scan storage path. Use this Goal Brief as the authoritative task contract. Continue working until the Completion Criteria are satisfied, preserve the Constraints and Forbidden Shortcuts, report progress as requested, and do not mark the goal complete until the Final Review and Handoff requirements are done.
```

## Desired Outcome

`codetrap embed` and `codetrap search --mode semantic|hybrid` should work without `JINA_API_KEY` when the user has Ollama running locally and `qwen3-embedding:0.6b` installed. The first implementation should reuse the current `EmbeddingProvider` abstraction, `trap_embeddings` BLOB storage, `passage_hash` freshness checks, cosine scoring, and existing RRF hybrid fusion.

The product default should remain safe for many users: FTS works with no setup; local semantic search is an explicit enhancement through Ollama; Jina remains available as an optional cloud provider. Do not add sqlite-vec, ONNX/gte, model cache management, or reranker behavior in this first pass.

## Captured Requirements and Decisions

- User has already installed Ollama and pulled `qwen3-embedding:0.6b`; local `ollama list` shows `qwen3-embedding:0.6b` at 639 MB.
- Local `/api/embed` was smoke-tested successfully against `http://localhost:11434/api/embed`.
- Product direction: default recommendation is Ollama + `qwen3-embedding:0.6b`; ONNX/gte is a future no-daemon fallback; sqlite-vec is a future performance backend, not a first-pass requirement.
- Existing architecture already has `EmbeddingProvider`, `EmbeddingRuntime`, `EmbeddingJob`, `DatabaseEmbeddingIndex`, `SearchService`, and RRF hybrid fusion.

## Completion Criteria

- Add an `OllamaEmbedder` that implements the existing `EmbeddingProvider` interface and calls Ollama `/api/embed` with batch input.
- Extend provider selection so local Ollama can be chosen from environment/config without removing the existing Jina behavior.
- `doctor` / embedding runtime status clearly reports provider, model, dimensions, and setup action for Ollama when unavailable.
- `codetrap embed` stores Ollama embeddings with provider/model/dimensions metadata, and freshness checks work across provider/model changes.
- `codetrap search "<query>" --mode semantic|hybrid` uses the locally generated Ollama embeddings and still falls back gracefully when the provider is unavailable.
- Add focused tests for provider selection, Ollama response parsing via mocked fetch, runtime status/setup actions, and semantic/hybrid behavior with provider metadata.
- Update README/docs that currently describe Jina-only embedding setup.

## Verification Plan

- Run `bun test src/tests`.
- Run `bunx tsc --noEmit`.
- Smoke-test locally with:
  - `ollama list`
  - `curl http://localhost:11434/api/embed -d '{"model":"qwen3-embedding:0.6b","input":"Bun sqlite extension load failed"}'`
  - `bun run src/index.ts doctor`
  - `bun run src/index.ts embed --scope project`
  - `bun run src/index.ts search "Bun sqlite extension load failed" --mode hybrid --json`
- If live smoke tests cannot be run in the target environment, report that as residual risk and rely on mocked tests plus local provider status checks.

## Starting Context

- Repository/workspace: `/Users/superstorm/Documents/Code/windsurf/codetrap`
- Main implementation files:
  - `src/lib/embedder.ts`
  - `src/lib/embedding-runtime.ts`
  - `src/lib/embedding-job.ts`
  - `src/lib/embedding-index.ts`
  - `src/lib/search-service.ts`
  - `src/lib/doctor.ts`
  - `src/lib/config.ts`
  - `src/commands/workflow.ts`
- Existing tests to extend:
  - `src/tests/embedding-runtime.test.ts`
  - `src/tests/search-semantic.test.ts`
  - `src/tests/embed-output.test.ts`
  - `src/tests/search-eval.test.ts`

## Scope

In scope:

- Ollama provider implementation and provider selection.
- Configuration/environment support for provider, endpoint, model, and dimensions.
- Runtime status, setup action, and docs for Ollama.
- Tests and docs for the new local provider path.

Out of scope:

- sqlite-vec or other vector index extensions.
- ONNX/gte, model cache management, or bundled model downloads.
- Reranker support.
- Database schema changes unless a small metadata-compatible migration is proven necessary.
- Replacing Jina; Jina should continue to work for users who configure it.

## Constraints

- Keep canonical embedding provider selection and setup guidance in `src/lib/embedding-runtime.ts`.
- Keep search retrieval in `SearchService`; keep ranking/fusion behavior in `src/lib/search-policy.ts`.
- Keep raw SQL and embedding storage operations in `src/db/embedding-queries.ts` / `src/lib/embedding-index.ts`.
- Do not make Ollama a hard dependency for FTS-only codetrap usage.
- Do not default to `qwen3-embedding:latest`; use `qwen3-embedding:0.6b`.
- Default Ollama endpoint should be localhost-only, e.g. `http://127.0.0.1:11434`.

## Allowed Tools and Environment

- Local shell commands, Bun tests, TypeScript type-checking, and local Ollama HTTP calls are allowed.
- Network access is allowed only for documentation lookup if needed; implementation should not require cloud services.
- No production deployment or external account access is needed.

## Safety and Permissions

- Do not print secrets or `.env` contents.
- Do not delete existing embeddings or user traps except through normal tested overwrite/freshness behavior.
- Ask before introducing new npm dependencies, native extensions, schema migrations, or destructive cleanup commands.

## Forbidden Shortcuts

- Do not fake semantic search by silently using FTS while reporting Ollama as active.
- Do not hard-code user-specific paths or assume Ollama is always running.
- Do not weaken freshness checks by ignoring provider/model/dimensions/passage version.
- Do not introduce sqlite-vec or ONNX/gte in this first implementation to make the scope look more complete.
- Do not remove Jina support.

## Progress Reporting

- Report after baseline inspection, after provider implementation, after CLI/status integration, after docs updates, and after verification.
- If the implementation touches more files than expected or needs a schema migration/new dependency, pause and explain the tradeoff before proceeding.

## Rollback, Cutover, and Rehearsal

- Applies to local configuration and local embeddings only; no production cutover.
- Rollback should be possible by unsetting the Ollama provider config/env and continuing with FTS or Jina.
- If provider/model metadata changes make old embeddings stale, prefer explicit reindex guidance over automatic destructive deletion.

## Final Review and Handoff

Before marking the goal complete, Codex must:

- Run the Verification Plan and include results.
- Review the diff for accidental unrelated changes.
- Update relevant documentation and CLI help/setup text.
- Summarize implementation choices, limitations, and the follow-up path for sqlite-vec and ONNX/gte.

## Open Questions and Default Assumptions

- Question: Should provider choice come from config file, env vars, or both?
  Default assumption: support both, with CLI/config-style behavior taking precedence where the existing config system allows it; use env vars for quick local setup.
- Question: Should `codetrap embeddings setup` be added now?
  Default assumption: no new command in the first pass unless the existing CLI structure makes it very small; update `doctor` setup actions and docs first.
- Question: Should embeddings be generated for project and global scopes by default?
  Default assumption: preserve existing `codetrap embed` scope behavior.
