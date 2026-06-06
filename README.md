# codetrap

> A local-first coding pitfall memory bank — record mistakes once, never repeat them twice.

**codetrap** records structured coding pitfalls ("traps") and provides search across them before you write code. It is CLI-first for humans and AI coding agents, with an optional MCP (Model Context Protocol) adapter for clients that prefer tool schemas.

## Why?

AI coding agents make the same mistakes repeatedly across sessions and projects. codetrap gives them a shared memory of "what not to do" — so when an agent is about to write code, it can check the trap database first and avoid known pitfalls.

## Quick Start

For detailed setup options, see [Installation](docs/installation.md). Maintainers can use the Chinese [Release Playbook](docs/release-playbook.zh-CN.md) when publishing updates.

```bash
# Prerequisites: Bun >= 1.x (https://bun.sh) for npm/source installs

# npm global install (recommended)
npm install -g codetrap
codetrap --help

# Source install
git clone <repo-url> && cd codetrap
bun install
bun run install:cli
codetrap --help

# Initialize codetrap data in a project
codetrap init

# Record your first trap
codetrap add --json '{
  "title": "Dont use fetch() without timeout",
  "category": "api",
  "scope": "global",
  "context": "Any external HTTP call in Node/Bun",
  "mistake": "Using bare fetch() which has no default timeout",
  "fix": "Always wrap fetch with AbortSignal.timeout(n)",
  "severity": "critical",
  "tags": ["fetch", "timeout", "http"]
}'

# Search for relevant traps as a human
codetrap search "HTTP request timeout" --mode hybrid

# Search for relevant traps as an agent
codetrap search "HTTP request timeout" --mode hybrid --json

# List all traps
codetrap list

# Show trap details
codetrap show 1
```

## 5-Minute Agent Setup

For a first AI-agent user, the fastest path is CLI-first project guidance:

```bash
# npm/source installs require Bun because the package entrypoint uses /usr/bin/env bun
bun --version  # If this fails, install Bun first or use the binary install in docs/installation.md
npm install -g codetrap

# Initialize pitfall memory in the target project
cd /path/to/project
codetrap init
codetrap doctor
```

Add the packaged agent guidance to `AGENTS.md` for Codex, or to `CLAUDE.md` for Claude Code:

```bash
cat "$(npm root -g)/codetrap/plugins/codetrap-agent/templates/AGENTS.codetrap.md" >> AGENTS.md
# or:
cat "$(npm root -g)/codetrap/plugins/codetrap-agent/templates/AGENTS.codetrap.md" >> CLAUDE.md
```

Then have the agent run this before non-trivial edits:

```bash
codetrap search "<task keywords>" --mode hybrid --json
```

Review the top 3 returned action cards, or all returned cards if fewer than 3, before deciding whether any trap applies. Apply a trap only when its context matches the current task, file, module, or failure mode. Severity alone is not enough to apply a trap. Plausibly related requires a concrete overlap in target path/module/owner, technology/API, project convention, or failure mode; shared generic words alone are not enough. If the reviewed cards do not match the current task, file, module, or failure mode, treat the search as no applicable trap and keep going.

After a user correction, repeated test failure, or review finding, have the agent draft a candidate instead of writing confirmed memory:

```bash
cat <<'EOF' | codetrap session capture --trap-markdown - --kind review --json
Title: <durable pitfall>
Context: <when it triggers>
Mistake: <what the agent did wrong>
Fix: <what to do instead>
EOF
```

Review pending candidates with `codetrap session status`, `codetrap session list`, `codetrap doctor`, or `codetrap web`; accepting a candidate remains an explicit human decision.

Use the returned `candidate_id` and `session_id` to inspect and resolve the candidate:

```bash
codetrap session candidate <candidate-id> --session <session-id> --json

# Only after explicit human approval:
codetrap session accept <candidate-id> --session <session-id>

# Or reject instead:
codetrap session reject <candidate-id> --session <session-id> --reason "<reason>"
```

## Features

