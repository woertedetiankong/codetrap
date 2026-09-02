# Task Brief: Learning Impact

> Created: 2026-08-31
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Complete the user journey from a useful Learning Insight to personal progress,
explicit content feedback, optional Run context, and a governed local Agent
experience candidate without calling a model or writing confirmed Library memory.

## Success Criteria

- Learning exposes `not_started`, `in_progress`, and `learned` as explicit,
  reversible personal state rather than mutating shared Insight content.
- Users can record `helpful`, `unclear`, or `outdated` feedback and optionally
  associate an Insight with an existing local Observation Run.
- `Create Agent experience candidate` opens a deterministic, editable local
  Trigger/Mistake/Fix preview and makes the zero-model/no-direct-write boundary
  obvious before any durable action.
- Sending the reviewed draft writes only a revisioned `pitfall_trap` candidate
  into the existing Candidate Inbox, with Insight provenance and no confirmed
  trap write.
- Repeated submission is idempotent for identical content, existing candidate
  state remains visible, and the user can navigate directly to its review.
- Legacy `consulted_count > 0` reads as `learned` until the user explicitly
  changes the new personal progress record; no read silently migrates data.
- Web failures preserve the exact unsaved draft, shared navigation remains
  reachable in empty states, and polling does not reset active scroll surfaces.
- Focused/full tests, typecheck, build, and an OpenCLI browser journey verify
  preview, mutation boundaries, Inbox navigation, URL/DOM/network/console state,
  and persistence.

## Scope

In scope:

- A separate project-local Learning progress/feedback/link/promotion store.
- Deterministic Agent experience draft generation and validation.
- Learning Web controls, editable preview, status feedback, Run association,
  and Candidate Inbox handoff.
- Best-effort metadata-only Observation events when a ledger is already enabled.

Out of scope:

- Calling Codex, Claude Code, an LLM judge, or an external service.
- Automatically accepting candidates or copying Learning content into confirmed
  Library memory.
- Team identity/sync, Team Hub, ranking, mastery inference, dwell/click tracking,
  or arbitrary prompt/transcript/diff capture.
- Installing hooks, committing, pushing, publishing, releasing, or changing the
  package version.

## Constraints

- Insight content remains project-owned; personal progress is stored separately.
- Existing Candidate Inbox authorization, editing, conflict, receipt, rejection,
  acceptance, supersede, and rollback contracts remain the single governance path.
- Observation is a failure-isolated sidecar and must not become enabled merely
  because the Learning page was opened or updated.
- Registered-project and token-authenticated Web boundaries remain unchanged.
- Preserve all pre-existing uncommitted work and persistent user data.

## Expected Knowledge Updates

- Rewrite Learning behavior in README/installation guidance and Slice 2 status in
  the Impact/Evals design.
- Reconcile the roadmap dashboard, task index, and `NEXT-SESSION.md`.
- Task index: update expected because this is a multi-module plan-linked slice.
- Wiki: not created; this repository has no hand-maintained wiki.
