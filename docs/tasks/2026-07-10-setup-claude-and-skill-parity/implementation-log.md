# Implementation Log

## Decisions affecting the product model / CLI-MCP contract

1. **`codex-setup.ts` generalized into `client-setup.ts`, not duplicated.**
   `runClientSetup(client, options)` with a `CLIENT_SPECS` table
   (home env var, home dir, guidance file, MCP command, label) is the whole
   per-client surface; adding a third client later means adding one spec entry
   (§3.1 symmetry rule). `runCodexSetup` is gone; the only consumer was
   `maintenance-commands.ts`.

2. **Setup JSON shape: `codex_home` → `client_home`, plus a new `client`
   field.** Breaking rename in the `setup <client> --json` payload, mirroring
   the repo's precedent for documented breaking CLI changes (M24). All other
   keys (`project`, `skills`, `agents`, `mcp`) kept; `agents` keeps its name
   for both clients since it points at the agent-guidance file
   (AGENTS.md / CLAUDE.md).

3. **Claude home resolution honors `CLAUDE_CONFIG_DIR`, default `~/.claude`;
   flag `--claude-home`** — exact parallel of `CODEX_HOME` / `--codex-home`.

4. **§13.2 instructions live in `src/mcp/instructions.ts`** and are passed as
   `instructions` in the `Server` constructor options, so they arrive in the
   initialize result. `start()` was split into `createServer(store)` + `start()`
   so tests can connect a real client over `InMemoryTransport` and assert the
   handshake, instead of poking SDK internals.

5. **§13.3 doctor checks live in `src/lib/client-health.ts`.**
   - Skill currency = byte equality against the bundled skill text (the same
     equality `setup` uses for its `unchanged` status), so doctor and setup
     can never disagree about what "current" means.
   - Guidance currency = the template idempotency marker (`TEMPLATE_MARKER`),
     the same check `setup` uses before appending.
   - MCP registration is a best-effort probe of known config locations
     (codex: `<home>/config.toml`; claude: `<home>/.claude.json`,
     `~/.claude.json`, project `.mcp.json`) searching for "codetrap". No
     readable config → `"unknown"`, never a guess. This is a heuristic and is
     labeled as such in the report.
   - **Nagging policy:** a client whose home dir is missing, or that has zero
     codetrap skills installed, is reported but produces no next action (the
     user may integrate via guidance-only or not use that client). Partial or
     outdated skills, or a guidance file missing the codetrap section, produce
     one `codetrap setup <client>` next action — setup is idempotent and
     self-healing (§4.5), so the fix is always safe to suggest.

6. **Version surface for the restart hint (§4.5/§13.3).** `DoctorReport` gains
   `version` (the version of whichever process built the report). The MCP
   `doctor` tool additionally spawns `codetrap --version` best-effort (3s
   timeout, all failures ignored) and attaches `restart_hint` when the
   installed CLI differs from the running server — the "stale MCP server after
   binary upgrade" failure is otherwise invisible. The CLI doctor path never
   spawns anything.

## Deviations from the roadmap text

- §13.3 asks for "skill presence and version". Skills carry no version field;
  byte-currency against the bundled copy is stronger and is what shipped.
- §13.3's "MCP server version matches CLI binary version" check can only run
  where both versions are observable — implemented on the MCP doctor path
  (server version = its own constant, CLI version = spawned `--version`), not
  on the CLI path (a CLI process cannot see a client's long-running server).

## Verification

- `bunx tsc --noEmit` clean.
- Full suite: 235 pass / 1 fail — the failure
  (`web-console.test.ts` "embedding reindex API refreshes project and global
  profile status", expected 200 got 500) **pre-exists this change**: it fails
  identically on the unmodified tree in this environment (verified via
  `git stash` → run → `git stash pop`). Not touched by this slice; likely
  environment-specific (embedding provider path under WSL). Left for a
  separate investigation.
- New coverage: `client-health.test.ts` (6 tests), `agent-onboarding.test.ts`
  (+3: setup claude default, setup claude MCP dry-run, cross-client byte parity),
  `mcp-tools.test.ts` (+2: initialize-handshake contract, doctor version field).