- **Structured trap recording** — title, category, context, mistake, fix, severity, tags, lifecycle, evidence, before/after code
- **Session mode capture** — record implementation notes, promote explicit structured trap notes into candidates, and save only user-accepted lessons
- **Dual scope** — project-scoped (`.codetrap/traps.db`) and global (`~/.codetrap/traps.db`)
- **CLI-first agent API** — `search/show/list/stats/doctor --json` and stdin query support for shell-friendly automation
- **Three search modes** — FTS (SQLite FTS5), semantic (Jina embeddings), hybrid (RRF fusion)
- **Chinese + mixed-language search** — CJK bigram tokenizer, synonym map for Chinese-English terms
- **MCP server** — optional tools + resources for AI agent integration
- **Embedding cache** with freshness tracking — embeddings are rebuildable, stale ones auto-invalidated
- **Doctor diagnostics** — scope, database, and embedding health in text or JSON
- **Schema migrations** — in-code migration system from v0 through current v5
- **Single-binary builds** — `bun build --compile` produces standalone binaries in `dist/`

## Directory Structure

```
codetrap/
├── src/
│   ├── index.ts              CLI entry point
│   ├── mcp-server.ts         MCP server entry point
│   ├── commands/router.ts    Thin CLI adapter + renderer
│   ├── commands/workflow.ts  CLI command behavior
│   ├── commands/command-result.ts  CLI command results + rendering
│   ├── mcp/
│   │   ├── server.ts         MCP stdio transport + handlers
│   │   ├── tools.ts          10 MCP tool definitions
│   │   └── resources.ts      4 MCP resource URIs
│   ├── domain/trap.ts        Trap types, builders, schemas
│   ├── domain/session.ts     Session, note, and candidate trap types
│   ├── lib/
│   │   ├── store.ts          Project/global scope orchestration
│   │   ├── trap-operations.ts Shared CLI/MCP operation semantics
│   │   ├── session-operations.ts Session command semantics + accept/reject flow
│   │   ├── session-review.ts Shared session review payloads + CLI conflict presenter
│   │   ├── session-store.ts  Session files, active state, index, recaps
│   │   ├── session-codec.ts  Session JSON/Markdown/candidate file conversion
│   │   ├── session-capture.ts Candidate draft normalization, extraction, and merge policy
│   │   ├── session-candidate-document.ts Candidate document transition rules
│   │   ├── session-conflicts.ts Candidate vs active-trap conflict checks
│   │   ├── trap-quality.ts   Deterministic candidate quality scoring
│   │   ├── command-requests.ts CLI/MCP request normalization helpers
│   │   ├── output-json.ts    Shared CLI/MCP JSON presenters
│   │   ├── scope-context.ts  cwd/project/global DB context + repo selection
│   │   ├── scope-migration.ts Safe project trap scope repair/migration
│   │   ├── doctor.ts         Scope and embedding health diagnostics
│   │   ├── embedding-index.ts Semantic candidate and embedding freshness interface
│   │   ├── embedding-runtime.ts Embedding provider runtime/config/status
│   │   ├── embedding-health.ts  Fresh/stale/missing embedding summaries
│   │   ├── search-service.ts FTS/semantic/hybrid candidate retrieval
│   │   ├── search-policy.ts  Applicability filtering, rerank, fusion signals
│   │   ├── search-result-card.ts Compact agent-facing result cards
│   │   ├── search-normalizer.ts  CJK bigram, synonyms, search_text
│   │   ├── fts-query.ts      Safe FTS5 literal query compiler
│   │   ├── trap-search-document.ts Derived search text + embedding passage
│   │   ├── trap-json-fields.ts Tags/path/evidence JSON array codec
│   │   ├── trap-codec.ts     Storage/JSON/archive/import shape conversion
│   │   ├── trap-mutation-result.ts Mutation result + scope fallback semantics
│   │   ├── trap-scope-match.ts Path/module/owner applicability matching
│   │   ├── trap-archive.ts   Import/export compatibility
│   │   ├── trap-transfer.ts  DB-to-DB transfer for scope migration
│   │   ├── embedder.ts       Jina Embeddings adapter
│   │   ├── embedding-job.ts  Batch embedding generation
│   │   ├── format.ts         CLI output formatting
│   │   ├── scope.ts          Project root detection
│   │   └── constants.ts      Categories, severities, statuses, defaults
│   ├── db/
│   │   ├── connection.ts     SQLite connection + PRAGMAs
│   │   ├── schema.ts         Schema init + migrations
│   │   ├── queries.ts        CRUD, search, stats, import/export
│   │   ├── embedding-queries.ts  Embedding storage SQL
│   │   └── repository.ts     Single-DB facade
│   ├── web/
│   │   ├── server.ts         Thin Web API adapter over shared operations
│   │   ├── static.ts         HTML/CSS shell
│   │   ├── client-shell.ts   Pane sizing/collapse behavior
│   │   ├── client-review.ts  Review queue + candidate draft/request model
│   │   ├── client-script.ts  DOM composition and event wiring
│   │   └── client-text.ts    Localized UI strings
│   └── tests/
│       ├── search-*.test.ts
│       ├── trap-*.test.ts
│       ├── session-cli.test.ts
│       ├── mcp-tools.test.ts
│       ├── scope.test.ts
│       ├── scope-migration-cli.test.ts
│       ├── import-export-cli.test.ts
│       └── fixtures/search-eval.json
├── skills/                   Agent skill definitions
├── plugins/codetrap-agent/   Sample Codex plugin bundle
├── scripts/                  Release asset and preflight scripts
├── docs/                     Architecture + reference docs
├── package.json
├── tsconfig.json
└── CONTEXT.md                Full project context for AI agents
```

