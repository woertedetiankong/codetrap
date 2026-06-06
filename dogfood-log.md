# Dogfood Log

Raw observations from real codetrap use. Keep this lightweight: record every pre-edit search outcome here, then use `docs/dogfood-flywheel.md` to decide whether the observation should be promoted.

Judgments:

- `useful_hit`: A result prevented, changed, or confirmed the next action.
- `miss`: A relevant existing trap should have appeared but did not.
- `noisy_hit`: Results looked plausible but distracted from the task.
- `no_relevant_trap`: The memory bank had no applicable prior lesson.

Promotion lanes:

- `search_eval`: promote a representative search-quality case into `src/tests/fixtures/search-eval.json`.
- `trap_candidate`: draft a reusable lesson through `codetrap session capture --trap-markdown - --kind review --json`.
- `product_backlog`: turn product/workflow friction into roadmap or implementation planning.
- `docs_guidance`: update AGENTS, README, skills, or docs guidance.
- `no_promotion`: keep the observation as raw history only.

Legacy entries may use `Promote: no`; new entries should use `Promotion lane:`.

## Template

```md
## YYYY-MM-DD - short task name

Task:
Query:
Mode:

Top results:
1.
2.
3.

Judgment:
Action changed:
Promotion lane:
Promotion target:
Note:
```

## Observations

## 2026-06-06 - Web Embeddings settings

Task: Add a Web Embeddings settings experience with provider status, Ollama/Jina switching, and project/global reindex controls.
Query: web embeddings settings provider reindex semantic search
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promotion lane: product_backlog
Promotion target: Web Embeddings settings goal implementation.
Note: This is a new product surface built on existing embedding runtime/profile primitives, not a search-quality regression or reusable trap candidate.

## 2026-06-06 - Generic packaged AGENTS snippet

Task: Make the packaged `AGENTS.codetrap.md` snippet generic enough for users to paste into external project `AGENTS.md` files.
Query: AGENTS codetrap template dogfood eval generic path guidance
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - partially relevant to keeping `--path` guidance generic and not tied to one repository path.
2. #5 Set SQLite busy_timeout before lock-prone startup pragmas - unrelated to documentation/template guidance.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promotion lane: docs_guidance
Promotion target: Packaged AGENTS template, README, installation docs, and onboarding asset test.
Note: The search reinforced removing the codetrap-specific `src/db/repository.ts --module db` example from the copyable snippet and replacing it with generic `path/to/file --module module-name` guidance plus dogfood observation fields.

## 2026-06-06 - Search policy sweep tool

Task: Add a first-phase search policy sweep tool with fixture and live project modes.
Query: search eval live project ranking sweep config fixture cwd
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - relevant to live project cwd/scope handling and matching real project DB search results.
2. No second result.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promotion lane: no_promotion
Promotion target: none
Note: Applied the trap by keeping live mode cwd-driven and scope-aware, adding tests for real project DB resolution plus title fallback/id drift, then tightening the architecture so live eval uses `ScopedRepositoryContext` for project/global resolution. No new eval fixture promotion needed.

## 2026-06-06 - Root AGENTS alignment

Task: Align root `AGENTS.md` with the current packaged agent guidance, skills, candidate-review flow, and dogfood promotion lanes.
Query: AGENTS guidance relevance gate dogfood promotion lane candidate review
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promotion lane: docs_guidance
Promotion target: Root `AGENTS.md` and onboarding drift test now include the current relevance gate and dogfood promotion lanes.
Note: This is repo guidance alignment, not a search-quality regression or reusable implementation trap.

## 2026-06-06 - Web help and browser smoke polish

Task: Fix `codetrap web --help` so it shows usage instead of starting the server, and add a browser-level smoke test for the web review console.
Query: web help command browser smoke playwright review console
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promotion lane: docs_guidance
Promotion target: Keep web console first-run/review guidance honest after CLI help and browser smoke coverage land.
Note: This was a small CLI/Web QA polish task; no existing trap applied.

## 2026-06-06 - Agent first-run success polish

