# codetrap Architecture

本文描述 codetrap 当前架构：Trap 的存储、Scope policy、CLI/MCP adapters、FTS/semantic/hybrid search、embedding 缓存和测试结构。

## System Overview

```mermaid
flowchart TB
  User["User / Developer"]
  Agent["AI Agent"]

  CLI["CLI Adapter<br/>src/index.ts<br/>src/commands/router.ts"]
  MCP["MCP Adapter<br/>src/mcp/server.ts<br/>src/mcp/tools.ts"]

  Store["TrapStore<br/>src/lib/store.ts<br/>Scope policy"]

  ProjectRepo["TrapRepository<br/>project scope"]
  GlobalRepo["TrapRepository<br/>global scope"]

  ProjectDB[("Project SQLite DB<br/>.codetrap/traps.db")]
  GlobalDB[("Global SQLite DB<br/>~/.codetrap/traps.db")]

  SearchService["SearchService<br/>src/lib/search-service.ts"]
  EmbeddingJob["Embedding Job<br/>src/lib/embedding-job.ts"]

  TrapQueries["Trap Row Queries<br/>src/db/queries.ts"]
  EmbeddingQueries["Embedding Queries<br/>src/db/embedding-queries.ts"]
  Schema["Schema / Migrations<br/>src/db/schema.ts"]

  SearchDoc["Trap Search Document<br/>src/lib/trap-search-document.ts"]
  Normalizer["Search Normalizer<br/>src/lib/search-normalizer.ts"]
  FTSQuery["FTS Query Compiler<br/>src/lib/fts-query.ts"]
  Embedder["Embedding Provider Adapter<br/>src/lib/embedder.ts<br/>JinaEmbedder"]

  Jina["Jina Embeddings API<br/>https://api.jina.ai/v1/embeddings"]

  User --> CLI
  Agent --> MCP
  CLI --> Store
  MCP --> Store

  Store --> ProjectRepo
  Store --> GlobalRepo

  ProjectRepo --> ProjectDB
  GlobalRepo --> GlobalDB

  ProjectRepo --> SearchService
  GlobalRepo --> SearchService
  ProjectRepo --> EmbeddingJob
  GlobalRepo --> EmbeddingJob

  SearchService --> TrapQueries
  SearchService --> EmbeddingQueries
  SearchService --> FTSQuery
  SearchService --> Normalizer
  SearchService --> Embedder

  EmbeddingJob --> EmbeddingQueries
  EmbeddingJob --> SearchDoc
  EmbeddingJob --> Embedder

  TrapQueries --> SearchDoc
  TrapQueries --> Normalizer
  Schema --> SearchDoc

  Embedder --> Jina
  Schema --> ProjectDB
  Schema --> GlobalDB
```

## Module Responsibilities

```mermaid
flowchart LR
  subgraph Adapters["Adapters"]
    CLI["CLI<br/>parse flags, render text"]
    MCP["MCP<br/>tool schema, JSON payloads"]
  end

  subgraph Policy["Scope Policy"]
    Store["TrapStore<br/>project-first/global-second<br/>scope validation"]
  end

  subgraph SingleDB["Single Database Modules"]
    Repo["TrapRepository<br/>single DB facade"]
    Search["SearchService<br/>fts/semantic/hybrid"]
    EmbedJob["Embedding Job<br/>batch generation"]
  end

  subgraph Storage["Storage Implementation"]
    TrapRows["Trap row queries"]
    EmbedRows["Embedding row queries"]
    Migrations["Schema migrations"]
  end

  subgraph Derivation["Derived Search Data"]
    SearchDoc["Trap Search Document<br/>search_text, passage, hash, freshness"]
    Normalizer["Search Normalizer<br/>CJK bigram, synonyms"]
    FTSCompiler["FTS Query Compiler<br/>literal query safety"]
  end

  CLI --> Store
  MCP --> Store
  Store --> Repo
  Repo --> Search
  Repo --> EmbedJob
  Repo --> TrapRows
  Repo --> EmbedRows

  Search --> TrapRows
  Search --> EmbedRows
  Search --> FTSCompiler
  Search --> Normalizer

  EmbedJob --> SearchDoc
  EmbedJob --> EmbedRows

  TrapRows --> SearchDoc
  Migrations --> SearchDoc
```

Key locality rules:

- `TrapStore` owns Scope policy. It decides whether reads go project-first/global-second or only to an explicit scope.
- `TrapOperations` owns shared Trap command execution semantics for CLI and MCP adapters.
- `trap-archive.ts` owns archive import/export compatibility, including evidence remapping.
- `trap-json-fields.ts` owns JSON string-array conversion for `tags` and `related_files`.
- `TrapRepository` owns one SQLite database. It does not know where project/global roots come from.
- `SearchService` owns retrieval and ranking inside one database.
- `trap-search-document.ts` owns derived Trap search data: `search_text`, embedding passage, passage hash, and freshness rules.
- `search-result-card.ts` owns compact action-card shape for agent-facing search results.
- CLI and MCP are adapters. They should not implement search, ranking, embedding, or schema rules.

