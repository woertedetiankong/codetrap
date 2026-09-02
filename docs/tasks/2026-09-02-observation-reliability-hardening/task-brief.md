# Task Brief: Observation Reliability Hardening

> Created: 2026-09-02
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done

## Goal

Make the shipped Observation and Evals workflow preserve active user work, keep historical evidence addressable, recover safely from Hook persistence failures, and degrade visibly when local controlled-eval history is partially corrupt.

## Success Criteria

- Background Evals refresh preserves the exact active review draft, selected candidate, focus surface, and scroll position.
- A Run selected from an Eval candidate remains addressable even when it is older than the recent-runs window.
- Failed lifecycle writes remain retryable; bounded Hook state never silently leaves a recorded Run permanently active.
- One malformed controlled-eval result does not hide healthy history, and the API/UI explicitly reports excluded corrupt records.
- Hook capacity is observable before capture stalls, stale state has a read-only preview, and recovery requires an explicit apply action that records cancellation evidence before removing state.
- When Evals polling defers external changes to protect an open form, the user sees that fresh evidence is waiting without losing the current draft.
- A behavior test proves a directly addressed Run remains available even when it is absent from the bounded recent-runs response.
- A corrupt or unsupported Hook state file cannot hide a healthy Ledger Overview; health degrades to an explicit unavailable state, while recovery refuses mutation.
- Focused and full tests, typecheck, the normal release build, diff checks, and OpenCLI state-transition verification pass.

## Scope

In scope:

- Impact/Evals client refresh and Run selection behavior.
- Agent observation correlation-state recovery and bounded eviction.
- Controlled-eval result-store diagnostics and partial-availability Web UX.
- Agent Hook health, explicit stale-Run recovery, and Web operator guidance.
- Regression tests and current milestone documentation.

Out of scope:

- Team Hub, real Agent baseline/candidate execution, remote telemetry, or model judging.
- Automatically repairing or deleting corrupt audit artifacts.
- Automatically expiring or silently deleting abandoned Agent Hook state.
- Increasing sensitive Observation capture or changing ground-truth governance.

## Constraints

- Preserve all existing uncommitted work and project-local Observation data.
- Do not silently skip, rewrite, quarantine, or delete malformed controlled-eval evidence; expose a bounded diagnostic instead.
- Hooks remain neutral, metadata-only, non-steering sidecars and must not invent successful completion.
- Do not commit, push, publish, install globally, accept pending Codetrap candidates, or change the package version.
- Validate every browser-visible change through OpenCLI and assert observable postconditions after interaction.

## Expected Knowledge Updates

- Update the parent roadmap, Impact/Evals design implementation status, task index, and restart handoff.
- Task index: update required because this slice crosses Web, Observation Hook, and controlled-eval modules.
- Wiki: not created; the repository has no hand-maintained wiki.
