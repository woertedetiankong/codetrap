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

### 2026-05-31

- Before starting the follow-up web work, I committed the completed Trap Library MVP as `c1dc698 feat(web): add trap library` after rerunning `bun test src/tests/web-console.test.ts`, `bun test src/tests`, and `bunx tsc --noEmit`.
- New scope is deliberately limited to three browser-facing improvements: a Review-to-Library trap jump, front-end sorting for already loaded Library traps, and a standalone Insights view computed from confirmed trap JSON. Back-end pagination/search stay out of this iteration because they need API-level result ordering and total-count semantics.
- Preflight codetrap search returned two results. Trap #2 is a partially applicable reminder to keep web requests centralized through the existing `api()` helper. Trap #3 is relevant as a warning not to duplicate or weaken module/owner filtering; this iteration will sort and aggregate returned traps rather than changing the filtering policy.
- The Review-to-Library jump clears Library search and narrows filters to the accepted trap's scope with `status=all`. That makes accepted traps reachable even if they later become archived or superseded, while avoiding a new lookup endpoint.
- Insights is a third web view backed by `/api/traps?status=all`, not a new persistence model. It aggregates category/module/tag/severity patterns and uses the same trap jump helper for recent and most-viewed rows.
- Browser verification found the first Playwright attempt could not use bundled browsers, so smoke checks used system Chrome through Playwright. Desktop, seeded `View trap`, and mobile checks passed without console errors.
- Final validation passed with `git diff --check`, `bun test src/tests/web-console.test.ts`, `bun test src/tests`, `bunx tsc --noEmit`, and browser smoke checks.
