# codetrap Web / Session Mode Handoff

Date: 2026-05-25  
Repo: `/Users/superstorm/Documents/Code/windsurf/codetrap`  
Audience: next Codex session continuing codetrap development.

## User Intent And Product Direction

The user is building `codetrap`, a CLI-first local coding pitfall memory bank. The CLI/MCP remain the agent-facing interface. The new Web surface is for human maintainers reviewing candidate traps that were already generated from sessions.

Product decision from this session:

- Web v1 is a human review console, not a full trap admin backend.
- Default Web view should behave like an inbox: show only `proposed` candidates needing review.
- `accepted` / `rejected` candidates are audit history and should be kept, but moved under `Reviewed`.
- If an accepted trap is later deleted from the DB, the reviewed candidate should clearly say something like `accepted -> trap #4 deleted`.
- User strongly prefers a light Codex app / OpenAI docs style over the original dark terminal-like UI.

## Current Local Preview

At handoff time a local Web server is running:

- URL: `http://127.0.0.1:4897/?token=k6I1BBXG_fSprBnTxbf0zf-Z`
- Listener: `bun` PID `27184` on `127.0.0.1:4897`

This is only a live preview convenience. Tomorrow, restart with:

```bash
bun run src/index.ts web --port 4897
```

The command prints a fresh one-time token URL.

## What Was Implemented

### Session / Candidate Trap Mode

New session-domain layer exists in:

- `src/domain/session.ts`
- `src/lib/session-store.ts`
- `src/lib/session-codec.ts`
- `src/lib/session-capture.ts`
- `src/lib/session-conflicts.ts`
- `src/lib/session-operations.ts`
- `src/lib/trap-quality.ts`
- `src/tests/session-cli.test.ts`

Relevant behavior:

- Sessions write files under `.codetrap/sessions/<session-id>/`.
- `session close --propose-traps` generates `candidate-traps.json`.
- Candidate traps stay proposed until accepted.
- Accept writes a real trap through `TrapOperations`, attaches evidence, and records accepted trap id/scope on the candidate.
- Reject records rejection history without writing a trap.
- Conflict detection blocks normal accept unless the user chooses `acceptAnyway` or a supersede flow.
- Candidate draft saving is supported only for `proposed` candidates. It normalizes through the existing trap input builder, recomputes quality, and resets conflict diagnostics.

### Web v1 Candidate Review Console

New Web files:

- `src/web/project-registry.ts`
- `src/web/server.ts`
- `src/web/static.ts`
- `src/tests/web-console.test.ts`

CLI entry:

- `src/index.ts` now routes `codetrap web`.
- Help mentions:
  - `web`
  - `--project <path>`
  - `--host <host>`
  - `--port <n>`
- `package.json` includes `src/web` in build inputs.

Server behavior:

- Uses `Bun.serve`.
- Defaults host to `127.0.0.1`.
- Finds the next available port if requested port is occupied.
- Generates a one-time token and prints a URL like:

```text
http://127.0.0.1:<port>/?token=...
```

- All `/api/*` requests require `X-Codetrap-Token`.
- Static HTML/CSS/JS is bundled as a TypeScript string in `src/web/static.ts`.
- No React/Vite/new runtime dependency was introduced.

Project registry:

- Stored at `~/.codetrap/web-projects.json`.
- Launch cwd or `--project` is auto-added if initialized.
- UI can add a project path manually.
- Paths resolve to the nearest initialized `.codetrap/` project root.
- Uninitialized paths are rejected.

API coverage currently implemented:

- `GET /api/bootstrap`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/sessions`
- `GET /api/candidates`
- `GET /api/trap`
- `POST /api/candidate/save`
- `POST /api/candidate/accept`
- `POST /api/candidate/reject`

Adapter note:

- `src/web/server.ts` returns Web-only candidate review metadata in `candidate.review`.
- For accepted candidates it checks whether `accepted_trap_id` still exists.
- Missing accepted trap returns `review.status = "accepted_missing"` and label `accepted -> trap #<id> deleted`.

### UI State After Latest Product Polish

The UI is a three-column review console:

- Left: projects and sessions.
- Middle: candidate list.
- Right: structured candidate detail form, evidence, quality, conflict/actions.

Latest UX behavior:

- Middle column has `Inbox` / `Reviewed` segmented controls.
- `Inbox` shows only `candidate.status === "proposed"`.
- `Reviewed` shows accepted/rejected candidates.
- After Save/Accept/Reject, the frontend reloads sessions and candidates, so counts and rows update immediately.
- Accepted/rejected candidates are read-only.
- Accepted candidate with deleted trap is shown as `accepted -> trap #4 deleted`.

Visual style:

