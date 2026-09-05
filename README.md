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
codetrap add --input-json '{
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
codetrap setup codex    # or: codetrap setup claude
codetrap doctor
```

`codetrap setup codex` installs the bundled Codex skills into `~/.codex/skills`, initializes `.codetrap/` when needed, and writes `AGENTS.md`. `codetrap setup claude` is the symmetric Claude Code path: same skill bundle into `~/.claude/skills`, same guidance template appended to `CLAUDE.md`. Neither configures MCP by default.

To also configure MCP, opt in explicitly:

```bash
codetrap setup codex --mcp    # or: codetrap setup claude --mcp
```

The packaged template is the source of truth for exact agent behavior. It tells agents to run CLI JSON checks before non-trivial edits, inspect only relevant action cards, keep post-flight lessons in the session candidate inbox, and require explicit human approval before accepting a candidate into `traps.db`.

For a quick manual check, agents can run `codetrap search "<task keywords>" --mode hybrid --json` from the project cwd.

## Features

- **Structured trap recording** — title, category, context, mistake, fix, severity, tags, lifecycle, evidence, before/after code
- **Session mode capture** — record implementation notes, promote explicit structured trap notes into candidates, and save only user-accepted lessons
- **Feedback Improver loop** — ingest correlated work-surface feedback, redact and weight its evidence, dry-run destination routing, and stage only reviewable candidates; no automatic approval or destination write
- **Existing Skill improvement** — stage exact-base file patches that preserve unrelated references, examples, scripts, assets, binaries, and empty directories; preview, approve, install, and roll back through the Phase 3 trust boundary
- **Dual scope** — project-scoped (`.codetrap/traps.db`) and global (`~/.codetrap/traps.db`)
- **CLI-first agent API** — `search/show/list/stats/doctor --json` and stdin query support for shell-friendly automation; `search --json` returns `{ results, diagnostics }` so degraded coverage (semantic fallback, partial embedding index) is visible even when results are empty
- **Three search modes** — FTS (SQLite FTS5), semantic (built-in local Hugging Face, Ollama, or Jina embeddings), hybrid (RRF fusion)
- **Chinese + mixed-language search** — CJK bigram tokenizer, synonym map for Chinese-English terms
- **MCP server** — optional tools + resources for AI agent integration
- **Embedding cache** with multi-profile freshness tracking — local Hugging Face/Jina/Ollama vectors can coexist and stale ones auto-invalidate
- **Stable project identity** — `codetrap init` mints a durable id in `.codetrap/project.json`, so a project's identity survives renames (the path is display-only metadata); `doctor` surfaces it
- **Doctor diagnostics** — scope, database, embedding, and per-client (Codex / Claude Code) integration health in text or JSON
- **Schema migrations** — in-code migration system from v0 through current v7
- **Single-binary builds** — `bun build --compile` produces standalone binaries in `dist/`

## Directory Structure

```
codetrap/
├── src/
│   ├── index.ts              CLI entry point
│   ├── mcp-server.ts         MCP server entry point
│   ├── commands/router.ts    Optional thin CLI adapter + renderer
│   ├── commands/workflow.ts  CLI command behavior
│   ├── commands/command-result.ts  CLI command results + rendering
│   ├── mcp/
│   │   ├── server.ts         MCP stdio transport + handlers
│   │   ├── tools.ts          MCP tool definitions
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
│   │   ├── session-candidate-scope.ts Candidate accepted-scope fallback
│   │   ├── session-conflicts.ts Candidate vs active-trap conflict checks
│   │   ├── trap-quality.ts   Deterministic candidate quality scoring
│   │   ├── command-requests.ts CLI/MCP request normalization helpers
│   │   ├── output-json.ts    Shared CLI/MCP JSON presenters
│   │   ├── scope-context.ts  cwd/project/global DB context + repo selection
│   │   ├── scope-migration.ts Safe project trap scope repair/migration
│   │   ├── doctor.ts         Scope and embedding health diagnostics
│   │   ├── embedding-runtime.ts Embedding provider runtime/config/status
│   │   ├── embedding-health.ts  Fresh/stale/missing embedding summaries
│   │   ├── embedding-management.ts Embedding profile command output
│   │   ├── search-service.ts FTS/semantic/hybrid candidate retrieval
│   │   ├── search-policy.ts  Applicability filtering, rerank, fusion signals
│   │   ├── public-retrieval-benchmark.ts Public benchmark runner + drift gate
│   │   ├── search-result-card.ts Compact agent-facing result cards
│   │   ├── search-normalizer.ts  CJK bigram, synonyms, search_text
│   │   ├── fts-query.ts      Safe FTS5 literal query compiler
│   │   ├── trap-search-document.ts Derived search text + embedding passage
│   │   ├── trap-json-fields.ts Tags/path/evidence JSON array codec
│   │   ├── trap-codec.ts     Storage/JSON/archive/import shape conversion
│   │   ├── trap-mutation-result.ts Mutation result + scope fallback semantics
│   │   ├── string-list.ts    Shared string list de-duping
│   │   ├── text-lines.ts     Shared line trimming helpers
│   │   ├── value-types.ts    Shared runtime value guards
│   │   ├── trap-scope-match.ts Path/module/owner applicability matching
│   │   ├── trap-archive.ts   Import/export compatibility
│   │   ├── trap-transfer.ts  DB-to-DB transfer for scope migration
│   │   ├── embedder.ts       Ollama and Jina Embeddings adapters
│   │   ├── huggingface-embedder.ts Built-in local Hugging Face adapter
│   │   ├── local-embedding-models.ts Reviewed q8 model registry
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
│   │   ├── browser/         Typed entry, Library/Review state and legacy templates
│   │   ├── client-review.ts  Review queue + candidate draft/request model
│   │   ├── client-script.ts  Shared embedded browser asset accessor
│   │   ├── client-bundle.generated.ts  Generated browser build (do not edit)
│   │   └── client-text.ts    Localized UI strings
│   └── tests/
│       ├── search-*.test.ts
│       ├── public-retrieval-benchmark.test.ts
│       ├── trap-*.test.ts
│       ├── session-cli.test.ts
│       ├── mcp-tools.test.ts
│       ├── scope.test.ts
│       ├── scope-migration-cli.test.ts
│       ├── import-export-cli.test.ts
│       └── fixtures/search-eval.json
├── plugins/codetrap-agent/   Codex plugin bundle with skills, MCP config, hooks, and templates
├── benchmarks/retrieval-v1/  Released synthetic retrieval dataset + expected results
├── scripts/                  Release, evaluation, benchmark, and preflight scripts
├── docs/                     Architecture + reference docs
├── package.json
└── tsconfig.json
```

## CLI Commands

| Command | Description |
|---|---|
| `init` | Initialize `.codetrap/` in current project |
| `add` | Record a confirmed trap (`--input-json` structured input, `--json` JSON output; interactive mode is not implemented) |
| `search <query>` | Search traps (--mode fts\|semantic\|hybrid, --category, --scope, --status, --limit, --path, --module, --owner, --no-rerank, --ranking-signals, --json; optional `--run-id` + `--device-id` records search/exposure metadata; query can come from stdin) |
| `list` | List traps (--category, --scope, --status, --path, --module, --owner, --limit, --json) |
| `show <id>` | Show full trap details (--json) |
| `edit <id>` | Edit a trap (`--input-json` input, `--json` output) |
| `delete <id>` | Delete a trap (--json) |
| `add_trap_evidence <id>` | Attach source/evidence metadata (--output-json) |
| `archive_trap <id>` | Archive a trap so default search skips it (--json) |
| `supersede_trap <old_id> <new_id>` | Mark one trap as replaced by another (--json) |
| `export` | Export traps to JSON |
| `import` | Import traps from JSON (--json) |
| `stats` | Show database statistics (--json includes embedding health) |
| `doctor` | Diagnose cwd, scope, database paths, trap counts, and embedding health (--json) |
| `setup codex` | Install Codex skills into `~/.codex/skills` and AGENTS.md guidance; MCP is opt-in with `--mcp` |
| `setup claude` | Install Claude Code skills into `~/.claude/skills` and CLAUDE.md guidance; MCP is opt-in with `--mcp` |
| `repair-scope` | Move legacy mis-scoped project traps into the current project (dry-run by default, `--apply` to mutate, `--json`) |
| `migrate-project` | Move project traps between initialized projects (`--from-project-path`, `--to-project-path`, dry-run by default, `--apply`, `--json`) |

Commands that accept `--input-json` also accept `--input-json -` and read one
JSON object from standard input. Prefer this form for multiline payloads on
Windows PowerShell, where native argument forwarding can otherwise rewrite
quotes.
| `embed` | Generate embeddings (requires a configured local Hugging Face, Ollama, or Jina provider) |
| `embeddings` | Manage embedding profiles (`status`, `list`, `models`, `use huggingface|ollama|jina`, `reindex`) |
| `learn` | Review your own Codex or Claude Code history for reusable lessons (`sources`, `review`, `evidence-pack`, `reviews`, `stage`, `delete`); read-only against history, writes only a review directory |
| `improver` | Capture correlated human feedback, inspect or delete stored events, dry-run or stage evidence-weighted candidates, record behavior outcomes, and summarize loop metrics |
| `useful` | Record that a recalled trap actually helped; optional `--run-id` + `--device-id` attaches the human label to an Observation Run |
| `observe` | Explicitly record metadata-only Run start, validation, trap feedback/miss, and completion events |
| `pack` | Export a user-curated context pack of committed lessons for planning time (`pack export --traps 1,2,3`) |
| `session` | Start a development session, append notes, capture post-flight candidates, promote explicit structured trap notes into candidates, approve/accept/reject/roll back candidates, migrate candidate records between schema versions, inspect authorization receipts and suppressed lessons, and clean up session files |
| `phase2` | Review-bound low-risk destinations: conventions/docs/eval patches, insight shelf, lesson validation/graduation, longitudinal metrics, and retrieve-vs-curate decisions |
| `phase3` | High-side-effect Skill candidates: propose a preset or an exact-base improvement, preview file changes for exact Codex/Claude targets, install under content-and-path-bound approval, inspect commits, and roll back safely |
| `web` | Start the local Review, Library, Learning, Embeddings, and real-data Impact Overview/Runs/Evals console |
| `serve` | Start MCP server |

### Metadata-only Observation Runs

Observation is opt-in and local. It does not scan transcripts in the background,
does not read hidden reasoning, and does not make the trap store depend on
telemetry. Events are written to `.codetrap/observations/ledger.sqlite`; the
existing `traps.db` remains the business source of truth.

For normal Agent work, preview the project-local integration first, then apply
it explicitly for each client you use:

```bash
codetrap observe enable codex
codetrap observe enable codex --apply

