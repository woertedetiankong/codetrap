# Implementation Log

> Created: 2026-08-31

## Task

Add an end-to-end governed promotion path from an Observation Eval candidate to a checked-in Search Eval case.

## Assumptions

- The reviewed Eval query is intentionally authored content and may be stored only after the user explicitly enters it; it is not automatic Observation capture.
- Existing Phase 2 candidate authorization, commit receipts, atomic snapshots, and rollback are the source of truth for durable fixture writes.

## Initial Approach

- Overlay generated Observation candidates with linked `search_eval_case` session candidates.
- Reuse Phase 2 for draft editing, exact preview, acceptance, and rollback rather than creating a second governance store.
- Add an Evals review editor that makes the user supply query, search mode, judgment, and expected fixture ids.

## Log

### 2026-08-31

- The current fixture schema uses `queries`, but the older Phase 2 `search_eval_case` destination and its test still target a legacy `cases` array. This must be repaired before the Web flow can safely reuse Phase 2.
- Observation stores only a query fingerprint by design. Automatic query reconstruction was rejected; the review form must explain that the user is deliberately adding new ground-truth content.
- Rejected Observation candidates still need an audit trail without requiring a query. A decision-only `search_eval_case` session candidate can reuse the existing rejection/suppression lifecycle, while preview/apply require a complete validated `case` payload.
- The governed overlay links generated Observation candidate ids to existing revisioned session candidates. Multiple linked records fail closed as `conflict`; no source-of-truth heuristic chooses one.
- Fixture trap options come only from the checked-in fixture. An observed project trap id is evidence context, not an automatically trusted fixture id.
- Phase 2 now validates `search_eval_case` against the current fixture and appends to `queries`; the old `cases` destination was removed. Exact duplicates are refused before commit.
- The Web action is the user's authorization for the exact submitted content. Draft preview is non-mutating; accept uses the existing lock/snapshot/receipt transaction; rollback restores exact prior bytes.
- OpenCLI found that rendering loading state before snapshotting the DOM form erased user input after a failed request. The client now snapshots the draft before any async re-render and keeps it through validation errors. A pending pitfall candidate records this pattern for human review.
- OpenCLI also showed the Evals headline wrapping into four fragments in the normal three-pane console. The hero grid and type scale now fit the content pane rather than scaling primarily from the browser viewport.

## Validation

- TypeScript typecheck passed.
- Final full repository suite passed 501 tests with 1 environment-skipped browser smoke test, 0 failures, and 2535 expectations; post-OpenCLI focused Web/locale tests also passed 18/18.
- Release-style compiled CLI and MCP binaries built successfully.
- OpenCLI exercised initial review, validation failure with draft preservation, no-write preview, accept, confirmed state, exact rollback, locale/status rendering, token removal, DOM/storage privacy, console errors, failed requests, and full-page screenshots against an isolated project.
- The isolated fixture stayed byte-identical after draft and after rollback (`SHA-256 835FAF970046AEE50D51F595EBF0E8DA360ED8A69BEF7A595FE3CD4BE7FB194C`), contained exactly one case only while accepted, and never exposed the private observed query.
