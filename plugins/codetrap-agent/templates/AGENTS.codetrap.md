## Codetrap

Before non-trivial code edits, check local pitfall memory from the current project cwd:

```bash
codetrap search "<keywords>" --mode hybrid --json
```

Review the top 3 action cards before deciding no trap applies. If a card is highly relevant, or has `critical` or `error` severity and is plausibly related, inspect it before editing:

```bash
codetrap show <id> --scope <project|global> --json
```

When editing a specific area, pass applicability hints:

```bash
codetrap search "<keywords>" --path src/db/repository.ts --module db --json
```

After user corrections, repeated test failures, or review feedback, propose a new trap. Only write it after user confirmation:

```bash
codetrap add --json '{...}' --output-json
```
