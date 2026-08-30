---
title: Handoff 2026-08-29 - Learning source coverage
status: Complete
updated: 2026-08-30
supersedes: ../2026-08-29-learning-collections/handoff.md
---

# Handoff

## Summary

Source-derived learning collections now account for reusable lessons and
substantive background without conflating them. Ordered Insights teach reusable
content; collection `context_sections` preserve dates, authorship, company
profiles, and other source context. Both destinations carry source-unit refs, so
coverage is derived from durable data instead of a model-authored claim.

## Current State

- Prompt Caching is re-audited and complete: 11/11 source units, 12 chapters.
- Warp is re-audited and complete: 13/13 source units, 5 chapters, one visible
  dated-background context section, and no skipped units.
- Collapsed cards show the plain-language audit phrase `原文已核对`; study progress
  remains the only ratio. Detailed counts remain available after expansion.
- The implementation and data migration are complete and validated, but code,
  tests, Skills, and docs remain uncommitted and unpushed.
- No package version, release, global install, approved candidate, or confirmed
  trap changed.
- Independent review findings are fixed: duplicate positions fail before write,
  Web mutations share Phase 2 validation, and existing audited source contracts
  are immutable through individual Insight applies.

## Durable Contract

- Inventory the exact source before drafting and fingerprint it.
- Route core knowledge and examples to ordered Insights.
- Route substantive background to collection `context_sections`.
- Exclude page chrome and non-body material from the inventory; use explained
  skips only for intentional editorial exclusions, not as a background bucket.
- Derive complete/incomplete/curated/sampled/unknown from stored Insight refs plus
  context refs. Partial shelves remain usable and visibly incomplete.
- Use one validated `phase2 propose-batch` for a multi-Insight source.
- Reject occupied positions and any per-Insight attempt to replace an audited
  collection's manifest, source context, or metadata. Append/re-audit needs a
  dedicated future operation.

## Changed Surfaces

- `src/domain/source-coverage.ts`: context-section model and validation.
- `src/lib/phase2-store.ts`, `phase2-operations.ts`, and `learning-stage.ts`:
  persistence, batch validation, and coverage across both destinations.
- `src/lib/learning-review-dir.ts`: inventory and routing prompt.
- Web client/text/styles: editorial cards and expandable source context.
- Web server and Phase 2 store: shared edit validation plus final collection
  position/source-contract invariants.
- Bundled external-capture and learning-review Skills: the same no-omission
  routing contract.
- Tests and current project documentation.

## Git And Persistent State

- Branch `main`; local HEAD `d4bb3f3`; `origin/main` `8206618`.
- Pre-completion backup:
  `C:\Users\EDY\AppData\Local\Temp\codetrap-insights-before-warp-background-completion-20260830.json`
  (SHA-256 `4e17fdccf08e897f5088d29a16c0c78bdf4dfc7d981224cfd7e2abb0912719e4`).
- Pre-context-migration backup:
  `C:\Users\EDY\AppData\Local\Temp\codetrap-insights-before-warp-context-migration-20260830.json`
  (SHA-256 `9a94b50729b909e388e70a5f95be8835e1fb7e211c45a815c211c13511661cd5`).
- Current shelf still reports Prompt Caching complete 11/11 and Warp complete
  13/13 with five chapters and one background section. Consultation state is
  user-mutable, so the live shelf is not pinned to a post-migration hash.
- Web server is running from current source on port 4737; its token is ephemeral.

## Validation

- Focused regression: 61 pass, 0 fail, 423 assertions.
- Full suite: 453 pass, 1 existing Windows browser skip, 0 fail, 2,134
  assertions across 62 files.
- `bun run typecheck`, `bun run build`, both Skill validators, and
  `git diff --check`: pass.
- Real Chrome: both cards show audited status; Warp background expands correctly;
  complete 13/13 detail; no console errors, warnings, issues, or overflow.

## Pending Review

- The no-omission semantics candidate remains pending in session
  `2026-08-30-capture-do-not-discard-substantive-article-background-when-a-lea`.
- The PowerShell/Bun quoting candidate remains pending in session
  `2026-08-30-capture-do-not-pass-substantial-javascript-to-bun-e-through-nest`.
- The collection-invariant candidate `cand-001` remains pending in session
  `2026-08-30-capture-learning-collection-invariants-must-hold-at-both-mutatio`.
- Do not auto-accept candidates, commit, push, install globally, publish, release,
  or change package version without explicit authorization.

## Restart Verify

```powershell
bun run typecheck
bun test --timeout 30000 src/tests/source-coverage.test.ts src/tests/phase2.test.ts src/tests/learning-review-cli.test.ts src/tests/web-console.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts
```

The expected result is a clean typecheck and 61 focused passing tests.
Any mismatch means the source manifest, context routing, durable coverage, Skill
prompt, or Web presentation contract has drifted.

## Next Steps

1. Let the user inspect both expanded collections in the running Web console.
2. Review the pending Codetrap candidates; do not accept them automatically.
3. Commit the learning slices only with explicit authorization.

## Implementation Log

[implementation-log.md](implementation-log.md) records the source-accounting,
context-routing, data-migration, UI, Skill, and validation decisions.
