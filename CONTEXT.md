# codetrap Context

codetrap records coding pitfalls as reusable "traps" so an AI coding agent can search known mistakes before writing or changing code.

References that shaped the design: `lerim-cli` (SQLite + FTS architecture), `mattpocock/skills` (skill-based workflows), `plannotator` (Bun standalone binary builds).

## Domain Vocabulary

### Trap

A trap is one recorded mistake pattern. It has:

- `title`: short human-readable summary.
- `category`: one of the categories in `src/lib/constants.ts`.
- `scope`: `project` or `global`.
- `context`: when the mistake tends to happen.
- `mistake`: what the AI or developer tends to do wrong.
- `fix`: the preferred correction.
- `tags`: JSON-encoded string in SQLite, exposed as a string array on input.
- `before_code` / `after_code`: optional examples.
- `severity`: `warning`, `error`, or `critical`.
- `status`: lifecycle state, one of `active`, `superseded`, or `archived`.
- `state_key`, `supersedes_id`, `valid_from`, `valid_until`: lifecycle metadata for rule evolution.
- `hit_count`: incremented when a trap is shown through the CLI.

The canonical TypeScript definitions and schema metadata live in `src/domain/trap.ts`.

### Trap Library

The trap library is the user-facing collection of confirmed Traps available for review and reflection.

### Growth Insight

A growth insight is a summary derived from confirmed Traps that helps a user notice repeated mistake patterns.

### Trap Evidence

Trap evidence records where a trap came from. A trap can have multiple evidence entries with `source_type`, optional `source_ref`, `observed_at`, `related_files`, and `note`.

Supported evidence source types are defined in `src/lib/constants.ts`: `manual`, `conversation`, `commit`, `issue`, `test_failure`, and `article`. `article` is for external references such as blog posts, papers, issues, or docs that an agent reads and then records as confirmed traps.

Evidence is loaded through `TrapDetails` for drill-down workflows. Default search results do not include full evidence.

### Trap Lifecycle

Trap lifecycle is the transition policy for `active`, `archived`, and `superseded` traps.

`src/lib/trap-lifecycle.ts` owns lifecycle transition semantics such as archive and supersede state-key resolution. Raw SQL remains in `src/db/queries.ts`; repository code adapts the SQL operations to the lifecycle Module.

### Action Card

An action card is the compact search result shape for agents. It includes the trap id, scope, title, why it is relevant, what to avoid, what to do instead, score/sources, diagnostics, and optional ranking signals.

Action card content is transport-neutral. It preserves relevance, ranking signals, and search diagnostics. CLI and MCP presenters add their own `next_action` shape: CLI JSON uses `next_action.command`, for example `codetrap show <id> --scope <scope> --json`; MCP uses `next_action.details_args` with both id and scope for `get_trap`.

### Trap Operations

Trap operations are the shared execution layer for CLI and MCP trap commands. They turn transport-neutral inputs into `TrapStore` calls for add/search/get/list/update/delete/evidence/archive/supersede/stats/export/import workflows.

CLI and MCP adapters should call `TrapOperations` instead of duplicating Trap operation semantics. The adapters still own argument parsing, terminal rendering, MCP JSON text payloads, and process exit behavior.

### Session

A session is one local AI collaboration run around a goal. It records temporary working memory under `.codetrap/sessions/` instead of writing directly to `traps.db`.

Session files include `session.json`, `implementation-notes.md`, optional `recap.md`, and optional `candidate-traps.json`. Session notes may record decisions, deviations, tradeoffs, open questions, failures, test failures, corrections, reviews, and observations.

Session files are a temporary notes store, candidate pool, and audit trail. Raw notes such as failures, test failures, reviews, and corrections stay as session evidence/recap material. Candidate traps are generated only from explicit structured trap notes that provide `Title`/`Context`/`Mistake`/`Fix`. Confirmed Trap memory still lives only in `traps.db` after an explicit accept step.

