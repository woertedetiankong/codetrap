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

### Trap Evidence

Trap evidence records where a trap came from. A trap can have multiple evidence entries with `source_type`, optional `source_ref`, `observed_at`, `related_files`, and `note`.

Evidence is loaded through `TrapDetails` for drill-down workflows. Default search results do not include full evidence.

### Action Card

An action card is the compact search result shape for agents. It includes the trap id, scope, title, why it is relevant, what to avoid, what to do instead, score/sources, and a `next_action`.

CLI JSON uses `next_action.command`, for example `codetrap show <id> --scope <scope> --json`. MCP uses `next_action.details_args` with both id and scope for `get_trap`.

### Trap Operations

Trap operations are the shared execution layer for CLI and MCP trap commands. They turn transport-neutral inputs into `TrapStore` calls for add/search/get/list/update/delete/evidence/archive/supersede/stats/export/import workflows.

CLI and MCP adapters should call `TrapOperations` instead of duplicating Trap operation semantics. The adapters still own argument parsing, terminal rendering, MCP JSON text payloads, and process exit behavior.

### Trap Archive

Trap archive is the import/export format and compatibility layer. It preserves traps and trap evidence, handles JSON-string fields such as `tags` and `related_files`, and remaps imported evidence onto the new trap IDs created during import.

`TrapStore` delegates archive import semantics to `src/lib/trap-archive.ts` so Scope policy stays separate from archive format compatibility.

### Trap Transfer

Trap transfer is the internal DB-to-DB move path used by `repair-scope` and `migrate-project`. It preserves storage metadata such as lifecycle fields, timestamps, hit counts, Trap Evidence, and remapped `supersedes_id` values while rewriting the destination `project_path`.

Trap transfer lives in `src/lib/trap-transfer.ts`. It is separate from Trap Archive import because archive import is a user-facing compatibility format with forgiving partial-import behavior, while transfer is a maintenance workflow for moving existing project-scoped rows between SQLite databases.

### Trap JSON Field Codec

Trap JSON field codec owns the conversion rules for Trap fields that are stored as JSON strings in SQLite but exposed as string arrays at module interfaces.

`tags` and trap evidence `related_files` must be encoded/parsed through `src/lib/trap-json-fields.ts`. This keeps canonical JSON arrays, legacy raw strings, and empty values consistent across storage, search documents, archive import/export, and CLI formatting.

### Scope

codetrap stores traps in two scopes:

- `project`: traps for the nearest ancestor directory containing `.codetrap/`.
- `global`: traps shared across all projects in `~/.codetrap/`.

Project scope is resolved from the current working directory by walking upward until `.codetrap/` is found. If no project root exists, project-scoped writes fail and callers should either run `codetrap init` or use `global`.

The global home store `~/.codetrap/` must not be treated as a project root.

### Storage

Each scope has its own SQLite database named `traps.db`.

- Project database: `<project-root>/.codetrap/traps.db`
- Global database: `~/.codetrap/traps.db`

The schema is initialized automatically when a database connection is opened. The schema includes an FTS5 virtual table and triggers that keep the full-text index synchronized with the `traps` table. Evidence is stored in `trap_evidence`.

### Search

Full-text search uses SQLite FTS5 over `title`, `context`, `mistake`, `fix`, `tags`, and derived `search_text`.

By default, search checks project scope first when a project exists, then global scope. It returns only `active` traps unless callers pass `status=all` or a specific lifecycle status. Callers may pass `scope` to restrict search to one database and `category` to filter results.

Chinese and mixed-language search are implemented through derived `search_text`, CJK bigram expansion, and a Chinese-English synonym map before FTS query compilation.

Implemented retrieval and agent-memory reference notes live in `docs/agent-memory-reference-analysis.md`. The next CLI-first product direction lives in `docs/codetrap-optimization-roadmap.zh-CN.md`.

## Adapter Rules

### CLI

The CLI is optimized for direct terminal use.

- `show <id>` increments the shown trap's `hit_count` in the scope where it was found.
- `search` renders action cards; `show` renders full `TrapDetails`.
- `search/show/list/stats/doctor --json` are the stable machine-readable agent surface.
- `search --json` can read the query from stdin when there is no positional query.
- `add` and `edit` accept structured `--json` input; use `--output-json` for machine-readable mutation output.
- `add_trap_evidence`, `archive_trap`, and `supersede_trap` expose evidence and lifecycle operations.
- `repair-scope` and `migrate-project` safely move project-scoped traps between DB files. They default to dry-run, require `--apply` to mutate, back up DBs first, and never move true global traps.

### MCP Server

The MCP server is optimized for AI tool use.

- Tools return JSON text payloads.
- `search_traps` searches both scopes by default, unless `scope` is provided, and returns compact action cards.
- `get_trap` is the drill-down tool for full `TrapDetails`, including evidence and lifecycle metadata.
- Tool calls may pass `cwd` so project scope resolves from the target workspace; without `cwd`, the server falls back to its startup cwd.
- MCP `get_trap` does not increment `hit_count`; the counter currently reflects CLI `show` usage.
- `TrapStore.hit(id)` follows the same project-first fallback as `get(id)` when no scope is provided. Passing an explicit scope restricts the hit update to that scope.

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
    scope.ts            -- scope resolution (walk up to .codetrap/)
    scope-context.ts    -- cwd/project/global DB diagnostic facts
    scope-migration.ts  -- repair-scope / migrate-project planning and apply logic
    store.ts            -- TrapStore: project/global scope policy
    trap-operations.ts  -- shared CLI/MCP Trap operation execution
    output-json.ts      -- shared CLI/MCP JSON presenters
    doctor.ts           -- doctor diagnostic report
    embedding-health.ts -- embedding freshness and fallback summaries
    trap-archive.ts     -- Trap archive import/export compatibility
    trap-transfer.ts    -- DB-to-DB Trap transfer for scope repair/migration
    trap-json-fields.ts -- JSON string-array codec for tags/related_files
    search-result-card.ts -- compact action-card builder
    format.ts           -- CLI formatting helpers
  db/
    connection.ts       -- openDatabase, PRAGMA, schema init
    schema.ts           -- schema versioning, migration
    queries.ts          -- raw SQL operations
    repository.ts       -- TrapRepository class wrapping queries
  commands/
    router.ts           -- CLI command dispatch
  mcp/
    server.ts           -- MCP server (stdio transport)
    tools.ts            -- MCP tool schemas
    resources.ts        -- MCP resource URIs (4 resources)
skills/
  codetrap-add/SKILL.md
  codetrap-check/SKILL.md
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

**Next priorities:**
- Tune ranking with exact token/tag/severity boosts and MRR observation.
- Add local embedding provider after CLI JSON, evals, and doctor remain stable.
- Explore post-flight trap capture and path/module scoped traps later.
