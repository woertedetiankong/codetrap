# Interactive study lessons

Codetrap can attach self-contained HTML lessons (including SVG, CSS and JavaScript
animations) to existing Learning insights or collections. The `codetrap-study`
skill lets a connected coding agent read a source, plan its knowledge coverage,
generate the lesson, verify interactions and save the file. Codetrap stores and
plays the result; it does not add a model service or an internal chat provider.

## Start through conversation

Install the current skill bundle with `codetrap setup codex` or
`codetrap setup claude`. When developing from this checkout, use
`bun run src/index.ts setup codex` (or `claude`) to use the updated sources.
Restart the agent session if it has already loaded its skill list.

Example requests:

- “用 codetrap-study 把这篇博客做成适合初学者的互动课程，保存到学习库。”
- “把这个函数的调用过程做成 SVG 单步动画，解释每一步的变量变化。”
- “给这个课程增加一个可以调整参数的实验，保留旧版本。”

The skill requires a knowledge-point/section coverage check and explicit labeling
of simulations versus source measurements. It retains source references and text
explanations. Coverage instructions improve generation quality; the player does
not certify that AI-generated teaching is complete or correct.

New Learning entries retain the existing proposal/review workflow. An explicit
request to attach or update a lesson authorizes that file operation. Generating a
preview alone does not save it. Lessons never automatically become agent memory.

## Import a lesson

Find an existing insight or collection using `codetrap phase2 insights --json`.
Run commands from that project root:

```sh
codetrap learn artifact import --file ./lesson.html --title "Interactive lesson" --insight INSIGHT_ID --json
codetrap learn artifact list --insight INSIGHT_ID --json
```

Use `--collection COLLECTION_ID` instead to show the same lesson from each member
insight. Structured input is supported through `--input-json -` on stdin:

```json
{
  "file": "./lesson.html",
  "title": "Interactive lesson",
  "target": { "kind": "insight", "id": "INSIGHT_ID" },
  "source_refs": ["https://example.com/article"],
  "source_revision": "article snapshot or code commit"
}
```

The file must be UTF-8 HTML, at most 8 MiB, with scripts, styles and required
assets embedded. Remote scripts, fetch calls and CDN styles will not work in the
player. Import copies bytes into the project, so deleting the original file does
not break the lesson. References identify provenance; no source snapshot is
fetched or stored automatically.

## Study, update and export

Open `codetrap web`, choose **Learning**, open the insight and select
**Interactive lesson**. Text remains in its own tab; existing notes and personal
progress remain available. The player supports version selection, restarting,
reloading newly imported versions, and downloading HTML. Switching between text
and animation tabs preserves the active animation until the detail is rebuilt
or the page is left. Progress is recorded through existing Learning controls;
playing an animation does not automatically mark a chapter complete.

```sh
codetrap learn artifact show ARTIFACT_ID --json
codetrap learn artifact import --file ./lesson-v2.html --title "Revised lesson" --insight INSIGHT_ID --id ARTIFACT_ID --expected-version 1 --json
codetrap learn artifact versions ARTIFACT_ID --json
codetrap learn artifact restore ARTIFACT_ID --version 1 --expected-version 2 --json
codetrap learn artifact export ARTIFACT_ID --version 1 --output ./lesson-export.html --json
```

Updates must name the latest expected version; stale updates fail. Supply source
metadata on each import. Restore appends a new latest revision, preserving all
history. Export refuses to overwrite an existing destination.

## Storage and execution boundary

Metadata lives in `.codetrap/learning/artifacts/index.json`; immutable HTML blobs
live in `blobs/<sha256>.html` under that directory. Back up this directory together
with the project's Learning records. Content hashes are checked on read, writes
are serialized, and existing symbolic-link file/storage paths are rejected.

