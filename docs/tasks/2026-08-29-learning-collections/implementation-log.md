# Implementation Log

> Created: 2026-08-29

## Task

Upgrade the flat Phase 2 Insight Shelf with source collections, ordered study,
registered-project aggregation, and learning-library filters.

## Assumptions

- The first release optimizes an early-stage personal library and keeps
  project-local files as the durable source of truth.

## Initial Approach

- Extend the existing Phase 2 JSON document compatibly, infer useful legacy
  collections on read, and materialize them only on an explicit collection edit.

## Log

### 2026-08-29

- Chose registered-project aggregation over a new home-global writable store.
  This preserves current candidate authorization, exact snapshot rollback, and
  project isolation while still providing an all-project reading view.
- Chose lazy legacy inference: two or more ungrouped insights with the same
  normalized primary source appear as an inferred collection ordered by
  `shelved_at`; rename/reorder materializes that relation. This avoids a silent
  migration while making the current 15-item single-blog shelf useful immediately.
- Kept source collections distinct from future cross-source learning paths. The
  storage uses collection-item relations so a later path type does not require
  moving Insight records.
- Real Chrome validation confirmed the existing Windows runtime trap: Bun-driven
  `playwright-core` hung even with a discovered Chrome executable, while the
  repository's documented Node-driven fallback completed in 2.6 seconds. The
  real local shelf rendered 2 collections and 15 chapters with no horizontal
  overflow or browser errors; the configured Windows browser-smoke skip remains.
- Closed the slice after typecheck, compiled builds, both bundled Skill
  validators, and the full 61-file suite passed: 445 tests, 2,072 assertions,
  zero failures, and one configured Windows browser-smoke skip.
- Added a follow-up accessible collection toggle after the user reviewed the
  real UI. Collapse state survives list re-renders, rename remains an independent
  action, and detail navigation reopens the target collection. Focused Web tests
  passed 14/14, and Node-driven real Chrome verified expanded -> collapsed ->
  expanded state with no browser errors.
- A second user screenshot review rejected the split-column collapsed header.
  Reworked it as one editorial surface: full-width toggle, quiet corner rename,
  unboxed chevron, and one compact progress row. Real Chrome measured a 99px
  collapsed card at 329px width with no overflow or console errors. Captured the
  reusable visual-hierarchy lesson as pending candidate `cand-001` in session
  `2026-08-29-capture-collapsible-collection-headers-must-read-as-one-visual-s`.
- After explicit user authorization, read both source articles through OpenCLI
  and materialized the two real inferred collections with reviewed semantic
  order. Renamed the first collection to `Prompt Caching In Agents`, moved its
  KV-cache foundation from position 11 to position 2, and reordered the Warp
  set as architecture -> Skill design -> feedback trust -> verification. The
  v1-to-v2 write added accurate `source_type: article` metadata; all 15 titles,
  summaries, bodies, tags, source refs, timestamps, and learned states remained
  unchanged. A pre-write backup is in the Windows temporary directory.
- A completeness audit found two source-backed gaps: Pi's concrete cache
  retention/observability controls and Warp's end-to-end Issue triage example.
  After explicit user authorization, added both through the normal Insight
  proposal, approval, and commit path, then reordered them to Prompt chapter 11
  and Warp chapter 3. The shelf now has 17 insights (12 + 5); a structural
  comparison against the pre-add backup confirmed all 15 prior Insight records
  remained unchanged.
