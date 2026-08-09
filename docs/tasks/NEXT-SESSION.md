# Next Session

Project `D:\llm\codetrap\codetrap` (codetrap). Read
`docs/tasks/2026-08-08-phase3-skill-candidate-lifecycle/handoff.md` first.
Previous session: Phase 3 closed after its byte-identical dual-client install
changed a later Codex screenshot-review task; 380 tests passed, one intentional
browser-smoke test skipped, and the Windows build passed.
Errata: the global PATH installation remains removed; use `bun run src/index.ts`.
Current state: Phase 3 and the F1-F4 UI proof are in implementation commit
`d834eb4` plus its handoff follow-up; both remain unpushed.
Environment: live skill commit `p3-20260809044652-b3sa2k` is current in both
approved client homes; `question.txt` is user-owned if it reappears.
Now do: 1. push the branch only when explicitly requested 2. begin Phase 4
only after an explicit scope decision.
Red lines: do not push without explicit user request; do not manually remove the
live skill; do not claim Claude behavior proof; do not touch `question.txt`.
First verify: `git status --short --branch; git log -2 --oneline; bun test src/tests/phase3.test.ts src/tests/web-client-text.test.ts src/tests/web-client-script.test.ts`
(expected a clean `phase3-skill-candidate`, a handoff commit above `d834eb4`, and 12 tests passed, 0 failed; a
mismatch means inspect repository or lifecycle drift before editing).