Authenticated endpoints return metadata and HTML as JSON, with an explicit
registered project scope. The browser creates a `srcdoc` iframe with
`sandbox="allow-scripts"` and a restrictive Content Security Policy. Animations
can run inline scripts, but cannot access the parent, local APIs, same-origin
storage, external resources or embedded frames. Child messages never change
Learning records. Persistent state and automatic grading bridges are not part of
this version. Downloaded HTML runs under the browser's normal file rules rather
than Codetrap's player isolation.

## 在网页里准备 AI 任务

学习页现在提供“和 AI 开始一个任务”：选择文章、代码、已有 HTML 课件或编程经验，再选择只放学习库、只放经验库或两个库都保存。已有 HTML 课件关联学习库；经验规则仍单独提炼。可填写链接、文件路径或资料，也可以稍后在 AI 对话中补充。

点击“复制请求，交给 AI”，把请求粘贴到具备 codetrap 的 AI 对话。请求包含当前项目、保存位置、互动课件选项和审核要求。复制不会发送资料或创建记录；AI 准备候选后，在审核页确认。项目内的任务草稿在当前网页会话中保留，刷新页面后不保留；本机文件路径不代表其他电脑也能访问。剪贴板不可用时展开请求并手动复制。

AI 可先运行 `codetrap learn artifact schema --json` 查看导入字段、示例及查询现有条目的命令。缺少必要输入时，JSON 错误保留 `success: false`、`error`，并增加 `code: "MISSING_INPUT"`、`missing_fields`、`next_actions`。版本冲突返回 `code: "VERSION_CONFLICT"` 与读取最新版本的命令，AI 应检查并合并差异后再重试，不应直接覆盖。其他错误仍可能使用原有错误格式。

## 搜索学习内容

学习页支持关键词与语义混合搜索，覆盖标题、摘要、标签、主题、学习正文和合集背景。搜索结果显示相关段落；点击记录后可打开它的互动课件。学习材料不会因为被搜到而自动成为 Agent 经验规则。

在对应项目中，AI 或用户可以运行：

```bash
codetrap learn search "怎样减少 AI 读取文件的成本" --json
codetrap learn search "offset" --mode fts --json
codetrap learn search "怎样减少上下文开销" --mode semantic --limit 5 --json
codetrap learn show <insight-id> --json
codetrap learn index-status --json
codetrap learn reindex --json
```

默认 `hybrid` 合并文字匹配与向量匹配；`fts` 为文字匹配，`semantic` 只返回语义结果。JSON 包含 `kind: "learning"`、命中片段、来源、项目路径及下一步读取命令。CLI 搜索当前项目；网页“全部项目”搜索已登记项目，并保留来源项目身份和合集阅读顺序。网页每个项目最多显示 100 个命中，CLI 的 `--limit` 范围为 1–100。

索引复用全局配置的本地 Hugging Face、Ollama 或 Jina 提供方。网页“建立当前项目学习索引”与 CLI `learn reindex` 等效；本地模型尚未缓存时，首次建立索引会下载模型。远程提供方会接收待索引的学习文字和查询；使用本地模型时推理在本机完成。

学习向量索引独立存放在项目 `.codetrap/learning/search-index.json`，不会修改课件或学习进度。按段落分块，每块最多 500 个 Unicode 字符，长段落保留 80 字重叠；每个知识点只贡献一次排序权重。索引记录模型、维数、格式版本和内容指纹。添加/修改内容或更换模型后，运行 `learn reindex`；未变化的有效段落复用向量。旧内容、已删除内容和不匹配模型的向量不参与搜索。失败的生成不会覆盖原索引。

没有模型或索引不完整时，混合搜索继续提供文字结果，并通过 `diagnostics` 解释限制；纯语义搜索可能返回空结果及原因。普通搜索不会自动下载模型、扫描 HTML 或发起重建。当前 `fts` 是学习文字匹配，不是经验库 SQLite FTS5 的同一索引。

HTML 内部、动态题目解析和精确章节跳转尚未建立结构化索引。这一阶段通过关联学习记录检索课件；仅出现在 HTML 中、未进入学习正文的知识点仍不能被直接搜到。
