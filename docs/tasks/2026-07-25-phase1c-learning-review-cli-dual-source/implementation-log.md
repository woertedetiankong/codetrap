# Implementation log — Phase 1C

Decisions affecting the product model, data model, Web review, or CLI/MCP
contract (§19.3). Ceremony evidence lives in `handoff.md`.

## Discovery

Both clients had real history on this machine, so parity was testable against
reality rather than only fixtures.

| | Codex | Claude Code |
|---|---|---|
| Path | `~/.codex/sessions/<Y>/<M>/<D>/rollout-<ts>-<uuid>.jsonl` | `~/.claude/projects/<slug>/<uuid>.jsonl` |
| Metadata | one `session_meta` header line | repeated on every line |
| Git branch | absent | `gitBranch` per line |
| Turns | `response_item` wrapping `payload.{role,content}` | `type` + `message.content` |
| Sessions here | 234 | 315 |

The asymmetry that shaped the envelope: Codex has a header and no branch, Claude
Code has a branch and no header. The normalized shape is their intersection with
explicit nulls — omitting a field on one side would have made the two adapters
produce differently-shaped objects and left the §16 1C parity gate unmeetable.

Phase 0's `extract.py` was the reference for redaction and noise filtering. It is
gitignored, throwaway, and Claude-Code-only; 1C ports its rules into shipped,
tested, client-agnostic code.

## Decisions

### D1 — One contract, and `roots` is a required argument

`SessionSourceAdapter` is `{id, roots(home), discover(home, opts), read(ref,
roots)}`. `read` takes `roots` **required**, not optional, because the first cut
made it optional and every adapter promptly called the reader without it — the
containment guard existed and never ran on the interface's own path. An optional
guard is a guard some call path will skip.

That change also deleted a parallel `READERS` lookup table that had grown beside
the adapters, so there is now exactly one read path.

### D2 — Parity is asserted on values, not only on key sets

The first version of the parity test compared `Object.keys` of the two manifests.
Both are built by one shared helper, so that assertion was true by construction
and would have passed no matter how far the readers diverged. It now compares the
fields the readers themselves populate — `cwd`, `first_timestamp`,
`last_timestamp`, redaction and session counts — and the envelope comparison
excludes only `source`, `path`, `client_version`, `session_id` and `branch`, each
for a stated reason.

### D3 — The manifest reports every file read, not every file kept

Sessions whose turns were all harness noise are dropped from the evidence pack,
but they were still opened and hashed. Dropping them from the manifest too would
have understated what codetrap read, which is exactly the question the manifest
exists to answer (§3.2). `totals` now carries `files_read`, `sessions` and
`skipped_empty` separately.

### D4 — Bounded default scope

A bare `learn review --source X` originally read the user's entire client
history across every project on the machine and wrote excerpts of unrelated work
into *this* repo's tree. It now defaults to §7.2's 30-day window with a 20-session
cap, and every run states the scope it actually used. `--limit` is the candidate
limit and never bounded reads; conflating the two would have let a user believe
they had capped the blast radius when they had not.

### D5 — Review artifacts are gitignored at creation

`.codetrap/learning/.gitignore` is written the first time a review directory is
created. This is Phase 0 risk 6, deferred through 1A and 1B; 1C is the phase that
starts writing excerpt-bearing artifacts into the working tree, so it is the
phase that has to own it.

### D6 — Deterministic verification is the staging gate

`learn stage` validates against the Phase 1B envelope and verifies that every
claimed `evidence[].ref` resolves against the recorded evidence pack. A candidate
that fails is reported with its reasons, never silently dropped (§8.4).

This is the enforcement Phase 0 risk 5 asked for: "evidence[].excerpt
verbatim-ness is requested, not enforced". Refs are now enforced. Excerpt
verbatim-ness itself is enforced by construction, because the excerpt is produced
by codetrap rather than supplied by the agent.

### D7 — The CLI does not mine lessons

`learn review` produces an evidence pack, a source manifest and the §7.3
discovery prompt. It does not extract lessons. §1.4 is explicit that codetrap is
a compiler, not a brain: deterministic extraction here, semantic judgment in the
agent.

### D8 — One learning-review entry point, shipped to both clients

`codetrap-learning-review` joins the shared skill bundle, so it installs
identically for Codex and Claude Code and there is no way to have it in one and
not the other (§3.1, §7.2). The README section that called the bundle "Codex
Plugin Skills" was itself a §3.1 defect and is retitled.

## Contract changes

```text
codetrap learn sources  [--source <id>] [--since 30d] [--project-only] [--json]
codetrap learn review   --source <id> [--since 30d] [--last-sessions N] [--limit N] [--project-only] [--json]
codetrap learn evidence-pack  (alias of review; §9.4 Mode A vs Mode C differ in who reads it next)
codetrap learn reviews  [--json]
codetrap learn stage    --review-dir <dir> [--apply] [--json]
```

`session capture` gains optional `candidateKind`, `sourceAgent`,
`destinationHint`, `rationale` and `sourceManifestRefs`, which is how Phase 1B's
reserved §8.2 fields finally get populated.

`CODETRAP_CLIENT_HOME` overrides the client-history home; it exists so tests can
point at a fixture instead of the developer's real `~/.claude` and `~/.codex`.

Unchanged: no new MCP tool, no Web route changes, no trap-schema changes.

## Out of scope, deliberately

No `.codetrap/learning/` locks, no coverage machinery beyond ref verification, no
semantic dedup (1D). No Inbox UI, no context-pack export (1E). No `learn decide`
/ `learn commit` — Phase 1B's `session approve` / `session accept` already are
those, and §3.4 forbids a second surface for one action.

## Test and typecheck state

`src/tests/learning-sources.test.ts` — 17 tests: envelope and manifest parity,
redaction, noise filtering, root containment including a symlinked intermediate
directory, and the honest file-count accounting.

`src/tests/learning-review-cli.test.ts` — 11 tests driving the real binary:
artifacts, bounded scope, ref verification and its rejections, suppression
carry-over, `candidate_kind` preservation, and the gitignore.

Full suite: 316 pass, 1 fail — the pre-existing `embedding reindex API` failure
that reproduces on a clean `HEAD` worktree. `bunx tsc --noEmit` clean.
