# Decisions and stage evidence

## 2026-09-05 — Accepted scope

The user requested all five previously proposed stages, and clarified that Learning
must support learning-only use. Knowledge promotion stays optional. Baseline is
`f763195`, clean, with generated artifact and both typechecks passing.

The initial broad draft-related search found no match; semantic search is unavailable
because the configured model is not ready. The real project has two active confirmed
lessons: scoped path matching (#3) and SQLite startup locking (#5). Applicability
must be checked against actual work, without claiming a search miss proves absence.
Stage 5 will use real development evidence, not synthetic performance fixtures or
unreviewed candidates, and will separate adoption from successful validation.

## Implemented slices, verification underway

- Shared immutable browser snapshot storage preserves the existing Learning v1
  format. Review, observed Eval candidate, evaluation case and run-parameter
  adapters keep raw fields and bind recovery to owner + source revision/hash.
  Other-tab versions are retained; quota/read failures keep editors usable. No
  recovery restores a preview, authorization, request ID or pending mutation.
- Review browser regression: 4 passing. New recovery browser regression: 3
  passing, including concurrent tabs, changed candidate/corpus, quota, raw text,
  mobile overflow and zero automatic writes. Observed-candidate coverage is next.
- Learning catalog and Impact now have typed state factories and request owners;
  shared latest-request generations reject superseded reads and A/B/A results.
  Review already owns typed requests. New request regressions: 5 passing.
  Learning existing browser scenarios: 6 passing; evaluation set end-to-end: 1
  passing. Copy assertions are being updated to the optional-learning wording.
- Synthetic baseline at 10,000 Runs / 60,000 events: repeated combined ledger
  read median 391.99 ms. Snapshot projections now have a bounded 8 MiB process
  cache keyed by project/path plus main/WAL/journal inode, size, mtime and ctime.
  Schema checks still precede use. Changes during read bypass caching; returned
  objects are cloned. A separate-process WAL append, schema replacement and
  mutable-return tests pass. Initial cold JOIN implementation was slower and
  replaced with two bulk queries; final measurement is pending.
- Actual task Run `run-five-stage-75b8680d-efb0-4054-9541-47660e66991e` records
  two actual searches. File-scoped search missed existing #5; unscoped
  `busy_timeout` found it at rank 1. Its path applicability does not cover the
  analogous observation module. This constraint was reviewed and applied while
  preserving timeout-before-SQL startup order. `db-locking.test.ts` passed.
  No favorable human feedback has been fabricated. Final validation/Run closeout
  and the evidence interpretation are still pending.


## Final verification and closeout — 2026-09-05

- Final full regression: 662 passing, zero failures, 95 files, 20 processes.
  The initial full run found two old headline assertions; the updated copy and
  all subsequent runtime fixes are included in the final full pass. Both strict
  checks and generated bundle identity pass. Individual process durations sum to
  133,817 ms; this is test-reported time, not total development time.
- Recovery now has five browser scenarios and request coordination six tests.
  Independent read-only review identified three regressions, all fixed and
  rechecked: false deferred changes on identical polls, stale DOM rebasing onto
  updated candidate context, and a closed dialog clearing a new dialog's backup.
  Logical draft revisions advance even when the storage write fails, preventing
  a later acknowledgement from deleting a newer failed-to-back-up edit.
- Comparable final repeated history reads are 8.06 → 0.47 ms (100 Runs),
  38.17 → 0.46 ms (1,000), and 391.99 → 0.48 ms (10,000). First overview at
  10,000 Runs is 375.36 ms; the final two-query implementation's independent
  append experiment is 396.24 ms median. Both warm and cold limits are documented.
- Rebuilt the standalone after the final fixes. Compiled fresh-tab authorization,
  Learning-only completion, raw drafts/Back/locale, explicit recovery, Review,
  evaluation case recovery, no replay and desktop/phone checks pass. Package
  dry-run includes all new runtime modules. Screenshots were visually inspected.
- Real task Run completed with six observed-fact events: start, two real searches,
  one exposure, successful 662-test validation and completion. Completeness stays
  partial; no human feedback was generated. Adoption is explicitly documented by
  the developer, separately from observed search and validation facts.
- Original audit matches the supplied attachment byte-for-byte, maintainer fixture
  hash is unchanged, and no real project evaluation suite was created. Existing
  proposed memory remains pending; no automatic hooks or paid models were enabled.
- README, installation, browser architecture, audit status, roadmap and task index
  reconciled against final behavior. Handoff records remaining display templates,
  cold-read limits, one-task evidence limits and uncommitted state. No wiki task.


## Final rendered-guidance correction

Source-preview phone QA exposed that the empty Learning list hides its detail pane,
so the detail-only copy prompt was unreachable. The compact catalog now displays
that same prompt. Both locations share the copy handler, whose clipboard-denied
fallback selects the prompt text. Source browser validation exercised this actual
phone path. After this guidance-only adjustment, both strict checks, five browser
smoke scenarios (115 assertions), rebuilt standalone delivery and read-only source
browser checks passed again. The full 662-test pass above precedes this small final
adjustment; the verification JSON distinguishes the final focused checks.


## Git checkpoint — 2026-09-05

The user explicitly requested a Git commit after delivery. The complete five-stage
change and its verification records are checkpointed as
`feat: complete five-stage product polish`. Current status references were updated;
prior validation entries retain the state at which they were written. No runtime
code changed during commit preparation, and no push was requested.