### Candidate Trap

A candidate trap is a proposed Trap extracted from an explicit structured session note. It lives in `candidate-traps.json` with a quality score, quality diagnostics, candidate status, Trap-shaped content, and evidence. Accept-time edits update the candidate document so the audit trail matches the Trap that was saved or blocked.

Candidate traps can be `proposed`, `accepted`, or `rejected`. Accepting a candidate writes a confirmed Trap through `TrapOperations`, attaches session evidence, and may supersede an older active Trap. Rejected and proposed candidates do not appear in normal Trap search.

### Session Capture

Session capture is the low-friction post-flight path for agent-drafted candidate Traps. `codetrap session capture --trap-markdown - ...` is the preferred agent-drafted path because Markdown avoids shell-escaped JSON, while `--trap-json` remains available for structured callers. Capture validates the structured Trap draft, scores it, writes it to the Session candidate inbox, and never writes directly to `traps.db`. If no Session is active, capture creates a post-flight Session, writes the Candidate Trap and recap, then closes the Session so no active state is left behind.

### Session Operations

Session operations are the shared execution layer for session commands. They compose `SessionStore`, `TrapOperations`, and candidate conflict detection for start/note/capture/status/list/show/notes/close/candidates/accept/reject workflows. During capture, `SessionOperations` asks the Session Capture Module to normalize the agent-drafted Trap Markdown or JSON and build candidate evidence, then delegates candidate file writes to `SessionStore`. During accept, `SessionOperations` applies `--edit-json` before conflict detection, checks the edited candidate, then either writes the Trap and evidence or records conflict diagnostics on the candidate.

CLI and future MCP session adapters should call `SessionOperations` instead of duplicating candidate accept, conflict, evidence, or supersede behavior.

### Session Review Contract

Session review contract is the shared transport-neutral shape for Session candidate review surfaces.

`src/lib/session-review.ts` owns session JSON payload paths, candidate review status, accepted-missing Trap checks, accept/reject/cleanup payloads, neutral conflict payloads, conflict text, and the CLI-only conflict presenter. CLI JSON adds command-oriented `next_actions` with `sessionCliConflictPayload`; Web/API payloads keep the base conflict shape transport-neutral.

### Session Store

Session store owns session file layout and project-local session state under `.codetrap/sessions/`.

`src/lib/session-store.ts` reads and writes active session state, session index entries, session metadata, implementation notes, recaps, and candidate documents. It does not write confirmed Traps; that behavior belongs to Session Operations through Trap Operations.

### Session Candidate Document

Session candidate document is the pure mutation layer for `candidate-traps.json`.

`src/lib/session-candidate-document.ts` owns candidate document transitions such as add, save edited trap shape, record conflict diagnostics, accept, reject, and remove. `SessionStore` calls this Module and remains responsible for file persistence, recap regeneration, and index refresh.

### Session Maintenance

Session maintenance is the cleanup path for temporary Session files after their durable Trap value has been accepted, rejected, deleted, or aged out.

`SessionOperations` owns the public maintenance semantics for deleting a Session, pruning old closed Sessions, and cleaning accepted Candidate Traps whose confirmed Trap was later deleted. `SessionStore` owns the file-layout changes: removing session directories, updating `index.json`, clearing `active.json`, rewriting candidate documents, and regenerating recaps. CLI and web adapters should call these operations instead of editing `.codetrap/sessions/` directly.

### Command Request

Command request is the normalized input shape shared by CLI and MCP before calling Trap Operations.

`src/lib/command-requests.ts` owns command argument normalization for search, list, stats, embedding, evidence, and session inputs. CLI and MCP adapters should translate transport-specific flags or tool arguments into Command Requests instead of reimplementing defaults, aliases, or numeric/boolean parsing.

### Trap Mutation Result

Trap mutation result is the transport-neutral result shape for write workflows such as update, delete, evidence, archive, and supersede. It records whether a mutation succeeded and which scope was attempted or matched.

