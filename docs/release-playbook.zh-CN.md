# codetrap 安装与发布操作手册

这份文档是给维护者看的：以后你要发新版本、检查 npm/bun 安装、检查 GitHub Release 二进制，可以按这里一步一步操作。

普通用户安装说明见 [Installation](installation.md)。

## 当前发布渠道

codetrap 现在有三种安装方式：

| 方式 | 面向用户 | 是否需要 Bun | 当前状态 |
|---|---|---:|---|
| `bun add -g codetrap` | Bun 用户 | 需要 | 已发布 |
| `npm install -g codetrap` | npm 用户 | 需要 | 已发布 |
| GitHub Release 二进制 | 普通用户 | 不需要 | 已发布 |

当前 npm 包：

```bash
npm view codetrap version bin dist-tags
```

期望看到类似：

```text
version = '0.1.6'
bin = { codetrap: 'bin/codetrap' }
dist-tags = { latest: '0.1.6' }
```

如果之后已经发布更高版本，实际查询结果应是最新版本。

当前 GitHub Release：

```bash
gh release view v0.1.6 --repo woertedetiankong/codetrap
```

## 普通用户安装命令

### Bun 全局安装

```bash
bun add -g codetrap
codetrap --help
```

### npm 全局安装

npm 安装的是源码版 CLI，用户电脑仍然需要安装 Bun，因为入口脚本使用：

```bash
#!/usr/bin/env bun
```

安装命令：

```bash
npm install -g codetrap
codetrap --help
```

### 二进制安装

二进制不需要用户安装 Bun。

macOS Apple Silicon：

```bash
curl -L https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-darwin-arm64 -o codetrap
mkdir -p ~/.local/bin
mv codetrap ~/.local/bin/codetrap
chmod +x ~/.local/bin/codetrap
codetrap --help
```

macOS Intel：

```bash
curl -L https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-darwin-x64 -o codetrap
mkdir -p ~/.local/bin
mv codetrap ~/.local/bin/codetrap
chmod +x ~/.local/bin/codetrap
codetrap --help
```

Linux x64：

```bash
curl -L https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-linux-x64 -o codetrap
mkdir -p ~/.local/bin
mv codetrap ~/.local/bin/codetrap
chmod +x ~/.local/bin/codetrap
codetrap --help
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force "$HOME\bin"
Invoke-WebRequest `
  -Uri "https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-windows-x64.exe" `
  -OutFile "$HOME\bin\codetrap.exe"
codetrap --help
```

## Jina API 配置

`JINA_API_KEY` 是可选的。

没有 key：

- `codetrap search "<query>" --mode fts` 正常可用。
- `codetrap search "<query>" --mode hybrid` 可用，但会退回 FTS。
- `codetrap embed` 和 `--mode semantic` 需要 key。

macOS / Linux zsh：

```bash
echo 'export JINA_API_KEY="your-jina-api-key"' >> ~/.zshrc
source ~/.zshrc
```

验证，不打印 secret：

```bash
bun -e 'console.log(process.env.JINA_API_KEY ? "has-key" : "no-key")'
```

生成 embeddings：

```bash
cd /path/to/project
codetrap embed --scope project
codetrap embed --scope global
```

## Codex / Claude Code 接入

### CLI-first 接入（推荐）

优先把下面片段放进项目的 `AGENTS.md` 或 `CLAUDE.md`：

````md
## Codetrap

Before non-trivial code edits, check codetrap from the current project cwd:

```bash
codetrap search "<keywords>" --mode hybrid --json
```

Review the top 3 action cards before deciding no trap applies. If a card is highly relevant, or has `critical`/`error` severity and is plausibly related, inspect it before editing:

```bash
codetrap show <id> --scope <project|global> --json
```

When a new recurring mistake or project convention is discovered, ask whether to record it:

```bash
codetrap add --json '{...}' --output-json
```
````

### MCP（可选）

Codex：

```bash
codex mcp add codetrap -- codetrap serve
```

如果 shell PATH 没被 MCP 客户端继承，用绝对路径：

```bash
codex mcp add codetrap -- "$(bun pm bin -g)/codetrap" serve
```

Claude Code 或其他 MCP 客户端可以使用：

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

即使已经配置 MCP，也建议在项目里写一段规则，因为：

- MCP 解决“agent 能调用什么工具”。
- `AGENTS.md` / `CLAUDE.md` 解决“agent 什么时候应该调用工具”。
- CLI JSON 是默认可复制、可调试、跨客户端的 agent 接口。

MCP 作为 optional adapter 使用；如果客户端支持传参，tool calls 应传 `cwd`，让 project scope 从目标 workspace 解析。

## 发布新版本：完整流程

下面以 `0.1.6` 为例。每次发布前把版本号换成你要发布的新版本。

### 1. 确认工作区

```bash
git status --short
```

如果有不相关改动，先处理清楚。不要把临时文件、数据库、`.env` 提交上去。

### 2. 更新版本号

修改 [package.json](../package.json)：

```json
{
  "version": "0.1.6"
}
```

注意：