## CLI Commands

| Command | Description |
|---|---|
| `init` | Initialize `.codetrap/` in current project |
| `add` | Record a confirmed trap (`--json` structured input; interactive mode is not implemented) |
| `search <query>` | Search traps (--mode fts\|semantic\|hybrid, --category, --scope, --status, --limit, --path, --module, --owner, --no-rerank, --ranking-signals, --json; query can come from stdin) |
| `list` | List traps (--category, --scope, --status, --path, --module, --owner, --limit, --json) |
| `show <id>` | Show full trap details (--json) |
| `edit <id>` | Edit a trap (`--json` input, `--output-json` output) |
| `delete <id>` | Delete a trap (--json) |
| `add_trap_evidence <id>` | Attach source/evidence metadata (--output-json) |
| `archive_trap <id>` | Archive a trap so default search skips it (--json) |
| `supersede_trap <old_id> <new_id>` | Mark one trap as replaced by another (--json) |
| `export` | Export traps to JSON |
| `import` | Import traps from JSON (--json) |
| `stats` | Show database statistics (--json includes embedding health) |
| `doctor` | Diagnose cwd, scope, database paths, trap counts, and embedding health (--json) |
| `repair-scope` | Move legacy mis-scoped project traps into the current project (dry-run by default, `--apply` to mutate, `--json`) |
| `migrate-project` | Move project traps between initialized projects (`--from-project-path`, `--to-project-path`, dry-run by default, `--apply`, `--json`) |
| `embed` | Generate embeddings (requires JINA_API_KEY) |
| `session` | Start a development session, append notes, capture post-flight candidates, promote explicit structured trap notes into candidates, accept/reject candidates, and clean up session files |
| `web` | Start the local review and trap library console |
| `serve` | Start MCP server |

### Session Mode

Session mode stores temporary working memory in `.codetrap/sessions/`. It does not add anything to `traps.db` until a candidate is explicitly accepted.

```bash
codetrap session start "implement agent harness" --spec docs/agent-harness-spec.md --module agent-runtime
codetrap session note --kind decision --text "Defaulted tool calls to 30s because the spec does not define timeout behavior."
cat <<'EOF' | codetrap session capture --trap-markdown - --kind review --json
Title: Do not parse nested tool calls with regex
Context: When implementing parser logic for nested tool-call arguments.
Mistake: Using regex to split nested calls corrupts arguments.
Fix: Use a tokenizer/parser and add regression tests for nested calls.
Tags: parser, tool-calls
Severity: error
EOF
codetrap session close --propose-traps
codetrap session candidates
codetrap session candidate cand-001

# Only after explicit human approval:
codetrap session accept cand-001
```

