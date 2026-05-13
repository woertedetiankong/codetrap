---
name: codetrap-check
description: Before writing code, check the pitfall database for relevant lessons and proactively avoid known mistakes
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
1. Read the `mistake` and `fix` fields
2. Adjust your code generation to follow the correct approach
3. If a trap matches exactly what you were about to do, explicitly tell the user: "I was about to [mistake], but the codetrap database says [fix]. I'll do it the right way."

## Step 4: Report

Briefly tell the user which traps you found and how you adjusted:
```
Checked codetrap: found 2 relevant pitfalls. Avoiding [X] and using [Y] instead.
```

If no traps found, say nothing — don't waste tokens.

## Step 5: Record new pitfalls

If while writing code you discover a NEW pitfall that isn't in the database, suggest: "This seems like a recurring pitfall. Want me to record it with `/codetrap-add`?"