## Storage Model

```mermaid
erDiagram
  traps {
    INTEGER id PK
    TEXT title
    TEXT category
    TEXT tags
    TEXT scope
    TEXT context
    TEXT mistake
    TEXT fix
    TEXT search_text
    TEXT before_code
    TEXT after_code
    TEXT severity
    TEXT state_key
    TEXT status
    INTEGER supersedes_id
    TEXT valid_from
    TEXT valid_until
    TEXT project_path
    INTEGER hit_count
    TEXT created_at
    TEXT updated_at
  }

  traps_fts {
    VIRTUAL rowid
    TEXT title
    TEXT context
    TEXT mistake
    TEXT fix
    TEXT tags
    TEXT search_text
  }

  trap_embeddings {
    INTEGER trap_id PK,FK
    TEXT provider
    TEXT model
    INTEGER dimensions
    INTEGER passage_version
    TEXT passage_hash
    BLOB embedding
    TEXT updated_at
  }

  trap_evidence {
    INTEGER id PK
    INTEGER trap_id FK
    TEXT source_type
    TEXT source_ref
    TEXT observed_at
    TEXT related_files
    TEXT note
    TEXT created_at
  }

  schema_version {
    INTEGER version
  }

  traps ||--o{ trap_evidence : has

  traps ||--o| trap_embeddings : "has cached embedding"
  traps ||--|| traps_fts : "indexed by triggers"
```

Storage notes:

- `traps` is canonical Trap storage.
- `trap_evidence` stores drill-down source metadata and is not loaded by default search.
- `traps_fts` is an FTS5 virtual table synchronized by SQLite triggers.
- `search_text` is derived from Trap fields for CJK bigram and synonym-expanded lexical search.
- `trap_embeddings` is a rebuildable cache. Freshness is determined by provider/model/dimensions/passage_version/passage_hash.
- `schema_version` controls migrations. Current schema version is `4`.
- Version 4 adds trap lifecycle metadata (`status`, `state_key`, `supersedes_id`, `valid_from`, `valid_until`) and `trap_evidence`.

## Search Flow

```mermaid
sequenceDiagram
  participant Caller as CLI / MCP
  participant Store as TrapStore
  participant Repo as TrapRepository
  participant Search as SearchService
  participant TrapQ as Trap Queries
  participant EmbedQ as Embedding Queries
  participant Provider as EmbeddingProvider

  Caller->>Store: search(query, mode, scope?, category?, limit?)
  Store->>Store: resolve scope policy

  loop each readable scope
    Store->>Repo: search(query, opts)
    Repo->>Search: search(query, opts)

    alt mode = fts
      Search->>TrapQ: searchTraps(query)
      TrapQ->>TrapQ: normalizeQuery + prepareFTSQuery
      TrapQ-->>Search: FTS ranked Trap results
    else mode = semantic
      Search->>Provider: embed(query, retrieval.query)
      Search->>EmbedQ: getAllFreshEmbeddings(config, filters)
      EmbedQ-->>Search: fresh Trap embeddings
      Search->>Search: cosine similarity + min score
    else mode = hybrid
      Search->>TrapQ: FTS search
      Search->>Provider: embed(query, retrieval.query)
      Search->>EmbedQ: fresh embeddings
      Search->>Search: semantic scoring
      Search->>Search: RRF fusion + length normalization
      Note over Search: If semantic is unavailable or has no candidates,<br/>return FTS results with diagnostics.
    end

    Search-->>Repo: TrapSearchResult[]
    Repo-->>Store: TrapSearchResult[]
  end

  Store-->>Caller: grouped results by scope
```

Search modes:

- `fts`: SQLite FTS5 with safe literal query compilation.
- `semantic`: query embedding + brute-force cosine similarity over fresh embeddings.
- `hybrid`: FTS + semantic + RRF fusion. Falls back to FTS with diagnostics when semantic is unavailable.

## FTS Search Detail

```mermaid
flowchart TB
  Query["Raw query<br/>HTTP 请求约定"]
  Normalize["normalizeQuery()<br/>CJK bigram + synonyms + ASCII tokens"]
  Compile["prepareFTSQuery()<br/>quote literal terms"]
  Match["SQLite FTS5 MATCH"]
  Rank["ORDER BY rank"]
  Results["TrapSearchResult<br/>sources: ['fts']"]

  Query --> Normalize
  Normalize --> Compile
  Compile --> Match
  Match --> Rank
  Rank --> Results
```

Safety rule:

- User text is treated as literal text by default.
- FTS operators such as `AND`, `OR`, `NOT`, and `NEAR` are not exposed through the default interface.
- Special characters like `*`, `(`, `)`, `/`, `-`, `"`, and `~` should not crash search.

