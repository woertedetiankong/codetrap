# Goal Brief: Web Embeddings Settings

> Prepared for Codex `/goal` mode.
> Created: 2026-06-06
> Source conversation: same thread
> Owner: superstorm

## Goal Objective

Add a product-ready Web Embeddings settings experience for codetrap that lets users inspect semantic search health, switch the active embedding provider/profile, and reindex project/global embeddings without using the CLI.

## /goal Command

```text
/goal Add a Web Embeddings settings experience for codetrap that exposes provider/profile status, supports Ollama/Jina switching, and lets users reindex project/global embeddings from the web console. Use this Goal Brief as the authoritative task contract. Continue working until the Completion Criteria are satisfied, preserve the Constraints and Forbidden Shortcuts, report progress as requested, and do not mark the goal complete until the Final Review and Handoff requirements are done.
```

## Desired Outcome

The codetrap web console should give users a clear, non-command-line path for semantic search setup. A user should be able to open `codetrap web`, see whether semantic/hybrid search is ready, understand which embedding profile is active, switch between Ollama and Jina, and trigger reindexing for project or global traps.

This should be a Phase 1.5 implementation: more complete than a minimal status display, but not a full settings center, background job system, secret manager, or profile deletion tool.

## Captured Requirements and Decisions

- User wants a product-friendly experience because many users may use codetrap.
- Current CLI support already exists after recent commits:
  - `8946937 Add local Ollama embedding provider`
  - `2f826e1 Add multi-profile embedding storage`
- Current multi-profile behavior must be preserved: switching providers does not overwrite previous embeddings; each trap can have multiple profile-specific embeddings.
- Recommended scope is Phase 1.5:
  - Build Web Embeddings settings/status UI.
  - Show current provider, model, dimensions, `profile_id`, and availability.
  - Show project/global `fresh`, `stale`, `missing`, and stored profiles.
  - Support `Use Ollama`.
  - Support `Use Jina`.
  - Support `Reindex project`.
  - Support `Reindex global`.
  - Include Ollama advanced fields: endpoint, model, dimensions.
- Rejected for this goal:
  - Profile deletion/cleanup.
  - Saving Jina API keys in the web UI.
  - Background reindex task queue and progress streaming.
  - Automatic Ollama model list/download.
  - ONNX/gte provider.
  - sqlite-vec backend.
  - Multi-model quality comparison.
- Product wording to preserve:
  - Use “Embeddings” or “Semantic Search” rather than a vague “model switch”.
  - Explain that switching provider changes the active profile, and reindexing is required before semantic/hybrid search can use that profile.

## Completion Criteria

- Web console has an Embeddings/Semantic Search view or panel reachable from the existing shell navigation without disrupting Review, Library, or Insights workflows.
- The UI shows current runtime status:
  - provider
  - model
  - dimensions
  - `profile_id`
  - available/unavailable state
  - setup or next action when unavailable
- The UI shows project and global embedding state:
  - total
  - fresh
  - stale
  - missing
  - stored profiles with provider/model/dimensions/profile id and embedding counts.
- Users can select Ollama or Jina from the web UI.
- Ollama selection supports endpoint/model/dimensions, defaulting to `http://127.0.0.1:11434`, `qwen3-embedding:0.6b`, and `1024`.
- Jina selection does not request or persist an API key. If `JINA_API_KEY` is not available, the UI reports the provider as unavailable and shows an environment-variable next action.
- Users can trigger reindexing for project and global scope.
- After provider switch or reindex, the UI refreshes status so users can see whether the active profile is fresh, stale, or missing.
- Existing CLI commands continue working:
  - `codetrap embeddings status`
  - `codetrap embeddings list`
  - `codetrap embeddings use ollama|jina`
  - `codetrap embeddings reindex`
  - `codetrap embed`
- Existing web session/candidate/library behavior remains unchanged.
- Documentation is updated to mention the web Embeddings settings path.

## Verification Plan