codetrap observe enable claude
codetrap observe enable claude --apply

codetrap observe status --json
```

The preview does not change files. Apply merges three handlers into
`.codex/hooks.json` or `.claude/settings.json` without replacing unrelated
settings, and backs up an existing config before writing. `UserPromptSubmit`
starts a turn-scoped Run, `Stop` completes it, and `SessionEnd` closes an
unfinished Run as partial. Codex requires its normal project-hook trust review.
Hook stdout is neutral JSON and recording failures never block or steer the
Agent.

Only allowlisted lifecycle metadata is used. Prompt text, assistant replies,
transcript paths/files, diffs, tool inputs/outputs, secrets, and hidden reasoning
are ignored. While exactly one automatic Run is active, ordinary
`codetrap search` and `codetrap useful` calls attach to it automatically; with
zero or multiple active Runs, Codetrap fails closed and requires explicit Run
context. Inspect the active state and capacity health with
`codetrap observe current --json` or `codetrap observe status --json`.

If an Agent process is killed before its completion Hook runs, Codetrap keeps
that retry state instead of silently evicting it. Preview stale entries without
changing the ledger or state file, then apply recovery only after reviewing the
listed Run ids:

```bash
codetrap observe recover --older-than-days 7 --json
codetrap observe recover --older-than-days 7 --apply --json
```

Preview is the default. `--apply` records each recoverable Run as
`cancelled`/`partial` before removing its Hook state; a failed append remains
retryable. Age alone never triggers automatic deletion. Impact → Overview also
shows an operator warning when capacity is near its limit or stale Runs exist.
If the Hook state file is damaged or from an unsupported version, the Ledger
and integration status remain available while health reports `unavailable`.
Counts are reported as unknown rather than zero, and recovery refuses to change
the file; restore a valid backup or inspect
`.codetrap/observations/agent-hook-state.json` before retrying.

Disable future automatic Runs without deleting historical evidence:

```bash
codetrap observe disable codex
codetrap observe disable codex --apply
codetrap observe disable claude --apply
```

The explicit contract below remains available for custom tools and clients.

Start a Run, attach real search/usefulness activity, record validation, then
complete it:

```bash
codetrap observe start --input-json '{"run_id":"run-123","event_id":"start-123","device_id":"device-local","actor_ref":null,"source_ref":"cli","source_client":"codex","source_session_ref":"opaque-session","repository_revision":null,"branch":null,"model_provider":"openai","model_name":null,"completeness":"complete"}' --json

codetrap search "HTTP timeout" --run-id run-123 --device-id device-local --event-id search-123 --json
codetrap useful 5 --scope project --run-id run-123 --device-id device-local --event-id useful-123 --json

codetrap observe validation --input-json '{"run_id":"run-123","event_id":"validation-123","device_id":"device-local","actor_ref":null,"source_ref":"cli","kind":"test","command":"bun test","status":"passed","passed":12,"failed":0,"duration_ms":820}' --json
codetrap observe complete --input-json '{"run_id":"run-123","event_id":"complete-123","device_id":"device-local","actor_ref":null,"source_ref":"cli","status":"completed","completeness":"complete","duration_ms":42000,"input_tokens":null,"output_tokens":null}' --json
```

`event_id` is optional, but a stable value makes retries idempotent. Search
queries, path/module hints, validation commands, missed-query text, and feedback
notes are persisted only as SHA-256 fingerprints. Arbitrary extra fields fail
closed. Fingerprints hide raw text but are not encryption; do not put secrets in
IDs, `source_ref`, branch names, or other caller-controlled metadata.

When observation storage fails during `search` or `useful`, the primary
operation still succeeds and returns an `observation_write_failed` diagnostic or
`observation_warning`. A direct `observe` command fails because recording is its
primary operation.

MCP exposes the same contract through `record_observation`; `search_traps` and
`mark_trap_useful` accept the same `run_id`, `device_id`, and optional `event_id`.
Codex and Claude Code use the same schema and differ only in explicit client
metadata.

If a project has no Observation Run yet, **Impact → Overview** offers an
unsaved example timeline and a plain-language Agent handoff. The example lives
only in browser memory, is clearly labelled as synthetic, disappears on reload,
and never creates project identity, an Observation Ledger, or data that affects
Overview/Evals metrics. The adjacent connection guide now shows preview/apply
commands for opt-in automatic Codex/Claude capture and keeps the explicit Agent
instruction as a fallback.

The observation readiness card distinguishes no configured collection, configured
clients awaiting a first task, existing real task records, and unreadable local
state. Codex and Claude Code have separate configuration indicators. Installed
hooks do not prove client trust or execution; existing records do not prove that
capture remains active. Reading readiness never enables hooks or creates a
project identity or ledger. Corrupt state is not displayed as zero activity.

Impact Overview uses a dedicated layout with recent tasks, current feedback,
validation denominators, and links to inspect evidence. An absent ledger means
no evidence has been recorded; it does not by itself tell whether client hooks
are configured. Check `codetrap observe status --json` for each client’s configuration state.

Feedback corrections are folded by **Run + scope + trap ID** in both Overview
and Evals. Project `#1` and global `#1` are separate experiences. Existing v1
scope-prefixed revisions supply this identity without rewriting the ledger;
unqualified historical references remain unknown and do not open a guessed
Library item. All original feedback events remain visible in the Run timeline.
Real scoped Run events also offer **Review this lesson**: record feedback, draft a
focused revision, test positive and negative examples, then explicitly apply or
reject it. Library → **Experience revisions** reopens the draft and its rollback
receipt. A passing keyword check does not demonstrate real-task benefit; the
receipt separately shows later evidence for that exact revision. See the
[revision workflow, storage and recovery](docs/experience-revisions.md).