- npm 同一个版本号只能发布一次。
- Git tag 也不要重复使用。
- `package.json` 版本 `0.1.6` 对应 tag `v0.1.6`。

### 3. 本地验证

```bash
bun install --frozen-lockfile
bun run check:release-version v0.1.6
bun run release:preflight v0.1.6
```

`release:preflight` 会串联测试、普通 build、多平台 release asset build、当前平台二进制 smoke test、`npm pack --dry-run`，并在当前 `package.json` 版本尚未发布时运行 `npm publish --dry-run --access public`。检查 npm dry-run 输出：

- 包名和版本正确。
- `bin/codetrap` 在 Tarball Contents 里。
- 没有 npm 自动修复 `bin` 的 warning。

### 4. 可选：本地测试 npm tarball

```bash
rm -rf /tmp/codetrap-pack-test /tmp/codetrap-npm-test
mkdir -p /tmp/codetrap-pack-test
npm pack --pack-destination /tmp/codetrap-pack-test
npm install -g --prefix /tmp/codetrap-npm-test /tmp/codetrap-pack-test/codetrap-0.1.6.tgz
/tmp/codetrap-npm-test/bin/codetrap --help
```

### 5. 可选：本地测试 Bun tarball

```bash
rm -rf /tmp/codetrap-bun-test
BUN_INSTALL=/tmp/codetrap-bun-test bun add -g /tmp/codetrap-pack-test/codetrap-0.1.6.tgz
/tmp/codetrap-bun-test/bin/codetrap --help
```

### 6. 提交代码

```bash
git add .
git commit -m "Release v0.1.6"
git push origin main
```

### 7. 创建并推送 tag

```bash
git tag v0.1.6
git push origin v0.1.6
```

推送 tag 后，GitHub Actions 会自动运行 `Release Binaries`，生成 GitHub Release 二进制。

查看 workflow：

```bash
gh run list --repo woertedetiankong/codetrap --limit 5
```

等待 release workflow 完成：

```bash
gh run watch <run-id> --repo woertedetiankong/codetrap --exit-status
```

查看 release：

```bash
gh release view v0.1.6 --repo woertedetiankong/codetrap --json url,tagName,assets
```

期望 assets 包含：

```text
codetrap-darwin-arm64
codetrap-darwin-x64
codetrap-linux-arm64
codetrap-linux-x64
codetrap-windows-x64.exe
sha256sums.txt
```

### 8. 发布 npm 包

trusted publisher 已经配置好后，手动触发 npm publish workflow：

```bash
gh workflow run npm-publish.yml --repo woertedetiankong/codetrap --ref v0.1.6 -f tag=v0.1.6
```

查看 workflow：

```bash
gh run list --workflow="npm-publish.yml" --repo woertedetiankong/codetrap --limit 5
```

等待完成：

```bash
gh run watch <run-id> --repo woertedetiankong/codetrap --exit-status
```

### 9. 验证 npm 最新版本

```bash
npm view codetrap version bin dist-tags --json
```

期望：

```json
{
  "version": "0.1.6",
  "bin": {
    "codetrap": "bin/codetrap"
  },
  "dist-tags": {
    "latest": "0.1.6"
  }
}
```

### 10. 最终安装验证

npm：

```bash
rm -rf /tmp/codetrap-npm-latest-test
npm install -g --prefix /tmp/codetrap-npm-latest-test codetrap@latest
/tmp/codetrap-npm-latest-test/bin/codetrap --help
```

Bun：

```bash
rm -rf /tmp/codetrap-bun-latest-test
BUN_INSTALL=/tmp/codetrap-bun-latest-test bun add -g codetrap@latest
/tmp/codetrap-bun-latest-test/bin/codetrap --help
```

GitHub Release 二进制：

```bash
curl -L https://github.com/woertedetiankong/codetrap/releases/latest/download/codetrap-darwin-arm64 -o /tmp/codetrap
chmod +x /tmp/codetrap
/tmp/codetrap --help
```

## 常见问题

### npm 提示 bin warning

如果看到类似：

```text
npm auto-corrected some errors in your package.json
"bin[codetrap]" script name ... was invalid
```

检查 [package.json](../package.json)：

```json
{
  "bin": {
    "codetrap": "bin/codetrap"
  }
}
```

并确认 [bin/codetrap](../bin/codetrap) 存在且有 shebang：

```bash
#!/usr/bin/env bun
```

### npm 发布失败：版本已存在

npm 不能覆盖同一个版本。解决方法：

1. 把 `package.json` version 升到新版本。
2. 重新 commit。
3. 重新打新 tag。
4. 重新触发 npm publish workflow。

### GitHub Release 已经有同名 tag

不要复用 tag。换一个新版本，比如从 `v0.1.6` 升到 `v0.1.7`。

### npm latest 没更新

检查 npm publish workflow 是否成功：

```bash
gh run list --workflow="npm-publish.yml" --repo woertedetiankong/codetrap --limit 5
```

如果 workflow 成功但 npm 缓存没刷新，等一两分钟再查：

```bash
npm view codetrap version bin dist-tags --json
```
