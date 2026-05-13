---
name: codetrap-search
description: Search the pitfall database for known mistakes relevant to the current task
---

Search the codetrap database for recorded pitfalls matching the user's query. Use the MCP tool `search_traps` or the CLI `codetrap search`.

## When to use

- Before writing code in a new area (e.g., "I need to write authentication middleware")
- When the user asks "have we seen issues with X before?"
- When starting a task that resembles something that caused problems in the past

## How to search

### Via MCP (preferred)

Call the `search_traps` MCP tool:
```
search_traps(query="<keywords>", scope=<optional>, category=<optional>)
```

### Via CLI

```bash
codetrap search "<keywords>" [--scope project|global] [--category api|database|...]
```

## How to present results

1. Show the most relevant traps first (project scope traps before global)
2. Summarize each trap's title, severity, and key lesson
3. If results are highly relevant, proactively explain how you'll avoid the pitfall
4. If no results, tell the user (this is a new area with no recorded pitfalls yet)

## Example

User: "I need to add a new API endpoint"
→ Search: `search_traps(query="API endpoint")`
→ Results show: "Don't use axios, use fetchWrapper" (project, error)
→ Tell user: "I see a project convention: always use fetchWrapper instead of axios. I'll follow that."
