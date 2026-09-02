---
title: Handoff 2026-09-02 - Local Hugging Face embeddings
status: Complete
updated: 2026-09-02
---

# Handoff

## Summary

Codetrap can run semantic/hybrid retrieval in-process without Ollama. Users can
select and switch between a balanced Jina q8 model and the larger
Qwen3-Embedding-0.6B q8 model from CLI or Web; Ollama and Jina cloud remain
compatible options.

## Current State

The feature, independent-review hardening, and explicit-download follow-up are
complete. Selecting an uncached Hugging Face model is inert: search and
opportunistic add/edit embedding cannot initialize it, and only an explicit
reindex may download the model.

## Git And Persistent State

- Branch: `main` at `9dafdfb`; this slice is uncommitted alongside pre-existing
  unrelated user changes in the dirty worktree.
- Persistent state: no schema migration, package version change, publish,
  global install, or user embedding-config change occurred. The OpenCLI evidence
  image is [embeddings-model-switch.png](embeddings-model-switch.png).

## Key Decisions

- `default` is `jinaai/jina-embeddings-v2-base-zh` q8 (768d, about 162 MB);
  `quality` is `onnx-community/Qwen3-Embedding-0.6B-ONNX` q8 (1024d, about 614 MB).
- Source/npm execution uses native ONNX; compiled standalone binaries use ONNX
  Runtime WASM and a filesystem-backed cache.
- Downloads use pinned Hub revisions and published SHA-256 values. They are
  ranged, retryable, resumable, exact-range and checksum verified, and
  serialized per weight with live-owner-aware abandoned-lock recovery.
- Standalone binaries embed the matching ONNX Runtime WASM binary and use the
  factory inside Transformers.js; first inference does not fetch jsDelivr.
- Unsupported Hugging Face config degrades to explicit repair guidance, and a
  valid CLI/Web selection repairs it without manual file editing.
- An uncached selected model is never initialized by add/edit or search. Hybrid
  falls back to FTS with `semantic_unavailable`; semantic search points to an
  explicit project/global reindex, which remains the only download entry point.
- Model identity includes the q8 variant, so switching preserves prior profiles.

## Changed Surfaces

- `src/lib/huggingface-*.ts` and `local-embedding-models.ts`: registry, runtime,
  download/cache ownership, model-specific formatting and pooling.
- `embedding-runtime.ts`, `search-service.ts`, and `repository.ts`: cache-ready
  gating for query and opportunistic writes while leaving explicit reindex able
  to initialize the selected provider.
- CLI/config/store/Web API: provider selection, model listing, status and reindex.
- Web console: two model cards, cache/download state, save and switching flow.
- Standalone/release scripts: portable Transformers.js WASM aliasing.
- README and installation guide: no-Ollama workflow and privacy/cache behavior.

## Cross-Module References

- Depends on: [Phase 1 closeout](../2026-08-08-phase1-closeout/handoff.md) -
  profile-aware embedding storage and semantic/hybrid retrieval.
- Referenced by: [installation guide](../../installation.md) and
  [README](../../../README.md) - operator setup and model-switch contract.

## Red Lines And Gotchas

- Do not label either model a Codetrap quality winner without a controlled
  retrieval evaluation on representative Chinese/English traps.
- Do not delete old embedding profiles during a switch; reindex writes the
  selected profile and profile freshness remains explicit.
- Standard `bun run build:release` hit a Bun 1.3.14 cross-runtime extraction
  failure on this host. All five targets compiled when the same official
  runtimes were passed through supported `executablePath`; treat this as a Bun
  downloader/cache issue unless it reproduces after a Bun fix.

## Docs And Wiki

- Rewritten: [README](../../../README.md), [installation guide](../../installation.md),
  [parent roadmap](../../agent-experience-compiler-roadmap.md), and task index.
- No wiki was created because the repository has no hand-maintained wiki.

## Validation

- Real production adapter: default returned 768 normalized values; quality
  returned 1024 values with Qwen query instruction and last-token pooling.
- Compiled Windows production adapter: cached default inference returned 768
  values through WASM without sidecar DLLs, `sharp`, or `node_modules`.
- Cross-target compile: Darwin arm64/x64, Linux arm64/x64, and Windows x64 built.
- `bun run typecheck`: pass. Focused local-model/config/CLI/Web suite: pass.
- `bun test`: 537 pass, 1 intentional browser skip, 0 fail.
- CLI regression: selecting an uncached local model followed by add, hybrid,
  and semantic search created no model cache; hybrid returned FTS plus the
  reindex diagnostic, semantic returned the structured reindex error, and the
  unit boundary confirmed explicit reindex still initializes the provider.
- Fresh Windows CLI and MCP standalone artifacts built under independent
  verification names because the normal `dist/codetrap.exe` was in use.
- The fresh CLI executable reindexed one trap with both pinned local models;
  model status reported both caches ready and profile storage reported 768d and
  1024d profiles.
- `bun install --frozen-lockfile`, Windows standalone model listing, and
  `npm pack --dry-run --json`: pass.
- OpenCLI: URL/DOM, two HTTP 200 saves, returned profile identities, temporary
  config bytes, and a 1600x900 screenshot verified; both browser servers closed.
- Explicit-download follow-up OpenCLI check: the isolated `#/embeddings` route
  rendered the selected default 768d profile, reported 0/21 fresh, retained the
  project/global reindex controls and guidance, and completed its embeddings API
  request with HTTP 200; the validation server and ephemeral tab were closed.

## Restart Verify

```bash
bun test src/tests/huggingface-embedder.test.ts src/tests/huggingface-file-cache.test.ts src/tests/huggingface-model-download.test.ts  # expected: 10 pass; mismatch means local inference/cache/download behavior regressed
bun test src/tests/search-semantic.test.ts src/tests/cli-json.test.ts  # expected: 25 pass; mismatch means explicit-download or CLI fallback behavior regressed
bun run typecheck  # expected: exit 0; mismatch means a shared config/runtime/Web contract drifted
bun run src/index.ts embeddings models --json  # expected: default 768d and quality 1024d; mismatch means registry or CLI presentation drifted
```

## Next Steps

1. Optional: run a representative Codetrap retrieval evaluation before making
   quality claims or changing the default.
2. Release/publish only as a separately authorized operation; version remains
   `0.1.9`.

## Implementation Log

- [implementation-log.md](implementation-log.md) records the runtime,
  resumable-download, standalone-WASM, and validation decisions.