- Run focused tests first:
  - `bun test src/tests/web-console.test.ts src/tests/web-client-text.test.ts src/tests/web-client-review.test.ts`
  - `bun test src/tests/cli-json.test.ts src/tests/search-semantic.test.ts src/tests/embedding-profile-storage.test.ts`
- Run full verification before completion:
  - `bun test src/tests`
  - `bunx tsc --noEmit --pretty false`
  - `git diff --check`
- Add or update tests for:
  - Web API status endpoint returns embedding runtime/profile/status data.
  - Web API provider switch writes config and preserves existing search config.
  - Web API reindex calls the existing embedding pipeline and returns generated/skipped/batch counts.
  - Web text dictionaries stay aligned for English and Chinese.
  - Existing web candidate/library tests still pass.
- Manual/browser checks:
  - Start `codetrap web` against a temporary or local test project.
  - Use the in-app Browser or equivalent browser automation to inspect the Embeddings UI.
  - Verify desktop layout does not overlap or hide controls.
  - Verify a narrow/mobile viewport remains usable.
  - Verify switch-to-Ollama flow shows the active profile and reindex action.
  - If local Ollama with `qwen3-embedding:0.6b` is available, run one live reindex smoke and confirm hybrid search can use semantic candidates.
- Required evidence in final handoff:
  - Test command outputs summarized.
  - Browser/manual verification summary.
  - Any residual limitations, especially if live Ollama was unavailable.

## Starting Context

- Repository/workspace: `/Users/superstorm/Documents/Code/windsurf/codetrap`
- Current branch: `main`
- Recent relevant commits:
  - `8946937 Add local Ollama embedding provider`
  - `2f826e1 Add multi-profile embedding storage`
- Current web backend entry point: `src/web/server.ts`
- Current web UI files:
  - `src/web/static.ts`
  - `src/web/client-script.ts`
  - `src/web/client-shell.ts`
  - `src/web/client-review.ts`
  - `src/web/client-text.ts`
- Current embedding management logic:
  - `src/lib/store.ts`
  - `src/lib/embedding-management.ts`
  - `src/lib/embedding-runtime.ts`
  - `src/lib/embedding-health.ts`
  - `src/lib/config.ts`
  - `src/commands/workflow.ts`
- Current web server constructs a new `TrapStore(projectRoot, undefined, home)` per API operation, so config changes written to `~/.codetrap/config.json` should be visible to later requests.
- The worktree may contain unrelated dirty changes from other work, including search-policy sweep files and docs/goal cleanup. Do not revert, overwrite, or accidentally stage unrelated changes.

## Scope

In scope:

- Add Web API endpoints for embedding status, provider configuration, and reindexing.
- Add UI surface for Embeddings/Semantic Search settings.
- Add localized English/Chinese UI text.
- Add tests for backend API, UI text alignment, and relevant client behavior.
- Update README/docs to mention the web Embeddings flow.
- Reuse existing `TrapStore.embeddingStatus`, `TrapStore.configureEmbeddings`, and `TrapStore.ensureEmbeddings` where possible.

Out of scope:

- Saving Jina API keys or other secrets in config or browser storage.
- Deleting or pruning embedding profiles.
- Background job queue, progress streaming, or cancellation.
- Installing/pulling Ollama models from the web UI.
- ONNX/gte provider.
- sqlite-vec backend.
- Large redesign of the whole web console.
- Changing search ranking, fusion, rerank, or semantic quality policy.
- Changing database schema unless a small additive change is clearly necessary.

## Constraints

- Keep CLI and MCP adapters thin; shared behavior should stay in `TrapStore`/lib modules.
- Keep web server as a thin adapter over shared operations.
- Preserve the existing web console style: dense, utility-focused, not a marketing page.
- Do not introduce a frontend framework unless the existing project already uses one.
- Avoid nested cards and overly decorative UI.
- Text must not overlap or overflow on desktop or narrow/mobile viewports.
- Use clear status states rather than hiding unavailable-provider failures.
- Reindex may be synchronous for this version; if it blocks for large stores, document the limitation and leave background job support as future work.
- Do not weaken or remove existing tests to make the new UI pass.

