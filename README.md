# codetrap

> A local-first coding pitfall memory bank — record mistakes once, never repeat them twice.

**codetrap** records structured coding pitfalls ("traps") and provides search across them before you write code. It serves both human developers via CLI and AI coding agents via MCP (Model Context Protocol).

## Why?

AI coding agents make the same mistakes repeatedly across sessions and projects. codetrap gives them a shared memory of "what not to do" — so when an agent is about to write code, it can check the trap database first and avoid known pitfalls.

## Quick Start

For detailed setup options, see [Installation](docs/installation.md). Maintainers can use the Chinese [Release Playbook](docs/release-playbook.zh-CN.md) when publishing updates.

```bash
# Prerequisites: Bun >= 1.x (https://bun.sh)

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

# Search for relevant traps
codetrap search "HTTP request timeout" --mode hybrid

# List all traps
codetrap list

# Show trap details
codetrap show 1
```

## Features

- **Structured trap recording** — title, category, context, mistake, fix, severity, tags, lifecycle, evidence, before/after code
- **Dual scope** — project-scoped (`.codetrap/traps.db`) and global (`~/.codetrap/traps.db`)
- **Three search modes** — FTS (SQLite FTS5), semantic (Jina embeddings), hybrid (RRF fusion)
- **Chinese + mixed-language search** — CJK bigram tokenizer, synonym map for Chinese-English terms
- **MCP server** — 10 tools + 4 resources for AI agent integration
- **Embedding cache** with freshness tracking — embeddings are rebuildable, stale ones auto-invalidated
- **Schema migrations** — in-code migration system from v0 through current v4
- **Single-binary builds** — `bun build --compile` produces standalone binaries in `dist/`

## Directory Structure

```
codetrap/
├── src/
│   ├── index.ts              CLI entry point
│   ├── mcp-server.ts         MCP server entry point
│   ├── commands/router.ts    CLI command dispatch
│   ├── mcp/
│   │   ├── server.ts         MCP stdio transport + handlers
│   │   ├── tools.ts          10 MCP tool definitions
│   │   └── resources.ts      4 MCP resource URIs
│   ├── domain/trap.ts        Trap types, builders, schemas
│   ├── lib/
│   │   ├── store.ts          Project/global scope orchestration
│   │   ├── trap-operations.ts Shared CLI/MCP operation semantics
│   │   ├── search-service.ts FTS/semantic/hybrid search, RRF fusion
│   │   ├── search-result-card.ts Compact agent-facing result cards
│   │   ├── search-normalizer.ts  CJK bigram, synonyms, search_text
│   │   ├── fts-query.ts      Safe FTS5 literal query compiler
│   │   ├── trap-search-document.ts Derived search text + embedding passage
│   │   ├── trap-json-fields.ts Tags/evidence JSON array codec
│   │   ├── trap-archive.ts   Import/export compatibility
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
│   └── tests/
│       ├── search-*.test.ts
│       ├── trap-*.test.ts
│       ├── mcp-tools.test.ts
│       ├── scope.test.ts
│       ├── import-export-cli.test.ts
│       └── fixtures/search-eval.json
├── skills/                   Agent skill definitions
├── docs/                     Architecture + reference docs
├── package.json
├── tsconfig.json
└── CONTEXT.md                Full project context for AI agents
```

## CLI Commands

| Command | Description |
|---|---|
| `init` | Initialize `.codetrap/` in current project |
| `add` | Record a new trap (`--json` structured input; interactive mode is not implemented) |
| `search <query>` | Search traps (--mode fts\|semantic\|hybrid, --category, --scope, --status, --limit) |
| `list` | List traps (--category, --scope, --status, --limit) |
| `show <id>` | Show full trap details |
| `edit <id>` | Edit a trap |
| `delete <id>` | Delete a trap |
| `add_trap_evidence <id>` | Attach source/evidence metadata |
| `archive_trap <id>` | Archive a trap so default search skips it |
| `supersede_trap <old_id> <new_id>` | Mark one trap as replaced by another |
| `export` | Export traps to JSON |
| `import` | Import traps from JSON |
| `stats` | Show database statistics |
| `embed` | Generate embeddings (requires JINA_API_KEY) |
| `serve` | Start MCP server |

## Agent Integration

For AI coding agents, use three layers:

- **MCP** gives the agent structured tools like `search_traps` and `add_trap`.
- **AGENTS.md / CLAUDE.md** tells the agent when to use codetrap.
- **CLI** is the fallback that works even when MCP is unavailable.

MCP and project guidance are complementary. MCP tells the agent what it can call; `AGENTS.md` or `CLAUDE.md` tells it when to call it.

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

Prefer MCP tools when available:
- `search_traps`
- `get_trap`
- `add_trap`

Fallback to CLI:

```bash
codetrap search "<keywords>" --mode hybrid
```

When a new recurring mistake or project convention is discovered, ask whether to record it with codetrap.
````

Recommended behavior:

- Use `search_traps` or `codetrap search` before risky edits in APIs, auth, database, security, migrations, or project conventions.
- Call `get_trap` for highly relevant results before editing code.
- Apply the recorded `avoid` and `do_instead` guidance while making changes.
- Ask before recording a new trap unless the user explicitly requested it.

### Codex Skills

Codex users can optionally install the bundled skills from `skills/`:

- `codetrap-check` — pre-flight check before code changes.
- `codetrap-search` — search existing lessons.
- `codetrap-add` — record a new pitfall.

Skills are a convenience layer for Codex users. They do not replace MCP or `AGENTS.md`; they make manual triggers like "run codetrap-check" easier.

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

## Configuration

| Env Variable | Required | Description |
|---|---|---|
| `JINA_API_KEY` | No | Jina AI API key for semantic/hybrid search. Without it, hybrid falls back to FTS. Get one at [jina.ai](https://jina.ai/api-dashboard/) |

All other behavior is configured via sensible defaults — see `src/lib/constants.ts`.

### Jina Embeddings Setup

codetrap works without a Jina API key. In that mode, search uses SQLite FTS keyword matching. If you want semantic search or stronger hybrid search, configure `JINA_API_KEY`.

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
```

## Test

```bash
bun test src/tests/                    # All tests
bun test src/tests/search-eval.test.ts # Recall@5 evaluation
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun + TypeScript |
| Database | SQLite (bun:sqlite) + FTS5 |
| Embeddings | Jina AI (`jina-embeddings-v5-text-small`) |
| MCP | `@modelcontextprotocol/sdk` |
| Search | FTS5 + cosine similarity + RRF fusion |

## License

MIT
