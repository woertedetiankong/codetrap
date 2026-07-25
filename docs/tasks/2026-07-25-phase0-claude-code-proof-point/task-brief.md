# Task brief — Phase 0 proof point (Claude Code)

Parent plan: `docs/agent-experience-compiler-roadmap.md` §16 Phase 0
Date: 2026-07-25
Status: **closed 2026-07-25** — mining complete; all 16 clusters approved by
user blanket decision. Candidate-quality gate **waived, not met** (see
`metrics.md`). Proceeding to Phase 1A.

## What Phase 0 is for

Test the riskiest assumption the whole roadmap rests on (§1.5):

> An agent mining real work history can produce lesson candidates that a real
> user actually accepts, at a rate that justifies the review time.

Evidence before architecture. No LessonCandidate schema, no `learn`
subcommands, no Inbox UI were built — §16 forbids them until this gate closes.

## Authorized scope

The user explicitly authorized, in-session:

- Client: **Claude Code only.**
- Window: **last 30 days** (2026-06-25 .. 2026-07-25).
- Mode: dry-run; read-only; no durable writes.

## Deviation from the roadmap: single-client run

§16 asks for one conclusive Codex run *and* one conclusive Claude Code run.
**The Codex run was not performed.** Reason, measured before deciding:

```text
Codex sessions in the authorized 30-day window : 2 files, 32 KB (both 2026-07-11)
§16 bar for a "conclusive run"                 : >= 10 substantive sessions
Codex corpus outside the window                : 232 files, 165 MB (2025-08 .. 2026-03)
~/.codex/memories                              : empty
```

The user was offered three options (extend the Codex window to its last
substantive period, mine the 2 files and mark the run inconclusive, or drop
Codex this round) and chose to drop Codex.

Consequences, carried forward honestly:

- The §16 sampling requirement is **not** met. Phase 0 is a single-client proof
  point, not the dual-client one the roadmap specifies.
- The `cross-client overlap rate` metric **cannot be computed**. A documented
  substitute is reported instead (cross-*run* overlap across independent
  miners, plus cross-*project* overlap) — see `metrics.md`.
- The §3.1 dual-client symmetry claim remains **untested by evidence**. It is
  shipped in code (2026-07-10 slice) but unproven in use.
- The go-gate clause "neither client with a conclusive corpus falls below 20%
  useful approval" is vacuously satisfied and must not be reported as passed.

Re-running the Codex side is the first item in `handoff.md` once the user has
Codex history worth mining.

## Sampling actually performed

| Run | Corpus | Files | Lens |
|---|---|---|---|
| primary-failures | Project-A (+lanes) | 61 digests | recurring failure/misuse patterns |
| primary-human | Project-A (+lanes) | 61 digests | user corrections, conventions, preferences |
| primary-workflow | Project-A (+lanes) | 61 digests | workflows, SOPs, insights |
| repeat-independent | Project-B, Project-C, codetrap | 19 digests | full discovery prompt, different projects |

The repeat run satisfies §16's "one repeat run from a different project". The
three primary runs are independent lenses over one corpus: they never saw each
other's output, so agreement between them is convergent evidence, not an echo.

Both corpora clear the conclusive bar: 79 substantive sessions (>50 KB) across
95 files and 228.6 MB in the window.

## Method

1. **Extract** (`evidence/extract.py`) — read-only walk of allowed roots,
   symlinks not followed. Distils 228.6 MB of transcripts into 105 KB of
   digests: real human turns plus classified failure signals, each capped at
   500 chars (§4.2) and secret-redacted before any agent sees them.
2. **Mine** — four subagents run the §7.3 discovery prompt under different
   lenses, each instructed that an honest low yield beats padded output, and
   required to cite `source_file` + line + timestamp for every claim.
3. **Verify** (`evidence/verify.py`) — the compiler checks every claimed
   pointer against the original transcript: file inside an allowed root, line
   exists, timestamp matches, excerpt genuinely present. Agent proposes,
   compiler disposes (§9.3).
4. **Consolidate** (`evidence/merge.py`) — assign stable IDs, group semantic
   duplicates into review clusters **without merging them** (§9.3, §13.4):
   every member and its provenance stays visible; merge is the user's call.
5. **Render** (`evidence/render_review.py`) — the review surface, ordered by
   independent-run agreement.

## Deliverables

| File | Committed? | Why |
|---|---|---|
| `task-brief.md`, `metrics.md`, `implementation-log.md` | yes | method and aggregates only |
| `review-shortlist.md` | **no** | carries private project internals |
| `evidence/` | **no** | verbatim excerpts, private paths, full candidates |

This repository is public. The mined corpus is the user's *other*, private
projects. Committing the excerpts would be precisely the trust failure §3.2
exists to prevent, so the excerpt-bearing artifacts are gitignored and stay
local. See `.gitignore` in this directory.

## How the gate actually closed

The user reviewed the analysis, judged it sufficient, and approved all 16
clusters as a single blanket decision rather than marking each item. The
approved set is recorded, sanitized, in `accepted-candidates.md`.

This closes Phase 0 procedurally but leaves the candidate-quality question
**untested rather than answered** — a bulk approval cannot measure whether
candidates survive independent judgment. `metrics.md` records that distinction
in full, and `handoff.md` carries it forward as risk into Phase 1A rather than
letting it disappear.

Private project identifiers in all committed files are replaced with stable
aliases (`Project-A` = primary mining corpus, `Project-B` / `Project-C` =
repeat-run projects).
