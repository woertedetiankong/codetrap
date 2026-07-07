---
name: codetrap-capture-external
description: Extract durable coding pitfalls from an external article, blog post, issue, paper, or reference, then save selected lessons to codetrap with source evidence after user confirmation.
---

Use this when the user shares an external source and wants to save useful lessons for future AI coding work.

The external source is read by the agent. Do not ask codetrap CLI to fetch URLs or crawl the web. codetrap stays a local memory store.

## Step 1: Read The Source

Open or read the provided URL, article text, issue, paper, or reference. Identify lessons that could change future implementation behavior.

Do not summarize the whole source into codetrap. Extract only durable pitfalls with a clear trigger, mistake, and fix.

## Step 2: Extract Candidate Traps

Create as many candidate traps as pass the quality bar. Do not force a fixed count.

Each candidate must include:

- `context`: when this lesson applies
- `mistake`: what an AI coding agent might do wrong
- `fix`: what it should do instead
- `severity`: `warning`, `error`, or `critical`
- `tags`: useful retrieval terms
- optional `path_globs`, `module`, and `owner` when the lesson is project-specific

Reject or omit candidates that are broad summaries, one-off facts, vague advice, marketing claims, or source details that would not change future coding behavior.

## Step 3: Rank And Ask

Present the recommended candidates in priority order. Include a short reason for each recommendation.

Ask the user which candidates to save. Do not write any trap until the user confirms.

If a candidate is useful but needs a narrower scope, ask for or propose edits before saving.

## Step 4: Save Confirmed Lessons

For each confirmed candidate, call:

```bash
codetrap add --input-json '<trap-json>' --json
```

Then attach the external source as evidence:

```bash
codetrap add_trap_evidence <id> \
  --scope <project|global> \
  --source_type article \
  --source_ref "<url-or-source-id>" \
  --note "External lesson captured from <short source title>." \
  --output-json
```

Use `global` for generally reusable lessons across projects. Use `project` only when the lesson is specific to the current repository or technology stack.

## Step 5: Confirm

Tell the user which trap IDs were saved, their scopes, and the source reference attached as evidence.
