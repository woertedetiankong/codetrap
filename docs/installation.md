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

Release binaries are built by `.github/workflows/release.yml` when a version tag is pushed.

1. Make sure `package.json` has the version you want to release.

2. Commit all release changes.

3. Create and push a matching tag:

```bash
git tag v0.1.6
git push origin v0.1.6
```

The release tag must match `package.json` exactly. For example, package version `0.1.6` must use tag `v0.1.6`.

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
npm publish --access public
```

Then configure trusted publishing for future releases.

The workflow runs:

```bash
bun test src/tests
npm pack --dry-run
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

## Optional: Jina Embeddings

`JINA_API_KEY` is optional. Without it, codetrap still works with SQLite FTS keyword search, and hybrid search falls back to FTS.

Create a key from the [Jina AI dashboard](https://jina.ai/api-dashboard/), then set it globally if you want semantic or hybrid search to work from every directory.

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

Verify that the key is visible without printing the secret:

```bash
bun -e 'console.log(process.env.JINA_API_KEY ? "has-key" : "no-key")'
```

Generate embeddings for the traps you want semantic search to use:

```bash
cd /path/to/your/project
codetrap embed --scope project
codetrap embed --scope global
```

Then search:

```bash
codetrap search "HTTP request timeout" --mode hybrid
```

If `JINA_API_KEY` is not set:

- `codetrap search "<query>" --mode fts` works normally.
- `codetrap search "<query>" --mode hybrid` works, but falls back to FTS.
- `codetrap search "<query>" --mode semantic` and `codetrap embed` require `JINA_API_KEY`.

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

```md
Before non-trivial code edits, check codetrap from the current project cwd:

codetrap search "<keywords>" --mode hybrid --json

Review the top 3 action cards before deciding no trap applies. If a critical/error result is plausibly related, inspect it before editing:

codetrap show <id> --scope <project|global> --json

When editing a known area, pass applicability hints:

codetrap search "<keywords>" --path src/db/repository.ts --module db --json

To add a lesson:

codetrap add --json '{...}' --output-json

For longer implementation work, keep temporary notes and explicit candidate traps in session files first:

```bash
codetrap session start "<goal>"
codetrap session note --kind decision --text "<what changed and why>"
codetrap session note --kind review --text $'Title: <durable pitfall>\nContext: <when it triggers>\nMistake: <what the agent did wrong>\nFix: <what to do instead>'
codetrap session close --propose-traps
codetrap session candidates
```

Only accepted candidates are written to `traps.db`:

```bash
codetrap session accept <candidate-id>
```

`codetrap session accept --edit-json ...` applies the edit before conflict detection. If a possible active-trap conflict is found, the candidate remains proposed and records conflict diagnostics until you choose `--accept-anyway`, `--supersedes <trap-id>`, or reject it.

To save a lesson from an external article or reference, let the agent read the source and attach the URL as evidence after the user confirms the trap:

codetrap add_trap_evidence <id> --scope global --source_type article --source_ref "https://example.com/post" --output-json
```
