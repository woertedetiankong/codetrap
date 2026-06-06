# Implementation Log

## Task

Track active codetrap implementation work across web, session, search, and agent-integration milestones.

## Assumptions

- Docs and AGENTS guidance should describe the current code shape, not only the feature that was active when this log was created.
- Confirmed traps still live in `traps.db`; session candidates and implementation notes remain temporary review material until accepted.
- CLI JSON remains the primary agent API, with MCP and the web console as thin adapters over shared operations.

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
- After committing the web follow-up as `271b031 feat(web): add library insights navigation`, I started a locale toggle for the web console. Preflight codetrap search returned no results, so there is no prior trap to apply.
- The locale toggle will stay browser-only for now: UI strings live in `src/web/static.ts`, the selected locale persists in `localStorage`, and no CLI/MCP output contract changes. Trap content itself remains user-authored data and is not translated.
- Implemented the locale toggle as English/Chinese UI chrome translation with a small `TEXT` dictionary and `t()` helper. Domain values such as scope/status/severity/category get display labels, while persisted form values remain the canonical English enum values.
- Validation passed with `git diff --check`, `bun test src/tests/web-console.test.ts`, `bunx tsc --noEmit`, `bun test src/tests`, and system-Chrome browser smoke checks for English/Chinese switching on desktop and mobile.
- Started the architecture deepening pass for the web console and session maintenance. Preflight codetrap search surfaced trap #3 as a relevant warning for applicability filters; I kept trap filtering calls on the existing `/api/traps` and `TrapOperations.listTraps()` path instead of adding alternate filter logic.
- Split the static web shell into `src/web/static.ts`, browser behavior in `src/web/client-script.ts`, and locale text in `src/web/client-text.ts`. This keeps UI text coverage testable without reading the full HTML artifact and leaves the web server as a thin adapter.
- Added session maintenance through `SessionOperations` / `SessionStore`: delete session directories, dry-run/apply prune of old closed sessions, and cleanup of accepted candidates whose confirmed trap was later deleted. Web routes and CLI commands call the same operations rather than editing `.codetrap/sessions` directly.

### 2026-06-01

- Task: add Codex-style horizontal resizing to the three-column web console without changing the framework-free web architecture.
- Preflight codetrap search for `web resizable grid splitter pointer drag localStorage` returned no results, so there is no prior trap to apply. I recorded it as a raw dogfood observation instead of promoting it.
- The UI currently uses a plain three-column CSS Grid in `src/web/static.ts` and a single embedded browser script in `src/web/client-script.ts`. I am keeping that structure and adding two thin splitter elements plus pointer-event behavior rather than introducing a client framework or layout dependency.
- Resizing stores only the rail and queue pixel widths in `localStorage`; the detail pane remains `minmax(460px, 1fr)` so it can absorb remaining desktop space. I also clear inline grid columns below the existing 1060px breakpoint so the mobile single-column layout is not overridden by saved desktop widths.
- Browser verification found the expected constraints: dragging the left splitter hit the queue minimum at 320px, and dragging the right splitter hit the detail minimum at 460px. This matches the existing pane min-width assumptions and keeps content from collapsing.
- Validation passed with targeted web tests, full `bun test src/tests`, `bunx tsc --noEmit`, `git diff --check`, and browser checks for desktop drag persistence plus the 390px mobile fallback.
- Follow-up task: add a Codex-style sidebar show/hide button. Preflight codetrap search for `web sidebar collapse hide show pane splitter localStorage` returned no results, so this is another no-relevant-trap dogfood observation.
- The sidebar toggle is desktop-only and stored separately as `codetrap-sidebar-collapsed`. Mobile explicitly removes the collapsed class so saved desktop state cannot hide the project/session list on narrow screens.
- In collapsed desktop mode, the left rail and left splitter are removed from the grid, while the queue/detail splitter remains active and can persist queue width through the existing `codetrap-shell-layout` key.
- Follow-up task: add the same show/hide behavior for the right detail pane. Preflight codetrap search for `web right sidebar collapse detail pane hide show splitter localStorage` returned no results, so there is no existing trap to apply.
- The detail toggle originally lived in the queue bar so users still had a visible restore affordance after the right pane was hidden. I later promoted both toggles to shell-level edge controls so the left button sits at the outer left edge and the right button sits at the outer right edge, matching the Codex-style placement more closely.
- When the detail pane is collapsed, the right splitter is hidden and unfocusable while the left splitter remains active. When both side panes are collapsed, the queue column expands to fill the shell.
- Final validation passed with targeted web tests, full `bun test src/tests`, `bunx tsc --noEmit`, `git diff --check`, and Chrome/Playwright checks for right-detail collapse persistence, both-side collapse, restore, and mobile fallback.
- Edge-control refinement: preflight codetrap search for `web sidebar toggle edge aligned codex style pane collapse button` returned no results. The behavior and storage keys stayed the same, but the toggle buttons are now absolutely positioned at the shell edges with padding added only where a visible panel header would otherwise overlap them.
- Validation for the edge-control refinement passed with targeted web tests, full `bun test src/tests`, `bunx tsc --noEmit`, `git diff --check`, and Chrome/Playwright checks for full, right-collapsed, both-collapsed, restored, and mobile states.