## Embedding Generation Flow

```mermaid
sequenceDiagram
  participant CLI as CLI embed command
  participant Store as TrapStore
  participant Repo as TrapRepository
  participant Job as Embedding Job
  participant EQ as Embedding Queries
  participant Doc as Trap Search Document
  participant Provider as JinaEmbedder
  participant DB as SQLite

  CLI->>Store: ensureEmbeddings(scope, limit, force, batchSize)
  Store->>Repo: ensureEmbeddings(...)
  Repo->>Job: runEmbeddingJob(adapter, provider, opts)
  Job->>EQ: countEmbeddable()
  Job->>EQ: trapsNeedingEmbeddings(config)
  EQ->>Doc: embeddingIsFresh(trap, embedding, config)
  EQ-->>Job: stale/missing traps

  loop batches
    Job->>Doc: buildTrapPassage(trap)
    Job->>Provider: embed(passages, retrieval.passage)
    Provider-->>Job: Float32Array[]
    Job->>Doc: hashTrapPassage(passage)
    Job->>EQ: saveEmbedding(record)
    EQ->>DB: upsert trap_embeddings
  end

  Job-->>Repo: generated/skipped/batches
  Repo-->>Store: per-scope result
  Store-->>CLI: total result
```

Embedding cache rules:

- Embeddings are generated explicitly by `codetrap embed`.
- `hybrid` search uses existing fresh embeddings if available.
- `hybrid` search falls back to FTS if no provider/key/fresh embeddings are available.
- `semantic` search requires a provider and fresh embeddings.
- Updating passage-related Trap fields invalidates the cached embedding.

## Write Flow

```mermaid
flowchart TB
  AddOrUpdate["add/update Trap"]
  Store["TrapStore<br/>validate scope"]
  Repo["TrapRepository"]
  TrapQueries["Trap row queries"]
  SearchDoc["Trap Search Document"]
  DB[("SQLite traps")]
  FTS[("traps_fts")]
  Embeddings[("trap_embeddings")]

  AddOrUpdate --> Store
  Store --> Repo
  Repo --> TrapQueries
  TrapQueries --> SearchDoc
  SearchDoc -->|"buildTrapSearchText()"| TrapQueries
  TrapQueries --> DB
  DB -->|"SQLite triggers"| FTS
  Repo -->|"passage fields changed"| Embeddings
```

Write invariants:

- Every Trap row has a derived `search_text`.
- SQLite triggers keep `traps_fts` synchronized with `traps`.
- If a Trap field that contributes to embedding passage changes, the cached embedding is deleted.
- Fresh embeddings can be regenerated later with `codetrap embed`.

## Test Architecture

```mermaid
flowchart LR
  Tests["src/tests"]
  MemoryDB["openDatabase(':memory:')"]
  MockProvider["Mock EmbeddingProvider"]
  Repo["TrapRepository"]
  Search["SearchService"]
  Eval["search-eval.json<br/>Recall@5 fixture"]

  Tests --> MemoryDB
  Tests --> MockProvider
  MemoryDB --> Repo
  MockProvider --> Repo
  Repo --> Search
  Eval --> Tests
```

Test coverage:

- FTS safety and literal query compilation.
- CLI argument parsing.
- CJK bigram and synonym normalization.
- Chinese/mixed-language search.
- Semantic search with mock embeddings.
- Hybrid fallback diagnostics.
- Embedding generation batching.
- Embedding invalidation after Trap updates.
- Recall@5 eval fixture across lexical, Chinese, semantic, and oblique queries.

## Key Commands

```bash
# typecheck
bunx tsc --noEmit

# tests
bun test src/tests/

# build standalone binaries
bun run build

# generate embeddings for project scope
bun run src/index.ts embed --scope project

# hybrid search
bun run src/index.ts search "HTTP 请求约定" --mode hybrid
```

## Current Extension Points

```mermaid
flowchart TB
  Current["Current Search Slice"]
  Reranker["Optional reranker<br/>after hybrid top-k"]
  Lifecycle["Implemented lifecycle<br/>active/superseded/archived"]
  Evidence["Implemented evidence metadata<br/>source_ref, related_files"]
  Cards["Implemented compact action cards<br/>agent-friendly search result"]
  Doctor["codetrap doctor<br/>index and embedding health"]

  Current --> Reranker
  Current --> Lifecycle
  Current --> Evidence
  Current --> Cards
  Current --> Doctor
```

Implemented modules:

- `search-result-card.ts`: compact action cards for MCP/agent consumption.
- Trap lifecycle fields: `state_key`, `status`, `supersedes_id`, `valid_from`, `valid_until`.
- Evidence/source metadata for traceable Trap origin.

Likely next modules:

- `codetrap doctor` for FTS index and embedding cache health.
