# codetrap Change Handoff

Date: 2026-05-13

This document records the code and project files changed during the architecture cleanup session so the next developer or agent can pick up without reconstructing the history from memory.

## Summary

The work focused on making codetrap easier to continue developing:

- Centralized trap domain types and MCP schema metadata.
- Split single-database operations from project/global scope policy.
- Fixed search filters that were exposed by CLI/MCP but not fully applied.
- Made CLI `edit --json` functional.
- Added an initialized in-memory database entry point for tests.
- Added Git ignore rules and project handoff/context documentation.

## Code Files Changed

### `src/domain/trap.ts`

New file.

Purpose:

- Defines canonical `Trap`, `TrapInput`, `TrapSearchResult`, and `TrapUpdate` types.
- Defines `TRAP_REQUIRED_INPUT_FIELDS` and `TRAP_UPDATE_FIELDS`.
- Holds shared MCP JSON schema metadata for trap input/update.
- Provides helpers:
  - `trapInputSchema()`
  - `trapUpdateSchema()`
  - `buildTrapInput(args)`
  - `pickTrapUpdate(args)`

Why it matters:

- `Trap` shape is no longer separately maintained in format, queries, and MCP tools.
- Adding or changing trap fields now has one primary source of truth.

### `src/lib/format.ts`

Changed.

Purpose of change:

- Removed the local `Trap` interface definition.
- Imports and re-exports `Trap` from `src/domain/trap.ts`.

Why it matters:

- Formatting code no longer owns domain structure.

### `src/db/queries.ts`

Changed.

Purpose of change:

- Uses domain types from `src/domain/trap.ts`.
- `searchTraps` now accepts `{ category, scope, limit }`.
- `searchTraps` now applies category and scope filters in SQL.
- `updateTrap` now accepts `TrapUpdate` and only updates fields listed in `TRAP_UPDATE_FIELDS`.
- Switched several parameterized writes to prepared statements.
- Added `exportTraps(db)`.

Important behavior fix:

- Before this cleanup, callers could pass search `category` or MCP search `scope`, but filtering was incomplete. Those filters are now honored.

### `src/db/repository.ts`

New file.

Purpose:

- Adds `TrapRepository`, a single-database wrapper around trap queries.
- Exposes methods:
  - `add`
  - `search`
  - `get`
  - `list`
  - `update`
  - `delete`
  - `hit`
  - `top`
  - `stats`
  - `exportAll`

Why it matters:

- Database behavior is now testable without project/global scope decisions.
- Future search changes can be worked into repository/query boundaries without rewriting CLI or MCP adapters.

### `src/db/connection.ts`

Changed.

Purpose of change:

- Added `openDatabase(path = ":memory:")`.
- Moved database PRAGMA and schema initialization into a shared `configureDatabase(db)` helper.
- `openGlobal()` and `openProject(root)` now call `openDatabase(path)`.

Why it matters:

- Tests can create a schema-initialized in-memory database with:

```ts
const repo = new TrapRepository(openDatabase(":memory:"));
```

### `src/lib/store.ts`

Rewritten internally while preserving the public class/API.

Purpose of change:

- `TrapStore` no longer calls `queries.*` directly.
- It composes `TrapRepository` instances for project and global databases.
- It now owns scope policy only:
  - project first, then global for read/search fallback
  - explicit scope restricts to one repository
  - project writes still require a project root

Why it matters:

- `TrapStore` is no longer both a database query wrapper and a scope dispatcher.
- CLI and MCP can keep using the same class while internals are cleaner.

### `src/mcp/tools.ts`

Changed.

Purpose of change:

- Replaced manually duplicated `add_trap` and `update_trap` schemas with `trapInputSchema()` and `trapUpdateSchema()`.
- Cleaned a corrupted description string.

Why it matters:

- MCP schema now follows the same domain metadata as the rest of the app.

### `src/mcp/server.ts`

Changed.

Purpose of change:

- `search_traps` now passes `args.scope` to `store.search`.
- `add_trap` now uses `buildTrapInput(args)`.
- `update_trap` now uses `pickTrapUpdate(args)`.
- Added a local `ToolArgs` cast so MCP arguments are handled consistently.

Important behavior fix:

