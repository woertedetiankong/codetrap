# Implementation Log

> Created: 2026-09-08

## Task

Implement the first evaluation workbench slice from the approved UX audit.

## Log

### 2026-09-08 — Evidence and scope

- Reuse the deterministic runner and existing governed review/revision actions. Live embeddings and Agent trials require a separate execution contract; this slice labels the actual engine and dataset coverage.
- Enrich historical experiments only from hash-verified snapshots. A missing or corrupt snapshot must preserve the result with an explicit title-availability warning, never substitute the mutable current corpus.
- Evaluate the same parsed suite that supplies the response digest. Cache only immutable deterministic summaries, bounded by entry count; history and feedback remain fresh.
- Use typed client-prefixed presentation modules within the existing browser import guard. Keep controls in the form so collapsed settings retain draft recovery.

### 2026-09-08 — Rendered verification and compatibility

- Retain a single-column Evals workspace with per-project disclosures, result counts and a horizontally scrollable comparison table. Native case dialogs preserve focus and stack their two sides at narrow widths.
- Show remaining candidate failures before a reassuring verdict, label older-suite results, and mark masked baseline identities separately from expected lesson matches. Recall/MRR are undefined for an all-negative set.
- Route Overview to an exposed, unrated recent task; navigation records no feedback. A header shortcut keeps findings reachable when experiments are long.
- Browser checks caught stale test navigation into the previously collapsed technical timeline. Update the revision regression test to use the existing visible lesson card, then rerun its feedback, evaluation, approval and rollback workflow.
- Preserve draft form fields inside collapsed settings. Existing recovery, uncertainty retry, source-change refusal and audit/rollback tests exercise the same APIs after the layout change.
