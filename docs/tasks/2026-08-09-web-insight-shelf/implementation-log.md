# Implementation Log

> Created: 2026-08-09

## Task

Connect the Web UI to the real Phase 2 Insight Shelf and remove the misleading
trap-derived Insights dashboard.

## Assumptions

- The approved F1-F6 set replaces, rather than preserves under a new name, the
  standalone descriptive analytics page.

## Initial Approach

- Reuse the existing Phase 2 store behind authenticated, project-bound Web
  routes, then replace the current `insightTraps` client state with actual
  insight records.

## Log

### 2026-08-09

- Screenshot and source inspection confirmed a naming/data-source collision:
  the Web `Insights` tab called `/api/traps` and rendered trap counts,
  categories, modules, tags, and recent traps. It never accessed
  `.codetrap/phase2/insights.json`. The user approved removing that standalone
  analytics surface and assigning the navigation slot to learning-only insight
  content.
- Product decision: opening an insight is read-only. Consultation count changes
  only through an explicit user action so passive browsing is not mislabeled as
  learning.
- Added authenticated, registered-project-bound list/consult routes backed by
  `Phase2Store`. The API regression proves traps and insights do not leak into
  one another, unauthorized consultation fails, and an unknown insight returns
  404.
- Replaced the `Insights` navigation slot with `Learning`, using the real Phase
  2 shelf. The empty state explicitly says that traps are not copied there.
  Detail opening stays read-only; **Mark learned** is the only browser path that
  calls the consultation mutation.
- Removed the duplicate category/module/tag/severity analytics. The Library now
  has clickable current / needs-validation / never-useful health filters. The
  validation window is supplied by `DEFAULT_RANKING_CONFIG` (180 days) so UI
  health and runtime stale down-ranking cannot drift independently.
- Fresh browser inspection on the current project verified the English Library,
  health filtering, English/Chinese Learning empty states, responsive rendering,
  and no console errors. The project's real shelf is empty, as independently
  confirmed through the Phase 2 CLI.
- Final gates: typecheck passed; 398 tests passed, 1 configured browser-smoke
  test skipped, 0 failed, 1693 assertions across 56 files; benchmark verification,
  both Windows compiled binaries, npm dry-run packing, and `git diff --check`
  passed.
