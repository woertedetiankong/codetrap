# Installation

codetrap supports three installation paths. Use source installation while developing the tool, binary installation for users who do not want a Bun toolchain, and package-manager installation for the published `codetrap` package.

## Method 1: Source Install

Best for developers who want to inspect or modify codetrap.

Requirements:

- Bun 1.x or newer
- Git

```bash
git clone <repo-url>
cd codetrap
bun install
bun run install:cli
codetrap --help
```

`bun run install:cli` creates a `codetrap` symlink in Bun's global bin directory. On macOS and Linux this is usually:

```bash
$(bun pm bin -g)/codetrap
```

After installation, initialize codetrap inside any project:

```bash
cd /path/to/your/project
codetrap init
codetrap stats
```

Use the CLI from any directory:

```bash
codetrap search "HTTP request timeout" --mode hybrid
codetrap add --input-json '{
  "title": "Dont use fetch() without timeout",
  "category": "api",
  "scope": "project",
  "context": "Any external HTTP call in Node/Bun",
  "mistake": "Using bare fetch() which has no default timeout",
  "fix": "Always wrap fetch with AbortSignal.timeout(n)",
  "severity": "critical",
  "tags": ["fetch", "timeout", "http"]
}'
```

For multiline structured input on Windows PowerShell, use standard input so the
shell cannot rewrite JSON quotes:

```powershell
@'
{"kind":"insight","title":"Cache prefixes","payload":{"title":"Cache prefixes","summary":"Exact prefixes are reusable.","body":"[same prefix] -> [cache hit]"}}
'@ | codetrap phase2 propose --input-json - --json
```

If you move the codetrap repository after source installation, run this again from the new path:

```bash
bun run install:cli
```

## Method 2: Binary Install

Best for ordinary users who only want the `codetrap` command.

This method does not require Bun at runtime once release binaries are published.

### For maintainers

Maintainer-only: agents must not create tags, push, publish packages, or create releases unless the user explicitly requests a release operation.

Release binaries are built by `.github/workflows/release.yml` when a version tag is pushed.

1. Make sure `package.json` has the version you want to release.

2. Commit all release changes.

3. Create and push a matching tag:

```bash
# Maintainer-only: do not run unless explicitly releasing.
git tag v<version>
git push origin v<version>
```

The release tag must match `package.json` exactly. For example, package version `<version>` must use tag `v<version>`.

The workflow runs:

```bash
bun test src/tests
bun run build:release
```

It uploads these release assets:

```text
codetrap-darwin-arm64
codetrap-darwin-x64
codetrap-linux-x64
codetrap-linux-arm64
codetrap-windows-x64.exe
sha256sums.txt
```

You can build the same files locally:

```bash
bun run build:release
ls dist/release
```

### For users

Download the binary for your platform from GitHub Releases, then install it into a directory on your `PATH`.

macOS Apple Silicon:

```bash
curl -L https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-darwin-arm64 -o codetrap
mkdir -p ~/.local/bin
mv codetrap ~/.local/bin/codetrap
chmod +x ~/.local/bin/codetrap
codetrap --help
```

macOS Intel:

```bash
curl -L https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-darwin-x64 -o codetrap
mkdir -p ~/.local/bin
mv codetrap ~/.local/bin/codetrap
chmod +x ~/.local/bin/codetrap
codetrap --help
```

Linux x64:

```bash
curl -L https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-linux-x64 -o codetrap
mkdir -p ~/.local/bin
mv codetrap ~/.local/bin/codetrap
chmod +x ~/.local/bin/codetrap
codetrap --help
```

Make sure `~/.local/bin` is on your `PATH`. For zsh:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\bin"
Invoke-WebRequest `
  -Uri "https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-windows-x64.exe" `
  -OutFile "$HOME\bin\codetrap.exe"
