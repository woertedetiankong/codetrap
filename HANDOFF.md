# codetrap Handoff

## Project Overview

codetrap is a standalone CLI tool plus MCP server for recording and searching coding pitfalls. The core idea is simple: Claude Code/Codex is already the AI engine, so codetrap only stores lessons learned and exposes them through CLI commands, MCP tools, and skill prompts.

References that inspired the shape of the project:

- `lerim-cli`: SQLite + FTS search architecture.
- `mattpocock/skills`: skill-based workflows.
- `plannotator`: Bun standalone binary builds.

## Current Status

### CLI

Implemented in `codetrap/src/index.ts` and `codetrap/src/commands/router.ts`.

- `init`: create `.codetrap/` in the current project.
- `add --json '...'`: structured trap input.
- `search "query"`: full-text search across project and global scopes by default.
- `list [--category X] [--scope project|global]`: list traps.
- `show <id>`: show details and increment hit count.
- `edit <id> --json '{}'`: update a trap through structured JSON.
- `delete <id>`: delete a trap.
- `export [--scope X]`: export traps as JSON.
- `import <file.json>`: import traps from JSON.
- `stats`: show project/global statistics.
- `serve`: start the MCP server over stdio.

### Storage

- SQLite through `bun:sqlite`.
- FTS5 full-text index with triggers that keep it synchronized.
- Two storage scopes:
  - Project: `.codetrap/traps.db`
  - Global: `~/.codetrap/traps.db`
- Schema versioning and migration entry point in `codetrap/src/db/schema.ts`.

### MCP Server

Implemented in `codetrap/src/mcp/server.ts`.

Tools:

- `search_traps`
- `add_trap`
- `get_trap`
- `list_traps`
- `update_trap`
- `delete_trap`
- `get_stats`

Resources:

- `codetrap://project/recent`
- `codetrap://global/recent`
- `codetrap://project/top`
- `codetrap://global/top`

### Skills

Source skill files live in `codetrap/skills/`.

- `codetrap-add.md`
- `codetrap-search.md`
- `codetrap-check.md`

Installed/project-level skill directories may also exist under `.claude/skills/`.

### Domain Context

Stable domain concepts and rules are documented in `codetrap/CONTEXT.md`.

Canonical trap types and schema metadata live in `codetrap/src/domain/trap.ts`.

## Known Priorities

### High

- Chinese search: SQLite FTS5 default tokenization is weak for Chinese. Options include ICU tokenizer support or pre-tokenizing with jieba before indexing.
- MCP live connection check: verify the server state inside Claude Code/Codex after first approval.

### Medium

- Interactive `add`: support manual readline input in addition to `--json`.
- Interactive `edit`: support manual editing in addition to `--json`.
- Unit tests: start with domain/query/store behavior and CLI command intent parsing.
- CI builds for Windows, macOS, and Linux.

### Low / Future

- Team sharing through committed `.codetrap/traps.db` or JSON export/import.
- Semantic search with local embeddings, possibly sqlite-vec.
- Proactive warning hooks before AI output.
- npm publishing and `npx codetrap`.

## Key Paths

```text
D:\llm\windsurf\codetrap\
  CONTEXT.md
  package.json
  src\
    index.ts
    mcp-server.ts
    domain\
      trap.ts
    lib\
      constants.ts
      scope.ts
      store.ts
      format.ts
    db\
      schema.ts
      queries.ts
      connection.ts
      repository.ts
    commands\
      router.ts
    mcp\
      server.ts
      tools.ts
      resources.ts
  skills\
    codetrap-add.md
    codetrap-check.md
    codetrap-search.md
  dist\
    codetrap.exe
    codetrap-serve.exe
```

External configuration:

- `D:\llm\windsurf\.mcp.json`: MCP server registration.
- `D:\llm\windsurf\.claude\skills\`: project-level skills.
- `~\.claude\skills\`: user-level skills.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun + TypeScript |
| Database | SQLite through `bun:sqlite` + FTS5 |
| MCP | `@modelcontextprotocol/sdk` |
| Build | `bun build --compile` standalone binaries |

## Development Commands

```bash
cd D:\llm\windsurf\codetrap
bun run src/index.ts
bun build ./src/index.ts --compile --outfile dist/codetrap
bun build ./src/mcp-server.ts --compile --outfile dist/codetrap-serve
```

## Current Architecture Notes

- `src/domain/trap.ts` is the source of truth for trap types, mutable fields, and MCP schema metadata.
- `src/db/repository.ts` wraps single-database trap operations.
- `src/lib/store.ts` is the scoped service that composes project/global repositories.
- `openDatabase(":memory:")` can be used in tests to create a schema-initialized in-memory database.
