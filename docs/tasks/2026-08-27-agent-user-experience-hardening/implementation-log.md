# Implementation Log: Agent and User Experience Hardening

### 2026-08-27

- Kept session IDs stable when changing a goal. The new rename operation updates
  session metadata, the session index, recap, and implementation-notes header
  under the project session lock; directory names and references do not move.
- Reused the candidate envelope's existing edit path so every supported edit
  recomputes quality, bumps the revision, refreshes the content hash, and
  invalidates stale authorization. CLI, MCP, and Web all converge on this path.
- Chose explicit translation/edit primitives instead of an embedded translation
  provider. Agents can generate localized text and submit it atomically without
  Codetrap sending project data to an undeclared external service.
- Chose visibility-aware polling for local Web freshness instead of a persistent
  SSE connection. The console is local-first, and polling can pause completely
  while a candidate form is dirty so external updates never overwrite a draft.
- Validation confirmed the existing Bun-driven system-browser smoke remains
  intentionally skipped on Windows, while a separate real Chrome run verified
  token cleanup, Chinese localization, the rename control, the native dialog
  state, suppression copy, layout geometry, and a clean browser console. The
  user authorized a local commit on 2026-08-28; no PR, push, or release followed.
- Extended the shared Codex/Claude skill bundle rather than adding a Web crawler.
  Agents continue to read external sources; Codetrap receives normalized,
  user-reviewed content and source references. This preserves the local-memory
  boundary while supporting both concise runtime traps and user-study insights.
- Applied the requested `用 ASCII 流程图结合通俗易懂的例子讲解` teaching format only
  to user-study insights. Both external capture and generated session-review
  prompts require a compact ASCII flow and concrete example; runtime pitfalls
  stay concise. The Learning empty state exposes the same ready-to-send request,
  and its body uses an ASCII-safe font stack.
- Windows Python must run the skill validator with `-X utf8` for skills that
  contain the Chinese teaching prompt; the default GBK decode failed before
  semantic validation began. Both updated skills pass in UTF-8 mode.
- Treated a learning insight as a first-class review destination instead of a
  malformed trap. Its editor now uses title, summary, body, tags, and source
  references; trap severity/quality warnings and trap-only conflict controls do
  not leak into the learning workflow.
- Added one explicit user action that saves the visible insight revision,
  records approval, and commits it to the Learning shelf. The separate
  approve-only action remains for a user who wants an Agent to execute later.
- Made **Mark learned** an idempotent state transition. Historical positive
  counts remain readable, but repeated clicks and network retries cannot turn
  study tracking into an accidental engagement score.
- Chose a small escaped fenced-code renderer instead of introducing a general
  Markdown runtime. This preserves ASCII diagram alignment and code blocks while
  keeping arbitrary source material inert in the local console.
- Added `--input-json -` to structured CLI commands. Piping JSON avoids the
  quote rewriting observed when PowerShell forwards multiline JSON to native
  Bun commands, and bundled skills now document the source-checkout CLI fallback
  without installing anything globally.
- Converted Web API 401 responses into localized stale-tab recovery guidance.
  Restarting the local server necessarily rotates the ephemeral launch token;
  the old tab now tells the user to use the newly opened tab instead of leaking
  the transport-level `Unauthorized` message into the product UI.
- Kept existing five-second test budgets unchanged after the final full-suite
  run timed out in two unrelated CLI-heavy cases by 0.16 and 0.53 seconds. Both
  files passed 28/28 in isolation, so increasing the timeout here would hide a
  suite-load signal without improving the learning workflow under test.
