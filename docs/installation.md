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

## Optional: Local Ollama Embeddings

codetrap works with no embedding provider. In that mode, search uses SQLite FTS keyword matching, and hybrid search falls back to FTS.

Recommended local semantic search uses Ollama with `qwen3-embedding:0.6b`. This keeps trap passages and query text on your machine.

Install Ollama, then pull the 0.6B embedding model:

```bash
ollama pull qwen3-embedding:0.6b
```

Do not omit `:0.6b`; `qwen3-embedding:latest` is much larger.

Configure codetrap to use Ollama:

```bash
codetrap embeddings use ollama
codetrap embeddings status
```

This writes `~/.codetrap/config.json`. Environment variables such as `CODETRAP_EMBEDDING_PROVIDER` and `CODETRAP_OLLAMA_MODEL` are still supported for temporary shell or CI overrides.

Verify Ollama embedding generation:

```bash
curl http://127.0.0.1:11434/api/embed -d '{"model":"qwen3-embedding:0.6b","input":"HTTP request timeout"}'
```

Generate embeddings for the traps you want semantic search to use:

```bash
cd /path/to/your/project
codetrap embeddings reindex --scope project
codetrap embeddings reindex --scope global
```

`codetrap embed` remains as a short alias for reindexing. codetrap stores embeddings by profile, so switching between Jina and Ollama does not overwrite existing vectors; it creates or refreshes the selected profile.

You can also run `codetrap web --open` to start the authenticated local console
and open it in your default browser. The launch token is removed from the
visible URL after it is copied into session storage. If the server restarts, an
old tab explains that its credential expired and directs the user to the newly
opened tab instead of showing a bare `Unauthorized` error. The console notices
session and candidate updates made by agents or other terminals while
preserving any unsaved candidate draft.

Learning candidates have their own editor and can be approved and added to the
shelf in one explicit action. The Learning view can switch between the current
project and all registered projects, groups notes from one article or AI
conversation into collapsible ordered source collections, shows progress and
previous/next navigation, and filters by search, source, tag, or learned state.
Project files remain the durable source of truth; the all-project view is an
aggregation rather than a second writable store.

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

Open the `Embeddings` view to inspect the active provider/profile, see project
and global fresh/stale/missing counts, switch between Ollama and Jina, and
reindex project or global embeddings. The web console does not save Jina API
keys; Jina still reads `JINA_API_KEY` from the environment.

Then search:

```bash
codetrap search "HTTP request timeout" --mode hybrid
```

Optional cloud provider: run `codetrap embeddings use jina` and set `JINA_API_KEY` to use Jina instead of Ollama. Privacy note: codetrap does not collect telemetry. FTS and Ollama search are local-only. When Jina is configured, reindexing sends trap passages to Jina, and semantic or hybrid search may send query text to Jina to compute embeddings.

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
