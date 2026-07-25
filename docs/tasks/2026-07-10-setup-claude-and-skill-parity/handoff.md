# Handoff

## Capability layer completed

Dual-client hard requirements from the parent plan
(`docs/agent-experience-compiler-roadmap.md`):

- §3.1: `codetrap setup claude` shipped — one setup core
  (`src/lib/client-setup.ts`), one skill bundle, one guidance template, two
  thin client specs. The two "(to build)" cells in the §3.1 table are now
  built (setup command + skills entry points).
- §13.2: MCP initialize instructions carry the behavioral contract
  (`src/mcp/instructions.ts`), asserted end-to-end over a linked
  client/server transport pair.
- §13.3: `codetrap doctor` reports per-client integration health
  (`src/lib/client-health.ts`) — skills current/outdated/missing, guidance
  presence + marker currency, best-effort MCP registration — with a
  `codetrap setup <client>` next action for partial/stale installs only. The
  MCP doctor adds a `restart_hint` when the running server's version differs
  from the installed CLI's.

## Red lines honored (trust receipt)

This slice adds no history readers and no durable-write paths.
Durable writes by the new code: **0** to `traps.db`; guidance edits happen
only inside explicit `codetrap setup <client>` runs (append-only with marker
idempotency, exactly as `setup codex` already did); 0 skills auto-installed
outside `setup`; 0 automations; 0 MCP registrations without `--mcp`.
Learning review remains unbuilt — nothing scans session history.

## Coverage / traceability

- Tests: `src/tests/client-health.test.ts`,
  `src/tests/agent-onboarding.test.ts` (setup-claude + parity),
  `src/tests/mcp-tools.test.ts` (handshake + doctor version).
- Docs: README (5-minute setup, features, command table, "Claude Code Setup"
  section), CLI `--help`.
- Known pre-existing failure (not this slice): `web-console.test.ts`
  embedding-reindex 500 in this environment; see implementation-log.

## Measured UX budgets

Not applicable to this slice (no review inbox surface). The §4.5 setup/doctor
budgets hold: setup is one command per client, idempotent, safe to re-run;
doctor names the fix (`codetrap setup <client>`) rather than just the failure.

## Next highest-ROI task

**Phase 0 — dual-client proof point (§16).** Requires the user: run the
hand-rolled discovery prompt over the last 30 days of Codex sessions and of
Claude Code sessions (≤10 LessonCandidates each, dry-run, plain JSON files),
then have the user accept/edit/skip. Record acceptance rate, actionability,
cross-client overlap, and review time in a Phase 0 dossier. Do not start
Phase 1 schema/CLI work before those numbers exist (§1.5 evidence before
architecture). After Phase 0: `session-store` locking already covers
`.codetrap/sessions/`; add equivalent locking for `.codetrap/learning/` when
those directories are introduced (§13.1).
