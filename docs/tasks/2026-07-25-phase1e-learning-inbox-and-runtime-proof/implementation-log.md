# Implementation log — Phase 1E

Decisions affecting the product model, data model, Web review, or CLI/MCP
contract (§19.3). Ceremony evidence lives in `handoff.md`.

## Decisions

### D1 — Usefulness is a new signal, not a reinterpretation of `hit_count`

`hit_count` increments on `codetrap show` and MCP `get_trap`. It counts *views*.
Reusing it as the §16 1E "marked useful" signal would have made every search
look like a success and the §17 falsifier unfalsifiable.

Schema v8 adds `useful_count` and `last_useful_at`, written only by an explicit
`codetrap useful <id>` or the MCP `mark_trap_useful` tool. The tool description
says outright to call it only when the lesson changed what the agent did, and
not merely for reading one — an inflated counter is worse than no counter.

Import and cross-scope transfer reset usefulness to zero: a track record belongs
to the store the lesson was actually used in.

### D2 — Approve and rollback land in the console

`POST /api/candidate/approve` closes Phase 1B risk 2 — a console-only user could
not record an authorization at all, so an agent-executed commit was unreachable
without a terminal. `POST /api/candidate/rollback` gives every committed lesson a
visible way back (§3.2).

### D3 — The trust receipt is a UI element, not a CLI-only courtesy

§4.3: "Users should never have to wonder whether something was silently
written; the product tells them, every time." The console renders the receipt
after every durable action, stating the executor as *declared* rather than
implying codetrap verified it.

### D4 — Budgets are measured and reported, not asserted

`inboxHealth()` reports pending count against the §4.2 soft cap of 30, and
candidates untouched for 60+ days as stale. `doctor` surfaces both and adds
next-actions. Stale is a label; nothing is deleted.

The staleness clock uses the session's last-touched time, because the candidate
record carries no per-item timestamp until it is decided. That is a real
approximation and is logged as a risk rather than papered over.

### D5 — Only `pitfall_trap` commits

`acceptCandidate` refuses any other kind with a message naming the two ways out:
re-classify, or suppress. §16 1E and §11 both require this — an `unclassified`
lesson has no validated destination, and forcing one would create exactly the
speculative stub §8.1 forbids.

### D6 — A context pack is user-chosen committed lessons, and says so about itself

`codetrap pack export --traps <ids>` emits Markdown. The pack's own `note` field
states that it is not auto-injected and does not replace pre-flight search,
because §12.1 is emphatic on both points and a pack that travels without that
caveat invites exactly the misuse.

## Contract changes

```text
codetrap useful <id> [--scope <s>] [--json]
codetrap pack export --traps <id,id,...> [--scope <s>] [--json]
```

MCP gains `mark_trap_useful`. Web gains `POST /api/candidate/approve` and
`POST /api/candidate/rollback`. `doctor` gains `inbox_health`.

Schema v8: `traps.useful_count`, `traps.last_useful_at` — additive, no rewrite.

## Test and typecheck state

`src/tests/runtime-proof.test.ts` — 16 tests: usefulness distinct from views and
accumulating, pack contents and its self-describing note, pack refusing
non-committed ids, inbox cap and the 60-day staleness horizon, doctor surfacing
both, and `unclassified` being reviewable and suppressible but not committable — plus
a regression test for each of the seven pre-commit review findings recorded in
`handoff.md`, including the export/import round trip that would have silently
destroyed `useful_count`.

Full suite: 351 pass, 1 fail — the pre-existing `embedding reindex API` failure
that reproduces on a clean `HEAD` worktree. `bunx tsc --noEmit` clean.

## Closeout

### 2026-08-08

- A Codex pre-flight search returned project trap #5 from the Claude Code
  learning review, and the current repository CLI raised its `useful_count`
  from 1 to 2. This closes criterion 1 and Phase 1. The resolved embedding
  failure and Windows suite evidence live in the Phase 1 closeout dossier so
  this historical implementation record stays append-only.