`src/lib/trap-mutation-result.ts` owns scoped mutation fallback semantics and machine-readable mutation payload normalization. CLI and MCP adapters render this result, but they should not duplicate project-first fallback or not-found result rules.

### Trap Archive

Trap archive is the import/export format and compatibility layer. It preserves traps and trap evidence, handles JSON-string fields such as `tags` and `related_files`, and remaps imported evidence onto the new trap IDs created during import.

`TrapStore` delegates archive import semantics to `src/lib/trap-archive.ts` so Scope policy stays separate from archive format compatibility.

### Trap Transfer

Trap transfer is the internal DB-to-DB move path used by `repair-scope` and `migrate-project`. It preserves storage metadata such as lifecycle fields, timestamps, hit counts, Trap Evidence, and remapped `supersedes_id` values while rewriting the destination `project_path`.

Trap transfer lives in `src/lib/trap-transfer.ts`. It is separate from Trap Archive import because archive import is a user-facing compatibility format with forgiving partial-import behavior, while transfer is a maintenance workflow for moving existing project-scoped rows between SQLite databases.

### Scope Maintenance

Scope maintenance is the safe repair and migration workflow for project-scoped traps across SQLite databases.

`src/lib/scope-maintenance.ts` owns scope-maintenance path derivation, validation, backup creation, and readonly repository opening. `src/lib/scope-migration.ts` composes those operations into dry-run/apply workflows and result shaping.

### Trap JSON Field Codec

Trap JSON field codec owns the conversion rules for Trap fields that are stored as JSON strings in SQLite but exposed as string arrays at module interfaces.

`tags`, `path_globs`, and trap evidence `related_files` must be encoded/parsed through `src/lib/trap-json-fields.ts`. This keeps canonical JSON arrays, legacy raw strings, and empty values consistent across storage, search documents, archive import/export, and CLI formatting.

### Trap Shape Codec

Trap shape codec owns whole-record conversion between storage shape, public JSON shape, archive shape, and import shape.

`src/lib/trap-codec.ts` is the deepened Module for these conversions. Callers should use it instead of individually parsing `tags`, `path_globs`, or `related_files` when converting an entire trap or evidence record.

### Scope

codetrap stores traps in two scopes:

- `project`: traps for the nearest ancestor directory containing `.codetrap/`.
- `global`: traps shared across all projects in `~/.codetrap/`.

Project scope is resolved from the current working directory by walking upward until `.codetrap/` is found. If no project root exists, project-scoped writes fail and callers should either run `codetrap init` or use `global`.

The global home store `~/.codetrap/` must not be treated as a project root.

### Scope Context

Scope context resolves cwd, project root, project/global database paths, and lazily selected repositories for a given execution cwd.

`src/lib/scope-context.ts` owns cwd-specific repository selection for `TrapStore`, MCP tool calls, and MCP resource reads. This keeps project/global lookup rules in one Module while `TrapStore` remains the scope policy Interface used by operations.

### Scope Path

Scope path is the cross-platform path normalization Module for cwd, home directory, project root, and scope database paths.

`src/lib/scope-path.ts` owns Windows/MSYS/POSIX path flavor detection, canonical path comparison, path joining, and testable filesystem probing. Scope Context and Scope Maintenance should use this Module instead of open-coding path normalization.

### Storage

Each scope has its own SQLite database named `traps.db`.

- Project database: `<project-root>/.codetrap/traps.db`
- Global database: `~/.codetrap/traps.db`

The schema is initialized automatically when a database connection is opened. The schema includes an FTS5 virtual table and triggers that keep the full-text index synchronized with the `traps` table. Evidence is stored in `trap_evidence`.

### Search

Full-text search uses SQLite FTS5 over `title`, `context`, `mistake`, `fix`, `tags`, and derived `search_text`.

