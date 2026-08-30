---
title: Handoff 2026-08-29 - Learning collections and ordered study
status: Complete
updated: 2026-08-29
supersedes: ../2026-08-27-agent-user-experience-hardening/handoff.md
---

# Handoff

## Summary

The Phase 2 Insight Shelf is now a source-aware learning library. Notes from one
article or AI conversation can form a collapsible ordered collection with
progress, previous/next navigation, renaming, and reordering. Search, learned state,
source type, and tag filters remain clear as the library grows, and the Web
console can aggregate every registered project without creating a second store.

## Current State

The learning-collections slice is complete and fully validated. Existing v1
shelves remain readable, and legacy entries sharing a normalized primary source
are grouped lazily without rewriting their files. The implementation is
uncommitted and unpushed. The real local shelf now has two explicitly ordered
version 2 collections with 17 chapters after user-authorized source review and
completion of two identified coverage gaps.

## Git And Persistent State

- Branch: `main`; learning work is based on local `d4bb3f3`. Local `main` is one
  commit ahead of `origin/main` (`8206618`).
- Learning-collection code, tests, Skills, and docs are uncommitted.
- During this task, the user's separate Phase 3 storage-lifecycle changes were
  externally committed as `d4bb3f3`; that commit was not created by this task.
- After explicit authorization, the real shelf materialized `Prompt Caching In
  Agents` (12 chapters) and the Warp self-improvement collection (5 chapters)
  with source-reviewed order. The two added chapters cover Pi's concrete cache
  controls/metrics and Warp's end-to-end Issue triage loop. No chapter was
  marked learned during the change.
- The additions used approved Insight candidates in sessions
  `2026-08-29-phase-2-proposal-prompt-caching-ttl` and
  `2026-08-29-phase-2-proposal-warp-issue-triage-agent`. Their rollback-able
  Phase 2 commits are `p2-20260829144234-59z6g2` and
  `p2-20260829144234-baoxgm`.
- The pre-write shelf backup is
  `C:\Users\EDY\AppData\Local\Temp\codetrap-insights-before-learning-reorder-20260829.json`;
  before/after SHA-256 values are
  `CA52AA9F32B056840F1EF95847D7F74807961A1C3CD32B2F00BA35FDDCF0E8B3`
  and `88BDD0616FD2DEF0B33C50188A51D6E34DD53C577CEB397414948D30E0C80F48`.
  The second pre-add backup is
  `C:\Users\EDY\AppData\Local\Temp\codetrap-insights-before-two-completion-notes-20260829.json`;
  its SHA-256 is `564262A8B60FB7B7321DF5DB91CA7E2DBEE7CA717D283C84E111CBF61C265A2B`.
  The final shelf SHA-256 is
  `70C3D747BBDE1DB08951B643E904009BF5A782841A173EE554F89E0E13EC9FEF`.
  The ignored UI screenshot is
  `artifacts/learning-collapse-redesign.png`.
- Visual review feedback produced proposed project candidate `cand-001` in
  session `2026-08-29-capture-collapsible-collection-headers-must-read-as-one-visual-s`;
  it remains pending and was not accepted automatically.
- The v1-to-v2 materialization added `source_type: article` to the 15 legacy
  records. Titles, summaries, bodies, tags, source refs, timestamps, and learned
  states remained byte-equivalent at the field level.
- Apart from the two explicitly authorized Insight candidates, no pending trap
  candidate decision, install, release, package-version change, Git commit, or
  push occurred.

## Key Decisions

- Project files remain the durable source of truth. The all-project view reads
  only Web-console registered projects and scopes UI identity by project root.
- Two or more legacy insights with the same normalized primary source form an
  inferred collection on read; only an explicit rename or reorder materializes
  the relation in the version 2 shelf document.
- Source collections describe provenance and recommended order. Future
  user-curated, cross-source learning paths are a separate concept.
- Opening a note remains read-only; **Mark learned** remains idempotent.

## Changed Surfaces

- `src/lib/phase2-store.ts`: compatible v2 collection/item document, legacy
  inference, source metadata, progress inputs, rename, and exact reorder.
