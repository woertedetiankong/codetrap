# Task Brief: Local Hugging Face Embeddings

> Created: 2026-09-02
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Let users run semantic and hybrid search without installing Ollama by choosing
between a default balanced local Hugging Face model and a larger high-quality
Qwen3 model, while preserving the existing Ollama and Jina providers.

## Success Criteria

- CLI and Web users can see the two built-in local model choices, select either
  one, and switch profiles without losing previously stored embeddings.
- The default choice uses `jinaai/jina-embeddings-v2-base-zh` q8 and the
  high-quality choice uses `onnx-community/Qwen3-Embedding-0.6B-ONNX` q8.
- Selecting a local model never requires Ollama or starts a download; the first
  explicit reindex downloads into a Codetrap-owned cache and later use can run
  from that cache.
- Each model applies its required pooling, normalization, and query/passage
  formatting rather than sharing Qwen-specific preprocessing accidentally.
- Existing FTS fallback, Ollama, Jina, multi-profile freshness, diagnostics,
  CLI JSON, and Web reindex behavior remain compatible.
- Configuration round trips, provider tests, CLI/Web tests, typecheck, the host
  compiled binary, release builds, and an OpenCLI model-switch journey pass.

## Scope

In scope:

- A model registry and local Hugging Face/ONNX embedding adapter.
- Model cache ownership, status, selection, first-use download, and offline
  reuse behavior.
- Config, CLI, Web API/UI, health/status, tests, installation docs, and README.
- Release/build validation for the native ONNX runtime dependency.

Out of scope:

- Removing Ollama or Jina compatibility.
- Changing the embedding database schema or automatically deleting old model
  profiles.
- Adding BGE-M3 sparse/ColBERT storage, a reranker, GPU-specific tuning, or
  claiming a quality winner before Codetrap-specific controlled evaluation.
- Publishing, tagging, installing globally, or changing the package version.

## Constraints

- Model download must be an explicit consequence of reindexing a local profile;
  selection, FTS, pre-reindex hybrid/semantic search, and opportunistic add/edit
  embedding must not download a model.
- Model files and query/trap text remain local after the initial Hugging Face
  download.
- The cache must not live under a project checkout or `node_modules`; use a
  stable directory below the Codetrap user home.
- Web interactions must be verified by observable DOM/API/profile
  postconditions, not only by a successful click envelope.
- The current dirty worktree contains user changes. Preserve unrelated edits
  and patch only the embedding slice and its documentation.

## Expected Knowledge Updates

- Rewrite the embedding setup and provider reference in `README.md` and
  `docs/installation.md`.
- Update the parent roadmap status dashboard and closed decisions.
- Task index: update expected because this is a cross-module milestone.
- Wiki: not created; the repository has no hand-maintained wiki and durable
  operator knowledge belongs in README/installation docs.
