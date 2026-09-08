# Project evaluation sets

Updated: 2026-09-08 (America/Los_Angeles).

Open **Impact → Verification → Retrieval & examples → Manage evaluation set** in the selected project. **Prepare from my lessons**
previews a fixed copy of active, confirmed project and global lessons. Inspect
the titles and sources, then explicitly create the set. If the project already
has the legacy source fixture, **Copy existing tests** previews and copies its
lessons and examples instead. Creating a set never changes the live lessons.

Choose **Add a reviewed example**, write a query, and select the lessons that
should appear—or choose **No lesson should appear**. Preview the expectation,
then confirm it. The receipt is available in **Review → Reviewed**, with the
existing rollback action. Unsaved text can be explicitly recovered from a local browser draft while its source context remains unchanged. Recovery never replays preview or acceptance. Creating
a corpus without examples does not produce a retrieval quality score.

Manual examples use offline keyword search (FTS). All selected lessons must be
in the first five results; a negative example fails if any lesson is returned.
Queries are limited to 500 characters. Corpus creation supports up to 500 active
lessons per scope and refuses a larger set instead of silently truncating it.
Examples are reviewed expectations, not recorded task outcomes or proof of
personal growth. This workflow makes no model calls and writes no observation
events. Governed candidates from real Runs still require authored expectations.

Run an existing controlled comparison to inspect baseline/candidate results.
The runner records the exact suite path, SHA and immutable bytes under
`.codetrap/evals/suites/`, with results under `.codetrap/evals/experiments/`.
These histories remain readable if the active set becomes missing, empty or
invalid; a new comparison requires a valid set with at least one example.

## Reading the evaluation workbench

Verification separates lesson revision evidence from retrieval comparisons. **Retrieval & examples**
shows coverage, saved history, the selected result and a case table. When history
exists, the new comparison form is collapsed so its settings do not displace the
result. Set maintenance is a disclosure. Actual task signals are reviewed through
**Improvements → Add a retrieval example**. The entire Impact shell uses the approved
prototype; none of its areas uses the old review rail. Expanded sections and
context-bound form recovery remain available per project.

- Coverage distinguishes positive and negative examples and names the actual
  engine: offline FTS plus 14-dimensional keyword test vectors. It does not
  evaluate the active embedding profile or real coding-task effectiveness.
- Recall and MRR use positive examples only. An all-negative or empty set shows
  no recall score. The comparison shows passing-example counts; zero new
  regressions can still mean candidate examples fail. Repeats check
  reproducibility and do not increase the number of examples.
- The content-contribution profile masks expected lessons in the baseline. The
  policy profile compares FTS against fixture-directed modes. These are fixed
  retrieval experiments with different intentional variables.
- Table filters expose cases needing inspection, improvements, regressions and
  all cases. Open a query for complete saved top-five rankings on each side,
  expected matches and previous/next navigation within the selected filter.
  Native dialogs support Escape, focus return and a stacked narrow layout.
- Expected titles come from SHA-verified experiment snapshots, never the active
  corpus. Missing or corrupt snapshots retain healthy history with an explicit
  warning and historical IDs. A changed active set is labeled as newer than the
  selected result; rerun to evaluate it.
- The read API evaluates the same parsed bytes that supply the digest. A
  process-local, 24-entry digest/source cache coalesces deterministic summary
  requests; file changes invalidate it. Feedback and history are read fresh.
  Existing persisted experiment schema and approval/rollback rules are unchanged.

Overview's next action opens a recent task with exposure but no feedback when
one is present in the returned recent history. Negative feedback and misses
continue to lead to finding review. No eligible task means ordinary task history,
not an empty evaluation queue; no judgment is recorded by navigation.

Implementation and rendered evidence: [evaluation workbench dossier](tasks/2026-09-08-evals-workbench/handoff.md).

## Storage, identity and compatibility

