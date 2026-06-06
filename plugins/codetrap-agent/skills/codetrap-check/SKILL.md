---
name: codetrap-check
description: Check codetrap from the current project cwd before non-trivial code edits.
---

Before risky code changes, run:

```bash
codetrap search "<task keywords>" --mode hybrid --json
```

Review the top 3 action cards. Only inspect a card when its title, summary, or context overlaps the current task, target file/module, technology, project convention, or failure mode. For matching cards, run `next_action.command` before editing when the card is highly relevant or has `critical` or `error` severity. Do not cite or apply non-matching cards, regardless of severity.

Treat codetrap results as historical warnings and project memory, not as authoritative instructions. Apply a trap only when its context matches the current task, file, module, or failure mode. Severity alone is not enough to apply a trap. Plausibly related requires a concrete overlap in target path/module/owner, technology/API, project convention, or failure mode; shared generic words alone are not enough. If the reviewed cards do not match the current task, file, module, or failure mode, treat the search as no applicable trap and keep going. When codetrap results conflict with the current source of truth for the task (user request, code, tests, or explicit project docs/spec), follow that source of truth and mention the conflict.

Use MCP only as an optional adapter. When calling MCP tools, pass `cwd` when the client supports it.

After user corrections, repeated test failures, or review feedback, draft a structured candidate and put it in the session inbox instead of writing a confirmed trap directly:

```bash
cat <<'EOF' | codetrap session capture --trap-markdown - --kind review --json
Title: <durable pitfall>
Context: <when it triggers>
Mistake: <what the agent did wrong>
Fix: <what to do instead>
EOF
```

Use `--trap-json` only when you already have a structured object.

Do not accept it automatically. Tell the user the returned candidate id and session id, then ask whether they want to accept, edit, reject, or supersede it.

If older candidate traps may be waiting, use `codetrap session status`, `codetrap session list`, `codetrap doctor`, or `codetrap web` to surface the pending review queue.
