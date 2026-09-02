# Task Brief: Governed Eval Candidates

> Created: 2026-08-31
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Turn a privacy-safe Observation candidate into an explicitly authored, previewable, content-bound Search Eval fixture change that a user can accept, reject, or roll back from Impact without confusing observed evidence with ground truth.

## Success Criteria

- Opening a candidate review never recovers or guesses prompt/query text from fingerprints; the user explicitly supplies the Eval query and expected fixture trap ids.
- Saving a draft persists a `search_eval_case` session candidate only, shows the exact destination and case preview, and does not modify the fixture.
- Accepting writes one validated query to the existing project `src/tests/fixtures/search-eval.json` through the Phase 2 lock/commit/receipt lifecycle.
- Rejecting records an auditable candidate decision without requiring sensitive query text or modifying the fixture.
- A committed case is shown as confirmed ground truth; rollback restores the exact previous fixture and returns the observation candidate to an unconfirmed state.
- Candidate revision/content hash changes on material edits; agent execution still requires user authorization, while a local Web user click is the authorization for that exact submitted content.
- Project isolation, duplicate handling, invalid/missing fixture behavior, and privacy allowlisting are covered by tests.
- The Evals UI explains evidence versus ground truth in plain language and passes OpenCLI DOM, route, console, network, storage, and screenshot verification.

## Scope

In scope:

- Observation-candidate review state overlay backed by existing session candidates.
- A fixture trap catalog derived only from checked-in fixture content.
- Draft, preview, accept, reject, and rollback Web/API workflows.
- Repair the Phase 2 `search_eval_case` destination to append to the current `queries` schema atomically and reversibly.

Out of scope:

- Recovering raw queries from Observation fingerprints, transcripts, prompts, responses, diffs, or tool bodies.
- Automatically deciding expected trap ids or accepting observed association as ground truth.
- Creating fixture trap definitions, controlled baseline/candidate execution, model judges, Team sync, or remote storage.
- Accepting project-memory pitfall candidates, installing hooks, releasing, or changing package version.

## Constraints

- Observation Ledger stays append-only and metadata-only; governed review state lives in the existing session/Phase 2 lifecycle.
- The checked-in Search Eval fixture remains the durable ground-truth destination and must already exist and validate before acceptance.
- All writes are project-local, locked, atomic, content-bound, reversible, and token-authenticated through the local Web server.
- Preserve pre-existing uncommitted work and current candidate history.

## Expected Knowledge Updates

- Rewrite README, installation/usage guidance, Impact/Evals design progress, parent roadmap dashboard, task index, and NEXT-SESSION.
- Record evidence/ground-truth, explicit-query, schema-repair, and review-state decisions in the implementation log.
- Wiki: not created; this repository has no hand-maintained wiki.