- `src/web/server.ts`: registered-project aggregation plus protected collection
  update/reorder routes.
- `src/web/client-script.ts`, `client-text.ts`, `static.ts`: collection catalog,
  scope and filters, accessible collapse/expand, progress, breadcrumb,
  navigation, and mobile presentation.
- Learning staging/review and bundled Skills: direct Insight candidates with
  source type, topics, shared collection identity, and recommended position.
- README and installation docs: current learning-library behavior and boundary.

## Cross-Module References

- Depends on: [Phase 2 low-risk destinations](../2026-08-08-phase2-low-risk-destinations/handoff.md)
  and [agent/user experience hardening](../2026-08-27-agent-user-experience-hardening/handoff.md).
- Referenced by: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md).

## Red Lines And Gotchas

- Do not route study content into the confirmed trap database; the Insight Shelf
  is the governed learning destination.
- Do not aggregate arbitrary filesystem projects. Cross-project reads are bound
  to the authenticated Web registry.
- Do not silently persist inferred collections during reads. Materialize only
  after an explicit collection mutation.
- Do not treat source order as mandatory unlocking, mastery, or spaced
  repetition; those remain out of scope.
- Do not commit, push, publish, release, install globally, or accept pending
  candidates without explicit user authorization.

## Validation

- `bun run typecheck`: pass.
- `bun test --timeout 30000 src/tests`: 445 pass, 1 configured Windows skip,
  0 fail, 2,072 assertions across 61 files.
- `bun run build` and `git diff --check`: pass.
- Both modified bundled Skills pass `quick_validate.py` under UTF-8 mode.
- Before the two data-only additions, Node-driven Playwright with real Chrome:
  2 collections, 15 chapters, scope
  toggle, filters, breadcrumb, previous/next controls, no browser errors, and no
  horizontal overflow. Bun-driven Playwright was avoided after reproducing the
  project's recorded Windows hang.
- Collapse follow-up: typecheck and 14 focused Web tests pass; real Chrome
  reported `true -> false -> true` for `aria-expanded`, hid/restored chapters,
  and produced no console or page errors.
- Collapsed-card redesign: real Chrome measured a unified 329px-wide by
  99px-high card, matching header/toggle widths, no overflow, and no browser
  errors. Latest screenshot: `artifacts/learning-collapse-redesign.png`.
- Final shelf/API validation: version 2, 17 insights, 2 collections, 17 item
  relations; Prompt completion is chapter 11 and Warp completion is chapter 3.
  The live `/api/insights` route reports the same counts, and all 15 prior
  Insight records compare structurally equal to the pre-add backup.

## Docs And Wiki

- Rewritten: README and installation learning-library descriptions.
- Reconciled: roadmap dashboard/decision, task index, and `NEXT-SESSION.md`.
- No hand-maintained wiki exists, so none was created.

## Known Risks

- Lazy grouping intentionally requires at least two notes with one matching
  normalized primary source; ambiguous or source-less legacy notes stay
  standalone.
- Cross-source user learning paths, quizzes, spaced repetition, and mastery
  models are intentionally absent until real usage justifies them.
- AI conversations can now produce collection metadata during reviewed
  extraction, but Codetrap does not mine conversations automatically.

## Restart Verify

```powershell
bun run typecheck
bun test --timeout 30000 src/tests/phase2.test.ts src/tests/web-console.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts
```

expected: typecheck exits 0 and the focused learning/Web suites pass. Any
mismatch means the collection storage/API/UI contract drifted.

## Next Steps

1. Use the collection UI on organic article and AI-conversation study material
   before expanding the model.
2. Review and commit the learning slice separately from the existing local
   Phase 3 commit, only with explicit user authorization.
3. Consider cross-source learning paths or review scheduling only after observed
   navigation and retrieval behavior identifies a concrete need.

## Implementation Log

- [implementation-log.md](implementation-log.md) records aggregation, lazy
  inference, source-collection semantics, and browser-validation decisions.