By default, search checks project scope first when a project exists, then global scope. It returns only `active` traps unless callers pass `status=all` or a specific lifecycle status. Callers may pass `scope` to restrict search to one database and `category` to filter results.

Chinese and mixed-language search are implemented through derived `search_text`, CJK bigram expansion, and a Chinese-English synonym map before FTS query compilation.

### Search Policy

Search policy owns retrieval filter planning, applicability filtering, overfetch decisions, semantic thresholding, generic reranking, ranking signals, RRF fusion, final ranking, and hybrid fallback diagnostics.

`src/lib/search-policy.ts` sits behind `SearchService`. Retrieval Modules fetch FTS or semantic candidates from storage/index adapters, while the policy Module decides storage pushdown filters, path/module/owner applicability, candidate limits, exact title/tag/code identifier boosts, severity boosts, and whether ranking signals or diagnostics are exposed.

### Search Eval

Search eval owns the maintainer-only search evaluation fixture shape, deterministic eval embedder, Recall@3/Recall@5/MRR reporting, dogfood judgment counts, and dogfood record normalization.

`src/lib/search-eval.ts` is the shared Module for search eval behavior. `scripts/dogfood-eval.ts` should stay a thin CLI Adapter, and `src/tests/search-eval.test.ts` should exercise the same Module instead of duplicating fixture types, embedding vectors, or metric calculations.

### Dogfood Observation

A dogfood observation is a raw record from real codetrap development that describes a pre-edit search or post-flight learning signal. It records the task, query, reviewed top results, judgment, whether the result changed the next action, and a promotion lane.

Dogfood observations are not telemetry. They do not automatically become confirmed Traps or search eval cases.

### Promotion Decision

A promotion decision chooses where a dogfood observation should go next: search eval, trap candidate, product backlog, docs guidance, or no promotion.

Search eval promotion is reserved for representative search-quality behavior with clear expected Trap IDs. Reusable mistake patterns should become Candidate Traps. Product friction should become roadmap or implementation planning.

### Embedding Index

Embedding index is the Module for semantic trap availability and embedding freshness.

`src/lib/embedding-index.ts` owns the index-facing Interface for fresh semantic candidates, embeddable counts, traps needing embeddings, and embedding state counts. Provider-specific embedding calls stay behind `EmbeddingProvider`; raw SQL stays in `src/db/embedding-queries.ts`.

### Embedding Runtime

Embedding runtime is the Module for embedding provider selection, provider availability, provider config, setup next actions, and provider-required error modes.

`src/lib/embedding-runtime.ts` owns the seam where Jina and future local embedding Adapters plug in. Store, Search, Doctor, and Search Eval should ask the runtime for provider/config/status instead of reading environment variables or embedding-provider facts directly.

Implemented retrieval and agent-memory reference notes live in `docs/agent-memory-reference-analysis.md`. The next CLI-first product direction lives in `docs/codetrap-optimization-roadmap.zh-CN.md`.

## Adapter Rules

### CLI

The CLI is optimized for direct terminal use.

- `show <id>` increments the shown trap's `hit_count` in the scope where it was found.
- `search` renders action cards; `show` renders full `TrapDetails`.
- `search/show/list/stats/doctor --json` are the stable machine-readable agent surface.
- `search --json` can read the query from stdin when there is no positional query.
- `add` and `edit` accept structured `--json` input; use `--output-json` for their machine-readable mutation output. `delete/archive/supersede/import --json` and `add_trap_evidence --output-json` also return machine-readable mutation results.
- `add_trap_evidence`, `archive_trap`, and `supersede_trap` expose evidence and lifecycle operations.
- `repair-scope` and `migrate-project` safely move project-scoped traps between DB files. They default to dry-run, require `--apply` to mutate, back up DBs first, and never move true global traps.
- `src/commands/router.ts` is the thin CLI Adapter. Command behavior lives in `src/commands/workflow.ts`, which returns `CommandResult` values before terminal rendering.

### MCP Server