`session capture` is the low-friction post-flight path: an agent drafts a structured Markdown or JSON candidate, codetrap scores it and puts it in the session inbox, and nothing is written to `traps.db` until the candidate is accepted. If no session is active, capture creates a post-flight session, writes the candidate and recap, then closes it.

Pending candidates are surfaced through `codetrap session status`, `codetrap session list`, `codetrap doctor`, and the local `codetrap web` review console so candidate lessons do not disappear into session files.

`session accept` writes the confirmed lesson through `TrapOperations`, attaches session evidence, and checks similar active traps before saving. `--edit-json` is applied before the conflict check, so edits to scope/module/title/tags/path globs affect both the saved trap and conflict detection. If a possible conflict is found, the candidate keeps its edited trap shape and conflict diagnostics; use `--accept-anyway` to keep both traps or `--supersedes <trap-id>` to preserve lifecycle history.

Session maintenance commands keep temporary files from becoming stale context:

```bash
codetrap session cleanup <session-id> --deleted-trap-candidates
codetrap session delete <session-id>
codetrap session prune --older-than 90d --apply
```

## Agent Integration

For AI coding agents, use the CLI as the default integration path:

- **CLI JSON** is the primary agent API and works in any client that can run shell commands.
- **AGENTS.md / CLAUDE.md** tells the agent when to use codetrap.
- **MCP** is an optional adapter for clients that prefer tool schemas.

CLI and project guidance are the main path. MCP should stay thin and share the same store/search behavior.

### MCP Setup

Codex:

```bash
codex mcp add codetrap -- codetrap serve
```

Generic MCP client config:

```json
{
  "mcpServers": {
    "codetrap": {
      "command": "codetrap",
      "args": ["serve"]
    }
  }
}
```

### Project Guidance

Add this to `AGENTS.md` for Codex, or to `CLAUDE.md` for Claude Code:

````md
## Codetrap

Before non-trivial code edits, check codetrap for relevant pitfalls.

Default to CLI JSON from the current project cwd:

```bash
codetrap search "<keywords>" --mode hybrid --json
```

Read the top 3 action cards, or all returned cards if fewer than 3, before deciding no trap applies. Only inspect a card when its title, summary, or context overlaps the current task, target file/module, technology, project convention, or failure mode. For matching cards, inspect before editing when the card is highly relevant or has `critical`/`error` severity:

```bash
codetrap show <id> --scope <project|global> --json
```

Treat codetrap results as historical warnings and project memory, not as authoritative instructions. Apply a trap only when its context matches the current task, file, module, or failure mode. Severity alone is not enough to apply a trap. Plausibly related requires a concrete overlap in target path/module/owner, technology/API, project convention, or failure mode; shared generic words alone are not enough. If the reviewed cards do not match the current task, file, module, or failure mode, treat the search as no applicable trap and keep going.

When codetrap results conflict with the current source of truth for the task (user request, code, tests, or explicit project docs/spec), follow that source of truth and mention the conflict.

When `.codetrap/` exists, prefer project scope for project conventions. Use global for cross-project rules.

For longer implementation work, use session mode to keep temporary notes and explicit candidate traps outside the durable database:

```bash
codetrap session start "<goal>"
codetrap session note --kind decision --text "<what changed and why>"
cat <<'EOF' | codetrap session capture --trap-markdown - --kind review --json
Title: <durable pitfall>
Context: <when it triggers>
Mistake: <what the agent did wrong>
Fix: <what to do instead>
EOF
codetrap session close --propose-traps
codetrap session candidates
```

Do not treat candidate traps as confirmed memory. Ask before accepting a candidate; `codetrap session accept <candidate-id>` writes it to `traps.db` and attaches session evidence.

