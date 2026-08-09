# Task Brief: Phase 3 Skill Candidate Lifecycle

> Created: 2026-08-08
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done

## Goal

Implement the evidence-approved screenshot-first UI review workflow as the first
`skill_candidate`, with an inspectable draft, revision-bound authorization,
byte-identical Codex/Claude installation, durable receipts, and exact rollback.

## Success Criteria

- The approved `review-ui-screenshots` artifact contains a valid `SKILL.md` and
  recommended `agents/openai.yaml` metadata.
- A skill candidate can be proposed, edited, previewed, and approved through the
  existing candidate envelope without weakening revision-bound authorization.
- Preview names both exact client targets and shows before/after file hashes
  without changing either client home.
- Apply refuses pending, stale, wrong-destination, or incomplete candidates and
  installs byte-identical artifacts into explicitly selected Codex and Claude
  homes in one recoverable operation.
- The commit record and trust receipt identify the candidate, authorization
  scope, executor claim, both targets, and reversible snapshot.
- Rollback refuses later edits and otherwise restores or removes both skill
  directories byte-for-byte.
- Candidate schema migration remains backward compatible; Phase 2 does not
  accidentally accept Phase 3 kinds.
- Targeted lifecycle tests, the full Windows suite, build, skill validation, and
  diff checks pass.

## Scope

In scope:

- `skill_candidate` schema, receipts, CLI commands, and lifecycle store.
- One evidence-backed, cross-client skill artifact: `review-ui-screenshots`.
- Exact preview/install/rollback behavior for explicit Codex and Claude homes.
- Documentation and restart-ready implementation memory.

Out of scope:

- Custom-agent or automation candidates; the evidence gate rejected both.
- Automatic installation into the user's live client homes without a final
  preview of those exact paths.
- Claims that the installed skill changed later organic work before such
  longitudinal evidence exists.
- Modifying or committing the user's `question.txt` if it reappears.

## Constraints

- Installation requires a current user approval bound to the candidate revision
  and exact content hash; agents cannot self-authorize.
- Skill names and files are allowlisted, and targets must resolve to exactly
  `<client-home>/skills/<skill-name>`.
- Both client targets are snapshotted before either is replaced; partial failure
  restores every touched target.
- Rollback is conflict-safe and never overwrites a skill modified after install.
- Do not push without user request.

## Expected Knowledge Updates

- Parent roadmap Phase 3 status, decision, and evidence blocks.
- CLI/workflow documentation.
- `docs/tasks/INDEX.md` and `docs/tasks/NEXT-SESSION.md`.
- No wiki exists; do not create one.
