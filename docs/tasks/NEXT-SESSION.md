# Next Session

Project `D:\llm\codetrap\codetrap` (codetrap). Read
`docs/tasks/2026-08-08-phase3-evidence-gate/handoff.md` first.
Previous session: Phase 2 committed as `c294eb1`; Phase 3 gate selected only
`skill_candidate` and found no custom-agent or automation evidence.
Errata: the global PATH installation was removed; use `bun run src/index.ts`.
Current state: Phase 3 implementation awaits individual acceptance-candidate approval.
Environment: `question.txt` is absent; treat it as user-owned if it reappears.
Now do: 1. confirm screenshot-first UI critique as the acceptance candidate
2. implement the skill lifecycle only after confirmation.
Red lines: do not manufacture custom-agent/automation demand; do not install a
skill without exact approval; do not touch `question.txt` if it reappears; do not push.
First verify: `git log --oneline -2; git status --short --branch` (expected
`c294eb1` above `34ad8fb` and only the audit docs uncommitted).