codetrap --help
```

Then add `%USERPROFILE%\bin` to your user `Path`.

## Method 3: Package-Manager Install

Best for long-term use with the published `codetrap` package.

### For maintainers

Maintainer-only: agents must not create tags, push, publish packages, or create releases unless the user explicitly requests a release operation.

Package publishing is handled by `.github/workflows/npm-publish.yml` when a GitHub Release is published.

Before automated publishing, configure npm trusted publishing:

1. Create or log into your npm account.
2. Make sure the package name `codetrap` is available, or rename the package in `package.json`.
3. On npmjs.com, open the package settings and add a trusted publisher:
   - Publisher: GitHub Actions
   - Organization/user: `woertedetiankong`
   - Repository: `codetrap`
   - Workflow filename: `npm-publish.yml`
4. Publish a GitHub Release from the matching version tag.

If npm does not let you configure trusted publishing before the first version exists, do the first publish manually after checking the package contents:

```bash
npm pack --dry-run
# Maintainer-only: do not run unless explicitly publishing.
npm publish --access public
```

Then configure trusted publishing for future releases.

The workflow runs:

```bash
bun test src/tests
npm pack --dry-run
# Maintainer-only: this is run by the release workflow after explicit release approval.
npm publish --access public
```

The package is source-based: the npm package installs the `codetrap` command from `bin/codetrap`, so users still need Bun installed.

You can preview the npm package locally:

```bash
npm pack --dry-run
```

### For users

Bun users can install it globally:

```bash
bun add -g codetrap
codetrap --help
```

npm users can install it globally if Bun is also installed, because the CLI entrypoint runs with Bun:

```bash
npm install -g codetrap
codetrap --help
```

For local development or unpublished branch testing, use the source install method:

```bash
git clone <repo-url>
cd codetrap
bun install
bun run install:cli
```

## 5-Minute Agent Setup

Use this path when the first user is a coding agent such as Codex or Claude Code.

```bash
bun --version  # If this fails, install Bun first or use Method 2 binary install
npm install -g codetrap
cd /path/to/project
codetrap setup codex
codetrap doctor
```

`codetrap setup codex` installs the bundled Codex skills into `~/.codex/skills`, initializes `.codetrap/` when needed, and writes `AGENTS.md`. It appends the packaged source-of-truth template at `plugins/codetrap-agent/templates/AGENTS.codetrap.md`. It does not configure MCP by default.

To also configure Codex MCP, opt in explicitly:

```bash
codetrap setup codex --mcp
```

The packaged template is the source of truth for exact agent behavior. It tells agents to run CLI JSON checks before non-trivial edits, inspect only relevant action cards, keep post-flight lessons in the session candidate inbox, and require explicit human approval before accepting a candidate into `traps.db`.

For a quick manual check, agents can run `codetrap search "<task keywords>" --mode hybrid --json` from the project cwd.

Observation Runs are optional after setup. Preview and explicitly apply the
project-local automatic integration for either client:

```bash
codetrap observe enable codex
codetrap observe enable codex --apply
codetrap observe enable claude
codetrap observe enable claude --apply
codetrap observe status --json
```

The preview is read-only. Apply merges `UserPromptSubmit`, `Stop`, and
`SessionEnd` command hooks into `.codex/hooks.json` or
`.claude/settings.json`, preserving unrelated configuration and backing up an
existing file. Codex will ask you to review and trust new project hooks.

Both clients use the same metadata-only contract. Automatic Runs ignore prompt
text, replies, transcript paths/files, diffs, tool bodies, secrets, and hidden
reasoning. When exactly one Run is active, normal `search`/`useful` calls attach
to it; the explicit `--run-id`, `--device-id`, and optional stable `--event-id`
contract remains available for ambiguous or custom integrations. See
[Metadata-only Observation Runs](../README.md#metadata-only-observation-runs)
for the complete example and privacy boundary.

`codetrap observe status --json` and `codetrap observe current --json` include
Hook capacity health. A killed Agent may leave retryable active state; inspect
stale entries with the read-only default before applying recovery:

```bash
codetrap observe recover --older-than-days 7 --json
codetrap observe recover --older-than-days 7 --apply --json
```

Apply records `cancelled`/`partial` completion evidence before removing state.
Failed writes stay retryable, and Codetrap never deletes an entry merely because
it is old. The Impact Overview repeats the warning and the preview command when
operator attention is needed.

If `.codetrap/observations/agent-hook-state.json` is unreadable or has an
unsupported version, `status` reports Hook health as `unavailable` without
hiding integration or Ledger data. `current` reports active counts as unknown,
and `recover`, including `--apply`, refuses mutation. Restore a valid backup or
inspect the file first; Codetrap does not automatically reset unknown Run state.

Preview disabling before applying it. Historical evidence is retained:

```bash
codetrap observe disable codex
codetrap observe disable codex --apply
codetrap observe disable claude --apply
```

Run `codetrap web --open` and choose **Impact** to inspect the resulting local
Overview, Run timelines, and Evals calibration bench. Evals keeps deterministic
Search Eval metrics separate from observed feedback/validation ratios and shows
unconfirmed review candidates that link back to their source Run. From a candidate,
the user can author an exact query and expected fixture IDs, save a no-write preview,
and explicitly accept, reject, or roll back the case. A project can prepare its
own `.codetrap/evals/suite.json` from confirmed lessons, then add reviewed examples.
An existing `src/tests/fixtures/search-eval.json` remains readable and can be
explicitly copied into project data. Download exports the exact evaluation set;
see the [evaluation set guide](project-evaluation-suites.md). Missing sets offer
setup without substituting a maintainer benchmark. Merely opening Impact or Evals is
read-only: when no ledger exists it shows an opt-in empty state without creating
project identity, observation directories, SQLite files, or Eval cases. Only the
labelled accept action writes the reviewed case, and rollback restores the exact
previous fixture.

The **Controlled comparison** lane can run two local, deterministic profiles
against the selected project set: FTS-only versus the case's configured retrieval
policy, or expected traps unavailable versus available. Choose a trial count and
seed, click **Run controlled comparison**, then inspect regressions, changed cases,
side-by-side metrics, fixture SHA, configuration fingerprint, and saved history.
The runner uses immutable in-memory snapshots, makes zero model calls, and writes
results only to ignored `.codetrap/evals/` storage. It does not modify the fixture,
run commands in the source worktree, or measure full Codex/Claude behavior.

Impact, Evals, selected Runs, and selected review candidates use refresh-safe
local hash routes. These routes intentionally omit the absolute project path and
are not remote Team share links and do not authorize a fresh tab. If the launch
credential is missing or rejected, paste the running service's full launch URL
into the recovery form. It must match the current address and port. Recovery
validates that credential without navigating away or repeating failed writes,
and retains the current route and local edits. If the service has stopped, use
the recovery page's restart command for the current port, then copy the new
launch URL from that terminal. A different port needs its own authorized tab;
do not close the original tab while it has unsaved edits.

For a project with no Run, **Impact → Overview** can preview a five-event sample
timeline without writing anything. The sample is browser-memory only, disappears
on reload, and does not contribute to Overview or Evals. The adjacent connection
guide presents automatic preview/apply commands first and retains a short Agent
instruction for explicit capture. Automatic capture is still metadata-only; it
does not scan transcripts.

## Optional: Local Hugging Face Embeddings

codetrap works with no embedding provider. SQLite FTS still works and hybrid
search reports that it fell back to FTS. Local semantic search now has two
built-in q8 choices and does not require Ollama, Python, or a model server:

| Choice | Hugging Face model | Dimensions | Approx. download |
|---|---|---:|---:|
| `default` | `jinaai/jina-embeddings-v2-base-zh` q8 | 768 | 162 MB |
| `quality` | `onnx-community/Qwen3-Embedding-0.6B-ONNX` q8 | 1024 | 614 MB |

Inspect and select a model:

```bash
codetrap embeddings models
codetrap embeddings use huggingface --model default
codetrap embeddings status
```

`local` is a CLI alias for `huggingface`. Selection writes
`~/.codetrap/config.json`; it does not download immediately. The first reindex
downloads to `~/.codetrap/models/huggingface` in resumable ranges. Completed
files are accepted only after their pinned revision and SHA-256 match, then are
reused offline. Standalone binaries embed ONNX Runtime WASM, so later embedding
work stays local without an Ollama or runtime-CDN dependency.

Before that first reindex completes, hybrid search stays usable by falling back
to FTS with a `semantic_unavailable` diagnostic. Semantic search reports the
reindex command instead of starting the model download. Adding or editing a trap
also remains download-free; its vector is filled by the explicit reindex.

Generate embeddings for the traps you want semantic search to use:

```bash
cd /path/to/your/project
codetrap embeddings reindex --scope project
codetrap embeddings reindex --scope global
```

Switch models by saving the other selection and reindexing the scopes you need:

```bash
codetrap embeddings use huggingface --model quality
codetrap embeddings reindex --scope project
```

`codetrap embed` remains a short alias for reindexing. Each provider/model q8
combination has a separate profile, so switching preserves previous vectors.
Existing Ollama setups remain supported with `codetrap embeddings use ollama`.

You can also run `codetrap web --open` to start the authenticated local console
and open it in your default browser. The launch token is removed from the
visible URL after it is copied into session storage. Connection failures, missing
credentials and rejected credentials have distinct recovery messages. Retry a
temporary connection failure in place, or paste the current service's full launch
link to reauthorize without reloading. Review/Evals also have explicit browser-local backup recovery;
closing or reloading can still lose them. Learning has separate browser backups
and an explicit recovery flow. The console notices
session and candidate updates made by agents or other terminals while
preserving any unsaved candidate draft.

Learning candidates have their own editor and can be approved and added to the
shelf in one explicit action. The Learning view can switch between the current
project and all registered projects, groups notes from one article or AI
conversation into collapsible ordered source collections, shows progress and
previous/next navigation, and filters by search, source, tag, or learned state.
Project files remain the durable source of truth; the all-project view is an
aggregation rather than a second writable store.

Practice notes and experience proposals retain separate drafts per source project
and Insight across article/project navigation, language changes and in-place
reauthorization. Preview validates the submitted version without replacing newer
input. Save practice notes explicitly; sending a proposal creates a pending
Candidate Inbox item for review, not confirmed memory. Discard affects only the
selected note or proposal. Learning also backs up drafts in this browser for 30
days. Reopen an authorized page at the same address/port in the same browser
profile, then inspect and restore or delete the offered copy. Server-note changes
are called out and separate tab versions are preserved. Restore never replays a
save/send or restores validation/approval. Successful explicit save/send or discard
removes that tab's copy, not another tab's newer edits.

Browser backups are local, readable browser data, not encrypted project storage or
cross-device sync. Clearing browser data removes them. Up to 100 draft snapshots
of at most 64 KiB each are supported; valid expired snapshots are cleaned on access,
and malformed/unsupported records are skipped with a notice. A storage failure
keeps editing available with a visible warning and the last successful backup;
keep the tab open and save explicitly if the latest text could not be backed up.
Drafts for removed or inaccessible items are not restored into a different item;
they expire normally. Review and Evals have the same bounded browser-local recovery. Review restoration
checks candidate content/revision/status; evaluation drafts check their source
and frozen evaluation context. Changed sources remain inspectable, with direct
restore disabled. Recovery fills editable text only; it never accepts a candidate,
reuses a preview or starts an evaluation. An earlier dialog's successful request
cannot remove a newer dialog's draft. Storage failures keep the editor usable.
Learning-only use is complete: practice and saving Library experience are optional.
See the [five-stage delivery](tasks/2026-09-05-five-stage-product-polish/handoff.md).

New source-derived collections use a fingerprinted source-unit inventory. Core
knowledge and examples route to ordered Insights; substantive background and
dated facts can live in collection `context_sections`, where they stay visible
and count toward coverage without increasing the chapter count. Explicit skips
are reserved for excluded non-content and require reasons. Multi-note sources
enter review through one validated `phase2 propose-batch`, and the UI derives
complete/incomplete/curated/sampled status from chapters and source context that
actually reached the shelf. Collapsed cards show a short source-audit phrase
beside the source type and reserve their only ratio for learning progress;
detailed coverage counts remain in the source ledger. Legacy collections remain
readable and show unknown coverage rather than a false completeness claim.

Web save, approval, and apply routes reuse the same source-coverage validation as
the CLI. The store also rejects occupied chapter positions and any attempt by a
single Insight apply to replace an existing audited collection's manifest,
context, or metadata; append and re-audit semantics require an explicit future
collection operation.

The Learning view renders fenced ASCII/code blocks safely, keeps source links
visible, localizes dates, and treats **Mark learned** as an idempotent state
instead of an incrementing score. Its empty state shows a ready-to-send Agent
request for a two-pass coverage account plus study material explained with an
ASCII flow diagram and a plain-language example; the bundled external-capture
and learning-review skills use the same contract. This is local memory and
study tracking, not model training.

Personal Learning Impact state is stored separately from shared Insight prose.
The Web view offers **Not started**, **In progress**, and **Learned**, explicit
**Helpful** / **Unclear** / **Outdated** feedback, and an optional link to an
existing local Observation Run. Repeating the same choice is idempotent, and no
Observation Ledger is enabled merely by viewing or updating Learning.

**Create Agent experience candidate** opens an editable, deterministic local
Trigger/Mistake/Fix draft. Preview performs zero model calls and no durable
write; sending it stages only a pending Candidate Inbox item. It never invokes
Codex or Claude Code and never copies an Insight directly into confirmed Agent
Library memory. Accept, reject, conflict handling, receipts, supersede, and
rollback continue through the existing review workflow.

Open the `Embeddings` view to inspect the active provider/profile, compare the
default and high-quality local cards, see cache and project/global freshness,
switch among local Hugging Face, Ollama, and Jina, and reindex either scope. The
web console does not save Jina API keys; Jina still reads `JINA_API_KEY` from
the environment.

Then search:

```bash
codetrap search "HTTP request timeout" --mode hybrid
```

Optional cloud provider: run `codetrap embeddings use jina` and set
`JINA_API_KEY`. Privacy note: FTS, local Hugging Face, and Ollama search stay on
the machine. When Jina is selected, reindexing sends trap passages to Jina, and
semantic or hybrid search may send query text to Jina to compute embeddings.

If no embedding provider is configured:

- `codetrap search "<query>" --mode fts` works normally.
- `codetrap search "<query>" --mode hybrid` works, but falls back to FTS.
- `codetrap search "<query>" --mode semantic` and `codetrap embed` require an embedding provider.

## Optional: Codex MCP

MCP is optional. `codetrap setup codex` does not configure MCP unless you pass `--mcp`:

```bash
codetrap setup codex --mcp
```

You can also add MCP manually if the `codetrap` command is on your `PATH`:

```bash
codex mcp add codetrap -- codetrap serve
```

If your MCP client does not inherit your shell `PATH`, use the absolute path:

```bash
codex mcp add codetrap -- "$(bun pm bin -g)/codetrap" serve
```

Agents can also use the CLI directly when the project guidance tells them when to call it. `codetrap setup codex` installs that guidance in `AGENTS.md`.
