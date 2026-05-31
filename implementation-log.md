# Implementation Log

## Task

Implement the web Trap Library MVP: a read-only trap library in the existing web console with filters, complete trap details, and lightweight growth insights.

## Assumptions

- The first version is read-only; mutation workflows remain in the candidate review UI and CLI.
- Trap Library defaults to active traps across the selected project and global scope.
- Growth Insight is derived from currently loaded traps and does not need a new persistence model.

## Log

### 2026-05-30

- Preflight codetrap search returned two results. Trap #3 is relevant because `/api/traps` must preserve module/owner filter semantics and tests should include those filters. Trap #2 is only partially applicable; the web console already centralizes frontend requests through an `api()` helper, so new frontend calls will use that helper.
- The existing `WebContext.home` did not reach `TrapStore`, so in-process web API tests could accidentally read or write the real global store. I added optional home injection through scope context and global DB opening before adding `/api/traps`, so project+global behavior can be tested against an isolated home.
- `/api/traps` is deliberately a thin adapter over `TrapOperations.listTraps()` plus `toListJson()`. The detail endpoint now returns `toTrapDetailsJson()` so the Web UI gets parsed `tags`, `path_globs`, and evidence `related_files` without duplicating storage-shape parsing in browser code.
- Browser verification found the existing mobile layout kept the rail at a fixed 520px minimum height, pushing the Library view too far down. I changed mobile rail sizing to content height and collapsed Library summary/detail grids to one column below 520px.
- The `web` command help and README command table now describe the broader review + Trap Library console so the user-facing entry point matches the new surface.
- Validation passed with `bun test src/tests/web-console.test.ts`, `bun test src/tests`, `bunx tsc --noEmit`, and Playwright/Chrome checks at desktop and mobile sizes.