Overview's feedback fraction counts all current judgments, including those with
no trap reference. Evals' Helpful/noise rates count only ratings with a trap
reference. Neither number measures causal improvement.

Open `codetrap web --open`, choose **Impact**, then **Evals** to inspect four
separate evidence tracks:

- deterministic Recall@3, Recall@5, and MRR over the selected project's
  `.codetrap/evals/suite.json`, with legacy source-fixture compatibility;
- zero-cost controlled baseline/candidate experiments over that immutable
  fixture, with fixed profiles, a user-visible seed and trial count, regression-
  first case evidence, and reproducibility/configuration identities;
- observed Helpful/noise/miss/validation ratios, always with their numerator and
  denominator;
- governed review candidates for explicit misses, irrelevant or harmful
  guidance, and validation failures recorded after an exposure.

A missing set offers **Prepare from my lessons**: preview a fixed corpus from
confirmed project/global lessons, then create it and add reviewed examples.
Existing source fixtures offer **Copy existing tests**, preserving their order
and leaving the original file intact. **Download evaluation set** exports the
frozen content and cases without overwriting source files. See the
[workflow, identity mapping and compatibility guide](docs/project-evaluation-suites.md).
Codetrap does not substitute its maintainer benchmark for project data.
Review candidates are unconfirmed clues,
not ground truth. A user can inspect the source Run, author the exact query and
expected fixture IDs, save a draft/preview without changing the fixture, then
explicitly accept, reject, or roll back the case. Opening Evals and its GET path
remain read-only and never launch an Agent; only the explicit accept action writes
one validated case through the locked, content-bound, reversible Phase 2
lifecycle. Retrieval metrics and observed outcomes remain separate because
neither alone proves task causality.

A `no_relevant_trap` retrieval case must return **no results** to pass, even
when its recall thresholds are zero. Unexpected results appear in both failures
and noisy hits; recall averages still use cases with expected traps. Temporary
fixture databases are closed after evaluation, including embedding fallback
and error paths.

The controlled lane currently provides two deterministic profiles:
`retrieval_policy_v1` compares FTS-only retrieval with each confirmed case's
configured retrieval mode, while `memory_contribution_v1` compares the expected
traps being unavailable versus available. Both sides run from in-memory fixture
snapshots and write only immutable experiment evidence under
`.codetrap/evals/`; the active set and source tree are not changed by a run.
Historical results remain readable when the active set is unavailable; new
comparisons require a valid set with at least one reviewed example.
These v1 experiments make zero model calls and incur zero token cost. They test
retrieval and confirmed-memory contribution, not end-to-end Codex or Claude Code
behavior; real Agent/worktree trials require a later explicit, budgeted opt-in.

The console keeps the workspace project and selected item in refresh-safe hash
routes. Examples include `#/library/project/42?project=p-…`,
`#/learning/p-<origin>/<insight-id>?project=p-<workspace>`, and
`#/impact/runs/<run-id>?project=p-…`. Refresh and browser Back/Forward restore the
exact scoped lesson or Learning origin, including cross-project links. Missing
projects/items stay explicit instead of selecting a different first item. The
project reference is derived from the normalized registered root: it contains
neither the absolute path nor the launch token, but is local to that root and is
not an authorization credential or portable identity after moving the project.
Existing view-only hashes still work. On phones, Learning and Library switch
between list and reader, keep filters collapsed initially, and use one main
scroll region. Back/Forward within the tab also restores reading position.
Unsaved practice notes still require saving before a reload. An expired launch link shows a persistent
recovery page instead of a partially initialized console. Impact navigation stays
available during loading, empty, and error states; when observation is off, the
Overview offers a direct read-only path to any checked-in offline Evals.

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
codetrap session edit cand-001 --edit-json '{"title":"中文标题","fix":"必须先验证再保存。"}'
codetrap session rename <session-id> "中文会话名称"

# Only after explicit human approval. The user approves; an agent may then
# execute the commit against that approval:
codetrap session approve cand-001 --authorized-scope "cand-001 only"
codetrap session accept  cand-001 --executor agent
```

`session capture` is the low-friction post-flight path: an agent drafts a structured Markdown or JSON candidate, codetrap scores it and puts it in the session inbox, and nothing is written to `traps.db` until the candidate is accepted. If no session is active, capture creates a post-flight session, writes the candidate and recap, then closes it.

`session edit` is the supported automation path for translating or improving a candidate. It applies a partial `--edit-json` object under the session lock, recomputes quality, refreshes the content hash, bumps the revision when the lesson changes materially, and invalidates stale approval. `session rename` changes the human-readable goal while preserving the stable session ID and synchronizing `session.json`, `index.json`, `recap.md`, and the implementation-notes header.

Pending candidates are surfaced through `codetrap session status`, `codetrap session list`, `codetrap doctor`, and the local `codetrap web` review console so candidate lessons do not disappear into session files.

`session accept` writes the confirmed lesson through `TrapOperations`, attaches session evidence, and checks similar active traps before saving. `--edit-json` is applied before the conflict check, so edits to scope/module/title/tags/path globs affect both the saved trap and conflict detection. If a possible conflict is found, the candidate keeps its edited trap shape and conflict diagnostics; use `--accept-anyway` to keep both traps or `--supersedes <trap-id>` to preserve lifecycle history.

> **Trust model:** the human-review gate is advisory, not enforced. `codetrap add`, the MCP `add_trap` tool, and `session accept` are all callable by the same agent that captured a candidate — codetrap cannot distinguish a human from an agent invoking the CLI. The packaged agent templates instruct agents to route lessons through the candidate inbox and wait for approval, but a misbehaving or misconfigured agent can write to `traps.db` directly. Review `codetrap list` / the web console periodically if that distinction matters to your workflow.

#### Authorization receipts, rollback, and suppression

Every durable learning decision leaves an append-only receipt in
`.codetrap/receipts.jsonl` recording what was authorized, who executed it, and
which lesson it applied to. `--executor` is a claim the caller makes, not a fact
codetrap verifies — it defaults to `user`, and an agent committing on your
instruction should pass `--executor agent`.

```bash
codetrap session approve cand-001 --authorized-scope "cand-001 only"
codetrap session accept  cand-001 --executor agent
codetrap session receipts                  # the audit trail, newest first
codetrap session rollback cand-001         # delete the trap, return the candidate to review
```

`session rollback` is the reverse of accept: it deletes the committed trap and
puts the candidate back in the queue, so the store returns to its pre-accept
state while the receipt log keeps the history. It also repairs a candidate left
stranded by a bare `codetrap delete`.

#### Approval binds to the lesson you actually read

An agent cannot authorize itself. `--executor user` means a human is running the
command, which is the authorization; `--executor agent` requires an approval the
user recorded first, against that exact revision of the lesson.

```bash
codetrap session approve cand-001 --authorized-scope "cand-001 only"
codetrap session accept  cand-001 --executor agent
```

Approval is bound to a content hash covering the title, trigger, mistake, fix
and scope. Editing any of them bumps the candidate's revision and drops the
approval, so a lesson that changed after you read it cannot be committed on the
strength of your earlier decision:

```text
Authorization for cand-001 covered content hash 6cc735d2…, but the candidate
now hashes to 0ea4cd6b…. The lesson changed materially since it was approved.
```

Cosmetic changes — tags, path globs, severity — are not material and keep the
approval.

#### Candidate schema migration

Candidate records carry a schema version. `codetrap doctor` reports any that
predate the current envelope, and migration is dry-run by default:

```bash
codetrap session migrate                 # report what would change; writes nothing
codetrap session migrate --apply         # migrate to the current schema
codetrap session migrate --apply --down  # reverse it
```

The downgrade inverts the transform rather than restoring a copy, so a migrated
project can be handed back to an older codetrap unchanged.

Rejecting a candidate suppresses that lesson project-wide, so the same lesson
mined again from the same evidence does not come back to the inbox — including
through `session close --propose-traps`. Suppression outlives the session it was
decided in.

```bash
codetrap session reject cand-001 --reason "Too broad; would cause doc churn."
codetrap session suppressions              # what is currently suppressed
codetrap session unsuppress <fingerprint>  # allow the lesson to be captured again
```

Session maintenance commands keep temporary files from becoming stale context:

```bash
codetrap session cleanup <session-id> --deleted-trap-candidates
codetrap session delete <session-id>
codetrap session prune --older-than 90d --apply
```

### Learning Review

`codetrap learn` reads your own agent history and turns it into reviewable
candidates. It runs only when you ask for it, reads only that client's own
session directory, never follows symlinks out of it, redacts secrets, and caps
every excerpt at 500 characters. It never writes a trap.

```bash
codetrap learn sources --json                        # what history exists, per client
codetrap learn review --source claude-code-sessions   --since 30d --project-only --limit 10              # build a review directory
codetrap learn stage --review-dir <dir>              # validate; writes nothing
codetrap learn stage --review-dir <dir> --apply      # stage into the candidate inbox
```

`--source` is `codex-sessions` or `claude-code-sessions`; both go through one
adapter contract and produce the same normalized envelope and source manifest,
so nothing above the adapter knows which client a lesson came from.

By default a review reads message text only. `--include reasoning,tools` (or
`--include all`) also reads assistant reasoning, tool calls and tool results —
which is where compiler errors, test failures and edit diffs live:

```bash
codetrap learn review --source claude-code-sessions --include all
```

It is off by default deliberately. On the same corpus the wider lens read ~5x
the volume and triggered **10x the redactions**, so it is a real widening of the
privacy surface. Redaction and the 500-character excerpt cap apply to it
unchanged, and the lens used is recorded in the review's scope.

Measured on this repo's own history, the narrow lens saw 1 distinct failure
shape and the wide lens saw 38 — so if you are mining for lessons about your own
code rather than your toolchain, you want `--include all`.

`learn review` writes three artifacts into
`.codetrap/learning/reviews/<review-id>/`:

- `source-manifest.json` — every file read, with bytes, SHA-256, line count and date range
- `evidence-pack.json` — redacted, capped excerpts with stable `<session-id>#<turn>` refs
- `discovery-prompt.md` — the task for the agent, including the red lines for the run

