---
name: codetrap-capture-external
description: Extract durable coding pitfalls or study-ready insights from an external article, blog post, issue, paper, repository, or reference, then save only user-confirmed lessons to codetrap with source evidence.
---

Use this when the user shares an external source and wants to save useful lessons
for future AI coding work, their own study, or both.

The external source is read by the agent. Do not ask codetrap CLI to fetch URLs or crawl the web. codetrap stays a local memory store.

Use `codetrap` when it is available on `PATH`. In a Codetrap source checkout
where the global command is intentionally absent, run the same arguments with
`bun run src/index.ts` from the repository root. Outside that checkout, report
the missing CLI; do not install or update it without user approval. For
structured input, prefer piping JSON to `--input-json -`; this avoids native
argument quote rewriting on Windows PowerShell.

## Step 1: Read The Source

Open or read the provided URL, article text, issue, paper, or reference. Identify lessons that could change future implementation behavior.

Do not copy or summarize the whole source into codetrap. Extract only content
that changes future agent behavior or materially improves the user's
understanding.

## Step 2: Extract And Route Candidate Lessons

Create as many candidates as pass the quality bar. Do not force a fixed count.
Choose the destination by purpose:

- `pitfall_trap` is concise agent memory: when it applies, what an agent might
  do wrong, and what it should do instead.
- `insight` is study material for the user: a mental model, rationale,
  tradeoff, or explanation worth understanding even when it is not a runtime
  guardrail.
- When a source supports both purposes, draft two purpose-specific candidates;
  do not duplicate one long summary into both destinations.

Each trap candidate must include:

- `context`: when this lesson applies
- `mistake`: what an AI coding agent might do wrong
- `fix`: what it should do instead
- `severity`: `warning`, `error`, or `critical`
- `tags`: useful retrieval terms
- optional `path_globs`, `module`, and `owner` when the lesson is project-specific

Reject or omit candidates that are broad summaries, one-off facts, vague advice, marketing claims, or source details that would not change future coding behavior.

Each insight candidate must include `title`, `summary`, `body`, `tags`, and
`source_refs`. Generate `body` with this teaching instruction:

> 用ASCII流程图结合通俗易懂的例子讲解

The body must contain a compact ASCII flow diagram that explains the important
sequence or relationship and a concrete, plain-language example. Keep the
diagram aligned as plain text and explain what the reader should notice. Do not
claim that saving or marking an insight trains the model.

## Step 3: Rank And Ask

Present the recommended candidates in priority order. Name the proposed
destination and include a short reason for each recommendation.

Ask the user which candidates to save. Do not write any trap until the user confirms.

If a candidate is useful but needs a narrower scope, ask for or propose edits before saving.

## Step 4: Save Confirmed Lessons

For each confirmed trap candidate, pipe its JSON object through standard input:

```bash
codetrap add --input-json - --json
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

For each confirmed insight candidate, stage a reviewed Phase 2 proposal with
the teaching content in `payload.body` and the source in
`payload.source_refs`:

Feed the following object to `codetrap phase2 propose --input-json - --json`
through standard input:

```json
{
  "kind":"insight",
  "title":"<title>",
  "rationale":"<why this is worth studying>",
  "payload":{
    "title":"<title>",
    "summary":"<short summary>",
    "body":"<ASCII flow plus plain-language example>",
    "tags":["<tag>"],
    "source_refs":["<url-or-source-id>"]
  }
}
```

Report the returned session and candidate ids, then stop for explicit user
approval. An agent must not approve its own proposal. The Web console lets the
user approve and add the current insight revision in one explicit action. If
the user records approval without applying it, the agent may run:

```bash
codetrap phase2 apply <candidate-id> --session <session-id> --executor agent --json
```

## Step 5: Confirm

Tell the user which trap ids or insight candidate ids were created, their
destinations and scopes, which writes still await approval, and the source
reference attached as evidence.
