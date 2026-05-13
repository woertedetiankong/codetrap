# codetrap Retrieval and Memory Roadmap

Date: 2026-05-13

codetrap is currently a local-first CLI plus MCP server for recording coding pitfalls as reusable `trap` records. Its present search model is simple and useful: SQLite FTS5 searches `title`, `context`, `mistake`, `fix`, and `tags`, with project/global scope filtering.

This document summarizes recent reference material and turns it into a practical development path for codetrap.

## Current Baseline

codetrap already made one strong architectural choice: it stores memory in a database, not a loose Markdown file. That gives it a cleaner path toward reliable indexing, filtering, migration, and MCP tool access.

Current strengths:

- Local-first SQLite storage.
- Clear project/global memory scopes.
- FTS5 full-text search with schema-managed triggers.
- CLI and MCP share the same `TrapStore` service.
- Trap records are structured around mistake patterns, not generic notes.

Current limits:

- Search is keyword-based, not semantic.
- Chinese and mixed Chinese/English tokenization are weak under default SQLite FTS5.
- Search ranking does not yet account for trap freshness, supersession, or whether a rule is still active.
- There is no reranking layer to resolve close candidates.
- There is no evaluation set to measure search quality changes.

## Reference Notes

### 1. Mem0: "Your AI Agent's Memory Is Just a File? That's the Problem"

Source: https://mem0.ai/blog/your-ai-agents-memory-is-just-a-file-thats-the-problem

Main idea:

Flat-file memory works for small, static, single-user memories, but breaks as memories grow, change, conflict, and need selective retrieval.

Key characteristics:

- Argues that agent memory should become a real data layer.
- Highlights limits of loading entire memory files into context.
- Emphasizes semantic retrieval over grep-style search.
- Calls out temporal reasoning, conflict resolution, concurrency, scoping, and forgetting as production memory needs.

What it means for codetrap:

- codetrap is already on the right side of the file/database divide because it uses SQLite.
- The next risk is staying at "database-backed keyword search" for too long.
- The important move is not just storing more traps, but retrieving the right few traps for the current coding task.

Design takeaway:

Do not turn codetrap into a giant `MEMORY.md`. Keep trap records structured, indexed, scoped, and queryable.

### 2. Mem0 Temporal Reasoning X Article

Source: https://x.com/mem0ai/article/2054227809829364200

Main idea:

Long-running memory systems fail when old facts and current facts are all retrieved as if they are equally true today. Mem0 adds temporal metadata and time-aware reranking.

Key characteristics:

- Every memory gets a time signature.
- Memories are classified as temporal facts, such as event, state, plan, relationship, preference, or absence.
- Time-sensitive queries are classified by intent, such as current state, historical range, upcoming plan, or duration.
- Temporal scoring is additive after retrieval. It nudges ranking without discarding candidates too early.
- Historical memories are preserved instead of deleted.

What it means for codetrap:

Trap records can also become stale. A project might once prefer `axios`, later require `fetchWrapper`, and later move to another wrapper.

Future trap records should support lifecycle fields:

- `observed_at`: when the trap was learned.
- `valid_from`: when the guidance became valid.
- `valid_until`: when it stopped being valid, if known.
- `status`: `active`, `superseded`, or `archived`.
- `state_key`: stable key for an evolving rule, such as `http-client-convention`.
- `supersedes_id`: link from a newer trap to an older trap.

Design takeaway:

For codetrap, temporal handling should be a reranking and lifecycle layer, not a hard pre-filter. Prefer current active traps, but keep historical traps inspectable.

### 3. Elastic / Jina: `jina-embeddings-v5-omni`

Source: https://www.elastic.co/search-labs/blog/jina-embeddings-v5-omni-all-media-one-index

Main idea:

One embedding family can put text, images, audio, and video into a shared semantic space, enabling cross-media retrieval in one index.

Key characteristics:

- Supports text, image, video, and audio retrieval.
- Text embeddings are compatible with the corresponding Jina v5 text models.
- Useful for multilingual and multimodal document retrieval.
- Suggests a future where screenshots, PDFs, videos, and text can all participate in memory search.

