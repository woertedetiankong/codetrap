---
status: Complete
updated: 2026-09-09
---
# Focused experience workflow

## Summary

Implemented the [accepted scope](task-brief.md): cross-scope consumption order,
an experience-only correction entry, and readable applicability/source/usage.
Product value relative to native memory still requires real user trials.

## Current State

- `search-order.ts` assigns merged positions; cards and observation ranks share the same flattening helper. FTS/mixed fallback interleave per-scope ranks with diagnostics, rather than compare incompatible raw scores.
- Empty Review/Library reuse the handoff in memory mode. Drafts are project-and-mode scoped; Learning stays separate. Filtered empty lists recover through Clear filters. No new write API or database schema.
- Library exposes applicability and original evidence, existing Run/revision links, unknown usage/validation states and a scoped archive command. Skill/template reports use actual actions and verification, without invented prevented errors.
- CLI symlink points to this checkout. Restart a running `codetrap web` process to load the new generated bundle.
- On 2026-09-09, the user requested local installation refresh and commit/push. `codetrap setup codex --no-agents` and `codetrap setup claude --no-agents` updated both installed check Skills with backups. All six bundled files in each client match source. The updated Codex entry was reread in this task; new invocations can load the installed version. No public release was requested.

## Validation

Targeted search and browser checks pass, including a mocked high-relevance global
result below the limit, mixed hybrid fallback, scoped ID collisions, copy-only
draft isolation, filter recovery, mobile layout and original Run navigation.
The full sequential run passed 110/111 files; the new browser suite failed on
a resize/render synchronization race in its test. After fixing synchronization
and exercising Review's mobile list/reader navigation, the final focused run
passed 8/8 tests across three files, including that browser suite. No remaining
test failures. Logs: `/tmp/codetrap-focused-tests.log` and
`/tmp/codetrap-focused-final.log`. Typecheck, generated-bundle consistency and
diff-whitespace checks pass. Browser screenshots use disposable fixtures under
[visual evidence](../../reviews/2026-09-09-focused-experience-assets/).
Skill frontmatter validation passed using an ephemeral uv PyYAML environment.

## Next Steps

Invite a small number of developers to try their own correction/reuse flow.
Publication remains separate from source delivery; the app changes do not establish market demand.

## Restart Verify

```bash
git status --short
codetrap setup codex --no-agents --dry-run
codetrap setup claude --no-agents --dry-run
bun run check:web
bun test src/tests/search-cross-scope.test.ts src/tests/experience-entry-browser.test.ts
```

The expected output is any remaining local review artifacts, three unchanged
Skills per client, a generated bundle matching source, and all 5 focused tests
passing. A mismatch means inspect
subsequent edits, local build or browser availability before drawing conclusions.

## Git And Persistent State

Base `main` at `b9d680e`; source delivery uses `main` and remote CI must be checked
against the containing implementation commit. npm publication is a separate step.
Preserve prior untracked product-assessment artifacts, which are outside this commit. No confirmed
experience content, course, hook or native-memory configuration was changed by this slice.

## Implementation Log

See [implementation-log.md](implementation-log.md). Durable contracts were merged
into README, browser architecture and the shared agent template.