The MCP server is optimized for AI tool use.

- Tools return JSON text payloads.
- `search_traps` searches both scopes by default, unless `scope` is provided, and returns compact action cards.
- `get_trap` is the drill-down tool for full `TrapDetails`, including evidence and lifecycle metadata.
- Tool calls may pass `cwd` so project scope resolves from the target workspace; without `cwd`, the server falls back to its startup cwd.
- MCP `get_trap` does not increment `hit_count`; the counter currently reflects CLI `show` usage.
- `TrapStore.hit(id)` follows the same project-first fallback as `get(id)` when no scope is provided. Passing an explicit scope restricts the hit update to that scope.

### Web Console

The web console is a local review surface for Projects, Sessions, Candidate Traps, the Trap Library, and Growth Insights. It is not the canonical agent interface; CLI JSON remains the primary Agent API.

`src/web/static.ts` owns the HTML/CSS shell. Browser behavior lives in `src/web/client-script.ts`, Review queue and candidate draft/request modeling live in `src/web/client-review.ts`, and display strings live in `src/web/client-text.ts` so locale coverage and UI shell generation can be tested without reading the full static artifact. Server routes in `src/web/server.ts` should stay thin adapters over `TrapOperations` and `SessionOperations`.

The browser shell Module lives in `src/web/client-shell.ts`; it owns desktop pane sizing, collapse state, splitter keyboard/pointer behavior, and shell layout persistence. The Review Module in `src/web/client-review.ts` owns pending-session selection, queue state, visible candidate draft normalization, and mutation payload construction for save/accept flows. `src/web/client-script.ts` should compose those Modules instead of mixing shell layout internals or candidate normalization into DOM event handlers.

## Design Direction

Keep domain concepts centralized and adapters thin:

- Domain definitions belong in `src/domain/`.
- `TrapRepository` in `src/db/repository.ts` owns single-database trap operations.
- `TrapStore` in `src/lib/store.ts` owns project/global scope policy and composes repositories.
- CLI and MCP should share execution logic where possible, then render results differently.
- Future search changes should be isolated behind the search/query layer so ICU, jieba, or vector search can be added without rewriting adapters.
- `openDatabase(":memory:")` from `src/db/connection.ts` creates schema-initialized in-memory databases for tests.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun + TypeScript |
| Database | SQLite through `bun:sqlite` + FTS5 |
| MCP | `@modelcontextprotocol/sdk` |
| Build | `bun build --compile` standalone binaries |

## Key Paths

