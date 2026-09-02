# Task Brief: Opt-in Agent Observation

> Created: 2026-08-30
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Let a user opt one project into automatic, metadata-only Observation Runs for Codex or Claude Code, so each normal Agent turn becomes visible evidence without transcript scanning or manual JSON.

## Success Criteria

- `UserPromptSubmit` starts one Run and `Stop` completes the same Run for both Codex and Claude Code.
- The adapter reads only an allowlist of lifecycle metadata; prompt text, assistant messages, transcript paths, reasoning, diffs, tool bodies, and secrets never enter the ledger or hook state.
- Run/event identity is stable across hook retries, and Claude Code's missing turn id is bridged by bounded project-local state rather than transcript inspection.
- Hook failures never block, continue, or otherwise steer the Agent; hook stdout stays valid neutral JSON.
- Project-local integration can be previewed, explicitly applied, inspected, and disabled per client while preserving unrelated user hooks and settings.
- Disabling capture leaves historical evidence intact and does not create or accept Eval cases.
- Empty Impact onboarding presents automatic setup as opt-in and keeps the existing explicit Agent instruction as a fallback.
- Tests, typecheck, build, diff checks, and an OpenCLI journey through a real hook-generated Run pass.

## Scope

In scope:

- A shared Codex/Claude lifecycle ingress and bounded hook state.
- Project-local hook configuration preview/apply/status/disable.
- CLI help, bilingual Impact connection guidance, tests, and operator documentation.

Out of scope:

- Transcript, prompt, response, reasoning, diff, tool-input, or tool-output capture.
- Automatic validation inference, automatic human feedback, controlled Eval execution, or Eval-case persistence.
- Global hook installation, plugin publishing, Team sync, model calls, or background transcript scanning.

## Constraints

- The Observation Ledger remains the source of truth and keeps its strict metadata-only schema.
- Automatic task boundaries are turn-scoped: start at `UserPromptSubmit`, finish at `Stop`; session hooks are not used as task evidence.
- Config edits are project-local, additive, reversible, and exact-handler scoped.
- Preserve all pre-existing uncommitted work. Do not enable hooks in this checkout, accept candidates, commit, push, release, install globally, or change the package version.

## Expected Knowledge Updates

- Update README, installation, Impact/Evals design progress, parent roadmap, task index, and NEXT-SESSION.
- Record lifecycle, privacy, identity, and config-merge decisions in the implementation log.
- Wiki: not created; this repository has no hand-maintained wiki.
