# codetrap

> A local-first coding pitfall memory bank — record mistakes once, never repeat them twice.

**codetrap** records structured coding pitfalls ("traps") and provides search across them before you write code. It serves both human developers via CLI and AI coding agents via MCP (Model Context Protocol).

## Why?

AI coding agents make the same mistakes repeatedly across sessions and projects. codetrap gives them a shared memory of "what not to do" — so when an agent is about to write code, it can check the trap database first and avoid known pitfalls.

## Quick Start

```bash
# Prerequisites: Bun >= 1.x (https://bun.sh)

# Install & init
git clone <repo-url> && cd codetrap
bun install
bun run src/index.ts init

# Record your first trap
bun run src/index.ts add --json '{
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
bun run src/index.ts search "HTTP request timeout" --mode hybrid

# List all traps
bun run src/index.ts list

# Show trap details
bun run src/index.ts show 1
```

## Features

- **Structured trap recording** — title, category, context, mistake, fix, severity, tags, before/after code
- **Dual scope** — project-scoped (`.codetrap/traps.db`) and global (`~/.codetrap/traps.db`)
- **Three search modes** — FTS (SQLite FTS5), semantic (Jina embeddings), hybrid (RRF fusion)
- **Chinese + mixed-language search** — CJK bigram tokenizer, synonym map for Chinese-English terms
- **MCP server** — 10 tools + 4 resources for AI agent integration
- **Embedding cache** with freshness tracking — embeddings are rebuildable, stale ones auto-invalidated
- **Schema migrations** — in-code migration system from v0 through current v3
- **Single-binary builds** — `bun build --compile` produces standalone `.exe` binaries

## Directory Structure

```
codetrap/
├── src/
│   ├── index.ts              CLI entry point
│   ├── mcp-server.ts         MCP server entry point
│   ├── commands/router.ts    CLI command dispatch
│   ├── mcp/
│   │   ├── server.ts         MCP stdio transport + handlers
│   │   ├── tools.ts          7 MCP tool definitions
│   │   └── resources.ts      4 MCP resource URIs
│   ├── domain/trap.ts        Trap types, builders, schemas
│   ├── lib/
│   │   ├── store.ts          Project/global scope orchestration
│   │   ├── search-service.ts FTS/semantic/hybrid search, RRF fusion
│   │   ├── search-normalizer.ts  CJK bigram, synonyms, search_text
│   │   ├── fts-query.ts      Safe FTS5 literal query compiler
│   │   ├── embedder.ts       Jina Embeddings adapter
│   │   ├── embedding-job.ts  Batch embedding generation
│   │   ├── format.ts         CLI output formatting
│   │   ├── scope.ts          Project root detection
│   │   └── constants.ts      Categories, severities, defaults
│   ├── db/
│   │   ├── connection.ts     SQLite connection + PRAGMAs
│   │   ├── schema.ts         Schema init + migrations
│   │   ├── queries.ts        CRUD, search, stats, import/export
│   │   ├── embedding-queries.ts  Embedding storage SQL
│   │   └── repository.ts     Single-DB facade
│   └── tests/
│       ├── search-safety.test.ts
│       ├── search-normalizer.test.ts
│       ├── search-chinese.test.ts
│       ├── search-semantic.test.ts
│       ├── search-eval.test.ts
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
| `add` | Record a new trap (JSON or interactive) |
| `search <query>` | Search traps (--mode fts\|semantic\|hybrid) |
| `list` | List traps (--category, --severity, --scope, --limit) |
| `show <id>` | Show full trap details |
| `edit <id>` | Edit a trap |
| `delete <id>` | Delete a trap |
| `export` | Export traps to JSON |
| `import` | Import traps from JSON |
| `stats` | Show database statistics |
| `embed` | Generate embeddings (requires JINA_API_KEY) |
| `serve` | Start MCP server |

## MCP Integration

Add to your MCP client config (e.g., Claude Code):

```json
{
  "mcpServers": {
    "codetrap": {
      "command": "bun",
      "args": ["run", "src/mcp-server.ts"]
    }
  }
}
```

### Tools

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

## Build

```bash
bun run build          # Build CLI + MCP server binaries → dist/
bun run build:cli      # dist/codetrap.exe
bun run build:serve    # dist/codetrap-serve.exe
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
