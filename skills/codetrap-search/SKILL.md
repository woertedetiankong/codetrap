---
name: codetrap-search
description: Search the codetrap pitfall database for known mistakes and project lessons. Use when starting work in a new area or when the user asks whether similar issues were seen before.
---

Search the codetrap database for recorded pitfalls matching the user's query. Default to the CLI `codetrap search --json`; use MCP only when it is already available and scoped to the right project.

## When to use

- Before writing code in a new area (e.g., "I need to write authentication middleware")
- When the user asks "have we seen issues with X before?"
- When starting a task that resembles something that caused problems in the past

## How to search

### Via CLI (preferred)

Run from the current project cwd:

```bash
codetrap search "<keywords>" --mode hybrid --json
```

For scoped work, pass known file/module/owner context:

```bash
codetrap search "<keywords>" --path src/db/repository.ts --module db --owner platform --json
```

Or pipe the query through stdin:

```bash
echo "<keywords>" | codetrap search --mode hybrid --json
```

CLI JSON returns compact action cards. Each card includes `avoid`, `do_instead`, and `next_action.command`; run that command to inspect full details.

### Via MCP (optional)

Call the `search_traps` MCP tool when available:
```
search_traps(query="<keywords>", scope=<optional>, category=<optional>, path=<optional>, module=<optional>, owner=<optional>, cwd=<optional>)
```

`search_traps` returns compact action cards. Each card includes `avoid`, `do_instead`, and `next_action.details_args` with both `id` and `scope`. Preserve that scope when calling `get_trap`.

## Result review rule

Review the top 3 action cards before deciding that no trap applies. Do not rely only on the first result; a relevant trap can rank second or third. If fewer than 3 cards are returned, review all returned cards.

## How to present results

1. Show the most relevant reviewed traps first (project scope traps before global)
2. Summarize each reviewed card's title, severity, `avoid`, and `do_instead`
3. If any reviewed card is highly relevant, or has `critical`/`error` severity and is plausibly related, and you are about to edit code, run the CLI `next_action.command`; with MCP, call `get_trap` with the card's `id` and `scope` before proceeding
4. If no results, tell the user (this is a new area with no recorded pitfalls yet)

## Example

User: "I need to add a new API endpoint"
→ Search: `codetrap search "API endpoint" --mode hybrid --json`
→ Results show: "Don't use axios, use fetchWrapper" (project, error)
→ Tell user: "I see a project convention: always use fetchWrapper instead of axios. I'll follow that."