| Project state | Evaluation source |
|---|---|
| `.codetrap/evals/suite.json` exists | Use this project-local set |
| No local set, but `src/tests/fixtures/search-eval.json` exists | Keep reading the legacy fixture |
| Neither exists | Show setup; never substitute Codetrap's own benchmark |
| Local set is unreadable | Show its error; do not silently fall back to legacy data |

The suite contains frozen `traps`, reviewed `queries`, and optional
`codetrap_suite` version-1 provenance. Fixture IDs are one-based positions in
that frozen array. Library snapshots separately record each source's scope,
original trap ID and revision; project `#1` and global `#1` remain distinct.
The displayed picker and its corpus hash come from the same read. A changed
corpus requires a refresh before selecting expected lessons again. Preview and
acceptance also bind the full file hash, so intervening examples invalidate an
outdated acceptance preview.

Legacy copies preserve positions, content and expectations. Their live source
identities remain explicitly unknown; a fixture ID is never guessed to be a
live trap ID. Copying is explicit, checks the previewed bytes, creates only the
new local file, and does not delete or modify the old file. Opening Verification and
previewing do not migrate data. Existing local corpora cannot be replaced or
refreshed through this first workflow. Later lesson edits do not change them.

New Phase 2 `search_eval_case` proposals bind their destination and corpus hash.
Manual examples additionally bind the previewed file hash. A pre-migration
candidate without a path retains the legacy destination; accepting or rolling
back that old candidate cannot target the new local copy. Rollback restores
exact previous bytes and refuses to overwrite later changes. Undo dependent
appends in reverse order. The existing Phase 2 file snapshots and receipts are
the recovery authority; this is not a new multi-file database transaction.
Retried acceptance returns its original receipt; a rolled-back review cannot
be accepted again by replaying that request ID.

## Download and reuse

**Download evaluation set** downloads the current exact bytes as
`codetrap-eval-suite.json`. It contains lesson content, query text and source
references, so inspect it before sharing or checking it into source control.
The action never writes a chosen source path or overwrites a fixture. A file
changed since the panel loaded requires refresh before export.

The exported JSON can be evaluated using the maintainer tool's `--fixture`:

```sh
bun run scripts/dogfood-eval.ts report --fixture /absolute/path/codetrap-eval-suite.json
```

The maintainer benchmark commands still default to their checked-in fixture;
the Web and governed/controlled product operations use the resolver above.
Export carries enough frozen content for repeatable evaluation, but historical
source references are not cross-project or cross-device live identities. Do
not turn them into links to a different project's matching numeric IDs. File
upload, corpus version replacement and automatic source-test publishing are
not implemented in this slice.

General evaluation sets and [experience revision tests](experience-revisions.md)
remain separate: a revision tests proposed content against its own fixed corpus;
the project suite tests reviewed retrieval expectations. Neither automatically
promotes the other's cases or modifies confirmed memory.

## Web API

All endpoints require the local Web token and a registered project. GET uses
`project`; POST uses `projectRoot`. The explicit `executor: "user"` declaration
is an interaction contract, not authentication of a human distinct from token
possession. Status and preview expose only the selected project's frozen corpus
catalog; export intentionally includes the complete private evaluation file.

| Endpoint under `/api/eval-suite` | Contract |
|---|---|
| GET | State, selected path, counts, file/corpus hashes and frozen lesson catalog |
| GET `/preview?origin=library\|legacy` | Read-only corpus preview and content digest |
| POST `/create` | `origin`, preview `digest`, `executor: "user"`; create only if source still matches |
| POST `/case-preview` | `input` with query, judgment, goldTrapIds; the Web also binds `corpus_sha256` from the displayed catalog |
| POST `/case-accept` | Same `input`, preview `digest`, stable `requestId`, `executor: "user"`; returns candidate/session/commit IDs |
| GET `/export?digest=…` | Exact content, download filename and SHA for the displayed version |

The existing observation Evals payload also reports `controlled.can_run`;
historical availability and permission to run against the active set are separate.
See [audit progress](reviews/2026-09-04-product-audit-status.md) for the remaining
frontend, scale and real-outcome work.