The agent reads the pack and writes `lesson-candidates.json` beside it. `learn
stage` then verifies deterministically: every `evidence[].ref` must resolve
against the pack, every candidate needs a trigger and a recommended action, and
anything that fails is reported with its reasons rather than dropped. An
invented pointer is not evidence.

Staging is not committing. Staged candidates land in the normal review inbox and
still need `session approve` and `session accept`.

A candidate may also carry coverage claims, which staging verifies:

```json
"coverage": { "claim": "extends", "covered_by": ["trap:42"], "overlaps": ["docs/guide.md#testing"] }
```

Trap ids must resolve, file paths must exist, and section anchors must really be
in the file. A claim that fails **flags** the candidate rather than dropping it —
the CLI settles what a machine can settle and leaves the judgement to you.

Two candidates with the identical lesson are consolidated into one, keeping both
provenances, so the same lesson mined from Codex and again from Claude Code
becomes a single candidate with two sources. Candidates that are merely *similar*
are grouped into a review cluster and both survive: codetrap never decides two
lessons are the same.

Review directories hold excerpts, so they have an explicit retention path:

```bash
codetrap learn reviews                 # what exists, and what has been deleted
codetrap learn delete <review-id>      # remove excerpts, keep audit metadata
```

Deleting leaves a tombstone with only non-sensitive metadata — counts, roots,
file hashes, dates — because a trap committed from that review still needs its
provenance to resolve.

The `codetrap-learning-review` skill drives this flow and installs for both
clients.

### Feedback Improver loop

`codetrap improver` is the proposal-only bridge between feedback where work
happens and Codetrap's governed Candidate Inbox. It does not connect to GitHub,
run a scheduler, approve a candidate, write a trap or patch, or install a skill.
An adapter or agent supplies one correlated event containing the original agent
output, the human response, the final change when known, and a normalized lesson
hypothesis:

```json
{
  "external_id": "github-review-17",
  "source": "github_pr",
  "source_ref": "https://example.com/org/repo/pull/17",
  "run_id": "agent-run-123",
  "source_agent": "codex",
  "reviewer_role": "maintainer",
  "feedback_detail": "reasoned",
  "outcome": "corrected",
  "agent_output": "const response = await fetch(url);",
  "human_feedback": "External requests need a timeout because the dependency can hang.",
  "final_change": "Added AbortSignal.timeout(5000).",
  "lesson": {
    "shape": "pitfall",
    "key": "external-http-timeout",
    "title": "Set an explicit timeout on external HTTP requests",
    "trigger": "Calling an external HTTP service from Node or Bun.",
    "mistake": "Using bare fetch leaves the request able to hang indefinitely.",
    "fix": "Apply the project's request-specific timeout policy.",
    "why": "External dependencies can stall independently of this process.",
    "tags": ["http", "timeout"],
    "related_files": ["src/api/client.ts"]
  }
}
```

Pipe that object through standard input for shell-safe capture, then inspect the
plan before staging anything:

```bash
codetrap improver capture --input-json - --json < feedback.json
codetrap improver events --status pending --json
codetrap improver run --json                              # dry-run; default
codetrap improver run --min-signal-weight 3 --apply --json # Candidate Inbox only
codetrap improver delete fb-0123456789abcdef               # dry-run
codetrap improver delete fb-0123456789abcdef --apply       # remove excerpts
```

PowerShell can use:

```powershell
Get-Content feedback.json -Raw | codetrap improver capture --input-json - --json
```

Feedback state lives in
`.codetrap/improver/state.json` under an advisory lock. Agent output, human
feedback, and final changes are best-effort secret-redacted and capped at 500
characters before storage. Source references also remove URL credentials,
secret-like query parameters, and known token shapes before entering evidence
or candidate provenance. `external_id` makes adapter retries idempotent; two
concurrent apply runs converge on the same candidate. `improver delete` is also
dry-run by default; `--apply` removes the stored excerpts and lesson body while
keeping only a non-sensitive tombstone (event/content ids, pattern key, source,
dates, and candidate resolution) so an existing destination remains auditable.
A retry of the deleted event acknowledges that tombstone and never recreates
the excerpts. If deletion races with candidate staging, tombstoned ids are
reported while surviving events in the same resolution batch still settle
atomically.

Signal weight deliberately values explanation over volume: binary feedback is
worth 1, reasoned feedback 2, a maintainer/domain expert adds 1, and a concrete
final change adds 1. The default threshold is 3. Workflow-to-skill proposals
also require at least two events, two distinct source refs, total weight 4,
`lesson.why`, and concrete `lesson.steps`.

