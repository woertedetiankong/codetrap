---
name: codetrap-add
description: Record a confirmed coding pitfall as a structured codetrap entry after explicit user approval. For agent-discovered post-flight lessons, prefer codetrap-capture and the session candidate inbox.
---

You are helping the user record a "coding pitfall" (a mistake pattern that AI coding assistants tend to make, and the correct approach). These pitfalls are stored in a local database and will be used to warn AI in future sessions.

This skill writes confirmed memory. Do not use it for autonomous post-flight agent discoveries, repeated failures, or review feedback unless the user explicitly asks to save the trap as confirmed memory. For agent-drafted lessons, prefer:

```bash
codetrap session capture --trap-markdown - --kind review --json
```

## Step 1: Gather information

Ask the user to describe what went wrong. Guide them to provide:

1. **What was the AI asked to do?** (the triggering context)
2. **What did the AI do wrong?** (the mistake)
3. **What should it have done instead?** (the fix)
4. **How serious is this?** (warning / error / critical)

If the user already provided enough detail, don't re-ask — just proceed to structuring.

## Quality gate

Only record stable lessons that are likely to change future AI behavior. Do not save unverified guesses, one-off logs, overly broad advice, or traps without a clear trigger and actionable fix. If the candidate is too vague, ask the user to clarify or suggest keeping it as a note instead of writing it to codetrap.

## Step 2: Determine scope

Ask the user (or infer from context):
- **project**: This pitfall is specific to the current project (e.g., "this project uses fetchWrapper instead of axios")
- **global**: This pitfall applies across all projects (e.g., "never store secrets in frontend code")

If a `.codetrap/` directory exists in the project, default to `project`. Otherwise default to `global`.

## Step 3: Determine category

Pick the best-fitting category:
- `api` — HTTP requests, REST, GraphQL, API design
- `database` — SQL, ORM, migrations, connections
- `auth` — Authentication, authorization, sessions, tokens
- `convention` — Project-specific conventions, naming, file structure
- `security` — Vulnerabilities, secrets, input validation
- `performance` — Bottlenecks, caching, bundle size
- `bug` — Common logic errors, edge cases
- `other` — Everything else

## Step 4: Structure and confirm

Convert the user's description into this JSON structure, show the draft to the user, and ask for explicit confirmation before writing it as confirmed memory:

```bash
codetrap add --json '{
  "title": "<one-line summary>",
  "category": "<category>",
  "scope": "<project|global>",
  "context": "<when does this happen?>",
  "mistake": "<what the AI does wrong>",
  "fix": "<what should be done instead>",
  "tags": ["<tag1>", "<tag2>"],
  "severity": "<warning|error|critical>",
  "path_globs": ["src/example/**"],
  "module": "<optional subsystem>",
  "owner": "<optional team>",
  "before_code": "<wrong code snippet (optional)>",
  "after_code": "<correct code snippet (optional)>"
}' --output-json
```

Only after the user confirms the draft should you call the CLI. If the CLI is not available and the user explicitly confirmed the save, use the MCP tool `add_trap` instead.

## Step 5: Confirm

Tell the user:
- The trap ID and scope
- Suggest running `codetrap stats` to see the growing knowledge base
- Remind them: next time AI works in this area, `/codetrap-check` will catch this pitfall