## Allowed Tools and Environment

- Local commands:
  - `bun test src/tests`
  - `bunx tsc --noEmit --pretty false`
  - `git diff --check`
  - `codetrap embeddings status/list/use/reindex`
  - `codetrap web`
- Browser:
  - Use the Codex in-app Browser or browser automation for local web verification.
- External services:
  - Local Ollama may be used if already installed and available.
  - Do not require network calls to Jina for tests.
- Data:
  - Use temporary projects/homes for tests where possible.
  - Existing local config may be inspected but should not be silently overwritten during tests.

## Safety and Permissions

- Do not print or persist secrets.
- Do not add a Jina API key input that saves keys to config, localStorage, or the repo.
- Do not delete embedding profiles or trap data.
- Do not revert unrelated dirty worktree changes.
- Ask before pushing, publishing, deploying, or making destructive git operations.
- For tests, use temporary HOME/project directories so the user’s real `~/.codetrap/config.json` is not mutated.

## Forbidden Shortcuts

- Do not build only backend endpoints without a discoverable web UI.
- Do not add only a provider toggle without status, next action, and reindex feedback.
- Do not fake semantic readiness by showing “ready” when the active profile is missing or stale.
- Do not overwrite old Jina embeddings when switching to Ollama.
- Do not save API keys in plain config/browser storage.
- Do not hide failures from Ollama/Jina availability checks.
- Do not skip responsive/browser verification after changing the web UI.

## Progress Reporting

- Report progress after these milestones:
  - Web API endpoint design is confirmed.
  - Backend endpoints/tests are implemented.
  - UI view/panel is implemented.
  - Verification starts.
  - Final diff review is complete.
- If the work takes multiple turns, keep updates concise and mention whether the current risk is backend behavior, UI state, or verification.
- Commit only when the user explicitly asks, or at the end if the active task has clearly requested committing. Keep unrelated dirty changes out of any commit.

## Rollback, Cutover, and Rehearsal

- Applies to config changes and embedding reindexing only.
- No production cutover is expected.
- Use local/temp config in tests.
- Provider switching writes user config; implementation must preserve unrelated config sections such as `search`.
- Reindexing should create/update embeddings for the selected profile only and must not delete existing profiles.
- Rollback for code changes is normal git revert of the feature commit.
- Rollback for a user-selected provider is running `codetrap embeddings use ollama` or `codetrap embeddings use jina` again, then reindexing if needed.

## Final Review and Handoff

Before marking the goal complete, Codex must:

- Run the Verification Plan and report results.
- Inspect `git diff --stat` and `git diff --name-only` for accidental unrelated changes.
- Confirm no secrets or real API keys were written.
- Confirm existing CLI embeddings commands still work.
- Confirm web session/candidate/library behavior still passes tests.
- Update README/docs or explain why docs were not changed.
- Summarize changed files, user-visible behavior, verification, and residual risks.

## Open Questions and Default Assumptions

- Question: Should the UI label be “Embeddings” or “Semantic Search”?
  Default assumption: Use “Embeddings” in developer-facing navigation and include “Semantic Search” in helper/status copy.

- Question: Should reindex run synchronously or as a background job?
  Default assumption: Use synchronous reindex for this goal, with loading state and clear completion result. Leave background jobs for a later goal.

- Question: Should the UI let users customize Jina model?
  Default assumption: No. Jina remains the built-in `jina-embeddings-v5-text-small` provider path; only Ollama gets endpoint/model/dimensions fields in this goal.

- Question: Should web settings modify project-local config or user-global config?
  Default assumption: Continue using the existing `~/.codetrap/config.json` behavior from `TrapStore.configureEmbeddings`, and clearly show that provider selection is global user config.