### 2026-06-02

- Task: swap the web console's middle queue pane and right detail pane so the visual order is project rail, detail, then queue.
- Preflight codetrap search for `web layout middle right panel swap` returned no results, so this is a no-relevant-trap dogfood observation.
- Red/green TDD check: added a static regression test that the exported web shell places `<section class="detail">` before `<section class="queue">` and uses the rail/detail/queue desktop grid order; it failed before the implementation and passed after the swap.
- The shell layout Module now stores rail/detail widths while the queue remains the flexible rightmost pane. Existing saved `queue` width can be read once as a detail-width fallback, but future writes use the `detail` key.
- Browser verification passed at `http://127.0.0.1:4787`: pane x-order was rail/detail/queue, the right splitter changed detail/queue widths from approximately `314/567/383` to `314/630/320`, reload preserved that layout, and sidebar collapse left detail/queue visible.
- User correction: after the pane swap, the right edge toggle still had old detail-pane semantics. A focused regression test now requires the shell to embed `queue-toggle`, `codetrap-queue-collapsed`, and "Hide queue pane" while excluding the old detail collapsed key/text.
- Fixed the shell collapse policy so the right edge button collapses the rightmost queue pane. Desktop browser verification with a 1280px viewport showed the click changed the shell to `queue-collapsed`, hid `.queue`, kept `.detail` visible and expanded, hid the right splitter, and changed the right button label to "Show queue pane".
- Follow-up interaction polish: preflight codetrap search for `web pane drag collapse edge hover reveal sidebar queue splitter` returned no results. I added drag-collapse thresholds in `client-shell.ts` so dragging the left splitter below a 180px rail target collapses the sidebar, and dragging the right splitter until the queue would be below 230px collapses the right queue pane.
- Added left/right 18px edge reveal zones and transient `rail-peeking` / `queue-peeking` overlay classes. Browser verification at a 1280px viewport passed: left drag produced `rail-collapsed`, left-edge hover produced `rail-peeking` with a 330px overlay, moving away hid it; right drag produced `queue-collapsed`, right-edge hover produced `queue-peeking` with a 390px overlay, moving away hid it.

### 2026-06-03

