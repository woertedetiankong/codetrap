---
title: Handoff 2026-08-30 - Opt-in Agent Observation
status: Complete
updated: 2026-09-01
---

# Handoff

## Summary

Codetrap can now observe normal Codex and Claude Code turns after an explicit project-local opt-in. `UserPromptSubmit` starts a metadata-only Run, `Stop` completes it, and `SessionEnd` closes unfinished work as partial. Search/usefulness plus explicit validation/feedback attach automatically only when one active Run is unambiguous.

## Current State

This milestone is complete. Users can preview configuration without writes, apply it per client, inspect status, and disable future capture without deleting history. In this checkout both Codex and Claude Code project hooks are enabled with the absolute compiled executable because `codetrap` is not installed on `PATH`. Codex still requires the user to reopen/trust the project. Automatic hooks do not create Eval ground truth.

## User Workflow

```powershell
codetrap observe enable codex
codetrap observe enable codex --apply
codetrap observe status codex --json
codetrap observe disable codex --apply
```

Replace `codex` with `claude` for Claude Code. Preview is the default. Codex users must review and trust the new project hooks.

## Key Decisions

- A Run represents one user/Agent turn, not an entire client session.
- Lifecycle payloads are untrusted. Only client, anonymous session/turn correlation, model metadata, and timestamps are retained; prompt/response text, transcript paths/content, diffs, tool bodies, secrets, full paths, and hidden reasoning are ignored.
- Codex uses a retry-stable client/session/turn-derived Run id. Claude Code uses a fresh random Run plus bounded hashed session state because its lifecycle payload has no turn id.
- Hook processes are non-steering sidecars: malformed input and storage failure still return neutral `{}`, no stderr, and exit 0.
- Project configuration is additive and reversible. Locked atomic writes and backups preserve unrelated hooks/settings; disable removes exact Codetrap-owned handlers only.
- A compiled CLI writes its own quoted absolute executable path into project hooks
  when no PATH installation is implied. Status/disable recognize both that form
  and the legacy `codetrap observe hook` command.
- Multiple active automatic Runs fail closed. Codetrap never guesses which Agent owns a search or validation event.
- Automatic Observation and Eval-case acceptance remain separate trust boundaries.

## Changed Surfaces

- `src/lib/agent-observation.ts`: lifecycle normalization, bounded correlation state, stable identity, retry recovery, and single-active-Run context.
- `src/lib/observation-integration.ts`: project config preview/apply/status/disable, locks, backups, atomic merge/removal, and trust/privacy results.
- `src/commands/observation-commands.ts`, `src/index.ts`: hook ingress, integration commands, current-Run diagnostics, implicit validation/feedback attachment, and CLI help.
- `src/lib/trap-operations.ts`: implicit search/usefulness attachment only for one unambiguous active automatic Run.
- `src/web/client-impact.ts`, `client-text.ts`, `static.ts`: automatic-first onboarding with preview/apply commands, privacy/trust wording, and explicit fallback.
- `src/tests/agent-observation.test.ts`, Web tests: retry, privacy, failure isolation, concurrency, config preservation, generated browser dependency, and onboarding coverage.
- README, installation, design, roadmap, task index, and NEXT-SESSION reconciled to the implemented contract.

## Cross-Module References

- Depends on: [Observation adapters](../2026-08-30-observation-adapters/handoff.md), [first-run onboarding](../2026-08-30-observation-first-run-onboarding/handoff.md), and official Codex/Claude hook contracts.
- Referenced by: governed Eval candidates, longitudinal Impact, and any future Team ingestion.

## Red Lines And Gotchas

- Do not read transcripts to reconstruct Claude turns or widen the metadata allowlist.
- Do not make hooks global by default or install them merely by opening Web.
- Do not infer validation, human feedback, or Eval ground truth from `Stop`.
- A neutral `{}` proves only that the hook did not steer the Agent; tests must also verify `observe current` or ledger state.
- On Windows, PowerShell JSON pipelines may add a BOM. Candidate `cand-001` in `2026-08-30-capture-powershell-json-pipelines-can-add-a-bom-before-stdin` records the reviewed draft and remains unaccepted.
- Generated browser functions must include every runtime helper. OpenCLI found and closed a missing `impactAutoClient` serialization dependency.

## Validation

- Repository suite: 497 pass, 1 intentional Windows browser skip, 0 fail (498 tests, 2480 expectations).
- Latest focused Web regression after the OpenCLI-found runtime fix: 18 pass, 0 fail (221 expectations).
- `bun run typecheck`, `bun run build`, and `git diff --check`: pass; both Windows binaries compile.
- Original 2026-08-30 integration previews changed no project config. The later
  2026-09-01 user-authorized follow-up applied both project hooks.
- OpenCLI verified the empty-state guide expands and shows preview/apply/disable, trust, privacy, and explicit fallback copy.
- A raw-stdin isolated Codex replay produced one completed Run with four events: start, zero-result search, passed validation, and completion. Overview showed one Run/one completion/one validation; the Run timeline exposed the four facts.
- OpenCLI reported no console errors or failed requests. A byte-level search found none of the fake prompt, response, session id, private path, or transcript name in `.codetrap`.
- 2026-09-01 follow-up: typecheck and build pass; 13 focused lifecycle/CLI/recorder
  tests pass. OpenCLI loaded the real Overview with the original one Run, zero
  failed requests, and zero console errors, confirming Hook setup created no fake
  evidence.

## Git And Persistent State

- The worktree contains this milestone plus pre-existing uncommitted Observation, Evals, Learning, Web, Skill, and documentation changes.
- Codex and Claude Code project hooks are now applied under `.codex/hooks.json`
  and `.claude/settings.json`; no global installation was made. No commit, push,
  release, version change, confirmed candidate acceptance, or Eval-case
  persistence occurred.
- The temporary isolated project was used only for OpenCLI/CLI verification and is safe to remove after the Web server is returned to the real project.

## Restart Verify

```powershell
bun run typecheck  # expected: exit 0
bun test src/tests/agent-observation.test.ts src/tests/observation-ledger.test.ts src/tests/observation-web.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts  # expected: all focused tests pass
bun run src/index.ts observe enable codex --json  # expected: applied=false and three changed events; no config write
```

Expected: typecheck exits 0; focused tests pass; the final command reports `applied: false`, a project `.codex/hooks.json` path, and three changed events without creating the file.
A mismatch means the lifecycle adapter, generated Web client, privacy boundary, or project-local integration merge has drifted.

## Next Steps

1. Build governed Eval-candidate preview/edit/accept/reject and rollback into checked-in project fixtures.
2. Keep observed evidence, human ground truth, and controlled execution as distinct layers.
3. Continue OpenCLI DOM, route, console, network, privacy, and screenshot verification for every Web-visible slice.

## Docs And Wiki

- Reconciled: README, installation, Impact/Evals design, parent roadmap, task index, and NEXT-SESSION.
- Created/refreshed: this dossier and handoff.
- Wiki not created: the repository has no hand-maintained wiki.

## Implementation Log

- [implementation-log.md](implementation-log.md) records lifecycle, privacy, identity, config merge, generated-script, and Windows replay decisions.
