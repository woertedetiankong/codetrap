

# Interactive study

Use the AI client's reading and coding tools to create the lesson; codetrap is
its local store and player, not a crawler or model service. Match the user's
language, starting knowledge, scope and chosen visual style. A preview request
alone does not ask you to save to the library.

Use `codetrap` on PATH. In the source checkout, if that command is unavailable,
use `bun run src/index.ts` with the same arguments. Run commands from the
intended project. Do not silently save into whichever project is nearby.

## Understand and teach

Read the supplied material. For code, identify the exact files and revision or
content hash; do not present a simulation as execution of that code. For an
article, inventory meaningful source units: concepts, examples, configuration,
commands, limitations, dated context and conclusions. Map them to chapters and
examples. If access is incomplete or sampled, say so and never claim complete
coverage. Link sources, paraphrase appropriately, and distinguish reported
measurements from illustrative values.

Choose interactions that change understanding, rather than moving decorations:
- execution or data flow: advance one meaningful step;
- routing or responsibility: classify a task, give reasoned feedback;
- boundaries: vary input around a threshold, show both sides;
- tradeoffs: change a parameter and compare consequences;
- bugs: predict an outcome, then reveal the counterexample.

No fixed chapter count. Keep a readable textual explanation and an accessible
alternative for every essential animation. Never equate playing an animation
with understanding. Use concrete examples, answer explanations, keyboard and
touch controls, replay/pause where relevant, and reduced-motion support.

## Generate a portable lesson

Produce UTF-8 self-contained `.html` (maximum 8 MiB). Embed SVG, JavaScript,
CSS and any necessary assets. A full course can attach to a collection; a
focused experiment attaches to an insight. Keep the standalone course and its
textual insight bodies consistent. Prefer simple HTML/SVG/JS; bundled React is
also supported when its entire runtime is embedded.

The player allows scripts inside an opaque-origin sandbox. It blocks external
resource requests via CSP, forms, nested frames and powerful browser features.
It does not provide a filesystem, model API, same-origin storage, popups or
parent access. Do not use eval, new Function, module imports, CDNs, fetch,
service workers, document.cookie, localStorage, window.openai, or host-provided
styles. Define the lesson's own styles and SVG colors. Use in-memory state;
source links are citations, not dependencies needed for learning. Keep copying
optional: clipboard access may be unavailable. Do not send parent messages or
attempt to set codetrap progress. Users use the existing Learning status and
practice notes outside the lesson to save their learning record.

Read back the generated file. Validate script syntax, referenced elements,
resource independence and correctness of simulated rules. When browser tools
are available, test the main interactions at desktop/mobile sizes and in a
sandbox equivalent to `sandbox="allow-scripts"`. Fix actual defects; say which
checks were unavailable instead of claiming they passed. Show a preview before
calling the result ready. Preserve an editable local source file for revisions.

## Find or create the Learning target

Use `codetrap phase2 insights --json` to find existing insights/collections.
Do not invent IDs. For new source-backed study content, read
[external-source.md](external-source.md). Historical session mining requires an
explicit request and the optional `codetrap-review` skill. If it is absent, explain
`codetrap setup codex --with-review` (or `claude`); install only when requested. Preserve source coverage and the ordinary
review/approval flow; an agent must not approve its own proposals. Textual
bodies remain independently useful for search and review. Never replace them
with raw HTML or a temporary file link.

When new Learning entries are not yet approved, keep the HTML as a preview and
report the candidate IDs. Attach once the target exists. Saving an attachment
to an existing target needs the user's save/update intent, not another candidate
review. Reuse authorization already given in the conversation.

## Save or update through the CLI

Import by piping JSON through stdin (portable across shells):

```json
{
  "file": "/absolute/path/lesson.html",
  "title": "Caching: a step-by-step experiment",
  "target": { "kind": "insight", "id": "<actual-insight-id>" },
  "source_refs": ["<source-url-or-code-reference>"],
  "source_revision": "<source-commit-or-content-hash>"
}
```

Pass it to `codetrap learn artifact import --input-json - --json`.
Use `"kind": "collection"` for a full course. `source_revision` may be null
for a source with no recorded revision. Imports copy the file into managed
storage; don't write `.codetrap` files directly.

For updates, first run:

```bash
codetrap learn artifact list --insight <id> --json
codetrap learn artifact list --collection <id> --json
codetrap learn artifact show <artifact-id> --json
```

Use the appropriate target filter, not both. Include the returned artifact
`id` and latest revision's `version` as `expected_version` in the import JSON,
keeping its target unchanged. Each import adds a version. If the expected
version is stale, read the latest metadata and resolve the conflict; don't
blindly retry over another author's work.

```bash
codetrap learn artifact restore <artifact-id> --version 1 --expected-version 3 --json
codetrap learn artifact export <artifact-id> --version 1 --output /path/new-copy.html --json
```

Restore creates a new current revision from the selected historical one.
Export refuses to overwrite an existing destination. The browser also lets
users select previous revisions and download HTML.

Read back with `show` after an import/update and confirm the target, version,
source and title. Tell the user to open `codetrap web`, select Learning and the
insight, then choose Interactive lesson. Collection lessons are available from
each insight in that collection. Do not publish code or course content to an
external service without a separate user request.
