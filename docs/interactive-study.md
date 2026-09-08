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