- Task: finish the session capture candidate inbox flow and reconcile docs after the architecture deepening.
- `codetrap session capture --trap-json ...` initially wrote agent-drafted post-flight lessons into the session candidate inbox; as of 2026-06-05, `--trap-markdown -` is the preferred agent input and `--trap-json` remains the structured fallback. If no session is active, capture creates a post-flight session, writes the candidate and recap, then closes the session so no active state is left behind.
- Candidate draft normalization, capture evidence, explicit note extraction, and merge/dedupe policy live in `src/lib/session-capture.ts`; `src/lib/session-candidate-document.ts` owns the pure `candidate-traps.json` state transitions.
- CLI and web candidate review now share `src/lib/session-review.ts` for session payload paths, accepted-missing review status, conflict payloads/text, and accept/reject/cleanup payloads.
- Embedding provider availability, provider config, setup next action, and provider-required errors moved behind `src/lib/embedding-runtime.ts`. Jina remains the only implemented provider; the new module is the adapter seam for future local providers.
- Neat-freak docs sync found stale agent guidance in installation/release snippets and a web-only handoff. Updated AGENTS, README, install/release docs, roadmap, dogfood log, handoff, and OpenSource Explorer progress notes to point at the current session-capture and embedding-runtime shape.

### 2026-06-04

- Task: implement candidate review visibility for pending session candidates.
- Preflight codetrap search for `candidate review visibility pending session doctor web inbox` returned no relevant traps. I will keep the implementation additive and derived from existing session files, with no database migration, candidate schema change, daemon, batch review, MCP session tools, or embedding work.
- The main product gap is visibility: `doctor` does not report pending candidates, `session status/list` do not surface pending review counts clearly, and the web review view can show candidates only after selecting a session. The shared solution will compute review counts from session index entries plus `candidate-traps.json`.
- Implemented shared candidate review summaries in `src/lib/session-review.ts` and wired them through `SessionOperations`, `doctor`, CLI session status/list, `/api/sessions`, and the Web Review view. Counts stay derived from session files and remain additive in JSON output.
- Web Review now prefers the first session with pending candidates, shows a project-level review summary banner, and leaves existing single-candidate accept/edit/reject/supersede flows unchanged.
- Updated README, install docs, AGENTS template, and codetrap skills to mention `doctor`, `session status/list`, and `codetrap web` as candidate review entrypoints while preserving CLI-first positioning and explicit accept semantics.
- Validation passed with targeted candidate visibility tests, full `bun test src/tests`, `bunx tsc --noEmit`, and `bun run eval:dogfood -- report`. ESP32 dogfood confirmed the manufactured session has 3 pending candidates visible in CLI, doctor, API, and Web, while confirmed project trap stats remain 8.
- Plannotator gates approved `brief.md`, `plan.md`, `verification.md`, `blockers.md`, and `goal-prompt.md` in `goals/candidate-review-visibility/`.

### 2026-06-05

- Task: implement Markdown Trap Capture as the preferred low-friction agent input for post-flight candidate traps.
- `codetrap session capture --trap-markdown -`, inline Markdown, and `--trap-markdown-file` now parse explicit `Title` / `Context` / `Mistake` / `Fix` drafts while preserving `--trap-json` for structured callers. The parser supports multiline fields, code blocks, comma lists, bullet lists, path globs, related files, and null normalization for empty `Module:` / `Owner:`.
- Markdown capture reuses existing candidate normalization, deterministic quality scoring, dedupe, and session evidence. It still writes only to the candidate inbox; confirmed traps require explicit accept.
- Task: implement Candidate Review Workbench v1 with agent-team support after Markdown capture.
- Web Review Accept, Accept anyway, and Supersede now send the currently visible candidate form as an accept-time edit, so reviewers can polish a candidate and accept it without losing unsaved changes. The action bar shows the draft safety hint.
- Follow-up TDD architecture pass moved Review queue/draft request modeling into `src/web/client-review.ts` and kept `src/web/client-script.ts` focused on DOM composition. `src/lib/session-review.ts` now keeps the base conflict payload transport-neutral, with CLI `next_actions` added through `sessionCliConflictPayload`.
- Validation passed with focused Web/Session Review tests, full `bun test src/tests`, `bunx tsc --noEmit`, `bun run eval:dogfood -- report`, and a browser smoke check for the Web Review draft hint.
