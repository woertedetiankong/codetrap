# Implementation log — Phase 1A

Decisions affecting the product model, data model, Web review, or CLI/MCP
contract (§19.3). Ceremony evidence lives in `handoff.md`.

## Discovery: what the existing code already did

Driven against the real CLI in a sandbox before any code was written, because
the brief predicted "several probably do" and guessing would have inflated the
slice.

| Criterion | Before | Evidence |
|---|---|---|
| 1 — user approves | process, no code gap | — |
| 2 — agent commits on instruction | path worked, executor unrecorded | `session accept` wrote trap #1 |
| 3 — searchable afterward | **already satisfied** | FTS returned the trap; no change needed |
| 4 — reversible | **broken** | `codetrap delete 1` left `cand-001` at `accepted` with a dangling `accepted_trap_id`; the only repair was `session cleanup`, which *deletes* the candidate |
| 5 — suppression survives | **broken** | rejected in one session, re-captured as `proposed` in the next |
| 6 — receipt | **absent** | `suppress`/`executor`/`receipt`/`rollback`/`fingerprint` had zero hits in `src/` |

Root cause for 5: candidate dedup was `candidateTrapKey` compared only within a
single session's `candidate-traps.json`, so every decision died at the session
boundary.

## Decisions

### D1 — Suppression is a fingerprint index, not a fourth candidate status

`CANDIDATE_STATUSES` is unchanged. `reject` keeps writing `rejected` on the
candidate and additionally records the lesson's fingerprint in a project-level
index. Considered and rejected: adding a `suppressed` status, which would have
handed Phase 1B's three-axis state migration a fourth state to carry for a
distinction 1A does not yet need. §16 wording supports this — a skip "records
suppression reason/fingerprint **instead of becoming a candidate type**".

Fingerprint = SHA-256 (first 32 hex chars) of `trapContentKey`: title, context,
mistake, fix and scope, whitespace-collapsed and lowercased. This reuses the
normalization that `candidateTrapKey` already applied, so same-evidence re-mining
yields the same fingerprint. It is deliberately *not* a semantic match — §13.4
semantic dedup is Phase 1D.

### D2 — Rollback deletes the trap rather than archiving it

`session rollback <candidate-id>` deletes the durable trap and returns the
candidate to `proposed`. The store therefore matches its pre-accept state, and
the audit lives in the receipt log rather than in a tombstone row. Archiving was
the alternative; it preserves evidence rows but leaves residue, which makes
"reversible" weaker than the exit gate wants.

Rollback **refuses** when the accept superseded another trap — see the review
findings below; that case cannot be reversed without new DB surface, and
half-reversing it would lose the predecessor lesson silently.

Rollback tolerates an already-missing trap on purpose: a candidate stranded by a
bare `codetrap delete` is exactly the pre-1A failure mode, and rollback is the
repair path for it. The receipt records that the trap was already absent.

### D3 — `executor` is a declared claim, recorded but never verified

`--executor user|agent` defaults to `user`; `--authorized-scope` defaults to
`candidate <id> only`. §3.2's security-boundary statement is explicit that
codetrap cannot distinguish a human from a same-account agent, so the receipt
says `executor is declared by the caller, not verified` rather than implying
proof. An unknown executor is refused at the CLI/Web boundary instead of being
recorded verbatim.

Requiring the flag on every write was the alternative. Rejected: it breaks every
existing caller for a field that is a claim either way.

### D4 — Receipts and suppressions live at project level, not in the session

`.codetrap/receipts.jsonl` (append-only) and `.codetrap/suppressions.json`.
Placing either inside `.codetrap/sessions/<id>/` would let `session delete` or
`session prune` silently un-suppress a lesson and erase the audit trail — the
exact failure Phase 1A must prevent. This matches §3.2's rule that deleting a
review preserves the non-sensitive audit metadata durable destinations need.

Not `.codetrap/learning/`: that directory and its locks are Phase 1D's.

### D5 — `captureCandidate` returns a discriminated union

`SessionCaptureResult` is now `{suppressed: false, ...}` | `{suppressed: true,
suppression, fingerprint, title}`. This forces the CLI, MCP and test call sites
to handle suppression rather than dereferencing a null candidate. The CLI's JSON
capture payload gained `suppressed: false` so both branches are discriminable by
machine consumers.

The suppression check runs **before** the auto-session is created. Otherwise a
suppressed lesson would still leave an empty session behind, and "does not
reappear" would degrade into "reappears as an empty session".

### D6 — Suppression also filters `close --propose-traps`

