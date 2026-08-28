# Task Brief: Agent and User Experience Hardening

> Created: 2026-08-27
> Parent plan: [Agent Experience Compiler Roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Make the local Codetrap workflow pleasant and safe for both agents and human reviewers by hardening atomic editing, multilingual behavior, review interactions, user-study generation, live refresh, Web launch, and token hygiene.

## Success Criteria

- Closed sessions can be renamed atomically through supported product APIs without leaving `session.json`, `index.json`, `recap.md`, or implementation-note headers inconsistent.
- Agents have a supported CLI/API path to edit proposed candidate content while preserving revision and content-hash semantics; no external translation service is introduced.
- Candidate quality scoring treats equivalent English and Chinese trigger/action language consistently, with localized Web warnings.
- Rejecting a candidate uses an accessible in-product dialog that states project-wide fingerprint suppression, records an optional reason, and offers a supported undo path.
- The Web console detects external session/candidate changes without overwriting an unsaved candidate draft.
- `codetrap web --open` launches the local console through a platform-safe browser opener, while existing non-open behavior remains unchanged.
- The launch token is removed from the address bar after being copied to session storage.
- A stale tab left behind by a Web restart shows localized recovery guidance instead of a bare `Unauthorized` error.
- External-source capture and session learning review generate user-study insights with a compact ASCII flow diagram and a concrete, plain-language example, while runtime traps remain concise.
- The empty Learning view displays a ready-to-send Agent request using the same teaching format and states through current-facing docs that this is not model training.
- Learning candidates use insight-specific fields and actions; the user can approve and shelve the visible revision in one explicit action without passing through trap-only quality warnings.
- Learning content renders fenced ASCII/code blocks safely, exposes source references, and presents local dates instead of raw ISO timestamps.
- **Mark learned** is idempotent and retry-safe; existing positive legacy counts are presented as a learned state rather than a score.
- Structured CLI payloads can be piped through `--input-json -`, and bundled skills know how to run from a source checkout when the global command is intentionally absent.
- Focused tests, typecheck, the full suite, real-browser geometry/interaction checks, and documentation reconciliation pass.

## Scope

In scope:

- Session and candidate mutation contracts in the store, CLI, Web API, and agent-facing surfaces where appropriate.
- English/Chinese quality heuristics and Web copy.
- Review modal, suppression undo, auto-refresh, token cleanup, and Web launch ergonomics.
- Bundled Codex/Claude skills, generated learning-review prompts, and Learning-view guidance for user-study insight presentation.
- Tests and current-facing documentation for the changed workflows.

Out of scope:

- Installing a global `codetrap` command or publishing a new package version.
- Calling an external translation API or silently translating user data.
- Commit, merge, push, release, or deployment.
- Broad visual redesign outside the review and shell interactions touched by this milestone.

## Constraints

- Preserve the local-first, explicit-trigger, human-authorization, and project-registry security boundaries in the parent roadmap.
- Candidate material edits must continue to bump revision, recompute `content_hash`, and invalidate stale authorization.
- Session edits and suppression changes must run under existing project/session locking and refresh derived artifacts atomically.
- Auto-refresh must pause while the candidate form is dirty and must not count passive viewing as learning.
- Existing user changes in the working tree must be preserved.

## Expected Knowledge Updates

- Rewrite affected Web/CLI workflow sections in `README.md` and installation docs.
- Update the parent roadmap status dashboard, task index, handoff, and next-session entry.
- Task index: update required because this work spans store, CLI, Web, and tests.
- Project wiki: not required; no hand-maintained wiki exists.