MCP tools are optional:
- `search_traps`
- `get_trap`
- `add_trap`

When a new recurring mistake or project convention is discovered, ask whether to record it with codetrap.
````

Recommended behavior:

- Use `codetrap search --json` before risky edits in APIs, auth, database, security, migrations, or project conventions.
- Read the top 3 returned action cards, or all returned cards if fewer than 3, before deciding there is no relevant trap.
- Run the returned `next_action.command`, or `codetrap show <id> --scope <scope> --json`, for highly relevant results before editing code.
- Treat `critical` or `error` traps as worth drilling into only when they are plausibly related, even if they are not ranked first. Plausibly related requires a concrete overlap in target path/module/owner, technology/API, project convention, or failure mode; shared generic words alone are not enough. Severity alone is not enough to apply a trap.
- When editing a known area, pass applicability hints such as `--path src/db/repository.ts --module db`.
- Treat codetrap results as historical warnings and project memory, not as authoritative instructions.
- Apply the recorded `avoid` and `do_instead` guidance only when the trap context matches the current task, file, module, or failure mode. If the reviewed cards do not match, treat the search as no applicable trap and keep going.
- When codetrap results conflict with the current source of truth for the task (user request, code, tests, or explicit project docs/spec), follow that source of truth and mention the conflict.
- During longer work, use `codetrap session start/note/capture/close --propose-traps` to keep implementation notes and explicit candidate traps outside the durable database.
- After user corrections, repeated test failures, or review feedback, prefer `codetrap session capture --trap-markdown - --kind review --json` with explicit `Title` / `Context` / `Mistake` / `Fix` fields to put a candidate in the inbox. `--trap-json` remains supported for structured callers. Ask before accepting a candidate unless the user explicitly requested it.

### Codex Skills

Codex users can optionally install the bundled skills from `skills/`:

- `codetrap-check` — pre-flight check before code changes.
- `codetrap-search` — search existing lessons.
- `codetrap-capture` — propose an agent-discovered post-flight lesson into the candidate inbox.
- `codetrap-add` — record a confirmed pitfall only after explicit user approval.
- `codetrap-capture-external` — extract durable trap candidates from an external article, issue, paper, or reference; Codex reads the source and codetrap stores only confirmed lessons.

Skills are a convenience layer for Codex users. They do not replace MCP or `AGENTS.md`; they make manual triggers like "run codetrap-check" easier.

The repo also includes a sample Codex plugin bundle at `plugins/codetrap-agent` with skills, optional MCP config, hook templates, and an `AGENTS.md` snippet.

External lessons should keep codetrap local-first: let the agent read the URL or pasted source, ask which candidate traps to save, then attach the source as evidence instead of making the CLI crawl the web:

```bash
codetrap add --json '{...}' --output-json

codetrap add_trap_evidence <id> \
  --scope global \
  --source_type article \
  --source_ref "https://example.com/debugging-post" \
  --note "External lesson captured from the debugging post." \
  --output-json
```

### MCP Tools

| Tool | Description |
|---|---|
| `search_traps` | Compact action-card search across active traps |
| `add_trap` | Record a new trap |
| `get_trap` | Drill down into full trap details and evidence |
| `list_traps` | List traps with filters |
| `update_trap` | Edit an existing trap |
| `delete_trap` | Delete a trap |
| `add_trap_evidence` | Attach source/evidence metadata |
| `archive_trap` | Archive a trap so default search skips it |
| `supersede_trap` | Mark a trap as replaced by another |
| `get_stats` | Database statistics |

### Resources

- `codetrap://project/recent` — Recently added project traps
- `codetrap://global/recent` — Recently added global traps
- `codetrap://project/top` — Most-hit project traps
- `codetrap://global/top` — Most-hit global traps
- `codetrap://{scope}/trap/{id}` — Individual trap by ID

Resources can accept an optional encoded `cwd` query parameter when the client knows the target workspace:

```text
codetrap://project/recent?cwd=%2Fpath%2Fto%2Fproject
```