Task: Make codetrap release-ready for first AI-agent users by aligning packaged onboarding, plugin hooks, skills, and relevance-gate guidance.
Query: release first users onboarding install dogfood package local embedding usability
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promotion lane: product_backlog
Promotion target: Agent first-run release-ready polish implemented from the goal brief.
Note: This is product onboarding and packaged-guidance consistency work rather than a search-quality regression or reusable implementation trap.

## 2026-06-06 - Dogfood product flywheel spec

Task: Create a documentation-only dogfood product flywheel process for improving codetrap through internal usage observations.
Query: dogfood flywheel promotion eval trap candidate roadmap docs
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - search/list applicability internals, not relevant to this documentation-only process spec.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promotion lane: no_promotion
Promotion target: none
Note: Proceed with a process spec that keeps raw dogfood observations separate from search eval, trap candidates, product backlog, and docs guidance.

## 2026-06-03 - Knowledge sync after session capture

Task: Reconcile project docs, AGENTS guidance, handoff, and memory notes after session capture and embedding runtime changes.
Query: documentation sync agent memory docs stale
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - database/search internals, not relevant to docs sync.
2. #5 Set SQLite busy_timeout before lock-prone startup pragmas - database startup, not relevant to docs sync.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Proceeded with a direct docs/code audit; updated stale agent guidance and handoff material manually.

## 2026-06-03 - Session capture architecture deepening

Task: Refactor session capture candidate drafting and candidate document mutation responsibilities after architecture review.
Query: session capture candidate mutation session-store
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Proceeded with a local architecture read: capture draft normalization moved into `session-capture`, while candidate document transitions moved into a dedicated pure mutation module.

## 2026-06-03 - Session capture candidate inbox

Task: Add `codetrap session capture` so agent-drafted post-flight trap candidates go into the session inbox instead of directly into confirmed traps.
Query: session capture candidate inbox post-flight trap note close propose duplicate
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - relevant reminder while accepting capture `path_globs`, `module`, and `owner` fields.
2. No second result.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promote: no
Note: Normalize empty `module`/`owner` values to null in capture input, preserve path_globs as arrays, and keep regression coverage around candidate capture fields.

## 2026-06-02 - Web drag-collapse edge reveal

Task: Make the web console side panes feel Codex-like: drag to collapse at a threshold and hover the shell edge to reveal collapsed panes.
Query: web pane drag collapse edge hover reveal sidebar queue splitter
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Treat this as browser-only shell interaction behavior; keep web APIs and session/trap rendering untouched.

## 2026-06-02 - Web right queue collapse after pane swap

Task: Fix the right edge pane toggle after swapping the web console detail and queue panes.
Query: web right pane collapse queue detail swapped layout
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: The bug was stale shell UI semantics after the pane order changed: the right edge toggle still collapsed the detail pane instead of the rightmost queue pane.

## 2026-06-02 - Web middle/right pane swap

Task: Swap the web console middle queue pane and right detail pane positions.
Query: web layout middle right panel swap
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Treat this as a shell layout change only; keep web API, Trap Library filtering, and session review behavior unchanged.

## 2026-06-01 - Web edge pane toggles

Task: Move the side-pane show/hide controls to Codex-style outer shell edges.
Query: web sidebar toggle edge aligned codex style pane collapse button
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Treat this as a visual refinement of the existing collapse behavior; keep storage keys and API behavior unchanged.

## 2026-06-01 - Web right detail collapse

Task: Add a Codex-style show/hide control for the right detail pane.
Query: web right sidebar collapse detail pane hide show splitter localStorage
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Extend the existing pane controls with a separate detail-pane collapsed state; keep right-pane hiding desktop-only.

## 2026-06-01 - Web sidebar collapse

Task: Add a Codex-style show/hide sidebar toggle to the web console.
Query: web sidebar collapse hide show pane splitter localStorage
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Implement as local browser UI state next to the existing pane layout state; keep API behavior unchanged.

## 2026-06-01 - Web resizable panes

Task: Add Codex-style horizontal resizing to the three-column web console.
Query: web resizable grid splitter pointer drag localStorage
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Implement as local browser UI state only; keep the existing web API and framework-free shell unchanged.

