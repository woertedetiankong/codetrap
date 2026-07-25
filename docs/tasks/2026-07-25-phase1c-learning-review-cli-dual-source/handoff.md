# Handoff — Phase 1C (dual-source adapters)

## Capability layer completed

One adapter contract, two clients. Codex and Claude Code history normalize to
the same envelope and the same source-manifest shape, so nothing above the
adapter knows which client a lesson came from.

```text
codetrap learn sources        -> inventory, both clients, no transcript bodies
codetrap learn review         -> redacted evidence pack + source manifest + prompt
  (agent drafts lesson-candidates.json)
codetrap learn stage          -> deterministic verification, then the review inbox
  -> session approve / session accept   (Phase 1B, unchanged)
```

## Red lines honored (trust receipt)

```text
history read:      read-only, explicit trigger only, allowed roots only
symlinks:          refused, including a symlinked intermediate directory
transcripts copied: 0 — pointers, hashes and <=500-char excerpts only
raw secrets in artifacts: 0 (verified by grep over a real pack)
durable trap writes: 0 across every learn subcommand
review artifacts:  gitignored at creation
```

Measured on real history: `learn review --project-only --last-sessions 3` read
3 files / 3.7 MB / 1368 lines, applied 5 redactions, and produced a 20 KB
evidence pack. A grep for `sk-ant-`, `gh[pousr]_` and `AKIA` patterns over the
pack returns zero.

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Equivalent fixture histories produce the same normalized envelope and source manifest shape from both adapters | met | `learning-sources.test.ts`: same key order, same client-agnostic content, same turn stream, matching manifest values |
| 2 | Per-client doctor passes | met | `codex: skills 6/6 current, guidance current` and `claude: skills 6/6 current, guidance current` after `setup codex` + `setup claude` |

The adapter independently reproduced a Phase 0 measurement: exactly **2 Codex
sessions** in the 30-day window, matching the Phase 0 handoff's "2 sessions in
window against a bar of 10". That is a real cross-validation — the number came
from a throwaway Python script then and from shipped TypeScript now.

## What the pre-commit review caught

Two independent reviewers; eight findings acted on, three of them privacy bugs.

1. **A bearer token survived redaction.** On `auth_token: Bearer <token>`, the
   `credential-assignment` rule matched the literal word "Bearer" as its value
   and consumed it, so the `bearer` rule never saw its marker and the live token
   was written into the evidence pack — while the run still reported a redaction.
   Verified by running the real function. Rule order fixed; the same change stops
   a single secret being counted twice.
2. **The root-containment guard was opt-in and never ran on the contract's own
   path.** `SessionSourceAdapter.read(ref)` took no roots, so `assertInsideRoot`
   was skipped by the interface every third-party adapter would implement.
   `roots` is now a required argument, and a parallel `READERS` table that had
   grown beside the adapters is deleted.
3. **A symlinked intermediate directory escaped the root.** `resolve()` is
   lexical, so `~/.codex/sessions/archive -> /elsewhere` passed a prefix test.
   Containment now compares realpath'd containers.
4. **Unbounded default scope.** A bare `learn review --source X` read the user's
   entire history across every project and wrote excerpts of unrelated work into
   this repo. Now defaults to 30 days / 20 sessions, with the scope stated on
   every run.
5. **The manifest under-reported what was read.** Sessions dropped as
   all-noise were opened and hashed but omitted, so the audit artifact
   understated its own reads.
6. **`--project-only` parsed every transcript body** to find one header field, in
   a command documented as metadata-only. Now a bounded head read: 0.22s over
   315 real sessions.
7. **`unclassified` was silently relabelled `pitfall_trap`.** The shipped prompt
   tells agents to mark insights `unclassified`; staging dropped the field, and
   Phase 1B binds the approval's destination to it — so a user would have
   authorized a trap for something the agent said was not one.
8. **Review artifacts were not gitignored** (Phase 0 risk 6, deferred twice).

## Coverage check status

Still unexercised — a fourth consecutive phase. `learn stage` does deterministic
*ref* verification, which is the §9.3 CLI half for evidence pointers only; the
coverage-claim verification (trap ids, file paths, section anchors) and the
similarity grouping remain Phase 1D's and remain untested.

## Measured UX budgets

```text
learn sources --project-only    0.22s over 315 sessions            PASS
excerpt cap                     <=500 chars, 0 over budget          PASS
evidence pack size              20 KB from 3.7 MB of transcript     PASS
scope disclosure                stated on every review run          PASS
```

## Risks carried into Phase 1D

1. **Turn indices are position-after-filtering.** Evidence refs are
   `<session-id>#<turn-index>` where the index is assigned after noise filtering.
   Adding a noise prefix in a later release shifts every subsequent index, so a
   stored `source_manifest_refs` would silently resolve to a different excerpt.
   The manifest records the file's SHA-256, which catches file mutation, but
   nothing records the normalizer version. **1D should either version the
   normalizer in the manifest or move to a content-derived ref.**
2. **`--since` filters on file mtime, not conversation time.** A session resumed
   for a minute yesterday is admitted by `--since 7d` with six-month-old turns
   inside, and a sync or restore rewrites mtimes wholesale. The inventory fields
   are now named `newest_file_modified_at` / `oldest_file_modified_at` so the CLI
   no longer presents mtime as conversation date, but the filter semantic is
   unchanged.
3. **Tool output and reasoning items are read from neither client.** Both
   adapters keep only message turns. This is the Phase 0 risk 4 blind spot
   ("the extractor discarded assistant reasoning and diffs, where codebase
   lessons plausibly live") carried forward intact — 1C ported the filter without
   re-testing the hypothesis.
4. **Cross-client overlap is still uncomputed.** §13.4 dedup across clients has
   no implementation and no evidence; both adapters exist now, which is the
   precondition, but 1D owns the work.
5. **Codex history is thin for this user.** 234 sessions total, 2 in the last 30
   days, 0 for this repository. Dual-client symmetry is now proven *in code and
   in fixtures*; it is still not proven *in use* for Codex, which was Phase 0
   risk 2 and remains open.
6. **The pre-existing `embedding reindex API` test failure remains**, reproduced
   on a clean `HEAD` worktree.

## Next highest-ROI task

**Phase 1D — compiler hardening (§16).**

Carry into 1D, in order:

- `.codetrap/learning/` locks and concurrent-write regression tests (§13.1). 1C
  added a second writer into that tree, so this is now load-bearing.
- The §9.3 coverage check that has gone four phases unexercised: agent-claimed
  refs verified against trap ids, file paths and section anchors, plus similarity
  grouping that never silently merges.
- Cross-client exact-duplicate consolidation with provenance preserved (§13.4),
  now that both adapters produce comparable envelopes.
- Fix risk 1 above before more candidates accumulate refs that will drift.

Still unspent after four phases, and now the cheapest remaining question:

- Re-run mining with assistant reasoning and diffs included (Phase 0 risk 4).
  1C's adapters make this a flag rather than a script. It decides whether the
  product's real store is codebase pitfalls or agent-operational memory, and
  every phase that passes without answering it builds more on an unverified
  positioning assumption.
