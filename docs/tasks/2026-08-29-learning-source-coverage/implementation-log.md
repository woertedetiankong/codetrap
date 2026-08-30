# Implementation Log

> Created: 2026-08-29

## Task

Add durable, user-visible source coverage so learning content cannot silently be
presented as complete when source material has no destination.

## Decisions

### 2026-08-29

- Chose “no unexplained omissions” rather than an impossible guarantee that AI
  discovers every semantic interpretation.
- Kept source completeness separate from candidate overlap/dedup `coverage`.
- Derived status from durable source refs instead of storing a writable
  `complete` boolean.
- Added fingerprinted `full_source` and `sampled` manifests. Declared units route
  to learn or an explained skip; Insight refs may name only learnable units.
- Added atomic `phase2 propose-batch` so a multi-Insight account is checked before
  any candidate write.
- Kept partial shelves usable and visibly incomplete.
- Made AI-session review fingerprint the exact sampled evidence pack and forbid a
  false full-source claim.
- Preserved additive compatibility: collections without a manifest are unknown,
  not guessed complete.
- Updated external-capture and learning-review Skills to inventory first and
  draft second.

### 2026-08-30

- User review clarified that “no omissions” includes substantive background even
  when it is not reusable methodology. Treating Warp's company profile as a skip
  was technically accounted but violated the product promise.
- Added collection-level `context_sections` for source background. Their
  `source_unit_refs` contribute to derived coverage alongside Insight refs, so
  background remains visible without becoming a fake chapter.
- Simplified collapsed cards: study progress is the only ratio; source accounting
  is a short secondary phrase such as `原文已核对`. Detailed counts remain behind
  progressive disclosure.
- Re-audited both real articles. Prompt Caching is complete at 11/11 source units
  and 12 chapters. Warp is complete at 13/13 units and 5 chapters, with one dated
  background context section and no skipped units.
- Backed up the shelf before each data write. The completion backup SHA-256 is
  `4e17fdccf08e897f5088d29a16c0c78bdf4dfc7d981224cfd7e2abb0912719e4`;
  the context-migration backup SHA-256 is
  `9a94b50729b909e388e70a5f95be8835e1fb7e211c45a815c211c13511661cd5`.
- Final gates: 54 focused tests pass; full suite 451 pass / 1 configured skip / 0
  fail; typecheck, build, both Skill validators, `git diff --check`, and real
  Chrome at narrow width pass without browser errors or overflow.

## Persistent Review Notes

- The no-omission semantics candidate remains pending in session
  `2026-08-30-capture-do-not-discard-substantive-article-background-when-a-lea`.
- The PowerShell/Bun quoting candidate remains pending in session
  `2026-08-30-capture-do-not-pass-substantial-javascript-to-bun-e-through-nest`.
- Neither candidate was auto-accepted.

### 2026-08-30 review hardening

- Independent dirty-worktree review reproduced a second-batch position collision
  and showed that Web draft edits bypassed `Phase2Operations.edit`.
- Deeper review found a stronger consequence: a crafted Web Insight payload could
  replace an existing collection's manifest with a smaller one, clear source
  context, and derive a misleading `complete` state from the reduced contract.
- Chose defense in depth. Web routes must reuse Phase 2 edit validation, while
  the store independently rejects occupied positions, empty refs for an audited
  collection, and changes to an existing audited source contract.
- Chose to reject ambiguous second-batch appends instead of automatically adding
  the existing collection length. Appending chapters and replacing a re-audited
  collection have different semantics and need an explicit future operation.
- Added store-boundary regression for occupied positions and source-contract
  replacement, plus Web regressions covering save, approval, and apply. Final
  gates are 61 focused tests and 453 full-suite tests passing, one configured
  browser skip, zero failures, typecheck/build/diff checks, and real narrow
  Chrome verification against the two persistent collections.
- Captured candidate `cand-001` in session
  `2026-08-30-capture-learning-collection-invariants-must-hold-at-both-mutatio`.
  Review recommends tighter applicability metadata; it remains pending and was
  not accepted automatically.