`SessionStore.closeSession` takes an `isSuppressed` predicate. Without it the
note that produced a rejected lesson would re-propose it on the next close,
which defeats the criterion through a second door.

## Contract changes

CLI — four new `session` subcommands:

```text
session rollback <candidate-id> [--session <id>] [--executor <e>] [--authorized-scope <s>]
session receipts [--limit <n>] [--json]
session suppressions [--json]
session unsuppress <fingerprint> [--json]
```

`session accept` and `session reject` accept `--executor` and
`--authorized-scope`. `accept` returns `receipt`; `reject` returns `suppression`
and `receipt`; `capture` returns `suppressed`.

Web — `POST /api/candidate/accept` and `/reject` accept `executor` and
`authorizedScope` in the body (default `user`) and return the receipt.

MCP — `capture_candidate` returns the suppressed branch with the fingerprint and
an instruction not to re-submit. No new MCP tool: accepting stays off the MCP
surface so the capturing agent does not also drive the gate (unchanged from
README's existing statement).

## Out of scope, deliberately

No `LessonCandidate` schema, `revision`/`content_hash`, or three-axis state (1B).
No `learn` subcommands or pull adapters (1C). No `.codetrap/learning/` locks,
coverage machinery, or semantic dedup (1D). No Inbox UI or context-pack export
(1E). No destination kinds beyond `pitfall_trap`. The two cheap adjacent items
from the brief (gitignore/doctor guard, mining re-run) were scoped out by user
decision.

## Self-review findings and fixes

A code review of the slice ran before commit. Seven findings were acted on; the
first was a genuine data-loss bug in new code.

1. **Rollback silently orphaned a superseded trap.** `accept --supersedes N`
   marks trap N `superseded`, and nothing in the store can restore it — `status`
   and `valid_until` are not in `TRAP_UPDATE_FIELDS`, and there is no
   un-supersede query. Deleting the successor would therefore have retired both
   lessons and lost the older one with no warning. Fixed by **refusing** the
   rollback when the committed trap has a `supersedes_id`, with an error naming
   the manual path. Restoring superseded traps needs new DB surface and belongs
   to 1B. The commit receipt now also records `superseded_id`.
2. **`closeSession` computed proposals unconditionally.** The first cut ran
   `proposeCandidateTraps` and the suppression predicate on every close, so a
   plain `session close` — including the auto-close inside every `session
   capture` — did work it never used to and could newly fail on a corrupt
   suppression index. Moved back inside the `--propose-traps` branch.
3. **One torn line made the whole audit log unreadable.** `listReceipts` threw
   on the first unparseable record. A process killed mid-append leaves exactly
   that, and losing read access to an append-only audit trail over one byte is
   disproportionate. Bad lines are now skipped and counted (`damaged`).
4. **A parseable-but-wrong-shaped suppression index crashed late.** `{}` parsed
   fine and then produced a `TypeError` inside the capture path. Now validated
   at read with the actionable "fix or delete the file" message.
5. **`parseExecutor` returned 500 from the Web routes.** Bad input was reported
   as a server fault; every other body-field validator on those routes raises
   `WebHttpError(400)`. Wrapped to match.
6. **`session receipts --limit` degraded silently.** `--limit=abc` or a
   valueless flag became "no limit" and dumped the whole log. Now rejected.
7. **Duplicated fs helpers.** `writeFileAtomic` and the JSON-read-with-corruption
   message existed in `session-store.ts` and were copied into `learning-store.ts`.
   Extracted to `src/lib/fs-json.ts` and shared, so the atomicity strategy has
   one definition. `AuthorizationInput` was likewise declared twice and now lives
   in `src/domain/learning.ts`.

Also fixed while there: `closeSession` read the suppression index once per
proposed candidate; it now reads it once per close.

Findings accepted rather than fixed, and carried into `handoff.md` as risks:
the suppression index is an unlocked read-modify-write (locks are explicitly
Phase 1D's), rollback's two steps are not atomic (the reachable failure state is
one that re-running rollback repairs), and rejecting an *edited* candidate
suppresses the edited wording rather than the original.

## Test and typecheck state

`src/tests/learning-authorization.test.ts` — 25 tests, one per criterion plus
the boundary cases and a regression test for each review fix above, across the
library, the real CLI binary, and the Web routes.

Full suite: 260 pass, 1 fail. The failure is
`web API > embedding reindex API refreshes project and global profile status`,
which reproduces identically on a clean `HEAD` worktree — pre-existing and
environmental (no embedding provider available here), not caused by this slice.

`bunx tsc --noEmit` is clean, matching the pre-change baseline.
