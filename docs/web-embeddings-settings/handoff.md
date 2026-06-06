# Handoff

## Summary

Implemented a Web Embeddings/Semantic Search settings view for codetrap. The web console now exposes embedding runtime health, active provider/profile metadata, project/global fresh-stale-missing counts, stored profile summaries, Ollama/Jina switching, and synchronous project/global reindex controls.

## Key Decisions

- Added a fourth main web view, `Embeddings`, instead of a modal or broad settings center.
- Kept web API routes thin over `TrapStore.embeddingStatus`, `TrapStore.configureEmbeddings`, and `TrapStore.ensureEmbeddings`.
- Jina provider selection does not accept or save API keys; the UI shows `JINA_API_KEY` environment guidance.
- `EmbeddingRuntime` now retains configured Jina provider/model/profile metadata even when no key is available, while keeping `available=false` and provider-required errors unchanged.
- Reindex remains synchronous for this phase.

## Files Changed

- `src/web/server.ts`: added `GET /api/embeddings`, `POST /api/embeddings/use`, and `POST /api/embeddings/reindex`.
- `src/web/client-script.ts`: added Embeddings view state, rendering, provider switch, and reindex interactions.
- `src/web/static.ts`: added Embeddings nav entry, settings/profile styles, and rail nav layout fix.
- `src/web/client-text.ts`: added English/Chinese strings for Embeddings UI.
- `src/lib/embedding-runtime.ts`: preserves configured Jina profile metadata without an adapter.
- `src/tests/web-console.test.ts`, `src/tests/web-client-text.test.ts`, `src/tests/embedding-runtime.test.ts`: added API/UI text/runtime coverage.
- `README.md`, `docs/installation.md`: documented the web Embeddings flow.
- `dogfood-log.md`: recorded the pre-edit codetrap search observation.
- `docs/handoff.md`: linked this task journal.
- `docs/web-embeddings-settings/implementation-log.md`: working implementation log.

## Validation

- `bun test src/tests/web-console.test.ts src/tests/embedding-runtime.test.ts`
- `bun test src/tests/cli-json.test.ts`
- `bun test src/tests/web-console.test.ts src/tests/web-client-text.test.ts src/tests/web-client-review.test.ts src/tests/embedding-runtime.test.ts`
- `bun test src/tests/cli-json.test.ts src/tests/search-semantic.test.ts src/tests/embedding-profile-storage.test.ts`
- `bun test src/tests`
- `bunx tsc --noEmit --pretty false`
- `bun run eval:dogfood -- report`
- `git diff --check`
- Browser desktop smoke in isolated temp project/home: Embeddings nav visible, provider switch to fake Ollama worked, project/global reindex changed counts to `1/1 fresh`.
- Browser mobile smoke at 390px: no horizontal overflow; nav, provider fields, and reindex buttons remained visible/usable.
- Live local Ollama smoke: real `qwen3-embedding:0.6b` generated one project embedding in an isolated temp project; hybrid search returned the trap with `fts` and `semantic` sources.

## Known Risks

- Reindex runs synchronously in the request path, so large stores may block the web UI until background job support exists.
- Existing worktree still contains unrelated dirty changes from other feature/doc work; stage this task by explicit path if committing.

## Follow-ups

- Consider background progress/cancel support for large reindex jobs.
- Consider exposing profile cleanup/deletion only after product scope is confirmed.
