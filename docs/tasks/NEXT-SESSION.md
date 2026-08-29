# Next Session

Project `D:\\llm\\codetrap\\codetrap` (codetrap). Read
`docs/tasks/2026-08-29-phase3-storage-lifecycle/handoff.md` first.

Previous session: added read-only Phase 3 storage diagnostics and safe orphan
snapshot GC; 441 tests passed, one configured browser smoke skipped, and zero
failed.

Errata: the superseded 2026-08-28 handoff says `8206618` was uncommitted; it is
now on local and remote `main`.

Current state: the storage-lifecycle slice is complete; live Phase 3 state
remains v1 and its commit-file hash was unchanged by `storage`.

Environment: ignored `dist/` binaries were rebuilt; no live GC, install,
migration, candidate decision, release, or version change occurred.

Now do:

1. Review pending locking/storage candidates explicitly.
2. Run one user-approved organic Skill improvement pilot before team-service work.

Red lines: do not run live `phase3 gc --apply`, accept candidates, use
`.codetrap/` as a network-share database, push, publish, release, install
globally, change package version, or install a Skill without explicit user
authorization.

First verify:

```powershell
bun run typecheck
bun test --timeout 30000 src/tests/phase3-hardening.test.ts src/tests/phase3.test.ts
```

Expected: typecheck exits 0 and 15 tests pass. Any mismatch means the
storage/GC safety assumptions must be re-audited before continuing.
