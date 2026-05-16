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

Call the MCP tool `search_traps` with the extracted keywords. Search both project and global scopes.

## Step 3: Apply the lessons

For each relevant trap found:
1. Read the action card's `avoid` and `do_instead`
2. If the card is highly relevant and you are about to edit code, call `get_trap` with `next_action.details_args.id` and `next_action.details_args.scope`
3. Adjust your code generation to follow the correct approach
4. If a trap matches exactly what you were about to do, explicitly tell the user: "I was about to [avoid], but the codetrap database says [do_instead]. I'll do it the right way."

## Step 4: Report

Briefly tell the user which traps you found and how you adjusted:
```
Checked codetrap: found 2 relevant pitfalls. Avoiding [X] and using [Y] instead.
```

If no traps found, say nothing — don't waste tokens.

## Step 5: Record new pitfalls

If while writing code you discover a NEW pitfall that isn't in the database, suggest: "This seems like a recurring pitfall. Want me to record it with `/codetrap-add`?"