## 2026-05-31 - Architecture deepening

Task: Deepen the web console UI module and add session maintenance operations.
Query: web console UI module locale library insights static.ts architecture refactor; session maintenance archive prune delete candidate cleanup index active recap
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - relevant only as a reminder to preserve module/owner filtering behavior while touching web trap filters.
2. #5 Set SQLite busy_timeout before lock-prone startup pragmas - not applicable; this work does not change SQLite connection startup.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promote: no
Note: Keep search/list applicability untouched except through existing web trap filter calls; focus session cleanup in `SessionOperations`/`SessionStore` rather than manual `.codetrap/sessions` edits.

## 2026-05-31 - Web locale toggle

Task: Add a Chinese/English language toggle to the web console.
Query: web language toggle chinese english i18n static ui text
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Implement as browser-only UI localization in `src/web/static.ts`; do not translate stored trap content or change CLI/MCP contracts.

## 2026-06-01 - Architecture deepening refactor

Task: Refactor Embedding runtime, Session review contract, and Web Console browser shell Modules after architecture review.
Query: embedding provider session review web console refactor
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: The check did not surface prior traps for this architecture-deepening pass; proceed with source, tests, and CONTEXT.md as the authoritative guides.

## 2026-06-04 - Candidate Review Visibility

Task: Surface pending session candidates through CLI, doctor, API, and Web Review without changing confirmed trap search.
Query: candidate review visibility pending session doctor web inbox
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: The gap was product visibility for pending candidate documents, not a repeated implementation pitfall. Keep this as a raw observation rather than a search regression fixture.

## 2026-06-04 - Web Review Client Model

Task: Deepen the Web Review client Module with TDD so pending-session selection and candidate queue behavior are tested outside the generated browser script.
Query: web review client candidate session pending selection test
Mode: hybrid

Top results:
1. #5 Set SQLite busy_timeout before lock-prone startup pragmas - not applicable to browser Review state.
2. #3 Applicability filters must normalize absolute paths and empty scope fields - not applicable to browser Review state.
3. No third result.

Judgment: noisy_hit
Action changed: no
Promote: no
Note: The results were plausible codetrap development traps but did not match the Web client Module seam. No fixture promotion.

## 2026-05-31 - Web Library follow-ups

Task: Add Review-to-Library trap navigation, Library sorting, and a standalone Insights view.
Query: web review library view trap sorting insights
Mode: hybrid

Top results:
1. #2 Legacy home-scoped project trap - partially applicable reminder to keep frontend requests centralized through the existing web `api()` helper.
2. #3 Applicability filters must normalize absolute paths and empty scope fields - relevant warning not to duplicate or weaken module/owner filtering while adding Library sorting and Insights aggregation.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promote: no
Note: Keep this iteration on top of the existing web API helper and returned trap JSON; defer backend search/pagination rather than adding a second filtering path.

## 2026-05-30 - Web Trap Library MVP

Task: Add a read-only web Trap Library view with filters, full trap details, and lightweight growth insight summaries.
Query: web trap library readonly list
Mode: hybrid

Top results:
1. #2 Legacy home-scoped project trap - partially applicable reminder to keep frontend requests centralized, though this repo uses the local `api()` helper rather than a named fetchWrapper.
2. #3 Applicability filters must normalize absolute paths and empty scope fields - relevant to `/api/traps` filter behavior and regression coverage for module/owner filters.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promote: no
Note: The search confirmed that API tests should cover module/owner filters and that new browser calls should use the existing request helper.

## 2026-05-30 - CLI UX next-action hints

Task: Improve agent-facing UX hints for doctor, embed, and dogfood eval report without changing core search semantics.
Query: doctor embed search json dogfood report ux next_action diagnostics
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - not applicable to CLI output hints.
2. No second result.
3. No third result.

Judgment: noisy_hit
Action changed: no
Promote: no
Note: The result was search-policy related but did not apply to output guidance, so this stays as a raw dogfood observation.

## 2026-05-30 - dogfood eval judgment support