What it means for codetrap:

The immediate value is semantic text search, especially multilingual or Chinese/English mixed retrieval. The multimodal part is future-facing.

Potential future uses:

- Store error screenshots as trap evidence.
- Search UI bug screenshots by natural language.
- Attach terminal recording snippets or logs.
- Index design screenshots or PR review images.

Design takeaway:

Do not start codetrap with multimodal search. First add text embeddings cleanly. Keep the embedding abstraction flexible enough that multimodal evidence can be added later.

### 4. OBLIQ-Bench

Source: https://dianetc.github.io/obliq_bench.pdf

Main idea:

Many real retrieval tasks are "oblique": the relevant document matches a latent pattern rather than sharing obvious surface words with the query. Current retrievers often fail to surface candidates, even when a reasoning model can verify relevance once candidates are shown.

Key characteristics:

- Tests implicit stance, conversation failure modes, proof-strategy analogues, writing style, and fuzzy recollection.
- Shows a retrieval-verification gap: LLMs can recognize relevance after seeing candidates, but scalable retrievers often fail to retrieve those candidates.
- Dense retrievers vary widely; bigger is not always better.
- BM25 and late-interaction models fail differently.
- Query rewriting helps only when the hidden target can be translated into useful search terms.

What it means for codetrap:

codetrap queries often look oblique:

- "This task touches HTTP requests; what should I avoid?"
- "Any project convention around API calls?"
- "What did we learn last time this kind of bug happened?"

The trap may say `axios`, `fetchWrapper`, or `request abstraction` without containing the user's exact wording.

Design takeaway:

Do not rely on one retriever. Use layered retrieval:

1. Lexical search for exact terms.
2. Semantic search for meaning.
3. Reranking for candidate judgment.
4. Structured metadata for category, severity, scope, status, and time.

Also, write traps with better retrieval text. A trap should include synonyms and task contexts, not only the final fix.

### 5. `memory-lancedb-pro`

Source: https://github.com/CortexReach/memory-lancedb-pro

Main idea:

A production-oriented agent memory plugin backed by LanceDB, with hybrid retrieval, cross-encoder reranking, scope isolation, lifecycle scoring, and management tools.

Key characteristics:

- LanceDB vector store.
- BM25 full-text search.
- Hybrid retrieval with vector/BM25 fusion.
- Cross-encoder rerank, with providers such as Jina, SiliconFlow, Voyage, Pinecone, and compatible endpoints.
- Recency, importance, length normalization, decay, and noise filtering.
- Multi-scope isolation and management CLI.
- Chinese query expansion exists as a practical patch for short CJK queries.

What it means for codetrap:

This is the strongest reference for an "effect-first" memory retrieval stack. It is also heavier than codetrap currently needs.

Useful ideas to borrow:

- Hybrid retrieval instead of vector-only.
- Optional reranker over a small candidate pool.
- Preserve exact keyword hits so reranking does not bury symbols, package names, or API names.
- Add query diagnostics or `--explain-search`.
- Add lifecycle scoring after base retrieval.

Ideas to avoid for now:

- Moving the whole project to LanceDB immediately.
- Making external reranker services required.
- Adding too much lifecycle automation before search quality is measurable.

Design takeaway:

Borrow the pipeline shape, not necessarily the storage engine.

### 6. `lerim-cli`

Source: https://github.com/lerim-dev/lerim-cli

Main idea:

A local-first context runtime for coding agents that extracts durable project memory and retrieves it through SQLite, FTS5, sqlite-vec, and RRF fusion.

Key characteristics:

- Global SQLite context store.
- Local ONNX embeddings.
- `sqlite-vec` vector search.
- SQLite FTS5 lexical retrieval.
- Reciprocal Rank Fusion (RRF) to combine semantic and lexical candidates.
- Maintenance flow for merging duplicates, archiving stale records, and refreshing useful context.
- Generated "working memory" Markdown view for fast agent startup.

What it means for codetrap:

This is the closest architectural reference because codetrap already uses SQLite and FTS5.

Useful ideas to borrow:

- Keep SQLite as the canonical store.
- Add vector search as a derived index.
- Use RRF for first hybrid ranking because it is simple and robust.
- Track index health: trap count, FTS count, embedding count, missing embeddings, stale embeddings.
- Consider a generated "active traps" summary for startup or preflight use.

Important caution:

`lerim-cli` is a Python project with its own licensing and runtime assumptions. Treat it as an architecture reference, not code to copy.

Design takeaway:

The best near-term codetrap path is closer to `lerim-cli` than to a full LanceDB migration.

## Recommended Retrieval Architecture

The target architecture should be layered and incremental:

```text
User / AI query
      |
      v
Query normalization
      |
      +--> SQLite FTS5 lexical search
      |
      +--> Embedding vector search
      |
      v
Candidate fusion
      |
      v
Metadata and lifecycle scoring
      |
      v
Optional rerank
      |
      v
Top traps with explanations
```

Recommended default for codetrap:

```text
SQLite canonical store
+ FTS5 exact search
+ embedding table as derived index
+ brute-force cosine first
+ RRF fusion
+ optional reranker later
```

Why not jump straight to LanceDB:

- Current trap volume is likely small.
- SQLite is already embedded and cross-platform.
- Bun packaging stays simpler.
- The first problem is search quality, not index scale.
- A clean search abstraction can still support LanceDB later.

## Development Roadmap

### Phase 0: Stabilize Current Search

Goal: make current FTS search safer and more inspectable before adding vectors.

Tasks:

- Add `PRAGMA busy_timeout` to reduce transient SQLite lock errors.
- Add safe FTS query compilation for free-form user input.
- Add `search --explain` to show scope, query, matched fields, and ranking source.
- Add fixtures for known traps and expected search results.
- Add tests for project/global search fallback.

Acceptance criteria:

- Existing keyword search behavior is covered by tests.
- Bad punctuation or mixed-language queries do not throw FTS errors.
- Search explanations make false negatives easier to debug.

### Phase 1: Better Chinese and Mixed-Language Keyword Search

Goal: improve current search without introducing embeddings yet.

Tasks:

- Add a normalized `search_text` representation per trap.
- Pre-tokenize mixed Chinese/English text into additional searchable terms.
- Add a small synonym/alias map for coding terms, such as "请求", "HTTP", "axios", "fetch".
- Preserve exact terms like package names, filenames, symbols, commands, and API identifiers.

Acceptance criteria:

- Searches like "请求库", "HTTP 请求", "axios", and "fetchWrapper" can all find the relevant trap when appropriate.
- Exact symbol searches do not get weakened by normalization.

### Phase 2: Semantic Search MVP

Goal: add semantic retrieval while keeping SQLite as the canonical database.

Tasks:

- Add an `embeddings` or `trap_embeddings` table.
- Store `trap_id`, `embedding_model`, `embedding_dim`, `embedding`, and `updated_at`.
- Generate embedding text from structured fields:

```text
title
category
tags
context
mistake
fix
before_code / after_code when useful
```

- Add an embedding provider abstraction:
  - remote provider option for higher quality
  - local provider option later for offline use
- Start with brute-force cosine over stored vectors.
- Add `search --mode lexical|semantic|hybrid`.

Acceptance criteria:

- "HTTP 请求应该注意什么" can find a trap about `axios` and `fetchWrapper`.
- Search works even if embeddings are missing, falling back to FTS5.
- Re-embedding can be triggered after model changes.

### Phase 3: Hybrid Ranking

Goal: combine exact and semantic search reliably.

Tasks:

- Retrieve top candidates from FTS5 and vector search.
- Fuse rankings with RRF.
- Keep source annotations per result:

```text
sources: ["fts", "semantic"]
```

- Prefer strong lexical hits for exact identifiers.
- Add search diagnostics showing candidate counts and fusion score.

Acceptance criteria:

- Exact searches still work better than pure semantic search for package names and symbols.
- Conceptual searches work better than pure FTS.
- Hybrid mode becomes the default.

### Phase 4: Optional Reranking

Goal: improve top results without making external services mandatory.

Tasks:

- Rerank only a small pool, such as top 10 or top 20.
- Support a provider interface for Jina, Voyage, local rerankers, or OpenAI-compatible endpoints where available.
- Blend rerank score with original fused score.
- Preserve high-confidence exact matches with a floor so reranking does not bury symbols.
- Add timeout and fallback behavior.

Acceptance criteria:

- If reranker fails, search still returns fused results.
- Reranking improves ambiguous queries in test fixtures.
- Search latency remains acceptable for CLI and MCP use.

### Phase 5: Trap Lifecycle and Temporal Reasoning

Goal: prevent stale traps from competing equally with current rules.

Tasks:

- Add lifecycle fields:

```text
status: active | superseded | archived
observed_at
valid_from
valid_until
state_key
supersedes_id
```

- Add commands:

```bash
codetrap supersede <old-id> --json '{...new trap...}'
codetrap archive <id>
codetrap list --status active
```

- During search, prefer active/current traps.
- Keep superseded traps visible in detail pages and exports.
- Add temporal reranking rather than hard filtering.

Acceptance criteria:

- If an old trap is superseded, default search returns the current rule first.
- Historical traps remain inspectable.
- MCP tools can communicate supersession status clearly to the agent.

### Phase 6: Maintenance and Quality Control

Goal: keep the trap database useful as it grows.

Tasks:

- Add duplicate detection.
- Add weak-trap detection for vague records.
- Add `codetrap doctor` for index health.
- Add `codetrap reindex` and `codetrap reembed`.
- Add stats for active/superseded/archived traps.
- Optionally generate a compact "active project traps" summary.

Acceptance criteria:

- Users can diagnose stale indexes.
- Duplicate or low-quality traps do not quietly pollute retrieval.
- Agent startup can access a compact high-signal view without loading every trap.

### Phase 7: Team and Multimodal Futures

Goal: support larger teams and richer evidence only when needed.

Possible features:

- Export/import bundles with metadata and embeddings excluded or regenerated.
- Shared project trap registries.
- Evidence attachments: screenshots, logs, small repro files.
- Multimodal embedding for screenshots or diagrams.
- LanceDB or Elasticsearch backend option for larger installations.

Trigger for this phase:

- Trap count grows beyond what brute-force or sqlite-vec handles comfortably.
- Teams need shared indexing.
- Evidence becomes more visual than textual.

## Evaluation Plan

Before changing retrieval, create a small benchmark owned by codetrap.

Suggested fixture categories:

- Exact keyword: `axios` finds `fetchWrapper` trap.
- Semantic: "HTTP 请求约定" finds the same trap.
- Chinese: "请求库" and "网络请求" find relevant traps.
- Symbol: `fetchWrapper` finds exact symbol trap.
- Oblique: "这个任务会不会违反项目 API 约定" finds HTTP convention traps.
- Superseded: old and new rules exist; active rule ranks first.
- Noise: unrelated traps do not appear in top results.

Suggested metrics:

- Recall@5
- MRR
- top-1 correctness for active rules
- search latency p50/p95
- fallback success when embeddings or reranker are unavailable

## Recommended Near-Term Implementation Order

Best next 5 steps:

1. Add tests around current FTS search.
2. Add safe FTS query normalization and better Chinese/mixed-language search text.
3. Add a search service abstraction so CLI and MCP do not call raw query functions directly.
4. Add embedding storage and brute-force semantic search.
5. Add RRF hybrid ranking and `--explain`.

Only after those are working should codetrap add reranking and lifecycle fields.

## Strategic Positioning

codetrap should not try to become a general agent memory platform immediately. Its sharper niche is:

> A project-aware pitfall memory layer for coding agents.

That means its best features should be:

- Very easy trap capture.
- Very reliable pre-coding trap recall.
- Strong project/global scoping.
- Excellent exact search for code symbols.
- Good semantic search for natural-language task descriptions.
- Lifecycle handling for evolving project conventions.
- Clean MCP tools that agents can use before writing code.

The references all point in the same direction: retrieval quality is not one feature. It is a stack. For codetrap, the right stack is incremental, SQLite-first, hybrid by default, and lifecycle-aware.