| Feedback shape | Candidate destination | Generated carrier |
|---|---|---|
| `pitfall` | `pitfall_trap` | Structured trigger/mistake/fix |
| `convention` | `project_convention` | Principle + applicability + why |
| `workflow` | `skill_candidate` | Reviewable `SKILL.md` and `agents/openai.yaml` |
| `evaluation` | `search_eval_case` | Caller-supplied deterministic case |
| `docs` | `docs_guidance` | Managed docs section |
| `insight` | `insight` | Learning-shelf explanation and example |

Groups use an explicit lowercase `lesson.key`. Incompatible shapes, or
different docs/evaluation payloads under one key, remain pending with blockers
instead of being guessed together. `--apply` writes no durable destination: the
result still needs the normal review, revision-bound approval, and destination
apply/install flow.

For a new reusable workflow, the generated full-artifact `skill_candidate` is
the starting point. To improve a Skill that is already installed, an agent or
model translates the reviewed principle into the structured `phase3 improve`
patch contract described below. Codetrap then owns deterministic base matching,
path safety, final-artifact validation, review, installation, and rollback; it
does not ask that proposer to authorize its own patch.

Record later behavior separately from search hits or subjective usefulness:

```json
{
  "pattern_key":"external-http-timeout",
  "metric":"manual_edit_rate",
  "direction":"lower_is_better",
  "before_value":0.40,
  "after_value":0.08,
  "before_samples":50,
  "after_samples":50,
  "source_ref":"eval:pull-requests-2026-08"
}
```

```bash
codetrap improver outcome --input-json - --json < outcome.json
codetrap improver metrics --json
```

Outcome values must be finite JSON numbers and sample counts must be positive
JSON integers. Strings, booleans, `null`, and decimal sample counts are rejected
instead of being coerced into metrics.

### Low-risk destinations and insight shelf

Phase 2 widens the candidate envelope without weakening approval. A proposal's
destination payload participates in its content hash, so editing a patch or
insight after approval bumps the revision and invalidates that approval.

```bash
codetrap phase2 propose --input-json '{
  "kind":"project_convention",
  "title":"Safe migrations",
  "rationale":"Keep both clients on the same migration rule.",
  "payload":{"section_id":"safe-migrations","title":"Safe migrations","content":"Run the migration and rollback test together."}
}' --json
codetrap session approve cand-001 --session <session-id> --executor agent
codetrap phase2 preview cand-001 --session <session-id> --json
codetrap phase2 apply cand-001 --session <session-id> --executor agent --json
codetrap phase2 revert <phase2-commit-id> --json
```

`project_convention` writes equivalent managed sections to `AGENTS.md` and
`CLAUDE.md`. `docs_guidance` is allowlisted to README/client guidance and
`docs/**/*.md`; `search_eval_case` binds either the project-local
`.codetrap/evals/suite.json` or the legacy `src/tests/fixtures/search-eval.json`.
Old candidates without a path retain their legacy destination after migration.
Commits store exact before/after
snapshots, refuse to overwrite a later edit during revert, and record the
destination in the receipt log.

`insight` uses a separate shelf rather than entering trap recall:

```bash
codetrap phase2 insights --json
codetrap phase2 consult <insight-id> --json
codetrap phase2 migrate-insights          # dry run for v2 insight hints
codetrap phase2 migrate-insights --apply
```

The Web console exposes the project-backed shelf under **Learning**. It can show
the current project or aggregate every project registered in the console; each
project file remains the source of truth, so the all-project view does not create
a second writable library. Insights from one article or AI conversation can
share a collapsible source collection with a recommended order, progress,
previous/next navigation, and user-controlled reordering. Existing flat shelves remain
readable: two or more ungrouped insights with the same primary source are
grouped on read and are persisted as a collection only after an explicit rename
or reorder. Search, source type, tag, and learned-state filters keep a growing
shelf navigable.

Practice notes and Agent experience proposals keep separate drafts for each source
project and Insight while you switch articles, projects, language or views. Preview
checks the submitted version without rewriting your text; newer edits remain
unvalidated until you preview again. Save a practice note explicitly, then submit
an experience proposal to the Candidate Inbox for review. These drafts survive
in-place reauthorization, but closing or reloading the tab can still lose unsaved
work.

New source-derived collections also carry an auditable source-unit inventory.
The agent first inventories the article or captured conversation sample, then
routes core knowledge and examples through Insight `source_unit_refs`.
Substantive background or dated facts can instead live in collection
`context_sections`, where they remain readable and count toward coverage
without becoming artificial chapters. `skip` is reserved for explicitly
excluded material such as page chrome or non-content, with a reason.
Multi-Insight sources are submitted atomically with
`codetrap phase2 propose-batch`, which rejects inconsistent manifests, gapped
order, and source units that disappear from both chapters and collection
context before creating the review session. Coverage is never a model-authored
`complete` flag: the shelf derives it from the Insights and source context
actually stored. Partially applied or rejected collections remain usable but
read **incomplete**; fully accounted articles, intentional curated subsets,
sampled conversations, and legacy unknown coverage remain distinct. Collapsed
cards keep the only visible ratio for study progress and summarize audit state
in plain language; detailed unit counts, reasons, and fingerprints stay behind
progressive disclosure. A prompt such as "do not omit anything" can guide
extraction, but the inventory, fingerprint, batch validator, durable
destinations, and unresolved-unit ledger are what make omissions reviewable.

Once a source-audited collection exists, an individual Insight write cannot
replace its manifest, source context, or collection metadata, and cannot occupy
an existing chapter position. Every Web draft mutation uses the same coverage
validation as the CLI, while the store repeats the invariant checks before any
durable write. Appending or replacing a re-audited collection therefore needs a
future explicit collection operation rather than an ambiguous second batch.

Learning candidates use a purpose-specific editor instead of trap-only severity
and mistake/fix fields. **Approve and add to Learning** records the approval and
shelves the current revision in one action; **Approve for Agent** keeps the
two-step workflow available. Fenced code and ASCII diagrams render as code
blocks, source links remain visible, and dates are localized. Merely opening an
insight is read-only; **Mark learned** is an idempotent state change, so retries
and repeated clicks do not inflate a counter. If the shelf is empty, the page
shows a ready-to-send Agent request that asks for an ASCII flow diagram and a
plain-language example.

Learning Impact keeps personal progress outside shared Insight content. A user
can explicitly choose **Not started**, **In progress**, or **Learned**, record
**Helpful**, **Unclear**, or **Outdated**, and optionally associate the Insight
with an existing local Observation Run. Legacy consultation reads as Learned
until an explicit personal record replaces it; opening the page never migrates
or rewrites the Insight.

The **How will you put this into practice?** card saves a personal note of up to
1,000 characters in local Learning progress. Unsaved text survives chapter and
view changes within the tab, including newer typing while an earlier save
finishes. Save before reloading or closing the tab; clear the text and save to
remove the note. Notes never enter shared Insight content, candidate drafts, or
observation events.

Accepted Learning candidates expose **View confirmed lesson**, using the actual
accepted scope and ID. Related task links select the Insight's source project.
Each Library detail has an **experience path**: explicit Learning provenance,
confirmed lesson, recorded exposures, and current feedback. Source links return
to Learning; task rows open the original Run evidence. Counts are project-local,
including for global lessons, and the Run list pages through 20 items at a time.
Current-version and other-version exposures are separate; feedback follows the
latest judgment per Run and scoped trap, across revisions. Unknown-scope records
are excluded. Run checks describe the whole task and do not establish adoption
or a causal effect. Missing/corrupt observation and Learning sources degrade
independently without hiding the confirmed lesson. Reading this view does not
initialize observation or modify stored history.

**Create Agent experience candidate** prepares a deterministic local
Trigger/Mistake/Fix draft for editing. Preview makes zero model calls and writes
nothing. Sending the draft creates one pending Candidate Inbox item with Insight
provenance; it does not call Codex or Claude Code, accept the candidate, or write
confirmed Library memory. The normal review, conflict, receipt, rejection,
supersede, and rollback workflow remains the only path into confirmed recall.