- Light warm Codex-app-inspired palette.
- Background around `#f7f3ea`, panels around `#fbfaf6` / `#fffdf8`.
- Black primary buttons, subtle beige borders, teal/green accent.
- User explicitly disliked the dark UI; do not revert to dark by accident.

## Demo Data Created During This Session

Created a real preview session:

```text
2026-05-25-web-console-preview-candidate
```

It had candidate `cand-001`, which the user accepted through the Web UI. That wrote project trap `#4`.

The user then asked to delete that test trap. It was deleted with:

```bash
bun run src/index.ts delete 4 --scope project --json
```

Important: the real trap `#4` is gone from the project DB, but the session candidate remains as accepted audit history. The Web UI now shows this under `Reviewed` as `accepted -> trap #4 deleted`.

## Verification Already Run

These passed after the latest Web inbox/reviewed change:

```bash
bun test src/tests/web-console.test.ts
bunx tsc --noEmit
bun test src/tests
bun run build
```

Observed results:

- `src/tests/web-console.test.ts`: 6 pass, 0 fail.
- Full suite: 63 pass, 0 fail.
- `bun run build` produced compiled binaries under `dist/`.
- Browser verification confirmed:
  - `Inbox 0`
  - `Reviewed 1`
  - reviewed row shows `accepted -> trap #4 deleted`.

## Current Worktree State

The worktree is intentionally dirty and contains broad in-progress work. Do not revert existing changes casually.

Tracked modified files shown by `git status --short`:

```text
M CONTEXT.md
M README.md
M codetrap-study-notes-2026-05-15.md
M docs/agent-memory-reference-analysis.md
M docs/codetrap-ascii-architecture.md
M docs/codetrap-optimization-roadmap.zh-CN.md
M docs/installation.md
M docs/session-mode-capture-spec.zh-CN.md
M package.json
M src/commands/workflow.ts
M src/index.ts
M src/lib/command-requests.ts
M src/lib/trap-scope-match.ts
```

Untracked files:

```text
src/domain/session.ts
src/lib/session-capture.ts
src/lib/session-codec.ts
src/lib/session-conflicts.ts
src/lib/session-operations.ts
src/lib/session-store.ts
src/lib/trap-quality.ts
src/tests/session-cli.test.ts
src/tests/web-console.test.ts
src/web/project-registry.ts
src/web/server.ts
src/web/static.ts
```

`git diff --stat` only reports tracked file changes, so it does not include the new untracked files above.

## Suggested Next Session Flow

Recommended skills:

- `codetrap-check`: before further code edits.
- `diagnose`: if continuing any Web refresh / accept-state bug.
- `frontend-design`: for visual refinement of the Web UI.
- `code-review-high`: before commit/PR, because this adds CLI/session/Web behavior.
- `neat-freak`: when ready to reconcile docs before committing.

Good first steps tomorrow:

1. Run `git status --short --untracked-files=all`.
2. Run `bun test src/tests && bunx tsc --noEmit`.
3. Start preview with `bun run src/index.ts web --port 4897`.
4. Manually inspect the Web UI with a fresh token.
5. Decide whether to commit the whole session-mode + Web v1 chunk together, or split into:
   - session candidate lifecycle,
   - Web server/registry/API,
   - Web UI polish.

## Open Product Questions

- Should the Web session list surface pending count directly, not just total candidate/accepted count?
- Should `Reviewed` support filters for accepted/rejected/missing?
- Should accepted candidates link to `GET /api/trap` detail when the trap still exists?
- Should there be a Web action to archive/delete the accepted trap from the reviewed candidate view, or should destructive trap lifecycle stay CLI-only?
- Should the Web UI offer a "hide reviewed" default per user/project persisted in local storage?
- Should deleted accepted traps be represented as candidate metadata only, or should the session candidate support a first-class `accepted_trap_deleted_at` field? Current implementation computes it live from DB state and does not mutate session JSON.

## Technical Follow-Ups

- Consider adding a Web API test for normal accepted candidate with `review.status = "accepted"` and `trap_present = true`.
- Consider browser-level smoke test or scripted DOM test for Inbox/Reviewed behavior.
- Consider making the Web static bundle easier to work on if the single string becomes too large.
- Consider API route for conflict trap detail if UI needs richer conflict comparison.
- Consider graceful server shutdown / no-op interval cleanup if this becomes a long-running command in tests.

## Things Not To Do Accidentally

- Do not scan the whole disk for projects; Web v1 uses manual/recent project registry only.
- Do not let Web create candidate traps; candidates are still produced by session close/propose flows.
- Do not turn Web into the primary agent interface; CLI/MCP stay canonical for agents.
- Do not directly write DB or session JSON from Web routes; keep using `TrapOperations`, `SessionOperations`, and `SessionStore`.
- Do not treat the deleted demo trap `#4` as a missing bug. It is an intentional test of reviewed audit state.
