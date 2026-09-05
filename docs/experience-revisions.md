# Review an experience from task feedback

Updated: 2026-09-04 (America/Los_Angeles).

In **Impact → Runs**, expand a real lesson exposure or feedback event and choose
**Review this lesson**. Record your judgment, explain the issue, edit the lesson,
and add at least one query where it should surface and one where it should stay
out. **Save & test** compares the original and proposed content against the same
frozen corpus. **Apply tested revision** changes the selected lesson after every
case passes; **Reject draft** closes a proposal without changing the lesson.
The Library's **Experience revisions** section reopens saved drafts and receipts.
Unsaved editor text remains intact during operations in the open dialog; save
before closing the dialog or reloading the page.

Only title, context, mistake, fix and tags change. IDs, provenance, evidence and
usage remain attached to the lesson. Global lessons carry an explicit warning:
their content is shared by all projects using that store. An older source event
can start a draft against the current active lesson, with the version difference
shown. Missing, unscoped, retired and graduated lessons cannot be revised here;
synthetic onboarding examples do not offer this action.

Tests use offline FTS, without embeddings or model calls. The selected lesson
must appear in the first five positive results and be absent from the first five
negative results. This tests the selected lesson's retrieval boundary in the
frozen fixture, not other lessons' recall, production hybrid ranking, adoption,
or task success. There are at most 20 queries (500 characters each) and 500 active
lessons per scope in this first evaluator. Corpus membership stays fixed when a
draft is edited. Later library changes do not refresh that corpus automatically.
Start a new draft when a new corpus is needed.

Applying requires the tested draft's digest and unchanged base content/lifecycle.
Editing a draft invalidates its evaluation. Concurrent changes to a global lesson
are checked within an immediate SQLite transaction. Content, embedding
invalidation and the acceptance receipt commit together. Retrying the same saved
content or accepted revision is idempotent. Agent-declared feedback, acceptance,
rejection and rollback requests are refused; these endpoints require the explicit
`executor: "user"` declaration used by the review UI. This is an interaction
contract, not authentication of a human distinct from possession of the local
Web token.

**Roll back this revision** restores the five original fields and assigns a new
revision. It preserves counters/evidence and refuses to overwrite later material
or lifecycle changes. Accepted/rejected/rolled-back drafts cannot be edited.
Acceptance and rollback retries retain their original receipts. Later task
activity shows only events with the exact applied scope, ID and revision; an
empty list is absence of recorded evidence, not evidence that the change failed.
An unreadable ledger does not hide a successful revision receipt.

## Storage and recovery

- `.codetrap/experience-revisions/rev-*.json` in the originating project stores
  draft content, rationale, queries, frozen corpus and evaluation. These are
  private project artifacts; they are not copied to Candidate Inbox, shared
  Insights, the observation ledger or source test fixtures.
- The selected project/global `traps.db` lazily creates
  `experience_revision_commits` on first acceptance. It contains before/after
  lesson snapshots, source evidence identifiers/judgment, an opaque owner hash,
  digest and reversible status. It contains no example queries or rationale.
- Feedback itself is an append-only human-label event with the source Run, scope,
  ID and revision. Identical request IDs deduplicate; conflicting reuse fails.
- Back up the originating project's dossier directory and relevant SQLite
  databases (using a consistent SQLite backup). Ordinary lesson JSON export does
  not export revision dossiers/receipts. Do not delete receipts to undo a change.
  The owner hash is bound to the resolved project path; moving a project and
  migrating revision ownership is not implemented in this slice.

## Web API

All endpoints require the normal local Web token and a registered project.
GET uses `project`; POST uses `projectRoot`. Read payloads omit other lessons and
the frozen corpus.

| Endpoint under `/api/experience-revisions` | Contract |
|---|---|
| GET `/context?eventId=…` | Exact real event, scoped lesson fields and feedback |
| GET `?scope=project\|global&trapId=…` | Up to 50 most recent dossiers for that lesson in this project |
| GET `/item?id=…` | Saved draft, reviewed content, results and receipt |
| POST `/feedback` | `eventId`, `feedback`, stable `requestId`, `executor: "user"` |
| POST `/draft` | `id`, `eventId` of real feedback, `draft` fields/reason/cases, previous `digest` for edits |
| POST `/evaluate` | `id`, saved `digest`; fixed baseline/candidate FTS |
| POST `/accept`, `/reject`, `/rollback` | `id`, saved `digest`, `executor: "user"` |

General retrieval expectations use the separate [project evaluation set](project-evaluation-suites.md).
It does not replace a revision's fixed comparison corpus or automatically copy
its cases. See [audit progress](reviews/2026-09-04-product-audit-status.md) for
the remaining frontend, scale and real-outcome work.
