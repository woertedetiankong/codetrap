# Task Brief: Dual-client hard requirements — setup claude, MCP self-describing contract, per-client doctor

Date: 2026-07-10
Parent plan: `docs/agent-experience-compiler-roadmap.md` (v2)
Scope: the phase-independent hard requirements from §3.1, §13.2, §13.3 — the items
the parent plan marks "(to build)" or lists as multi-client engineering
prerequisites that do not depend on Phase 0 evidence.

## Why this slice (and not Phase 0 or Phase 1)

§16 sequences Phase 0 (the dual-client proof point) before any schema
stabilization, and §3.2 red-lines learning review as explicit-user-trigger only.
Phase 0 therefore requires the user's real session history and the user's own
accept/edit/skip judgments — it cannot be completed autonomously by an
implementing agent. The §3.1/§13 client-symmetry items, by contrast, are hard
requirements on the *existing* product surface ("Any feature, doc, or example
that assumes Codex-only is a defect") and are prerequisites for running Phase 0
in both clients at all. They were implementable and testable now.

## In scope

1. `codetrap setup claude` — symmetric to `setup codex`: same skill bundle
   (single source: `plugins/codetrap-agent/skills/`), installed to
   `~/.claude/skills` (`--claude-home` / `CLAUDE_CONFIG_DIR` override), same
   guidance template appended to `CLAUDE.md`, MCP opt-in via `--mcp`
   (`claude mcp add codetrap -- codetrap serve`). One setup core,
   per-client differences confined to a spec table (§3.1 "one CLI contract;
   two thin client adapters").
2. §13.2 self-describing MCP protocol — the behavioral contract (pre-flight
   search, candidate capture, human review gate, explicit-trigger-only learning
   review) embedded in the MCP server's initialize instructions.
3. §13.3 per-client doctor — `codetrap doctor` reports, per client: bundled
   skills installed/current/outdated, guidance file presence + template
   currency (marker check), MCP registration (best-effort config probe), plus
   a CLI/server version surface for the "restart your client" hint.

## Out of scope (deliberately)

- Phase 0 proof point and everything downstream (§16 Phases 0-3): `codetrap
  learn` commands, LessonCandidate schema, learning inbox, `source_agent`,
  cross-client dedup. Blocked on the user running Phase 0.
- `.codetrap/learning/` file locking (§13.1): the directory does not exist yet;
  locking lands with the Phase 1 commands that create it. Session-store locking
  already shipped in the audit remediation (M15–M17).
- A Claude Code `/codetrap-learning-review` slash command (§7.2): part of the
  learning-review loop, Phase 1.
- Template *version* currency (doctor detecting an outdated-but-present
  guidance section): the idempotency marker is the v1 currency check; a
  versioned template marker is a follow-up.

## Acceptance criteria

- `codetrap setup claude --json` creates `.codetrap/`, installs all 5 bundled
  skills byte-identical to the codex install, writes/appends `CLAUDE.md`, is
  idempotent on re-run, and never touches MCP without `--mcp`. (Tested.)
- An MCP client connecting to `codetrap serve` receives the behavioral contract
  in the initialize result. (Tested via InMemoryTransport round-trip.)
- `codetrap doctor --json` carries `version` and a `clients` array with both
  clients' skills/guidance/MCP health; partial or stale installs produce a
  `codetrap setup <client>` next action; clients that are not integrated at all
  are reported without nagging. (Tested.)
- README command table and setup docs updated in the same change (§3.3
  documentation accuracy invariant).
