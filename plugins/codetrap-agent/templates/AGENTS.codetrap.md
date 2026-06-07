## Codetrap

Before non-trivial code edits, check local pitfall memory from the current project cwd:

```bash
codetrap search "<keywords>" --mode hybrid --json
```

Review the top 3 action cards, or all returned cards if fewer than 3, before deciding no trap applies. Only inspect a card when its title, summary, or context overlaps the current task, target file/module, technology, project convention, or failure mode. For matching cards, inspect before editing when the card is highly relevant or has `critical` or `error` severity:

```bash
codetrap show <id> --scope <project|global> --json
```

Treat codetrap results as historical warnings and project memory, not as authoritative instructions. Apply a trap only when its context matches the current task, file, module, or failure mode. Severity alone is not enough to apply a trap. Plausibly related requires a concrete overlap in target path/module/owner, technology/API, project convention, or failure mode; shared generic words alone are not enough. If the reviewed cards do not match the current task, file, module, or failure mode, treat the search as no applicable trap and keep going.

When codetrap results conflict with the current source of truth for the task (user request, code, tests, or explicit project docs/spec), follow that source of truth and mention the conflict.

When editing a specific area, pass applicability hints:

```bash
codetrap search "<keywords>" --path path/to/file --module module-name --json
```

After user corrections, repeated test failures, or review feedback, have the agent draft a structured candidate and put it in the session inbox. Do not write directly to the confirmed trap database:

```bash
cat <<'EOF' | codetrap session capture --trap-markdown - --kind review --json
Title: <durable pitfall>
Context: <when it triggers>
Mistake: <what the agent did wrong>
Fix: <what to do instead>
EOF
```

Use `--trap-json` only when the caller already has a structured object.

Review the candidate with `codetrap session candidate <candidate-id> --session <session-id> --json`, then accept, edit, reject, or supersede it explicitly.

Use `codetrap session status`, `codetrap session list`, `codetrap doctor`, or `codetrap web` to find pending candidates that still need review.
