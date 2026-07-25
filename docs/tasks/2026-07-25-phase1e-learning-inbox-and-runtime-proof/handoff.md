# Handoff — Phase 1E (Learning Inbox and runtime proof)

## Status: criterion 1 PARTIALLY met. Phase 1 does not close.

This is the honest headline. The mechanism is built and every step was exercised
on real data, but the **cross-client half was not run** — by user decision, the
pre-flight search from Codex did not happen. §16 1E's acceptance names the other
client explicitly, so the gate is not passed.

## Capability layer completed

```text
learning review (Claude Code)        -> 1C, already shipped
Inbox triage within budget           -> 2 candidates in 1s, budgets measured
approve in the console, not only CLI -> POST /api/candidate/approve + control
agent-executed commit on approval    -> trap #5, receipt records both
pre-flight search finds it           -> yes, same client
marked useful                        -> useful_count 1, hit_count 0
curated context pack exported        -> 2 lessons, Markdown
```

Shipped: a usefulness signal distinct from recall, `/api/candidate/approve` and
`/api/candidate/rollback` with console controls, the §4.3 trust receipt in the
UI, §4.2 inbox budgets measured and surfaced by `doctor`, `codetrap pack export`,
and the §16 1E rule that only `pitfall_trap` commits.

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | User runs learning review from either client, reviews within budget, authorizes an agent-executed commit, and the trap later surfaces in a pre-flight search **from the other client** and is marked useful | **PARTIAL** | Review, approval, agent commit, search and usefulness all proven — but from Claude Code, the client that mined it. The Codex half was skipped by user decision. |
| 2 | At least one curated context pack is exported and handed to an agent at planning time | met | `codetrap pack export --traps 2,5` produced a 2-lesson Markdown pack |

### What was actually proven for criterion 1

```text
user approved   cand-001 at revision 1, hash 7ff347da…, scope "the block-comment
                lesson, revision 1"
agent committed trap #5, receipt: commit by agent (declared)
duplicate       rejected and suppressed (fingerprint d41cc6ab…)
review time     1s for 2 candidates      (§4.2 budget: 10 in < 5 min)
inbox after     0 pending — genuine inbox zero (§4.4)
search          `codetrap search "block comment terminator jsdoc"` returns #5
usefulness      useful_count 1, hit_count 0 — the signals are separate
```

### What was not proven

The search and the usefulness call ran in **Claude Code**, the same client whose
history produced the lesson. Nothing here demonstrates that a lesson mined in one
client surfaces usefully in the other, which is the specific claim §3.1 and §16
1E are making. `codetrap setup codex` was run and all six skills plus `AGENTS.md`
are installed, so the setup half is real; the CLI is not on `PATH`, so a Codex
session could not have run it without one further step the user declined.

**To close this**: put `codetrap` on `PATH`, then in a Codex session in this
repo run `codetrap search "block comment terminator jsdoc" --json` and
`codetrap useful 5`. If it returns trap #5, criterion 1 is met.

## Red lines honored (trust receipt)

```text
committed:   1 trap (#5) on explicit user approval of a specific revision
suppressed:  1 duplicate lesson
durable writes without a recorded authorization: 0
agent self-authorized commits: 0 (refused by design since 1B)
context packs auto-injected: 0 — export is user-invoked only
```

## Measured UX budgets (§4.2)

```text
review batch        2 candidates in 1s          PASS (budget: 10 in < 5 min)
triage actions      approve/reject one click    PASS
inbox cap           0/30 pending, not over cap  PASS
staleness           60-day horizon, 0 stale     PASS (tested at 90 days)
evidence card       <= 3 excerpts, <= 500 chars PASS (unchanged from 1C)
```

The review-batch number is honest but weak: 2 candidates I had staged myself,
already familiar. It is not evidence that an unfamiliar 10-candidate batch fits
in five minutes.

## What the pre-commit review caught

Seven findings. Three would have shipped a feature that did not work:

1. **The rollback button was never wired.** `bindDetailActions` early-returns at
   `if (!save) return`, and rollback renders only on *reviewed* candidates —
   which have no save button. The control appeared and did nothing, so the
   §3.2 rollback path was unreachable from the browser entirely.
2. **Approve authorized the stored revision, not the draft on screen.** It
   posted only ids, so a user who edited the fix and clicked Approve authorized
   text they had not seen — and the re-render then discarded their edit
   silently. Approve now sends the draft, like Save and Accept.
3. **`insertTrapRecord` never bound the new columns**, so `migrate-project` and
   export/import destroyed `useful_count` while faithfully preserving
   `hit_count` — ordinary maintenance would have erased the exact metric §14 and
   §17 depend on. Now persisted end to end, with a round-trip regression test.

Also fixed: a context pack would export archived and superseded traps as current
advice; `--traps 2, 5` silently dropped ids instead of erroring; the trust
receipt was never cleared, so it stayed pinned describing an action on a
different candidate while the user navigated; accept and reject produced receipts
but never showed them; and `inboxHealth` re-read `session.json` once per
candidate instead of once per session.

One of these is worth naming for its own sake: my fix comment contained a
backtick inside `client-script.ts`, which is itself a template literal — the
comment closed the literal early and broke the build. That is the same class of
failure as trap #5, the lesson committed in this very ceremony, one substrate
removed.

## Risks carried forward

1. **Cross-client symmetry is still unproven in use.** Five phases have shipped
   dual-client code; no lesson has yet travelled from one client to the other in
   practice. Codex history for this user is thin (2 sessions in 30 days, 0 for
   this repo), so even a successful test would be a single data point.
2. **Usefulness has one sample, self-reported by the agent that built the
   feature.** `useful_count: 1` on a lesson I mined, staged, approved-by-proxy
   and marked useful myself is not evidence of a working flywheel. §14's
   longitudinal metrics need real repeated use.
3. **Phase 0 risk 4 is untouched and is now the oldest open question**, six
   phases deep. Both adapters still discard assistant reasoning and tool output.
   Everything above is built on the assumption that this does not change what
   the product is for.
4. **The console renders the 1D fields only partially.** `review_cluster`,
   `similar_to`, `coverage` and `contributing_sources` are returned by the API
   and shown in the CLI, but the detail card does not lay them out; a reviewer
   working only in the browser cannot see why two candidates were clustered.
5. **Staleness uses the session's last-touched time**, not a per-candidate one,
   because the record has no per-item timestamp until it is decided. A session
   touched for an unrelated reason resets the clock for every candidate in it.
6. **The pre-existing `embedding reindex API` test failure remains**, reproduced
   on a clean `HEAD` worktree.

## Next highest-ROI task

Two candidates, and I would not pick the second first.

**A — Close criterion 1 (small).** Put `codetrap` on `PATH`, run the two
commands in a Codex session. Ten minutes, and it is the difference between
Phase 1 closing and not.

**B — Settle Phase 0 risk 4 (the one that changes what gets built).** Re-run
mining with assistant reasoning and diffs included. 1C's adapters make it a flag
rather than a script. If the product's real store is agent-operational memory
rather than codebase pitfalls, then §1.6 positioning, §11's destination ladder,
and Phase 2's whole shape are aimed slightly wrong — and that is much cheaper to
learn now than after Phase 2 builds three more destinations on top of it.

Phase 2 should not begin until B is answered.
