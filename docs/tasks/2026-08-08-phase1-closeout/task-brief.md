# Task Brief: Phase 1 Closeout

> Created: 2026-08-08
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete — all criteria met 2026-08-08

## Goal

Close Phase 1 with a green Windows test suite, real cross-client recall evidence
from Codex, and current roadmap and handoff documentation.

## Success Criteria

- Every Claude Code session fixture derives a platform-safe project directory
  key, with a regression assertion for Windows drive-letter paths.
- The full Bun test suite passes on this Windows checkout.
- In this Codex session, project trap #5 is returned by the Phase 1E pre-flight
  query and is marked useful through the shipped CLI.
- The roadmap closes Phase 1 and current-facing handoffs no longer carry the
  fixed embedding reindex failure as an open risk.

## Scope

In scope:

- Test-only fixture path generation under `src/tests/`.
- The persisted usefulness signal for project trap #5.
- Phase 1 status, Phase 1E evidence, stale handoff risks, and restart continuity.

Out of scope:

- Phase 2 implementation.
- Accepting or rejecting unrelated pending learning candidates.
- Restoring or modifying the user's deletion of `docs/codebase-audit.md`.

## Constraints

- Preserve the authorization and audit red lines in the parent roadmap.
- Treat implementation logs as append-only history; reconcile stale final-state
  claims in handoffs and the roadmap instead.
- Do not push or commit without explicit user instruction.

## Expected Knowledge Updates

- `docs/agent-experience-compiler-roadmap.md`
- Phase 1E and earlier handoffs carrying the resolved embedding reindex risk
- `docs/tasks/INDEX.md` and `docs/tasks/NEXT-SESSION.md`
