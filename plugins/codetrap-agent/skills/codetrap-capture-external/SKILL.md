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

Use two passes. In pass one, inventory the source before drafting anything:

- headings and sections
- core claims and mental models
- examples and case studies
- source background, dated facts, authorship, and case-study context
- code, commands, configuration, APIs, and diagrams
- limitations, exceptions, tradeoffs, and conclusions

Give every meaningful unit a short stable id. Calculate a SHA-256 fingerprint
from the exact rendered text you reviewed and format it as `sha256:<64 hex>`.
If the source is truncated or only sampled, use mode `sampled`; never claim
full-source completeness.

In pass two, create as many candidates as pass the quality bar. Do not force a
fixed count. Route substantive units to either an Insight's
`source_unit_refs` or a source-backed `collection.context_sections` entry.
Use collection context for background or dated facts that should remain
available but should not become artificial study chapters. Use `skip` only
for page chrome, navigation, duplicated widgets, or material outside the
article body, with a concrete reason. Never silently discard substantive
source content.
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

Reject trap candidates that are broad summaries, one-off facts, vague advice,
marketing claims, or source details that would not change future coding
behavior. Preserve substantive article background in collection context rather
than discarding it merely because it is not a trap or standalone lesson.

Each insight candidate must include `title`, `summary`, `body`, `tags`, and
`source_refs`, plus a suitable `source_type`. Generate `body` with this teaching
instruction:

> 用ASCII流程图结合通俗易懂的例子讲解

The body must contain a compact ASCII flow diagram that explains the important
sequence or relationship and a concrete, plain-language example. Keep the
diagram aligned as plain text and explain what the reader should notice. Do not
claim that saving or marking an insight trains the model.

When one source yields multiple insights, treat the extraction as one source
collection. Give every proposal the same stable `collection.id`, title, shared
collection topics, source metadata, and consecutive `collection.position`
values following the source's recommended reading order. Give every proposal
the same complete
`collection.source_coverage` manifest and the source-unit ids taught by that
proposal. Even a single source-derived insight uses a one-item collection so
the source inventory and any intentional skips remain auditable.
When background belongs to the whole source, repeat the same
`collection.context_sections` array on every proposal. Each section needs a
stable id, title, body, and `source_unit_refs`; those refs count toward
collection completeness without increasing the chapter count.

## Step 3: Rank And Ask

Present the recommended candidates in priority order. Name the proposed
destination and include a short reason for each recommendation.

Also present the source coverage account: every inventoried unit, which
candidate covers it, and every explicit skip reason. If any unit is unresolved,
say the collection is incomplete and resolve it before proposing a full-source
collection.

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

Stage every confirmed insight from one source as a single reviewed Phase 2
batch. The command validates the whole coverage account before it writes any
candidate, so never loop over `phase2 propose` for a multi-insight source.
Put teaching content in `payload.body` and the source in `payload.source_refs`.

Feed the following object to `codetrap phase2 propose-batch --input-json - --json`
through standard input:

```json
{
  "goal":"External source study collection: <source title>",
  "proposals":[
    {
      "kind":"insight",
      "title":"<title>",
      "rationale":"<why this is worth studying>",
      "payload":{
        "title":"<title>",
        "summary":"<short summary>",
        "body":"<ASCII flow plus plain-language example>",
        "tags":["<tag>"],
        "source_refs":["<url-or-source-id>"],
        "source_type":"article",
        "topics":["<primary topic>"],
        "source_unit_refs":["unit-1"],
        "collection":{
          "id":"<same stable id for this extraction>",
          "title":"<source collection title>",
          "source_type":"article",
          "source_refs":["<url-or-source-id>"],
          "topics":["<shared collection topic>"],
          "context_sections":[
            {
              "id":"source-background",
              "title":"Source background",
              "body":"Dated authorship, company, or case context.",
              "source_unit_refs":["unit-2"]
            }
          ],
          "source_coverage":{
            "version":1,
            "mode":"full_source",
            "source_fingerprint":"sha256:<64 hex>",
            "units":[
              {"id":"unit-1","title":"<source section>","disposition":"learn"},
              {"id":"unit-2","title":"<source background>","disposition":"learn"}
            ]
          },
          "position":1
        }
      }
    }
  ]
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
