# Implementation Log

> Created: 2026-08-30

## Task

Implement a production, real-data observational Evals v1 inside the existing Impact Web workspace.

## Assumptions

- A project opts into deterministic retrieval metrics by checking in the existing Search Eval fixture path; ordinary projects without it receive a setup state rather than Codetrap maintainer benchmark numbers.
- Review candidates in this slice are evidence projections, not persistent governed candidates.

## Initial Approach

- Add a bounded, typed Observation Evals projection to the Ledger, combine it with a deterministic project-local Search Eval summary in a privacy-safe Web DTO, and render it as a third Impact tab.

## Log

### 2026-08-30

- Chose three explicit evidence lanes: checked-in deterministic retrieval, observational outcome evidence, and unconfirmed review candidates. Combining them into one score would erase different denominators and imply unsupported causality.
- The Web API will never return Search Eval query text, ranked titles, or raw Observation attributes. The fixture is evaluated in memory, while the browser receives only aggregate metrics, counts, fixed source metadata, and sanitized status.
- Candidate creation is read-only in v1. Stable projected candidates link back to the evidence Run, but accepting or writing an Eval case remains a future governed workflow so observation cannot silently become ground truth.
- Search Eval computation is lazy: Overview/Runs do not wait for the project fixture, and the deterministic evaluation is requested only after the user opens Evals (or refreshes while it is active). This keeps the existing evidence navigation responsive while preserving a current checked-in result.
- A failed validation becomes a review candidate only when a trap exposure precedes it in the same Run sequence. The label remains “after exposure” and “association only”; it does not assert the exposure caused either success or failure.
- Focused Ledger/API/client/localization tests passed after the first vertical integration: 30 pass, 0 fail. The Windows browser smoke path remains the repository's intentional skip, so static responsive and inline-script compilation contracts carry this stage until a supported browser run is available.
- Final validation passed: 485 tests passed, one intentional Windows browser smoke was skipped, typecheck/build/diff checks passed, and the current 24-case deterministic fixture projected Recall@3=1, Recall@5=1, and MRR=1 without creating a production Ledger. No commit or PR exists for these decisions yet.
- A user screenshot exposed a navigation flaw after the milestone review: the unconfigured Overview returned its empty state before rendering the shared Impact tabs, so Evals was implemented but unreachable from the UI. The Overview now keeps the shared tabs visible in every data state and scopes the empty message to the active tab content. A focused post-feedback check passed with 21 tests and 239 expectations.
- Captured the reusable lesson as unconfirmed candidate `cand-001` in session `2026-08-30-capture-keep-workspace-sub-navigation-visible-in-empty-states`; it remains pending human review and was not accepted automatically.
