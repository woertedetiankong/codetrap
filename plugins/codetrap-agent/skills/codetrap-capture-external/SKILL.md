---
name: codetrap-capture-external
description: Extract durable coding pitfalls from an external article, blog post, issue, paper, or reference, then save selected lessons to codetrap with source evidence after user confirmation.
---

Use this when the user shares an external source and wants to save useful lessons for future AI coding work.

The agent should read the source. The codetrap CLI should not fetch URLs or crawl the web; it only stores confirmed lessons and evidence.

Workflow:

1. Read the URL, article text, issue, paper, or reference.
2. Extract every candidate trap that has a clear trigger, mistake, and fix. Do not force a fixed count.
3. Filter out broad summaries, one-off facts, vague advice, and source details that will not change future coding behavior.
4. Rank the recommended candidates and ask the user which ones to save.
5. After confirmation, run `codetrap add --json '<trap-json>' --output-json`.
6. Attach the source with `codetrap add_trap_evidence <id> --scope <project|global> --source_type article --source_ref "<url-or-source-id>" --note "External lesson captured from <short source title>." --output-json`.

Default to `global` for generally reusable engineering lessons. Use `project` only when the source lesson is specific to the current repository or stack.