Task: Add no_relevant_trap support, improve unknown goldTrapIds guidance, and create this dogfood log.
Query: dogfood eval record goldTrapIds fixture judgment
Mode: hybrid

Top results:
1. No results returned.
2. A second concurrent check for related terms hit `database is locked`.
3. Not applicable.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Keep future pre-edit checks serial when using the same SQLite-backed store.

## 2026-05-30 - SQLite startup lock fix

Task: Fix `database is locked` when concurrent agent pre-edit searches open the same SQLite database.
Query: sqlite database locked concurrent search busy_timeout
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - not applicable to connection startup locking.
2. No second result.
3. No third result.

Judgment: noisy_hit
Action changed: no
Promote: no
Note: The result was search-related but the fix belongs in `src/db/connection.ts`, not applicability filtering.

## 2026-06-05 - Markdown trap capture

Task: Add Markdown input for `codetrap session capture`.
Query: session capture markdown trap-json candidate note parsing
Mode: hybrid

Top results:
1. No results returned.
2. Follow-up query `empty module owner session capture path_globs command requests` returned #3 Applicability filters must normalize absolute paths and empty scope fields.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promote: no
Note: The first query had no direct capture-specific trap, but #3 is relevant to the planned empty `Module:` / `Owner:` Markdown behavior, so implementation will preserve null normalization and add regression coverage.

## 2026-06-05 - Candidate Review Workbench

Task: Improve Web Review candidate polish and triage after Markdown capture.
Query: web review candidate edit save accept reject session candidate
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: No existing project trap directly covered Web Review candidate editing. Keep the work routed through existing SessionOperations/session-review contracts and avoid changing confirmed trap search semantics.

## 2026-06-05 - Review Workbench Architecture TDD

Task: Deepen Web Review candidate draft request modeling and split CLI conflict next actions from the transport-neutral session review payload.
Query: web review candidate draft accept payload session review conflict cli next_actions transport neutral
Mode: hybrid

Top results:
1. #5 Set SQLite busy_timeout before lock-prone startup pragmas - database startup behavior, not applicable to Web Review or session review payload shape.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Proceed with TDD through Web Review and Session Review public Modules; no existing trap changes the design.

## 2026-06-05 - Neat-freak docs sync

Task: Reconcile project docs and agent guidance after Markdown capture, Candidate Review Workbench, and the Review architecture pass.
Query: docs sync web review session review conflict payload next_actions client-review
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: No project trap covered docs synchronization for module-boundary drift. Update current docs directly and keep historical logs intact where they describe older milestones.

## 2026-06-06 - Local Ollama embedding provider

Task: Add a local Ollama embedding provider for `qwen3-embedding:0.6b` while preserving existing Jina and SQLite BLOB exact-scan behavior.
Query: local ollama embedding provider qwen3 semantic hybrid
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: No existing trap covered local embedding provider integration. Keep the work scoped to `EmbeddingProvider` / `EmbeddingRuntime`, preserve provider/model/dimension freshness metadata, and do not introduce sqlite-vec or ONNX in this pass.

## 2026-06-06 - Multi-profile embedding storage

Task: Add multi-profile embedding storage and product-facing `codetrap embeddings` management commands.
Query: embedding profiles multiple provider storage switch embeddings command migration
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - only loosely related to repository/search storage behavior, not directly applicable to embedding profile schema or provider switching.
2. No second result.
3. No third result.

Judgment: noisy_hit
Action changed: no
Promote: no
Note: The returned trap was about path/module applicability filtering rather than embedding profile storage. Proceeded with a schema v6 migration, profile-aware freshness checks, and CLI management commands while leaving search applicability policy unchanged.

## 2026-06-06 - Single Plugin Skill Source

Task: Move the five root Codex skills into the codetrap-agent plugin bundle and remove the duplicate root `skills/` tree.
Query: skills plugin bundle distribution root skills drift parity documentation
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no_promotion
Note: No existing trap covered skill packaging source-of-truth drift. Proceed with the currently installed root skill content as the canonical version and make the plugin bundle the only packaged Codex skill source.
