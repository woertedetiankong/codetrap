# Implementation Log: Local Hugging Face Embeddings

### 2026-09-02 — Runtime and profile identity

Decision:

- Add one in-process Hugging Face provider backed by a small built-in model
  registry. Persist the selected built-in model in normal embedding settings
  and include its q8 variant in the runtime model identity so stored profiles
  cannot be confused with a future full-precision variant.
- Load the inference dependency lazily and keep its cache below the Codetrap
  user home. FTS-only commands must neither initialize ONNX nor contact the
  Hugging Face Hub.
- Keep model-specific query formatting and pooling in registry entries: mean
  pooling for Jina and Qwen's instruction plus last-token pooling for Qwen3.

Why:

- A registry gives CLI and Web the same two reviewed choices without accepting
  arbitrary remote model code or silently guessing an incompatible pooling
  strategy.
- Lazy initialization preserves the current lightweight FTS path and makes the
  first download an observable consequence of local semantic reindexing.
- A variant-bearing profile identity preserves old embeddings safely when a
  user switches models and leaves room for later quantization choices.

Risk to prove before completion:

- `@huggingface/transformers` brings a native ONNX runtime. The host compiled
  binary and all release targets must be built before this design is treated as
  shippable; a typecheck or mocked provider test is not sufficient evidence.

### 2026-09-02 — Resumable downloads and standalone WASM runtime

Observed:

- A real default-model load downloaded the small tokenizer/config files but a
  single 162 MB Bun fetch timed out before the ONNX weight reached the cache.
- A Bun-compiled executable could bundle the Transformers.js node artifact but
  could not run its native `sharp`/ONNX addons as a self-contained executable.

Decision:

- Download the reviewed ONNX weight in validated 8 MB HTTP ranges, retry each
  range, preserve a `.part` file, and rename only after the exact reviewed byte
  count is present.
- Keep the native node backend for source/npm execution. For standalone builds,
  resolve Transformers.js to its web artifact and select ONNX Runtime WASM with
  a Codetrap filesystem-backed Cache API for model metadata and runtime assets.

Evidence:

- The retried real download completed to 100% and returned a normalized
  `[1, 768]` tensor from `jinaai/jina-embeddings-v2-base-zh` q8.
- The larger `onnx-community/Qwen3-Embedding-0.6B-ONNX` q8 download also
  completed through the production adapter and returned a 1024-dimensional
  query vector with its instruction and last-token pooling path.
- A Windows standalone smoke using the production adapter and only the local
  cache returned a 768-dimensional vector without `sharp`, DLLs, or
  `node_modules` beside the executable.
- The normal Bun target downloader repeatedly failed to extract its downloaded
  cross-runtime on this machine. Supplying the matching official Bun 1.3.14
  executables through the supported `executablePath` built all five release
  targets successfully, isolating the failure to Bun's downloader/cache rather
  than the Codetrap bundle.

### 2026-09-02 - Shared-download ownership and rendered switching proof

Decision:

- Serialize downloads of one reviewed ONNX weight with an owner-aware lock.
  A waiter reuses the completed file; abandoned-lock recovery checks owner
  process liveness and elects one reclaimer atomically instead of stealing by
  age alone.
- Keep selection and downloading separate. CLI/Web save only `default` or
  `quality`; reindex performs the first ranged download.

Evidence:

- A concurrent downloader test made one network request for two callers and
  both received the same exact completed file.
- In an isolated OpenCLI session, saving `quality` returned HTTP 200 with the
  Qwen3 q8 1024-dimensional profile. Saving `default` returned HTTP 200 with
  the Jina q8 768-dimensional profile, and the temporary config matched both
  transitions.
- The repository-wide run reached 520 pass and one intentional skip; three
  unrelated fixed-five-second tests timed out under aggregate load. Their two
  files passed 28/28 immediately when rerun in isolation.

### 2026-09-02 - Independent-review integrity hardening

Decision:

- Pin each built-in model to an immutable Hub commit and published LFS SHA-256.
  Store its weight below a revision-specific cache path, require an exact
  `Content-Range`, hash the completed file before atomic promotion, and retry
  one corrupt resumable download from byte zero.
- Bind the ready marker to repository, revision, digest, dimensions, exact
  weight size, and mtime. A stale or incomplete marker is not shown as cached.
- Convert an unsupported configured Hugging Face model into repair guidance so
  CLI and Web selection can self-heal it; reject an unsupported Web model with
  HTTP 400.
- Give custom-cache partials unique names and tolerate a concurrent atomic
  publish winner. Memoize standalone Transformers initialization so the
  temporary runtime-detection override cannot race.
- Embed the matching ONNX Runtime WASM binary in standalone executables and use
  the JS factory already bundled by Transformers.js. Supplying only
  `wasmBinary` avoids both jsDelivr and Bun's invalid blob-to-file import path.

Evidence:

- Regression tests cover same-size corrupt weights, corrupt resumable partials,
  incorrect range totals, serialized downloads, revision-isolated cache keys,
  concurrent cache writes, unsupported config recovery, and Web HTTP 400.
- Fresh Windows standalone CLI and MCP binaries compiled. The CLI executable
  reindexed the same trap with both cached pinned artifacts, producing separate
  768-dimensional default and 1024-dimensional quality profiles without a
  runtime CDN or Ollama.
- Repository validation completed with 533 pass, one intentional browser skip,
  zero failures, clean typecheck, and no whitespace errors.

### 2026-09-02 - Explicit local-model download boundary

Decision:

- Treat the reviewed ready marker as the gate for automatic Hugging Face use.
  Selecting a model records intent but does not initialize Transformers.js or
  create the model cache.
- Search asks for a ready provider. Before the first explicit reindex, hybrid
  maps the readiness error to its existing FTS fallback and
  `semantic_unavailable` diagnostic; semantic returns the actionable reindex
  error directly.
- Opportunistic embedding after add/edit quietly skips an uncached local model.
  Batch reindex deliberately keeps the unrestricted provider path and is the
  only operation allowed to initialize or download the model.

Evidence:

- A repository regression test observed zero pipeline initializations across
  hybrid, semantic, and opportunistic embedding, then observed one when the
  same repository ran explicit reindex.
- A CLI regression selected an uncached model, added a trap, ran hybrid and
  semantic search, and verified no Hugging Face cache directory was created.
- An isolated OpenCLI read of `#/embeddings` rendered the selected default
  profile, missing-vector count, explicit reindex guidance and controls after a
  successful embeddings API request; no layout change was required.
- Focused validation passed 38/38; typecheck passed; repository validation
  completed with 537 pass, one intentional browser skip, and zero failures.