The bundled external-capture and learning-review skills
apply that teaching format only to user-study insights and attach source type,
topics, and shared collection positions when one source yields several study
notes; concise runtime traps stay action-oriented. Confirmed traps are never
copied into the shelf automatically, and saving or marking an insight does not
train the model. The Library keeps only actionable health filters (current, past
the runtime's validation window, and never marked useful) rather than
duplicating traps in a separate analytics dashboard.

Validation refreshes `last_validated`; stale active lessons receive a visible
`stale_currency` ranking penalty. Graduation archives a mechanized lesson from
default recall while retaining its deterministic-check reference and history.

```bash
codetrap phase2 validate 42 --scope project
codetrap phase2 graduate 42 --to "test:schema-snapshot" --scope project
codetrap phase2 metrics --json
codetrap phase2 outcome 42 --channel preflight --useful --scope project
codetrap phase2 decision --json
```

### Phase 3 Skill Candidates

Phase 3 supports the evidence-approved `skill_candidate`; custom agents and
automations remain intentionally absent. A candidate can come from the built-in
review preset or from a feedback group that passed the Improver's stricter
workflow evidence gate. It can also improve an existing resource-rich Skill
through an exact-base file patch. Both client homes are required, preview is
read-only, and `required_authorized_scope` binds approval to the candidate
revision, both exact install paths, and the complete before/after directory
hashes.

The local improvement loop is:

```text
reviewed feedback / principle
          |
          v
structured file operations
          |
          v
same existing Skill in Codex + Claude
          |
          v
exact base hash + static final-Skill validation
          |
          v
Candidate Inbox -> preview -> approval -> install
          |
          v
behavior outcome record or conflict-safe rollback
```

Create `skill-improvement.json` as the output of a human, agent, or optional
external reasoning layer. Codetrap itself makes no model call:

```json
{
  "name": "http-review",
  "title": "Require bounded external HTTP requests",
  "trigger": "When the Skill reviews code that calls an external HTTP service.",
  "mistake": "The existing workflow can approve an unbounded request.",
  "fix": "Require the project timeout policy and load the focused reference when HTTP appears.",
  "why": "External dependencies can stall independently of the agent process.",
  "source_agent": "codex",
  "source_refs": ["pr:17#review", "pr:29#review"],
  "tags": ["http", "timeout"],
  "operations": [
    {
      "op": "replace_text",
      "path": "SKILL.md",
      "old_text": "## HTTP review\n\nCheck the response.",
      "new_text": "## HTTP review\n\nRequire a timeout and read `references/http-timeout.md`."
    },
    {
      "op": "write_text",
      "path": "references/http-timeout.md",
      "content": "# HTTP timeout review\n\nApply the project's bounded-request policy.\n"
    }
  ]
}
```

Stage and inspect it without changing either live Skill:

```bash
codetrap phase3 improve --input-json - \
  --codex-home <codex-home> --claude-home <claude-home> --json < skill-improvement.json
```

`improve` requires the named Skill to have identical paths and bytes in both
client homes; on POSIX it also requires identical recorded permission modes. It
records the shared directory hash in the candidate and returns an initial
`improvement_plan` with every file classified as `added`, `modified`, `deleted`,
or `unchanged`. A later base or permission change invalidates the patch instead
of silently rebasing it.

Supported operations are:

| Operation | Meaning |
|---|---|
| `write_text` | Add or replace one UTF-8 file. |
| `write_base64` | Add or replace one bounded binary file using canonical base64. |
| `replace_text` | Replace text that must occur exactly once in an existing UTF-8 file. |
| `append_text` | Append to an existing UTF-8 file. |
| `delete` | Delete one existing file explicitly. |

Each relative forward-slash path may appear once in a patch. Traversal,
Windows-unsafe paths and reserved Skill names, case-colliding paths, symlinks,
invalid final frontmatter, an incorrect `agents/openai.yaml` prompt, ambiguous
replacements, and deletion of required `SKILL.md` are rejected. Plain, single-
quoted, and double-quoted simple `name` scalars are accepted in valid
frontmatter. Candidate scripts are copied as inert data; this workflow never
executes them.

```bash
codetrap phase3 propose --preset review-ui-screenshots --json
codetrap phase3 preview cand-001 --session <session-id> \
  --codex-home <codex-home> --claude-home <claude-home> --json

# Copy required_authorized_scope exactly from preview:
codetrap session approve cand-001 --session <session-id> \
  --authorized-scope "<required_authorized_scope>"
codetrap phase3 install cand-001 --session <session-id> \
  --codex-home <codex-home> --claude-home <claude-home> --executor agent --json

codetrap phase3 commits --json
codetrap phase3 rollback <phase3-commit-id> --executor user --json

# Read-only storage inventory and dry-run orphan collection:
codetrap phase3 storage --json
codetrap phase3 gc --json

# Only after reviewing the dry-run result:
codetrap phase3 gc --apply --executor user --json
```

Legacy full-artifact candidates still replace the reviewed artifact as before.
Patch candidates construct the final directory from the reviewed base plus only
the declared operations, preserving unrelated references, examples, scripts,
assets, binary files, and empty directories. Install writes byte-identical final
directories to both clients, snapshots both existing directories before
changing either, restores all touched targets after a partial failure, records
a trust receipt, and refuses rollback if either installed directory changed
later. On POSIX, regular-file, directory, and root permission modes are included
in new snapshot identity and restored across install/rollback; ACLs, ownership,
timestamps, and extended attributes are not preserved. An install approval
never authorizes an agent to remove the Skill.

Phase 3 commit metadata is lightweight. Version 2 commits reference deduplicated
content-addressed objects under `.codetrap/phase3/snapshots/` rather than
embedding Codex/Claude before/after base64 copies in
`skill-commits.json`. Legacy version 1 commits migrate lazily inside the Phase 3
lock and remain rollback-compatible. New history is bounded to 1,000 commits,
512 snapshot objects, 256 MB total snapshot JSON, and 30 MB per snapshot object;
an install that would cross a bound is refused before either live Skill changes.

`phase3 storage` is a read-only point-in-time inventory. It reports commit and
snapshot usage, limits, objects reachable from active **and reverted** commits,
valid orphan objects, malformed entries, and unavailable version 2 rollback
objects. It does not migrate legacy version 1 history. `phase3 gc` is also a
dry-run by default; `--apply` rechecks under the Phase 3 lock, refuses damaged or
ambiguous state, and deletes only content-verified snapshot objects that no
durable commit references. Applied runs leave an exact planned/completed/failed
receipt under `.codetrap/phase3/maintenance-receipts/`. GC never prunes commit
history or removes rollback material referenced by a reverted commit.

The project-local Phase 3 store and PID-aware advisory lock are **single-host**
coordination. Do not place `.codetrap/` on a network share and treat it as a
distributed team database: PIDs, atomic rename, and filesystem failure semantics
are host-specific. The first supported team-evaluation pattern is Git/PR review
of candidates plus explicit local apply and receipts on each device. A central
service, RBAC, signed rollout manifests, and cross-device leases require a later
team architecture rather than weakening this local safety boundary.

After organic use, attach the installed candidate to a directional outcome; a
search hit alone is not improvement evidence:

```json
{
  "pattern_key": "external-http-timeout",
  "candidate_id": "cand-002",
  "metric": "manual_edit_rate",
  "direction": "lower_is_better",
  "before_value": 0.40,
  "after_value": 0.08,
  "before_samples": 50,
  "after_samples": 50,
  "source_ref": "eval:http-review-2026-08"
}
```

```bash
codetrap improver outcome --input-json - --json < outcome.json
codetrap improver metrics --json
```

### Did it actually help?

`hit_count` counts views. It says nothing about whether a lesson changed what an
agent did, so it cannot answer the only question that matters about a memory
product. `codetrap useful <id>` — and the MCP `mark_trap_useful` tool — record
that separately:

```bash
codetrap search "block comment terminator" --json   # pre-flight recall
codetrap useful 5                                   # it actually helped
```

An agent should call it only when the lesson genuinely changed its behavior.
Marking every recall useful would make the number meaningless and the product
unfalsifiable.

### Context packs

Pre-flight search is agent-initiated and catches the pitfall you have already
forgotten. A context pack is the other direction: **you** pick committed lessons
and hand them to an agent at planning time.

```bash
codetrap pack export --traps 2,5            # Markdown, ready to paste
codetrap pack export --traps 2,5 --json
```

Only committed lessons are eligible. Packs are never auto-injected and never
replace pre-flight search — they are a convenience over data you already
approved.

### Local model servers behind an HTTP proxy

codetrap's default Ollama endpoint is `http://127.0.0.1:11434`. If you export
`http_proxy` — common on corporate machines, and for anyone running a local
proxy — requests to your own machine can be routed through it and refused with
a bare `403`, which reads like Ollama rejecting them.

The usual `no_proxy=127.*,localhost` does not always help, because not every
client understands the `127.*` glob. codetrap therefore adds the exact loopback
host of any endpoint it calls to `no_proxy` for its own process. It never
removes entries and never excludes a non-loopback host, so a remote Ollama still
goes through your proxy as intended.

### Concurrency

Codex and Claude Code can both be active against one store, so every
read-modify-write on `.codetrap/sessions/` and `.codetrap/learning/` runs under a
per-resource advisory lock with retry jitter. Dry-run paths take no lock, because
they take no write. Locked JSON payloads report `lock_wait_ms` so contention is
visible rather than guessed at.

## Agent Integration

For AI coding agents, use the CLI as the default integration path:

- **CLI JSON** is the primary agent API and works in any client that can run shell commands.
- **AGENTS.md / CLAUDE.md** tells the agent when to use codetrap.
- **MCP** is an optional adapter for clients that prefer tool schemas.

CLI and project guidance are the main path. MCP should stay thin and share the same store/search behavior.

### Codex Setup

Default setup installs skills and project guidance without MCP:

```bash
codetrap setup codex
```

MCP is optional. To configure it too, opt in explicitly:

```bash
codetrap setup codex --mcp
```

You can also add MCP manually:

```bash
codex mcp add codetrap -- codetrap serve
```

### Claude Code Setup

Claude Code is a co-equal first-class client with the same setup shape: the same bundled skills install into `~/.claude/skills` (override with `--claude-home` or `CLAUDE_CONFIG_DIR`), and the same guidance template is appended to `CLAUDE.md`:

```bash
codetrap setup claude
```

MCP stays opt-in:

```bash
codetrap setup claude --mcp
# or manually:
claude mcp add codetrap -- codetrap serve
```

`codetrap doctor` reports per-client integration health for both clients — bundled skills installed and current, guidance file carrying the codetrap section, and MCP registration — and suggests a `codetrap setup <client>` refresh when an install is partial or stale. The MCP server also embeds its usage contract in the initialize handshake, so any MCP client learns the pre-flight/capture/review workflow without per-client prompt configuration.

### MCP Setup

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

The packaged template at `plugins/codetrap-agent/templates/AGENTS.codetrap.md` is the source of truth for Codex and Claude Code project guidance. Append that file instead of copying README excerpts, so released npm packages, plugin skills, and user projects stay aligned:

```bash
cat "$(npm root -g)/codetrap/plugins/codetrap-agent/templates/AGENTS.codetrap.md" >> AGENTS.md
# or:
cat "$(npm root -g)/codetrap/plugins/codetrap-agent/templates/AGENTS.codetrap.md" >> CLAUDE.md
```

The template covers CLI-first pre-edit search, top-card relevance checks, applicability hints such as `--path` and `--module`, session candidate capture, explicit candidate review, and optional MCP usage. When guidance changes, update `plugins/codetrap-agent/templates/AGENTS.codetrap.md` first and keep README/install docs as pointers to it.

codetrap maintainers working on this repository can also append `plugins/codetrap-agent/templates/AGENTS.codetrap-maintainer.md` to add the dogfood eval protocol. Ordinary user projects should use only `AGENTS.codetrap.md`.

### Plugin Skills

The same skill bundle installs for **both** Codex and Claude Code from `plugins/codetrap-agent/skills/`:

- `codetrap-check` — pre-flight check before code changes.
- `codetrap-search` — search existing lessons.
- `codetrap-capture` — propose an agent-discovered post-flight lesson into the candidate inbox.
- `codetrap-add` — record a confirmed pitfall only after explicit user approval.
- `codetrap-capture-external` — extract concise Agent pitfalls, user-study insights, or both from an external article, post, repository, issue, paper, or reference; study extraction uses a two-pass source inventory, explicit skip reasons, atomic batch validation, an ASCII flow diagram, and a plain-language example, and Codetrap stores only user-confirmed lessons.
- `codetrap-learning-review` — look back over recent sessions and stage reusable lessons from a fingerprinted evidence sample with an explicit source-unit account; runs only on explicit invocation and never claims full-conversation coverage from sampled history.

The plugin skill directory is the single source of truth for skill packaging in both clients. The repo does not keep a duplicate root `skills/` tree.

Skills are a convenience layer. They do not replace MCP or `AGENTS.md` / `CLAUDE.md`; they make manual triggers like "run codetrap-check" easier.

External lessons should keep codetrap local-first: let the agent read the URL or
pasted source, ask which candidates to save and whether each belongs in Agent
memory or the user's Learning shelf, then attach the source as evidence instead
of making the CLI crawl the web. For study material, the bundled skill uses the
request `用ASCII流程图结合通俗易懂的例子讲解` and stages a reviewed Phase 2
`insight`; it does not turn the CLI into a web crawler.

```bash
codetrap add --input-json '{...}' --json

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
| `record_observation` | Record a strict metadata-only Run start, validation, feedback/miss, or completion event |
| `add_trap` | Record a new trap directly |
| `mark_trap_useful` | Report that a recalled trap actually helped on this task — the usefulness signal, distinct from a view |
| `capture_candidate` | Propose a pitfall for human review instead of writing it directly — writes a candidate to the session inbox for `session accept`/`reject` or the web console (preferred for the capture→review→accept workflow) |
| `edit_candidate` | Translate or improve a proposed candidate through the revisioned session store without touching internal JSON |
| `update_session_goal` | Update a session's human-readable goal while preserving its stable ID and derived documents |
| `get_trap` | Drill down into full trap details and evidence |
| `list_traps` | List traps with filters |
| `update_trap` | Edit an existing trap |
| `delete_trap` | Delete a trap |
| `add_trap_evidence` | Attach source/evidence metadata |
| `archive_trap` | Archive a trap so default search skips it |
| `supersede_trap` | Mark a trap as replaced by another |
| `get_stats` | Database statistics |
| `doctor` | Diagnose project health: trap/embedding counts, hybrid-search availability, mis-scoped traps, and pending candidate review (pass `cwd` to target a project) |

Accepting or rejecting a candidate is intentionally *not* an MCP tool — it stays on the CLI (`codetrap session accept`/`reject`) and the web review console, so the human-review gate is not driven entirely by the capturing agent.

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
| `CODETRAP_EMBEDDING_PROVIDER` | No | Embedding provider for semantic/hybrid search: `huggingface`, `ollama`, or `jina`. Recommended: `huggingface` |
| `CODETRAP_HUGGINGFACE_MODEL` | No | Built-in local model: `default` or `quality`. Default: `default` |
| `CODETRAP_OLLAMA_MODEL` | No | Ollama embedding model. Recommended: `qwen3-embedding:0.6b` |
| `CODETRAP_OLLAMA_ENDPOINT` | No | Ollama endpoint. Default: `http://127.0.0.1:11434` |
| `CODETRAP_OLLAMA_DIMENSIONS` | No | Ollama embedding dimensions. Default: `1024` for `qwen3-embedding:0.6b` |
| `JINA_API_KEY` | No | Jina AI API key for optional cloud semantic/hybrid search. Get one at [jina.ai](https://jina.ai/api-dashboard/) |
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
  },
  "embeddings": {
    "provider": "huggingface",
    "model": "default"
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

### Local Hugging Face Embeddings (No Ollama Required)

codetrap works with no embedding provider: FTS continues to work and hybrid
search falls back to FTS. For local semantic search, choose one reviewed q8
model; neither option requires Ollama, Python, or a separate model server.

| Choice | Model | Dimensions | Approx. download | Use when |
|---|---|---:|---:|---|
| `default` | `jinaai/jina-embeddings-v2-base-zh` q8 | 768 | 162 MB | Recommended starting point; Chinese-English and smaller |
| `quality` | `onnx-community/Qwen3-Embedding-0.6B-ONNX` q8 | 1024 | 614 MB | Quality-first option with more disk and memory use |

List the choices, select one, then reindex the desired scopes:

```bash
codetrap embeddings models
codetrap embeddings use huggingface --model default

codetrap embeddings reindex --scope project
codetrap embeddings reindex --scope global
codetrap embeddings status
```

`local` is accepted as a short alias for `huggingface`. The first reindex
downloads the selected model into `~/.codetrap/models/huggingface`. Downloads
are pinned to reviewed Hub revisions, ranged, resumable, SHA-256 verified, and
reused offline. Standalone binaries include their ONNX Runtime WASM dependency;
trap passages and later query text stay on the machine. Ordinary FTS commands
never initialize or download a model. Until the selected model has completed a
reindex, hybrid search returns FTS results with a `semantic_unavailable`
diagnostic, while semantic search reports the exact reindex command; neither
path starts a download implicitly.

Switch to the larger option at any time:

```bash
codetrap embeddings use huggingface --model quality
codetrap embeddings reindex --scope project
```

Each model has its own profile id, so switching does not delete or overwrite
previous vectors. `codetrap embed` remains an alias for reindexing.

Ollama remains supported for existing setups:

```bash
ollama pull qwen3-embedding:0.6b
codetrap embeddings use ollama
```

You can also run `codetrap web --open` to start the authenticated local console
and open it in your default browser. The launch token is moved to session
storage and removed from the visible URL immediately. A copied page address does
not authorize a fresh tab. Recovery distinguishes missing credentials, rejected
credentials, connection failures and invalid server responses. Paste the current
service's full launch URL into the recovery form to reconnect in the same tab;
the address and port must match. Your current route and local edits remain, and
failed writes are never automatically replayed. If the service stopped, recovery
shows a restart command using the current port. Avoid closing or reloading a tab
with unsaved drafts. The console polls for
candidate/session changes made by agents or other terminals, but pauses
application of external updates while a candidate form has unsaved edits. Open
the blue `Impact` view to see real local Observation Overview totals, browse
Runs, inspect a privacy-allowlisted evidence timeline, and open the Evals
calibration bench for project-local deterministic retrieval metrics,
denominator-visible observed rates, and governed candidates linked back to
their Runs. Opening Impact or Evals is read-only and does not create or enable
an Observation Ledger. A fixture changes only after the user authors an exact
Eval case and clicks the labelled accept action; draft preview, rejection, and
ordinary browsing do not write it, and rollback restores its exact previous
bytes. The page labels incomplete evidence and distinguishes deterministic
checks, observed facts, human labels, confirmed ground truth, and causal claims.
Open `Embeddings` to compare the two local cards, see download/cache state, save
a selection, switch providers, and reindex project or global embeddings. Jina
remains an optional cloud provider via `codetrap embeddings use jina` plus
`JINA_API_KEY`; when selected, trap passages and semantic/hybrid queries are
sent to Jina for embedding.

Then search normally:

```bash
codetrap search "HTTP request timeout" --mode hybrid
```

If no embedding provider is configured, FTS works normally, hybrid reports its
FTS fallback, and semantic/reindex commands explain how to select a provider.

## Reproducible Retrieval Benchmark

The released `codetrap-retrieval-v1` benchmark runs offline against 12 synthetic
traps and 12 authored queries. The dataset is MIT-licensed, identified by
SHA-256, and contains no copied user sessions, private trap-store records, or
project source. Run the checked-in drift gate from a clean checkout:

```bash
bun install --frozen-lockfile
bun run benchmark:retrieval -- --verify
bun run benchmark:retrieval -- --verify --output artifacts/retrieval-benchmark.json
```

The retrieval-benchmark workflow runs the same drift gate on clean Windows and
Linux GitHub-hosted runners with Bun 1.3.14, then uploads each runner's complete
JSON report. The workflow becomes evidence only after it runs remotely; its
presence in the repository is not itself an external reproduction.

Current checked-in results:

| Configuration | Recall@3 | Recall@5 | MRR | Failed gates |
|---|---:|---:|---:|---:|
| Default hybrid + deterministic proxy | 1.0000 | 1.0000 | 0.9028 | 0 |
| FTS only | 0.8333 | 0.8333 | 0.8333 | 2 |
| Deterministic semantic proxy only | 1.0000 | 1.0000 | 0.8750 | 0 |
| Hybrid with semantic unavailable | 0.8333 | 0.8333 | 0.8333 | 2 |

The weaker rows are intentional and remain visible. This benchmark measures
retrieval on a released synthetic dataset. Its semantic provider is a
public-only deterministic category proxy used for reproducibility, not a production
embedding model. It does not measure candidate quality, human approval quality,
longitudinal usefulness, or later agent behavior. See
[`benchmarks/retrieval-v1/README.md`](benchmarks/retrieval-v1/README.md) for the
method and claim boundary.

## Build

```bash
bun run build          # Build CLI + MCP server binaries → dist/
bun run build:cli      # dist/codetrap
bun run build:serve    # dist/codetrap-serve
bun run build:web     # Regenerate the embedded browser module bundle
bun run check:web     # Verify browser source/artifact freshness
bun run typecheck     # Strict project and DOM-only browser checks
bun run release:preflight  # tests, builds, release assets, smoke test, npm dry-runs
```

The Web console has a normal browser module entry. `dev` and the supported
standalone build helper regenerate its embedded asset automatically. After
editing browser source, run `build:web` before directly starting an existing
source preview wrapper, then restart that process. Include the generated asset
with its source change; CI and npm prepack check freshness. See
[browser architecture and remaining type boundaries](docs/browser-architecture.md).

Library list, filters, selected lesson and experience activity now live in typed
browser modules. Loading failures offer a retry, and older requests cannot replace
the current project or lesson after navigation. Review preserves separate in-tab
drafts for each project/session/candidate across navigation and locale changes;
background updates defer while editing, and action completion stays bound to its
original candidate. Learning practice/proposal drafts and action state now use
strict modules too, with source-identity validation, captured payloads and guarded
list retries. Use Save for durable storage: in-tab drafts are not autosaved across
a forced reload. Review presentation, Learning collection/filter presentation and
Run-choice loading, and broader Impact state retain explicit migration boundaries.

## Test

```bash
bun test src/tests/                    # All tests
bun test src/tests/search-eval.test.ts # Recall@5 evaluation
bun run benchmark:retrieval -- --verify # Public synthetic benchmark + drift gate
bun run eval:dogfood -- report         # Maintainer dogfood eval report
bun run eval:dogfood -- report --live  # Dogfood eval with configured embedding provider
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun + TypeScript |
| Database | SQLite (bun:sqlite) + FTS5 |
| Embeddings | Built-in local Hugging Face q8 models, Ollama, or Jina AI |
| MCP | `@modelcontextprotocol/sdk` |
| Search | FTS5 + cosine similarity + RRF fusion + generic rerank |

## License

MIT
