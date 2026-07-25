# Task brief — Phase 1E: Learning Inbox and runtime proof

Parent plan: `docs/agent-experience-compiler-roadmap.md` §16 Phase 1E
Predecessor: `docs/tasks/2026-07-25-phase1d-locking-coverage-and-dedup/`
Date opened: 2026-07-25
Status: **criterion 2 met; criterion 1 partial** — cross-client half not run; see `handoff.md`

## Goal

Close the loop the whole of Phase 1 has been building toward: a lesson mined in
one client, reviewed in one place, committed on the user's authority, and then
actually **used** by an agent in the other client.

```text
learning review (either client)
  -> Learning Inbox: triage within budget
  -> approve in the console, not only the CLI
  -> agent-executed commit on that approval
  -> pre-flight search from the OTHER client finds it
  -> the agent marks it useful, and that signal is recorded
  -> a curated context pack is exported and handed over at planning time
```

## Scope (§16 Phase 1E, unchanged)

- Inbox list/card supports approve, edit, reject, user-visible skip/suppress,
  authorization, commit, rollback, trust receipts, and measured UX budgets.
- Minimal browse surface with curated context-pack export (§10, §12.1).
- Only `pitfall_trap` commits end-to-end; `unclassified` can be reviewed and
  suppressed but not forced into a speculative destination.

### Explicitly out of scope

- No new destination kinds, no insight shelf (Phase 2).
- No hook-based injection — §12.1 rules it out deliberately.
- No spaced repetition or digests (§10 defers them until the study surface sees
  real use).
- No currency/staleness down-ranking in recall (§12.3, Phase 2). 1E marks stale
  *candidates*, which §4.2 requires; stale *traps* are Phase 2.

## Acceptance criteria (§16, unchanged)

1. A user on a real project runs learning review from either client, reviews
   within budget, authorizes an agent-executed commit, and the trap later
   surfaces in a pre-flight search from the other client and is marked useful.
2. At least one curated context pack is exported and handed to an agent at
   planning time.

## Discovery findings

| Fact | Consequence |
|---|---|
| There is no `/api/candidate/approve` route and no Approve control | A console-only user cannot authorize an agent-executed commit at all — 1B risk 2, and criterion 1 runs straight through it |
| **No usefulness signal exists.** `hit_count` increments on `codetrap show` and MCP `get_trap` — it counts *views*, not help | "marked useful" has nothing to record into. This is the criterion's load-bearing verb and it must be built |
| The console has save / accept / reject only | No rollback, no trust receipt, and none of the 1D fields (`review_cluster`, `similar_to`, `coverage`, `contributing_sources`) render |
| §4.2 budgets are written as acceptance criteria, not aspirations | Inbox cap (~30) and staleness (60 days) must be enforced and measured, not documented |

## Design

### D1 — Usefulness is a distinct signal from recall

A new `useful_count` / `last_useful_at` on the trap, recorded by an explicit
`codetrap useful <id>` (and an MCP tool), separate from `hit_count`.

Viewing a trap is not evidence it helped; conflating them would make the §17
falsifier unfalsifiable, because every search would look like a success. §14
wants "useful downstream recall" as a product metric, and that requires a
signal a caller has to opt into.

### D2 — Approve lands in the console, not just the CLI

`POST /api/candidate/approve` plus an Approve control, so the §3.2 split —
user authorizes, agent executes — is reachable without dropping to a terminal.

### D3 — The trust receipt is shown, every time

§4.3: "Users should never have to wonder whether something was silently
written." The console renders a receipt after every durable action, and the
inbox shows a session-level receipt.

### D4 — Budgets are enforced where they are cheap and reported where they are not

- Inbox cap: a new review warns when pending exceeds ~30 and suggests triage.
- Staleness: candidates untouched 60 days are marked stale, never deleted.
- Review time: measured and reported, not asserted.

### D5 — A context pack is committed lessons, chosen by the user

`codetrap pack export --traps <ids>` emits a Markdown pack for planning-time
feeding. §12.1 is emphatic that this is user-invoked and never auto-injected,
and §12.2 that only committed lessons are eligible.

## Plan

1. Usefulness signal: schema, CLI, MCP, and its separation from `hit_count`.
2. `/api/candidate/approve` + console Approve, rollback, and trust receipt.
3. Render the 1D fields the console currently drops.
4. Inbox cap and staleness.
5. `pack export`.
6. `unclassified` blocked from commit, reviewable and suppressible.
7. The live ceremony, with both clients.

## Risk

Criterion 1 is the first claim in this roadmap that cannot be satisfied by code
alone — it needs a real trap, a real search from Codex, and a real usefulness
call. The honest failure mode is building the mechanism and then reporting the
ceremony as passed without actually running it from the other client.
