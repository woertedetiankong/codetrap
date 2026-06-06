# Implementation Log

## Task

Implement the Web Embeddings settings experience from `goal-brief-web-embeddings-settings.md`.

## Assumptions

- The web console should stay framework-free and reuse the existing three-pane shell.
- Provider switching should write the existing codetrap config shape and preserve unrelated config, especially `search`.
- Reindexing can be synchronous for this phase and should reuse `TrapStore.ensureEmbeddings`.
- Jina API keys must stay out of the web UI.

## Log

### 2026-06-06

- Preflight codetrap search for `web embeddings settings provider reindex semantic search` returned no results. This looks like a new web-product surface rather than a repeated implementation pitfall, so I am proceeding with source/tests as the guide and logging the dogfood observation as `no_relevant_trap`.
- API design will use thin web endpoints over existing shared operations: `GET /api/embeddings`, `POST /api/embeddings/use`, and `POST /api/embeddings/reindex`. After provider switching, the endpoint will create a fresh `TrapStore` before returning status so the newly written config is reflected immediately.
- Jina-without-key status previously lost provider/model/profile metadata because no adapter was constructed. I changed `EmbeddingRuntime` to retain configured metadata while keeping `available=false` and `requireProvider()` behavior unchanged, so Web and CLI status can show the active Jina profile plus the `JINA_API_KEY` next action.
- Focused backend validation passed with `bun test src/tests/web-console.test.ts src/tests/embedding-runtime.test.ts` and `bun test src/tests/cli-json.test.ts`. The web reindex API test uses a fake local Ollama server to avoid network calls and user config mutation.
- The Embeddings UI is an additional main shell view rather than a modal/settings center. Queue pane owns active provider controls and reindex actions; detail pane owns runtime/profile and project/global stored-profile breakdown. This keeps the existing Review/Library/Insights workflows intact while making Embeddings reachable from the same navigation.
- Frontend-focused validation passed with `bun test src/tests/web-console.test.ts src/tests/web-client-text.test.ts src/tests/web-client-review.test.ts src/tests/embedding-runtime.test.ts` and `bunx tsc --noEmit --pretty false`.
- Browser verification caught that the fourth `Embeddings` nav item was clipped in the rail when the main view segmented control stayed one row. I changed the rail header to stack its actions and render the main nav as a 2x2 grid, then rechecked desktop and 390px mobile layouts.
- Manual browser smoke used an isolated temp project/home plus a fake local Ollama endpoint. Switching to Ollama through the UI, saving endpoint/model/dimensions, and reindexing project/global scopes updated the visible active profile and fresh counts from `0/1` to `1/1`; no horizontal overflow appeared at 390px.
- Local Ollama was available with `qwen3-embedding:0.6b`, so I ran a live isolated smoke: configured Ollama in a temp home, generated one project embedding, and confirmed hybrid search returned the trap with both `fts` and `semantic` sources.
