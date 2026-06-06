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
codetrap add --json '{
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
codetrap init
codetrap doctor
```

Add the packaged agent guidance to `AGENTS.md` or `CLAUDE.md`:

```bash
cat "$(npm root -g)/codetrap/plugins/codetrap-agent/templates/AGENTS.codetrap.md" >> AGENTS.md
# or:
cat "$(npm root -g)/codetrap/plugins/codetrap-agent/templates/AGENTS.codetrap.md" >> CLAUDE.md
```

Then have the agent run a pre-edit check from the project cwd:

```bash
codetrap search "<task keywords>" --mode hybrid --json
```

Review the top 3 returned action cards, or all returned cards if fewer than 3, before deciding whether any trap applies. Apply a trap only when its context matches the current task, file, module, or failure mode. Severity alone is not enough to apply a trap. Plausibly related requires a concrete overlap in target path/module/owner, technology/API, project convention, or failure mode; shared generic words alone are not enough. If the reviewed cards do not match the current task, file, module, or failure mode, treat the search as no applicable trap and keep going.

After user corrections, repeated test failures, or review feedback, have the agent write a candidate into the review inbox:

```bash
cat <<'EOF' | codetrap session capture --trap-markdown - --kind review --json
Title: <durable pitfall>
Context: <when it triggers>
Mistake: <what the agent did wrong>
Fix: <what to do instead>
EOF
```

Use `codetrap session status`, `codetrap session list`, `codetrap doctor`, or `codetrap web` to review pending candidates. Do not accept candidates automatically.

Use the returned `candidate_id` and `session_id` to inspect and resolve the candidate:

```bash
codetrap session candidate <candidate-id> --session <session-id> --json

# Only after explicit human approval:
codetrap session accept <candidate-id> --session <session-id>

# Or reject instead:
codetrap session reject <candidate-id> --session <session-id> --reason "<reason>"
```

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

You can also run `codetrap web` and open the `Embeddings` view to inspect the active provider/profile, see project and global fresh/stale/missing counts, switch between Ollama and Jina, and reindex project or global embeddings from the web console. The web console does not save Jina API keys; Jina still reads `JINA_API_KEY` from the environment.

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

If the `codetrap` command is on your `PATH`, add it to Codex as an MCP server:

```bash
codex mcp add codetrap -- codetrap serve
```

If your MCP client does not inherit your shell `PATH`, use the absolute path:

```bash
codex mcp add codetrap -- "$(bun pm bin -g)/codetrap" serve
```

Agents can also use the CLI directly from `AGENTS.md`:

````md
Before non-trivial code edits, check codetrap from the current project cwd:

codetrap search "<keywords>" --mode hybrid --json

Review the top 3 action cards, or all returned cards if fewer than 3, before deciding no trap applies. Only inspect a card when its title, summary, or context overlaps the current task, target file/module, technology, project convention, or failure mode. For matching critical/error results, inspect before editing:

codetrap show <id> --scope <project|global> --json

Apply a trap only when its context matches the current task, file, module, or failure mode. Severity alone is not enough to apply a trap. Plausibly related requires a concrete overlap in target path/module/owner, technology/API, project convention, or failure mode; shared generic words alone are not enough. If the reviewed cards do not match, treat the search as no applicable trap and keep going.

When editing a known area, pass applicability hints:

codetrap search "<keywords>" --path path/to/file --module module-name --json

To capture a post-flight lesson from agent work:

```bash
cat <<'EOF' | codetrap session capture --trap-markdown - --kind review --json
Title: <durable pitfall>
Context: <when it triggers>
Mistake: <what the agent did wrong>
Fix: <what to do instead>
EOF
```

`--trap-json` remains available for callers that already have a structured object:

```bash
codetrap session capture --trap-json '{...}' --kind review --json
```

For longer implementation work, keep temporary notes and explicit candidate traps in session files first:

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

Pending candidates are visible from `codetrap session status`, `codetrap session list`, `codetrap doctor`, and `codetrap web`.

Only accepted candidates are written to `traps.db`:

```bash
# Only after explicit human approval:
codetrap session accept <candidate-id>
```

`codetrap session accept --edit-json ...` applies the edit before conflict detection. If a possible active-trap conflict is found, the candidate remains proposed and records conflict diagnostics until you choose `--accept-anyway`, `--supersedes <trap-id>`, or reject it.

To save a lesson from an external article or reference, let the agent read the source and attach the URL as evidence after the user confirms the trap:

codetrap add_trap_evidence <id> --scope global --source_type article --source_ref "https://example.com/post" --output-json
````
