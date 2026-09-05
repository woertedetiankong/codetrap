# Implementation log

## 2026-09-04 — Route identity and daily reading
- Extend the existing hash router with scoped item identity and opaque project references derived from normalized registered roots. No project identity file or registry migration is needed just to read or share a local route.
- Learning links retain both the workspace project and Insight origin when browsing all projects. Missing identities remain explicit rather than falling back to an unrelated first item.
- Keep the established palette. On narrow screens, move between a list and a focused reader with one main scroll area; desktop keeps both panes.
- Read existing owned hook configuration separately from recorded Runs: installed configuration is not proof of execution or client trust.

## Verification and refinement
- API/codec coverage checks deterministic project references, scoped item round-trips, cross-project Insight origins, missing targets, client-specific configuration, and corrupt ledgers without read-time writes.
- Browser journeys check refresh and Back/Forward through saved practice notes, accepted global lessons, originating Runs, missing-item recovery, and mobile list/detail transitions. Fixed the project sheet remaining over mobile content after selecting a project.
- Native filter expansion is remembered from summary clicks, not synthetic toggle notifications from desktop rendering; otherwise resizing could incorrectly retain desktop expansion on phones.
- Visual checks on a 390 × 844 phone confirmed focused reading. Condensed Library health summaries into three compact controls so the actual list is visible earlier.
- One browser check transiently timed out awaiting scoped evidence after changing a filter; the diagnostic rerun and five bounded repetitions passed. Keep failure diagnostics and verify again in the final suite.

- A mobile history regression exposed reader replacement while task choices were loading. `loadLearningRunsForCurrentInsight` now hydrates only the task select; it preserves the practice editor, focus, and reader DOM. The browser test settles focus scrolling before measuring and verifies Back/Forward restores the actual reading position.
- Two single-process full-suite attempts were terminated with exit 137 (the latter after 469 passes and no assertion failures). Final coverage ran as five sequential batches, with previews stopped and no overlapping build.

## Final checks
- All 75 test files passed in five sequential batches: **562 tests, 0 failures, 3,065 assertions**. Logs are archived under the session visualization directory, `verification/workspace-suite-{1..5}.log`.
- Typecheck and standalone compilation passed. The compiled interface opened the real project and retained project-scoped lesson #3 on refresh.
- The final copy-only refinement says an absent ledger means no task observations, without inferring missing hook configuration. The 21 client text/script checks and standalone rebuild passed after that refinement.