- MCP `search_traps` had a `scope` parameter in its schema but did not actually pass it to the store. It now works.

### `src/commands/router.ts`

Changed.

Purpose of change:

- Imports `pickTrapUpdate`.
- Implements `cmdEdit` for `edit <id> --json '{...}'`.

Important behavior fix:

- `edit` was previously a placeholder that printed instructions only. It now parses JSON and calls `store.update`.

## Documentation And Repo Files Changed

### `.gitignore`

New file.

Purpose:

- Ignores local/generated files:
  - `node_modules/`
  - `dist/`
  - `.codetrap/`
  - `.claude/`
  - Bun build temporary files
  - SQLite database/WAL/SHM files
  - editor and OS noise

### `CONTEXT.md`

New file.

Purpose:

- Documents stable domain concepts:
  - Trap
  - Scope
  - Storage
  - Search
  - CLI rules
  - MCP rules
  - design direction

### `HANDOFF.md`

New file inside the `codetrap` repo.

Purpose:

- Current project handoff:
  - project overview
  - implemented CLI/MCP/storage features
  - known priorities
  - key paths
  - tech stack
  - development commands
  - architecture notes

Note:

- A previously garbled handoff also existed at `D:\llm\windsurf\HANDOFF.md`. The repo-local `codetrap/HANDOFF.md` is the version that will be tracked by Git.

## Git Setup

Git was initialized in:

```text
D:\llm\windsurf\codetrap\.git
```

This means the repo tracks files inside `codetrap/` only. Parent-level files such as `D:\llm\windsurf\.mcp.json` are outside this repository.

Current intended tracked set:

- `.gitignore`
- `CONTEXT.md`
- `CHANGELOG_HANDOFF.md`
- `HANDOFF.md`
- `bun.lock`
- `package.json`
- `skills/`
- `src/`
- `tsconfig.json`

Current intended ignored set:

- `node_modules/`
- `dist/`
- `.codetrap/`
- `.claude/`
- `*.bun-build`
- SQLite local database files

## Verification Run

The following checks passed after the architecture cleanup:

```powershell
bunx tsc --noEmit
bun run src/index.ts search test --scope global --limit 1
bun run src/index.ts list --scope global --limit 1
```

An in-memory repository smoke test also passed:

```ts
const repo = new TrapRepository(openDatabase(":memory:"));
const id = repo.add({
  title: "memory test",
  category: "bug",
  scope: "global",
  context: "test context",
  mistake: "test mistake",
  fix: "test fix",
});
const trap = repo.get(id);
```

Temporary standalone builds also succeeded:

```powershell
bun build ./src/index.ts --compile --outfile dist/codetrap-check
bun build ./src/mcp-server.ts --compile --outfile dist/codetrap-serve-check
```

The temporary build artifacts were removed after verification.

## Known Caveats

- Running the normal `bun run build` previously failed with `EPERM` while writing `dist/codetrap.exe`. The code compiled successfully to alternate temporary output names, so this is likely a Windows file lock on the existing executable.
- No formal test suite exists yet.
- Git has been initialized, but no first commit has been created yet.

## Review Fixes Applied

Date: 2026-05-13

- `src/commands/router.ts`: `cmdSearch` now passes `opts.scope` to `store.search`, so `codetrap search ... --scope global|project` is honored by the CLI.
- `src/db/schema.ts`: removed duplicate PRAGMA setup. Database connection PRAGMA configuration now lives in `src/db/connection.ts`.
- `src/lib/store.ts`: `hit(id)` without an explicit scope now checks project first and falls back to global only if the trap exists there. Explicit scope still restricts the hit update to one repository.
- `CONTEXT.md`: documented the precise `hit_count` behavior for CLI `show` and `TrapStore.hit`.

## Recommended Next Steps

1. Create the first commit:

```powershell
git add .
git commit -m "Initial codetrap implementation"
```

2. Add unit tests around:
   - `TrapRepository` using `openDatabase(":memory:")`
   - `TrapStore` project/global fallback behavior
   - CLI `edit --json` parsing and update behavior

3. Start designing the search abstraction before implementing Chinese tokenization, so FTS5, jieba preprocessing, and future vector search do not leak into CLI/MCP adapters.
