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

An action card is the compact search result shape for agents. It includes the trap id, scope, title, why it is relevant, what to avoid, what to do instead, score/sources, and a `next_action` that points to `get_trap` with both id and scope.

### Trap Operations

Trap operations are the shared execution layer for CLI and MCP trap commands. They turn transport-neutral inputs into `TrapStore` calls for add/search/get/list/update/delete/evidence/archive/supersede/stats/export/import workflows.

CLI and MCP adapters should call `TrapOperations` instead of duplicating Trap operation semantics. The adapters still own argument parsing, terminal rendering, MCP JSON text payloads, and process exit behavior.

### Trap Archive

Trap archive is the import/export format and compatibility layer. It preserves traps and trap evidence, handles JSON-string fields such as `tags` and `related_files`, and remaps imported evidence onto the new trap IDs created during import.

`TrapStore` delegates archive import semantics to `src/lib/trap-archive.ts` so Scope policy stays separate from archive format compatibility.

### Trap JSON Field Codec

Trap JSON field codec owns the conversion rules for Trap fields that are stored as JSON strings in SQLite but exposed as string arrays at module interfaces.

`tags` and trap evidence `related_files` must be encoded/parsed through `src/lib/trap-json-fields.ts`. This keeps canonical JSON arrays, legacy raw strings, and empty values consistent across storage, search documents, archive import/export, and CLI formatting.

### Scope

codetrap stores traps in two scopes:

- `project`: traps for the nearest ancestor directory containing `.codetrap/`.
- `global`: traps shared across all projects in `~/.codetrap/`.

Project scope is resolved from the current working directory by walking upward until `.codetrap/` is found. If no project root exists, project-scoped writes fail and callers should either run `codetrap init` or use `global`.

### Storage

Each scope has its own SQLite database named `traps.db`.

- Project database: `<project-root>/.codetrap/traps.db`
- Global database: `~/.codetrap/traps.db`

The schema is initialized automatically when a database connection is opened. The schema includes an FTS5 virtual table and triggers that keep the full-text index synchronized with the `traps` table. Evidence is stored in `trap_evidence`.

### Search

Full-text search uses SQLite FTS5 over `title`, `context`, `mistake`, `fix`, `tags`, and derived `search_text`.

By default, search checks project scope first when a project exists, then global scope. It returns only `active` traps unless callers pass `status=all` or a specific lifecycle status. Callers may pass `scope` to restrict search to one database and `category` to filter results.

Chinese search is a known future improvement: default FTS5 tokenization is not enough for good Chinese word segmentation.

Retrieval roadmap and reference analysis: `docs/retrieval-memory-roadmap.md` and `docs/reference-analysis.md`.

## Adapter Rules

### CLI

The CLI is optimized for direct terminal use.

- `show <id>` increments the shown trap's `hit_count` in the scope where it was found.
- `search` renders action cards; `show` renders full `TrapDetails`.
- `add` and `edit` currently accept structured `--json` input.
- `add_trap_evidence`, `archive_trap`, and `supersede_trap` expose evidence and lifecycle operations.

### MCP Server

The MCP server is optimized for AI tool use.

- Tools return JSON text payloads.
- `search_traps` searches both scopes by default, unless `scope` is provided, and returns compact action cards.
- `get_trap` is the drill-down tool for full `TrapDetails`, including evidence and lifecycle metadata.
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
    store.ts            -- TrapStore: project/global scope policy
    trap-operations.ts  -- shared CLI/MCP Trap operation execution
    trap-archive.ts     -- Trap archive import/export compatibility
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
  retrieval-memory-roadmap.md
  reference-analysis.md
```

## Development

```bash
cd D:\llm\windsurf\codetrap
bun run src/index.ts                          # run CLI directly
bun build ./src/index.ts --compile --outfile dist/codetrap.exe      # build CLI binary
bun build ./src/mcp-server.ts --compile --outfile dist/codetrap-serve.exe  # build MCP binary
bunx tsc --noEmit                             # type-check
```

For tests, use `openDatabase(":memory:")` from `src/db/connection.ts` and pass the database to `new TrapRepository(db)`. This initializes schema without touching project or global files.

## Current Priorities

Based on `docs/reference-analysis.md`.

**P0 — immediate:**
- Search stability: safe FTS query compilation, PRAGMA busy_timeout
- Chinese/mixed-language search: pre-tokenize, add `search_text` field, synonym map
- Evaluation set: 15 queries with annotated gold trap IDs

**P1 — next:**
- Semantic search MVP: Jina embedding API, `trap_embeddings` table, brute-force cosine
- Hybrid ranking: RRF fusion with FTS5, length normalization, hard min score

**P2 — later:**
- Cross-encoder reranker (Jina, optional)
- Trap lifecycle and evidence are implemented; future work can deepen ranking and review workflows around them.

**P3 — future:**
- `codetrap doctor`: index health, duplicate detection
- Team sharing, multimodal evidence
