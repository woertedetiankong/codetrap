---
name: codetrap-check
description: Check the codetrap pitfall database before code changes and apply relevant lessons. Use before non-trivial coding work, when touching risky areas, or when the user runs /codetrap-check.
---

Before generating any non-trivial code, pause and check the codetrap database for relevant pitfalls. This is a "pre-flight check" that prevents you from repeating known mistakes.

## When to trigger

Run this check when:
1. The user asks you to write or modify code
2. The task touches an area with recorded pitfalls (API, auth, database, security, etc.)
3. The user explicitly runs `/codetrap-check`

Do NOT run for: trivial text changes, questions about code, documentation-only changes.

## Step 1: Extract key terms

From the user's request, extract search keywords. Focus on:
- Technology names: "axios", "prisma", "jwt", "react"
- Patterns: "middleware", "endpoint", "migration", "hook"
- Domains: "authentication", "database", "routing", "state"

## Step 2: Search the database

Default to the CLI from the current project cwd:

```bash
codetrap search "<keywords>" --mode hybrid --json
```

When the task targets a known file or subsystem, include applicability hints:

```bash
codetrap search "<keywords>" --path src/db/repository.ts --module db --json
```

If the query comes from another tool, stdin is also supported:

```bash
echo "<keywords>" | codetrap search --mode hybrid --json
```

MCP `search_traps` is optional. Use it only when it is already available and project-scoped correctly; pass `cwd` when the client supports it.

Review the top 3 returned action cards before deciding that no trap applies. Do not stop after only the first result; relevant traps may rank second or third. If fewer than 3 cards are returned, review all returned cards.

## Step 3: Apply the lessons

For each relevant trap found in the reviewed top cards:
1. Read the action card's `avoid` and `do_instead`
2. If the card is highly relevant, or has `critical`/`error` severity and is plausibly related, and you are about to edit code, run `next_action.command` from CLI JSON; with MCP, call `get_trap` with `next_action.details_args.id` and `next_action.details_args.scope`
3. Adjust your code generation to follow the correct approach
4. If a trap matches exactly what you were about to do, explicitly tell the user: "I was about to [avoid], but the codetrap database says [do_instead]. I'll do it the right way."

## Step 4: Report

Briefly tell the user which traps you found and how you adjusted:
```
Checked codetrap: found 2 relevant pitfalls. Avoiding [X] and using [Y] instead.
```

If no traps found, say nothing — don't waste tokens.

## Step 5: Record new pitfalls

If while writing code you discover a NEW pitfall that isn't in the database, propose a post-flight trap candidate. Do not write it automatically; ask: "This seems like a recurring pitfall. Want me to record it with `/codetrap-add`?"