## Configuration

| Env Variable | Required | Description |
|---|---|---|
| `JINA_API_KEY` | No | Jina AI API key for semantic/hybrid search. Without it, hybrid falls back to FTS. Get one at [jina.ai](https://jina.ai/api-dashboard/) |
| `CODETRAP_SEARCH_MODE` | No | Default search mode: `fts`, `semantic`, or `hybrid` |
| `CODETRAP_SEARCH_LIMIT` | No | Default search result limit |
| `CODETRAP_SEARCH_SCOPE` | No | Default search scope: `project` or `global` |
| `CODETRAP_RERANK` | No | Enable query-aware reranking (`true`/`false`) |

Behavior preferences can also live in `~/.codetrap/config.json`; CLI args override config, config overrides env vars, and env vars override built-in defaults.

```json
{
  "search": {
    "mode": "hybrid",
    "limit": 20,
    "scope": "project",
    "rerank": true
  }
}
```

API keys still belong in environment variables, not config files.

### Scoped Traps

Trap JSON supports optional applicability fields:

```json
{
  "path_globs": ["src/db/**"],
  "module": "db",
  "owner": "platform"
}
```

Empty applicability fields mean the trap applies everywhere. `search` and `list` can filter with `--path`, `--module`, and `--owner`; matching scoped traps receive a small rerank boost.

### Jina Embeddings Setup

codetrap works without a Jina API key. In that mode, search uses SQLite FTS keyword matching.

Privacy note: codetrap does not collect telemetry. FTS search is local-only. When `JINA_API_KEY` is set, `codetrap embed` sends trap passages to Jina, and semantic or hybrid search may send query text to Jina to compute embeddings.

If you want semantic search or stronger hybrid search, configure `JINA_API_KEY`.

1. Create a Jina API key from the [Jina AI dashboard](https://jina.ai/api-dashboard/).

2. Add it to your shell environment.

macOS or Linux with zsh:

```bash
echo 'export JINA_API_KEY="your-jina-api-key"' >> ~/.zshrc
source ~/.zshrc
```

macOS or Linux with bash:

```bash
echo 'export JINA_API_KEY="your-jina-api-key"' >> ~/.bashrc
source ~/.bashrc
```

Windows PowerShell:

```powershell
setx JINA_API_KEY "your-jina-api-key"
```

After `setx`, open a new PowerShell window.

3. Verify that the key is visible without printing the secret:

```bash
bun -e 'console.log(process.env.JINA_API_KEY ? "has-key" : "no-key")'
```

4. Generate embeddings for the traps you want semantic search to use:

```bash
cd /path/to/your/project
codetrap embed --scope project
codetrap embed --scope global
```

5. Search with hybrid mode:

```bash
codetrap search "HTTP request timeout" --mode hybrid
```

If `JINA_API_KEY` is not set:

- `codetrap search "<query>" --mode fts` works normally.
- `codetrap search "<query>" --mode hybrid` works, but falls back to FTS.
- `codetrap search "<query>" --mode semantic` and `codetrap embed` require `JINA_API_KEY`.

## Build

```bash
bun run build          # Build CLI + MCP server binaries → dist/
bun run build:cli      # dist/codetrap
bun run build:serve    # dist/codetrap-serve
bunx tsc --noEmit      # Type-check without emitting files
bun run release:preflight  # tests, builds, release assets, smoke test, npm dry-runs
```

## Test

```bash
bun test src/tests/                    # All tests
bun test src/tests/search-eval.test.ts # Recall@5 evaluation
bun run eval:dogfood -- report         # Maintainer dogfood eval report
bun run eval:dogfood -- report --live  # Dogfood eval with configured embedding provider
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun + TypeScript |
| Database | SQLite (bun:sqlite) + FTS5 |
| Embeddings | Jina AI (`jina-embeddings-v5-text-small`) |
| MCP | `@modelcontextprotocol/sdk` |
| Search | FTS5 + cosine similarity + RRF fusion + generic rerank |

## License

MIT
