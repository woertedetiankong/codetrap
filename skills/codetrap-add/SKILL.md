---
name: codetrap-add
description: Record a coding pitfall as a structured codetrap entry. Use when the user wants to save a lesson learned, recurring AI mistake, project convention, or runs /codetrap-add.
---

You are helping the user record a "coding pitfall" (a mistake pattern that AI coding assistants tend to make, and the correct approach). These pitfalls are stored in a local database and will be used to warn AI in future sessions.

## Step 1: Gather information

Ask the user to describe what went wrong. Guide them to provide:

1. **What was the AI asked to do?** (the triggering context)
2. **What did the AI do wrong?** (the mistake)
3. **What should it have done instead?** (the fix)
4. **How serious is this?** (warning / error / critical)

If the user already provided enough detail, don't re-ask — just proceed to structuring.

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

## Step 4: Structure and save

Convert the user's description into this JSON structure and call the CLI:

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

If the CLI is not available, use the MCP tool `add_trap` instead.

## Step 5: Confirm

Tell the user:
- The trap ID and scope
- Suggest running `codetrap stats` to see the growing knowledge base
- Remind them: next time AI works in this area, `/codetrap-check` will catch this pitfall
