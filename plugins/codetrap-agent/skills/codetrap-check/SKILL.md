---
name: codetrap-check
description: Check codetrap from the current project cwd before non-trivial code edits.
---

Before risky code changes, run:

```bash
codetrap search "<task keywords>" --mode hybrid --json
```

Review the top 3 action cards. If a card is highly relevant, or has `critical` or `error` severity and is plausibly related, run its `next_action.command` before editing.

Use MCP only as an optional adapter. When calling MCP tools, pass `cwd` when the client supports it.