```text
src/
  index.ts              -- CLI entry point
  mcp-server.ts         -- MCP server entry point
  domain/
    trap.ts             -- canonical types, schema metadata, builders
  lib/
    constants.ts        -- categories, severities, defaults
    command-requests.ts -- CLI/MCP command request normalization
    scope.ts            -- scope resolution (walk up to .codetrap/)
    scope-path.ts       -- cross-platform path normalization for scope paths
    scope-context.ts    -- cwd/project/global DB diagnostic facts
    scope-maintenance.ts -- shared scope repair/migration safety helpers
    scope-migration.ts  -- repair-scope / migrate-project planning and apply logic
    store.ts            -- TrapStore: project/global scope policy
    trap-operations.ts  -- shared CLI/MCP Trap operation execution
    session-store.ts    -- project-local session file storage
    session-operations.ts -- shared Session operation execution
    session-review.ts   -- shared Session review payloads plus CLI conflict presenter
    session-candidate-document.ts -- pure candidate-traps.json transition rules
    session-capture.ts  -- deterministic candidate construction, extraction, and merge policy
    session-conflicts.ts -- possible active Trap conflict detection for candidates
    trap-quality.ts     -- deterministic candidate Trap quality scoring
    trap-mutation-result.ts -- shared mutation result and scoped fallback semantics
    trap-lifecycle.ts   -- Trap lifecycle transition semantics
    output-json.ts      -- shared CLI/MCP JSON presenters
    doctor.ts           -- doctor diagnostic report
    embedding-index.ts  -- semantic candidate and embedding freshness Interface
    embedding-runtime.ts -- embedding provider runtime, config, setup actions, and Adapter seam
    embedding-health.ts -- embedding freshness and fallback summaries
    trap-archive.ts     -- Trap archive import/export compatibility
    trap-codec.ts       -- whole Trap shape conversion for JSON/archive/storage inputs
    trap-transfer.ts    -- DB-to-DB Trap transfer for scope repair/migration
    trap-json-fields.ts -- JSON string-array codec for tags/path_globs/related_files
    search-policy.ts    -- applicability filtering, rerank, fusion, ranking diagnostics
    search-eval.ts      -- search eval fixture, deterministic embedder, metrics, dogfood record normalization
    search-result-card.ts -- compact action-card builder
    format.ts           -- CLI formatting helpers
  db/
    connection.ts       -- openDatabase, PRAGMA, schema init
    schema.ts           -- schema versioning, migration
    queries.ts          -- raw SQL operations
    repository.ts       -- TrapRepository class wrapping queries
  commands/
    router.ts           -- thin CLI adapter and result renderer
    workflow.ts         -- CLI command workflow behavior
  mcp/
    server.ts           -- MCP server (stdio transport)
    tools.ts            -- MCP tool schemas
    resources.ts        -- MCP resource URIs (4 resources)
  web/
    server.ts           -- thin Web API adapter over shared operations
    static.ts           -- HTML/CSS shell artifact
    client-shell.ts     -- browser pane sizing/collapse Module
    client-review.ts    -- Review queue and candidate draft/request Module
    client-script.ts    -- DOM composition and event wiring
    client-text.ts      -- localized Web UI strings
skills/
  codetrap-add/SKILL.md
  codetrap-check/SKILL.md
  codetrap-capture-external/SKILL.md
  codetrap-search/SKILL.md
docs/
  installation.md
  agent-memory-reference-analysis.md
  codetrap-optimization-roadmap.zh-CN.md
```

## Development

```bash
cd /path/to/codetrap
bun run src/index.ts                          # run CLI directly
bun test src/tests                            # run tests
bun run build                                 # build CLI + MCP binaries into dist/
bun run build:release                        # build release assets into dist/release/
```

For tests, use `openDatabase(":memory:")` from `src/db/connection.ts` and pass the database to `new TrapRepository(db)`. This initializes schema without touching project or global files.

## Current Priorities

Based on `docs/codetrap-optimization-roadmap.zh-CN.md`.

**Completed on 2026-05-17:**
- CLI JSON contract for `search/show/list/stats/doctor --json`.
- CLI `next_action.command`, stdin search, and `add/edit --output-json`.
- CLI-first AGENTS/skills guidance with top 3 review.
- MCP thin-adapter work: shared JSON presenters and optional `cwd` for tool calls.
- Scope diagnostics via `codetrap doctor`.
- Scope repair/migration via `repair-scope` and `migrate-project`.
- Embedding health summaries in `stats --json` and `doctor --json`.
- StickS3 search eval fixture with Recall@3/Recall@5 gates.
- Mutation JSON for delete/archive/supersede/evidence/import.
- Schema v5 path/module/owner scoped traps.
- Generic reranking with MRR observation and ranking signals.
- `~/.codetrap/config.json` search defaults with env fallback.
- MCP resource `?cwd=` project resolution.
- Codex plugin/onboarding scaffold and release preflight script.
- External lesson capture via `codetrap-capture-external` skill plus `article` trap evidence source type.
- Architecture deepening for Search Policy, Trap Shape Codec, Scope Context, Trap Mutation Result, CLI Command Workflow, Scope Path, Command Request, Scope Maintenance, Embedding Index, and Trap Lifecycle.

**Next priorities:**
- Add local embedding provider after CLI JSON, evals, and doctor remain stable.
