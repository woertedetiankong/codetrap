# Task Brief: Controlled Eval Runner

> Created: 2026-08-31
> Parent plan: [Impact, Evals, and team observability design](../../impact-evals-design.zh-CN.md)
> Status: Complete

## Goal

Add a reproducible, source-safe baseline/candidate runner that lets a user see which confirmed Search Eval cases improve, regress, or stay unchanged without mixing controlled results with observed usage rates.

## Success Criteria

- The runner reads only confirmed checked-in fixture cases and never promotes Observation signals or model judgments into expected answers.
- A run records the suite path and SHA-256, repository revision and dirty state, runtime, profile identities, configuration fingerprint, deterministic case order, timestamps, duration, and per-case evidence links.
- The initial profiles compare current fixture-directed retrieval with an FTS-only baseline and compare the same fixture with expected traps absent versus present.
- Both sides run against immutable in-memory fixture snapshots; no experiment mutates the source tree or fixture.
- Results are written atomically under ignored project-local `.codetrap/evals/`, can be listed after restart, and remain distinct from Observation Ledger rates.
- The Web UI leads with regressions and changed cases, shows sample sizes and duration, explains the experiment boundary, and links each case to its fixture evidence.
- Browser-visible behavior passes OpenCLI URL, DOM, state-transition, network, storage, console, and screenshot verification.

## Scope

In scope:

- Versioned controlled-experiment schema and project-local result store.
- Two deterministic built-in comparison profiles with zero model calls.
- Token-authenticated list/run Web APIs.
- Regression-first controlled comparison UX inside Impact → Evals.

Out of scope:

- Calling Codex, Claude Code, or an LLM judge.
- Running untrusted commands, changing source files, or creating destructive worktrees.
- Treating controlled results as observed Helpful/noise rates.
- Team sync, remote result storage, CI scheduling, release, or package-version changes.

## Constraints

- Preserve the metadata-only Observation boundary and existing governed Eval candidate workflow.
- The only intentional variable may differ between baseline and candidate; repository, fixture snapshot, runtime, permissions, and tool surface remain fixed.
- Invalid or missing fixtures fail closed without creating experiment state.
- Preserve pre-existing uncommitted work.

## Expected Knowledge Updates

- Rewrite the controlled-Evals section and progress status in `docs/impact-evals-design.zh-CN.md`.
- Update README, installation guidance, parent roadmap dashboard, task index, and `docs/tasks/NEXT-SESSION.md`.
- Task index: update expected.
- Wiki: not created; this repository has no hand-maintained wiki.
