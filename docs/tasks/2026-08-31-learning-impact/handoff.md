---
title: Handoff 2026-08-31 - Learning Impact
status: Complete
updated: 2026-08-31
---

# Handoff

## Summary

Learning now gives a person explicit local progress, content feedback, and an
optional Run association, then offers a transparent path from a useful Insight
to an editable Agent-experience candidate. The action makes zero model calls and
cannot write confirmed Library memory; it stops in the existing Candidate Inbox.

## Current State

Slice 2 is complete. Learning, personal progress, proposed Agent experience, and
confirmed runtime memory remain separate stores and governance states. Legacy
`consulted_count` stays readable without an eager migration.

## Delivered

- A locked, atomic project-local Learning Impact document stores one explicit
  local actor's progress, feedback, Run link, and promotion reference separately
  from shared Insight content.
- Three-state `not_started` / `in_progress` / `learned` progress and
  `helpful` / `unclear` / `outdated` feedback are reversible and idempotent.
- Optional Run links are validated against the existing Observation Ledger. A
  Learning action never enables Observation or creates a Ledger implicitly.
- When Observation already exists, best-effort metadata-only Learning events are
  recorded without weakening the primary Learning write.
- The deterministic local draft exposes Trigger, Mistake, Fix, scope, module,
  tags, and path globs for editing and labels its `0 model calls` / Inbox-only
  boundary before any durable action.
- Preview is non-mutating. Create stages one revisioned `pitfall_trap` candidate
  with Insight provenance and exact-repeat idempotence, never a confirmed trap.
- An existing promotion remains visible and links directly to its normal review,
  accept, reject, conflict, receipt, supersede, and rollback workflow.
- Learning filters and collection progress understand all three progress states.

## Trust Boundary

- Opening Learning or previewing a draft does not write progress, candidates,
  confirmed traps, or Observation state.
- No Codex, Claude Code, external model, model judge, prompt upload, transcript,
  diff, tool body, or hidden reasoning is involved.
- Personal state does not rewrite project-owned Insight prose or claim that a
  click, dwell time, or page visit proves mastery.
- Candidate creation is not authorization. Confirmed memory still requires the
  existing explicit human review gate.

## Validation

- `bun run typecheck`: pass.
- Focused Learning/Phase 2/Observation/Web suite: 68 pass, 0 fail after the
  repeated-status idempotence compatibility fix.
- `bun test`: 510 pass, 1 intentional environment skip, 0 fail, 2623 expectations
  across 71 files.
- `bun run build`: both `dist/codetrap.exe` and `dist/codetrap-serve.exe` compiled.
- `git diff --check`: pass.
- OpenCLI journey: progress changed to Learning in progress, feedback to Helpful,
  and an existing Run was linked; the exact edited Fix and non-zero scroll
  position survived preview and a six-second polling interval on the same DOM
  node.
- OpenCLI candidate handoff: preview left the original Inbox unchanged; create
  produced one pending candidate, the review URL addressed that exact candidate,
  and its edited Fix matched byte-for-byte. Project trap listing remained empty.
- OpenCLI health: 0 failed requests and 0 console errors. Visual inspection at
  1440×1000 confirmed the blue three-pane Learning Impact card and actions remain
  readable without clipping or scroll reset.

## Git And Persistent State

- No real Insight, confirmed trap, Observation Run, hook, external account,
  global install, commit, push, release, or package version changed.
- Temporary OpenCLI projects, Web process, registry entry, screenshots, and
  fixture scripts were removed after validation.
- Two accidentally home-scoped test fixtures were detected by ownership checks
  and precisely removed; the pre-existing home session was verified preserved.
- A post-flight pitfall candidate is pending as `cand-001` in session
  `2026-08-31-capture-launch-compiled-windows-cli-fixtures-from-an-explicit-te`.
  It has been edited but not accepted into confirmed memory.
- The working tree still includes this slice plus pre-existing uncommitted
  Observation, Evals, Web, Learning, Skill, and documentation work.

## Next Steps

The next product slice is Slice 3, Team Hub minimum loop: team/project/member and
device identity, a metadata-only outbox with idempotent ingest, aggregate Team
Impact, and explicit detail sharing with TTL/revoke/audit. Keep member ranking,
private-by-default details, and all sensitive body uploads outside the default
path.

Before that work, the user may review the new Windows validation candidate and
accept, edit, reject, or supersede it; Team Hub implementation must not treat a
pending candidate as confirmed guidance.

## Implementation Log

- [implementation-log.md](implementation-log.md) records storage separation,
  deterministic drafting, idempotence, scroll safety, OpenCLI validation, and the
  isolated-fixture correction.

## Restart Verify

```powershell
bun run typecheck  # expected: exit 0; mismatch means Learning Impact or Web types drifted
bun test src/tests/learning-impact.test.ts src/tests/phase2.test.ts src/tests/observation-web.test.ts src/tests/web-console.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts  # expected: 68 pass, 0 fail
bun run build  # expected: both compiled binaries build
```
