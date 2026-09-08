# Next Session

Project `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read
`docs/tasks/2026-09-08-impact-production-migration/handoff.md` first.

Current slice: the approved whole Impact prototype replaces the production UI,
with real feedback, revisions and verification. 102/102 test files pass; the slice is complete.
Errata: the prototype-only handoff's statement that integration is future work is
superseded by the production migration. Earlier Evals/Run work is integrated.
Environment: source preview 4750, separate prototype 4760, installed service 4751.
Now do: follow any new user feedback against the completed migration; no remaining required implementation.
Red lines: do not insert demonstration records into the real project or expose launch tokens.
First verify: `bun run check:web` (expected exit 0; failure means artifact drift).
