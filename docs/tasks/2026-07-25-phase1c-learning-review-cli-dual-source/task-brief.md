# Task brief — Phase 1C: dual-source adapters

Parent plan: `docs/agent-experience-compiler-roadmap.md` §16 Phase 1C
Predecessor: `docs/tasks/2026-07-25-phase1b-candidate-envelope-and-migration/`
Date opened: 2026-07-25
Status: **complete** — both criteria met 2026-07-25; see `handoff.md`

## Goal

One adapter contract, two clients. Equivalent histories from Codex and Claude
Code must normalize to the same envelope and the same source-manifest shape, so
the compiler layer never learns which client a lesson came from.

```text
codetrap learn sources        -> what history exists, per client, read-only
codetrap learn evidence-pack  -> redacted digests + source manifest in a review dir
codetrap learn review         -> a review dir plus the shared discovery prompt
codetrap learn stage          -> validate agent-drafted candidates into the inbox
```

## Scope (§16 Phase 1C, unchanged)

- `codetrap learn sources | evidence-pack | review | stage` pull mode for Codex
  sessions, then Claude Code sessions, reusing one adapter contract.
- Internal delivery may be sequential; the exit gate requires behavioral and
  artifact parity for both clients.
- Add the shared Codex and Claude Code learning-review entry points.

### Explicitly out of scope

- No `.codetrap/learning/` **locks**, no coverage machinery beyond deterministic
  ref verification, no semantic dedup (1D).
- No Inbox UI, no curated context-pack export (1E).
- No `learn decide` / `learn commit` — Phase 1B's `session approve` / `session
  accept` already are those, and §3.4 forbids a second surface for one action.
- The CLI does not mine lessons semantically. §1.4 is explicit that codetrap is
  a compiler, not a brain: adapters do deterministic extraction, the agent does
  judgment.

## Acceptance criteria (§16, unchanged)

1. Equivalent fixture histories produce the same normalized envelope and source
   manifest shape from both adapters.
2. Per-client doctor passes.

## Discovery findings (done, before writing code)

Both clients have real history on this machine, so parity is testable against
reality and not only fixtures.

**Claude Code** — `~/.claude/projects/<slug>/<session-uuid>.jsonl`, one JSON
object per line. Turn lines carry `type` (`user`/`assistant`/`system`),
`timestamp`, `uuid`, `sessionId`, `cwd`, `gitBranch`, `version`. Non-turn lines
(`mode`, `permission-mode`) carry no timestamp and must be skipped.

**Codex** — `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<ts>-<uuid>.jsonl`. A
leading `type: "session_meta"` line carries `payload.{id,timestamp,cwd,
originator,cli_version}`; turns arrive as `type: "response_item"` with
`payload.{type:"message",role,content:[{type,text}]}`. There is no per-line
branch, and `~/.codex/history.jsonl` is a separate flat prompt log.

The asymmetries that matter: Codex has session metadata in a header line and no
git branch; Claude Code repeats metadata on every line and has no header. The
normalized envelope has to be the intersection plus explicit nulls, or the
adapters will not produce the same shape.

**Phase 0's extractor** (`../2026-07-25-phase0-claude-code-proof-point/evidence/
extract.py`) is the reference for redaction and noise filtering. It is a
throwaway script, gitignored, and Claude-Code-only; 1C ports its rules into
shipped, tested code and makes them client-agnostic.

## Design

### D1 — One contract, two thin adapters

```text
SessionSourceAdapter
  id            : "codex-sessions" | "claude-code-sessions"
  roots()       : explicit allowed roots, never followed out of
  discover()    : SourceSessionRef[]  (path, session id, mtime)
  read(ref, roots): ReadSessionResult   (roots required, not optional)
```

The compiler layer sees only `NormalizedSession` and `SourceManifestEntry`.
Adding a third client must not touch anything above the adapter.

### D2 — Parity is a test, not a claim

The exit gate is asserted by feeding *equivalent* fixture histories — the same
conversation, encoded in each client's on-disk format — through both adapters
and asserting deep equality of the normalized envelope modulo the fields that
are genuinely client-specific (`source`, `path`, `client_version`, `session_id`,
`branch`), plus equality of the manifest values the readers themselves populate.

### D3 — Privacy rules are shipped code, not a script

Redaction, excerpt caps (≤500 chars, §4.2), allowed-root enforcement, and
no-symlink-escape move out of the Phase 0 throwaway and into tested modules.
Evidence packs store pointers, hashes, and short excerpts — never full
transcripts (§3.2).

### D4 — `learn stage` is the deterministic gate

It validates agent-drafted candidates against the Phase 1B envelope, verifies
every claimed evidence ref resolves against the recorded source manifest, and
only then stages into the session candidate inbox. Semantic judgment advises;
deterministic verification gates (§9.3).

## Plan

1. Normalized envelope + source manifest types; redaction module ported and
   tested.
2. Adapter contract, then the Claude Code adapter, then the Codex adapter.
3. `learn sources` (read-only inventory).
4. `learn evidence-pack` / `learn review` writing `.codetrap/learning/reviews/`.
5. `learn stage` with envelope validation and ref verification.
6. Parity fixtures and the per-client doctor check.
7. The shared learning-review entry point for both clients.

## Risk

The dominant risk is reading real user history. Every read path is
explicit-trigger-only, allowed-root-scoped, symlink-refusing, and redacting; the
tests assert those properties rather than trusting them.
