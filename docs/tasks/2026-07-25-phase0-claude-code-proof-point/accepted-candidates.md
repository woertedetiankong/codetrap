# Phase 0 accepted lessons (sanitized)

All 16 review clusters were approved by the user as a **blanket approval** on
2026-07-25 — not as 16 separately adjudicated decisions. See `metrics.md` for
why that distinction changes what these numbers can be used for.

Private project identifiers are replaced with stable aliases
(`Project-A` = primary mining corpus, `Project-B`/`Project-C` = repeat-run
projects). Verbatim evidence excerpts are **not** reproduced here; they stay
in the gitignored `evidence/` directory. Frequencies are retained because they
carry no private content.

These are the inputs to Phase 1A, which must push at least one of them
end-to-end through stage -> review -> authorize -> commit -> search.

| # | Lesson | Kind | Dest | Conf | Runs | Harness |
|---|---|---|---|---|---|---|
| 1 | Throwaway Node scripts in the session scratchpad cannot resolve the project's node_modules | trap | trap | high | 4/4 | yes |
| 2 | The visible turn is a pointer: @question.txt / @N.png carry the real instruction | trap | guidance/insight/trap | high | 3/4 | yes |
| 3 | Updating the tracking/plan document is part of finishing the work | trap | guidance/skill/trap | high | 3/4 | no |
| 4 | Edit/Write on a file not Read this session fails, in bursts during batch edits | trap | trap | high | 2/4 | yes |
| 5 | Commit per subsystem, one unit of work per commit | trap | guidance/trap | high | 2/4 | no |
| 6 | sleep-polling is blocked; Monitor is the remedy but its schema must be loaded first | trap | insight/trap | high | 2/4 | yes |
| 7 | Edit old_string matching fails: re-read exact bytes, anchor short and unique, never retry blind | trap | trap | high | 2/4 | yes |
| 8 | This project's living docs exceed the 25k-token Read cap | trap | insight/trap | high | 2/4 | no |
| 9 | Plan first in a document, get approval, then implement | guidance | guidance/skill | high | 2/4 | no |
| 10 | Long build/test commands exceed the 2-minute Bash default and get killed | trap | trap | medium | 2/4 | no |
| 11 | Give plan/review items stable IDs and stop at each unit boundary | guidance | guidance | medium | 2/4 | no |
| 12 | Screenshot-first UI critique: ranked findings, bulk approval, per-subsystem commits | skill | skill | high | 1/4 | no |
| 13 | Report and fix the whole findings list, not a self-selected top-N | trap | trap | high | 1/4 | no |
| 14 | Fan a review backlog into per-lane git worktrees with a fixed merge order | skill | skill | medium | 1/4 | no |
| 15 | Label review findings CONFIRMED vs suspected; reproduce before claiming | guidance | guidance | medium | 1/4 | no |
| 16 | Project-C skills are symlinked live into ~/.claude/skills | insight | insight | medium | 1/4 | no |

---

## 1. Throwaway Node scripts in the session scratchpad cannot resolve the project's node_modules

- **decision:** approved (blanket)  ·  **cluster:** `C01`  ·  **members:** P0-003, P0-017, P0-025, P0-029
- **found by:** 4 of 4 independent runs (failures, human, workflow, repeat)
- **kind / destination hint:** `pitfall_trap` / `trap`
- **harness mechanic:** yes — a toolchain property, not a codebase lesson
- **frequency:** 6 occurrences across 5 sessions incl. one worktree lane (2026-07-08 .. 2026-07-16)
- **confidence:** high

**Trigger** — About to write a throwaway Node script (.mjs/.js) that imports a project dependency — playwright, better-sqlite3, @playwright/test — in order to reproduce a bug, take a screenshot, or probe the database.

**Recommended action** — Put throwaway scripts under the project tree (e.g. `<repo>/scratch-<name>.mjs`, cleaned up afterwards) so Node's upward resolution finds the repo's node_modules — or, if the script must live in the scratchpad, invoke it with the repo as resolution root (`NODE_PATH=<repo>/node_modules node ...`) and confirm the dependency exists before writing the script. For Playwright specifically, also verify the browser binary is installed, not just the package.

**Rationale** — Each failure costs a full write+run turn and produces no diagnostic signal about the actual bug under investigation, and it recurs specifically during visual/UI debugging, which is this project's dominant activity. The scratchpad location is the default the agent reaches for, so the trap fires without any warning sign. Note also that resolving the package is not sufficient: in session <session> the import succeeded and the run still failed with `browserType.launch: Executable doesn't exist at ~/.cache/ms-playwright/<binary>`.

**Risk** — The scratchpad convention is harness-provided, but the failure is a property of this project's on-disk layout (repo on /mnt/d, deps installed only in the repo). Slight over-breadth risk: writing scratch files into the repo can pollute the working tree, so the action must include cleanup or a .gitignore-safe path.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-003` [failures] Write repro/probe scripts inside the repo, not the session scratchpad — /tmp scripts cannot resolve the project's node_modules
- `P0-017` [human] Node scripts in the session scratchpad cannot resolve the project's node_modules
- `P0-025` [workflow] Node verification scripts written to the session scratchpad cannot resolve the project's node_modules
- `P0-029` [repeat] Throwaway .mjs driver scripts fail with ERR_MODULE_NOT_FOUND when they import project deps

---

## 2. The visible turn is a pointer: @question.txt / @N.png carry the real instruction

- **decision:** approved (blanket)  ·  **cluster:** `C03`  ·  **members:** P0-018, P0-023, P0-031
- **found by:** 3 of 4 independent runs (human, workflow, repeat)
- **kind / destination hint:** `unclassified` / `guidance/insight/trap`
- **harness mechanic:** yes — a toolchain property, not a codebase lesson
- **frequency:** observed in 49 of 61 sessions (question.txt), plus the @1.txt/@2.txt variants in 6 more; the convention is self-documented in docs/<handover-doc>.md as of 2026-07-10
- **confidence:** high

**Trigger** — Any turn whose entire visible content is '@question.txt' (or '@1.txt' / '@2.txt'), with or without image attachments.

**Recommended action** — Read question.txt in full at the start of the turn and restate the instruction back in your own words before acting — that restatement is the only copy that survives into the transcript and across compaction. Treat any earlier reference to question.txt in the conversation as stale. When staging commits, exclude question.txt and the @N.png/@N.txt scratch attachments explicitly, and do not report the tree as dirty on their account.

**Rationale** — The pattern exists because the user composes long, structured, carefully-worded prompts in an editor rather than a terminal composer — the two sessions where the full text is visible (<session> L12/L19) are multi-paragraph briefs with explicit constraints like 'Please do not modify any files in this round.' That authoring choice buys prompt quality but costs transcript fidelity and compaction survivability, because the harness records the mention and not the content. The in-repo location is the second-order cost: the prompt channel and the work product share a working tree, so every clean-tree check and every 'commit this' has to know to ignore it.

**Risk** — Highly project-specific — the filename and location would not transfer. Misuse risk: an agent could over-generalize into 'always restate the user's prompt', which is noise when the prompt is inline. The value is specifically in recognizing a file-borne prompt channel and compensating for its non-persistence.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-018` [human] Attachments referenced as @question.txt or @N.png are not files in the repo
- `P0-023` [workflow] The visible human turn is a pointer, not the request: question.txt is the real prompt and it is mutable and in-tree
- `P0-031` [repeat] The user's real instructions arrive in an attached, mutable question.txt / 1.txt

---

## 3. Updating the tracking/plan document is part of finishing the work

- **decision:** approved (blanket)  ·  **cluster:** `C05`  ·  **members:** P0-012, P0-021, P0-032
- **found by:** 3 of 4 independent runs (human, workflow, repeat)
- **kind / destination hint:** `pitfall_trap` / `guidance/skill/trap`
- **harness mechanic:** no
- **frequency:** said as a separate follow-up turn in 6 separate sessions across 6 days (2026-07-05 <session> L1331, 2026-07-05 <session> L92 'fix the toolchain filter and update the doc', 2026-07-07 <session> L716, 2026-07-08 <session> L219, 2026-07-09 <session> L1305 '...and update CODE_REVIEW.md', 2026-07-10 <session> L118 'go ahead and update the doc(s) for me')
- **confidence:** high

**Trigger** — When you finish implementing items that came from a tracking document in this project (docs/CODE_REVIEW.md, UI_REVIEW.md, FIX_PLAN.md, docs/<handover-doc>.md, docs/<integration-doc>.md, docs/UI_OVERHAUL_PLAN.md) -- i.e. any time the task list you just worked from lives in a repo Markdown file.

**Recommended action** — Treat the source document as part of the deliverable: after implementing items from a tracking doc, immediately edit that doc to mark the completed items done, record what was actually shipped versus deferred, and note anything discovered that changes the remaining items -- then report. Do this in the same turn as the implementation, before the user has to ask, and include the doc edit in the relevant commit.

**Rationale** — The user's whole workflow reloads state from these docs at the start of the next session (sessions routinely open with '@docs/CODE_REVIEW.md @question.txt'). A doc that lags the code silently corrupts the next session's plan -- the agent re-proposes finished work or skips deferred work. The extra round-trip the user is forced into is pure waste and it recurs on almost every review-driven session.

**Risk** — Misuse risk if generalised into 'always update docs' -- that would produce doc churn on unrelated tasks. It must stay scoped to the specific case where the work items were READ FROM a tracking doc in this repo. Staleness risk is low but the named file list will drift as the project renames docs, so the trigger should key on 'the doc you took the task list from' rather than on the hardcoded filenames.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-012` [human] Update the tracking Markdown doc as part of finishing the work, not after being asked
- `P0-021` [workflow] The review document is the cross-session ledger — write completions back before the session ends
- `P0-032` [repeat] The plan/roadmap document is a deliverable of every slice, not just its input

---

## 4. Edit/Write on a file not Read this session fails, in bursts during batch edits

- **decision:** approved (blanket)  ·  **cluster:** `C02`  ·  **members:** P0-006, P0-027
- **found by:** 2 of 4 independent runs (failures, repeat)
- **kind / destination hint:** `pitfall_trap` / `trap`
- **harness mechanic:** yes — a toolchain property, not a codebase lesson
- **frequency:** 53 occurrences across 24 of 61 sessions (2026-07-02 .. 2026-07-16); worst single sessions had 5
- **confidence:** high

**Trigger** — About to emit two or more Edit/Write calls in one tool block, or about to edit a file discovered via Grep/Glob rather than opened with Read.

**Recommended action** — Before composing a multi-file edit block, issue the corresponding Reads as one parallel batch and wait for them. Treat Grep/Glob hits, plan-document references and prior-session knowledge as insufficient: only an in-session Read of that exact path unlocks Edit. When fixing a numbered list of findings ('fix all of these'), Read all target files up front rather than interleaving read/edit per finding.

**Rationale** — The burst structure is the actionable part — the agent is not forgetting one file, it is batching edits on a set of files it never opened, so a single habit change (batch the Reads first) removes 2-5 failures at a time. The failures cluster in exactly the sessions where the user says 'fix all of these' or 'apply all three fixes', i.e. multi-file remediation passes, which is this project's most common work shape.

**Risk** — Harness mechanic — a restatement of the Read-before-Edit rule if framed naively. Its value depends entirely on keeping the batch framing ('Read the whole set before the edit block'), not the bare rule. Low staleness risk but also low novelty; the user should see it labelled as toolchain behaviour, not a property of their codebase.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-006` [failures] Read every file in a parallel Edit batch first — edit-before-read failures arrive in bursts
- `P0-027` [repeat] Edit/Write on an unread file fails; the failure arrives in bursts during batch edits

---

## 5. Commit per subsystem, one unit of work per commit

- **decision:** approved (blanket)  ·  **cluster:** `C04`  ·  **members:** P0-010, P0-011
- **found by:** 2 of 4 independent runs (failures, human)
- **kind / destination hint:** `pitfall_trap` / `guidance/trap`
- **harness mechanic:** no
- **frequency:** 'per subsystem' said verbatim in 6 separate sessions across 5 days (2026-07-09 <session> L1305, 2026-07-12 <session> L737, 2026-07-12 <session> L837, 2026-07-13 <session> L377, 2026-07-13 <session> L400, 2026-07-14 <session> L906); plus the 'Commit after each phase' standing instruction re-sent 3 times in the 2026-07-03/04 FIX_PLAN run (<session> L597)
- **confidence:** high

**Trigger** — When the user asks to commit work on the Project-A project, or when you are about to run `git commit` after finishing a batch of changes that touched more than one subsystem/area.

**Recommended action** — Before committing, group the working tree by subsystem/area (e.g. runtime, data, routes, UI panels, docs, vendored <vendored-dep>/) and produce one commit per group, in dependency order. Do this by default when the user says 'commit this' -- do not wait for the 'per subsystem' qualifier. If the change genuinely touches only one subsystem, say so explicitly rather than silently producing one commit. If the work was driven by a phased plan document, commit at each phase boundary instead of at the end.

**Rationale** — The user reviews history per subsystem and needs to revert or bisect one area without dragging in unrelated changes; a monolithic commit destroys that. The cost of getting it wrong is high because it is expensive to undo -- once the commit is made the user must ask for a reset and re-split, which is exactly the churn visible in the corpus. Restating this six times is strong evidence the default behaviour is wrong for this repo.

**Risk** — Over-breadth: this is evidenced only for the Project-A repo and its lane worktrees, so it should be scoped to that project rather than promoted as a global commit convention. There is one counter-signal -- on 2026-07-08 during a lane merge the user said 'let's go with a squash commit' (<session> L426) -- so the rule must not override an explicit squash request in a merge context. Mild staleness risk if the repo is ever restructured so that 'subsystem' boundaries stop being meaningful.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-010` [failures] Default to per-subsystem commits in this repo — the user asks for it every time
- `P0-011` [human] Split each unit of work into its own commit, scoped per subsystem

---

## 6. sleep-polling is blocked; Monitor is the remedy but its schema must be loaded first

- **decision:** approved (blanket)  ·  **cluster:** `C07`  ·  **members:** P0-001, P0-002, P0-026
- **found by:** 2 of 4 independent runs (failures, workflow)
- **kind / destination hint:** `pitfall_trap` / `insight/trap`
- **harness mechanic:** yes — a toolchain property, not a codebase lesson
- **frequency:** 9 occurrences across 9 distinct sessions (2026-07-03 .. 2026-07-16); every single one blocked
- **confidence:** high

**Trigger** — About to wait for a long-running command, a backgrounded task output file, or a dev server to come up — i.e. any Bash call whose first token is `sleep`.

**Recommended action** — Do not emit `sleep` as a wait primitive. To wait for a condition, use Monitor with an until-loop (`until <check>; do sleep 2; done`). To wait for something you started, launch it with `run_in_background: true` and let the completion notification arrive. Never chain shorter sleeps to work around the block.

**Rationale** — Each blocked call is a fully wasted turn that produces no observation, and the failures cluster in the exact moments where the agent is already blocked on slow work (test suites, dev servers, Playwright runs) — so the cost compounds with the latency it was trying to absorb. The harness error text already states the fix verbatim; the failure is purely one of recall at the moment of composing the Bash call.

**Risk** — Pure harness mechanic — will go stale if the sleep block is ever removed or relaxed. Over-breadth risk is low: the rule is narrowly scoped to `sleep` used as a wait primitive, not to `sleep` inside a legitimate until-loop.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-001` [failures] Never poll a background task with `sleep N && cat ...` — the harness blocks it every time
- `P0-002` [failures] Load Monitor's schema via ToolSearch before calling it — the recommended remedy fails without it
- `P0-026` [workflow] Long builds here dead-end twice: the 2-minute Bash cap pushes you to background, sleep-polling is blocked, and Monitor's schema is not loaded

---

## 7. Edit old_string matching fails: re-read exact bytes, anchor short and unique, never retry blind

- **decision:** approved (blanket)  ·  **cluster:** `C08`  ·  **members:** P0-005, P0-007, P0-008, P0-028
- **found by:** 2 of 4 independent runs (failures, repeat)
- **kind / destination hint:** `pitfall_trap` / `trap`
- **harness mechanic:** yes — a toolchain property, not a codebase lesson
- **frequency:** 16 occurrences across 10 sessions (2026-07-05 .. 2026-07-16); at least 7 are on docs/*.md or skill frontmatter
- **confidence:** high

**Trigger** — At the end-of-session 'update the doc' step — editing docs/CODE_REVIEW.md, docs/<handover-doc>.md, docs/<integration-doc>.md, docs/<prototype>.html or a skill's YAML frontmatter — particularly when the file was earlier too large to Read whole, or when working from a compacted-context summary.

**Recommended action** — Before any Edit to these documents, grep for a short, distinctive anchor (a heading, an ID like `P6`, a field name), Read a narrow window around the hit with offset/limit, and copy old_string verbatim from that fresh read. Keep old_string to the shortest uniquely-identifying span — one line where possible — instead of a multi-line prose block. If the file has changed since your last read, re-read even if you believe you wrote the current content yourself.

**Rationale** — These documents are the project's handover state and are edited in nearly every session, so a failed edit here is both frequent and late in the session when context is most degraded. Long prose old_strings are the worst possible match key: they are exactly the text most likely to have been reflowed, re-worded, or summarised in the agent's context. The harness message spells out the fix ('Re-read the file and copy the exact surrounding text') and it was still repeated across 10 sessions.

**Risk** — The 'reconstructed from summary' causal claim is an inference from the shape of the failing strings (long prose, session-late timing) rather than something the digest states directly. The repo lives on /mnt/d (a Windows mount) and one session explicitly worked a `.gitattributes` issue, so CRLF could contribute to some matches failing — that hypothesis is unverified and should not be baked into the lesson.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-005` [failures] Re-read the exact bytes before editing a living doc — never reconstruct old_string from summary or grep output
- `P0-007` [failures] Do not queue several Edits to one file in a single block — the file is rewritten after each write
- `P0-008` [failures] Anchor edits to hook-return field lists — the same field block appears twice in one file
- `P0-028` [repeat] Retrying a failed Edit with the same long multi-line old_string fails again

---

## 8. This project's living docs exceed the 25k-token Read cap

- **decision:** approved (blanket)  ·  **cluster:** `C09`  ·  **members:** P0-004, P0-024
- **found by:** 2 of 4 independent runs (failures, workflow)
- **kind / destination hint:** `pitfall_trap` / `insight/trap`
- **harness mechanic:** no
- **frequency:** 7 occurrences across 5 sessions (2026-07-09 .. 2026-07-11), all on user-attached docs/*.md and docs/<prototype>.html
- **confidence:** high

**Trigger** — About to Read one of this project's long-lived status documents — docs/CODE_REVIEW.md, docs/<handover-doc>.md, docs/<prototype>.html, docs/UI_REVIEW.md — especially at session start when the user's turn is just `@docs/CODE_REVIEW.md @question.txt`.

**Recommended action** — For these specific files, do not issue a bare Read. Either grep for the section anchor first and then Read with `offset`/`limit` around the hit, or read in explicit windows. Get the line count (`wc -l`) before deciding. Assume any file under docs/ that the user attaches by name is oversized until proven otherwise.

**Rationale** — The rejection wastes the session's opening turn and, worse, pushes the agent into working from grep fragments and its own summary of the document — which is the direct upstream cause of the separate edit-string-not-found cluster on those same files. Reading in windows costs the same tokens but yields exact text the agent can later match against.

**Risk** — Staleness: the specific files may shrink or be split. File attribution is inferred from tight adjacency to the user's @-attachments rather than from a recorded filename in the digest — the token counts and timing make the mapping near-certain for the three cited cases but it is an inference. The 25k cap itself is a harness constant.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-004` [failures] This repo's living docs blow the 25k-token Read cap — grep or offset/limit them, never Read whole
- `P0-024` [workflow] The single-file HTML prototype buys zero-build previewability and pays for it in unreadable, unpatchable source

---

## 9. Plan first in a document, get approval, then implement

- **decision:** approved (blanket)  ·  **cluster:** `C11`  ·  **members:** P0-015, P0-022
- **found by:** 2 of 4 independent runs (human, workflow)
- **kind / destination hint:** `unclassified` / `guidance/skill`
- **harness mechanic:** no
- **frequency:** FIX_PLAN-driven phase execution across 6 sessions (<session>, <session>, <session>, <session>, <session>, <session> on branch fix-plan); phase-number resumption in 7eefea7b; multi-hour sessions in at least 6 sessions, including one 10h21m and one 8h55m window.
- **confidence:** high

**Trigger** — Work is being driven from a multi-phase plan document (FIX_PLAN.md and similar), or a session is expected to run for hours.

**Recommended action** — When handed a phased plan: execute one phase at a time and commit at each phase boundary before starting the next, even if the user did not repeat the instruction this turn. Name the phase in the commit subject so 'continue phase N' is answerable from git log alone. Do not batch multiple phases into one commit to save time — the commit boundary is the recovery point, not a tidiness preference.

**Rationale** — In this project the session is the unstable unit and the repository is the stable one. Context exhaustion is not an edge case (one session's own compaction summary documents it, and multi-hour single-turn sessions are routine), so anything held only in conversation is expected to be lost. Committing at each phase converts in-context progress into repository state, which is the only thing a fresh session can read; that is precisely what makes 'continue phase 7' a sufficient prompt. The corollary is that a long uncommitted run is a strictly worse failure mode here than a slightly noisier git history.

**Risk** — Commit-per-phase is only safe when phases are independently green; a plan with phases that only compile together would produce broken checkpoints. Should be stated as 'commit at each phase that passes the build' rather than unconditionally.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-015` [human] Write the plan to a Markdown doc and get approval before touching code
- `P0-022` [workflow] Phase-gated plan execution with a commit per phase, because sessions outlive the context window

---

## 10. Long build/test commands exceed the 2-minute Bash default and get killed

- **decision:** approved (blanket)  ·  **cluster:** `C06`  ·  **members:** P0-009, P0-030
- **found by:** 2 of 4 independent runs (failures, repeat)
- **kind / destination hint:** `pitfall_trap` / `trap`
- **harness mechanic:** no
- **frequency:** 6 occurrences across 5 sessions (2026-07-04 .. 2026-07-10); a further 2 kills at exit 144 in session <session> on 2026-07-11
- **confidence:** medium

**Trigger** — About to run this project's full verification chain in the foreground — `npm test` / the whole vitest suite, `next build`, or a chained `tsc && test && build` pre-commit check.

**Recommended action** — Run the full suite with `run_in_background: true` and collect the result from the completion notification, or raise `timeout` explicitly to a value above the suite's real runtime. Do not chain tsc, the suite and the build into one foreground command: run the fast checks in the foreground and background the slow one, so a kill never destroys results that had already succeeded.

**Rationale** — A killed run yields no pass/fail signal at all, so the agent either re-runs (another 2 wasted minutes) or proceeds to commit on unverified code. Chaining makes it worse by discarding the cheap checks' output along with the expensive one. Backgrounding costs nothing and the harness re-invokes on exit.

**Risk** — The 2-minute default is a harness constant; the project-specific part is that this repo's suite genuinely exceeds it. Only the <session> occurrence identifies the command as the full suite — the other kills are recorded without their command line, so the 'full suite' attribution is partly inferred. Staleness if the suite is sped up or split.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-009` [failures] Background the full test suite — it exceeds the 2-minute Bash default and gets killed at exit 143
- `P0-030` [repeat] Project-B build/QA commands exceed the default 2-minute Bash timeout

---

## 11. Give plan/review items stable IDs and stop at each unit boundary

- **decision:** approved (blanket)  ·  **cluster:** `C10`  ·  **members:** P0-016, P0-033
- **found by:** 2 of 4 independent runs (human, repeat)
- **kind / destination hint:** `pitfall_trap` / `guidance`
- **harness mechanic:** no
- **frequency:** ID-referencing or 'continue with <unit>' turns in at least 8 separate sessions across 10 days (2026-07-04 <session> L614 'continue'; 2026-07-05 <session> L589; 2026-07-05 <session> L901 'continue phase 7'; 2026-07-07 <session> L223 and L515 'gohead DATA-05'; 2026-07-08 <session> L34 'fix ARCH-01'; 2026-07-08 <session> L149/L526/L809 slices 2-4; 2026-07-09 <session> L253/L318/L374; 2026-07-11 <session> L289 'fix the four P1s' then L427 'fix the P2s too'; 2026-07-10 <session> L724 'continue')
- **confidence:** medium

**Trigger** — When authoring a multi-item plan or review document for this user, and when you have just finished one named item from such a document.

**Recommended action** — When you write a plan or review, assign every item a short stable ID (ARCH-01, DATA-04, P1/P2, slice N, phase N) and keep those IDs unchanged across document revisions so the user can reference them in later sessions. After completing one named item, stop, report what changed and what it verified, and wait -- do not chain into the next item unless the user asked for the whole batch.

**Rationale** — Stable IDs are what make his terse driving prompts ('gohead DATA-05') resolvable at all, including across session boundaries where the doc is re-attached from scratch. Renumbering items on a doc revision silently breaks his references. Rolling past a unit boundary removes his inspection point -- and since he reviews visually by attaching screenshots of the running UI, he needs the run to pause so he can look.

**Risk** — Real tension with the 'fix the whole list, not a top-N' trap: that one says do all the findings, this one says stop at unit boundaries. The reconciliation -- report ALL findings but EXECUTE in checkpointed units -- is my inference from the two patterns coexisting, not something the user ever stated, so the two lessons should be staged together and reviewed together or one will contradict the other in practice. The 'stop and wait' half is also inferred from the user's 'continue' turns rather than from an explicit complaint about running ahead; the 'stable IDs' half is directly evidenced.

Grouped members (kept distinct; merge remains a Phase 1 decision):

- `P0-016` [human] Give plan and review items stable IDs, then stop at each unit boundary
- `P0-033` [repeat] Project-B work is gated one lettered <plan-doc>.md milestone per turn

---

## 12. Screenshot-first UI critique: ranked findings, bulk approval, per-subsystem commits

- **decision:** approved (blanket)  ·  **cluster:** `C13`  ·  **members:** P0-020
- **found by:** 1 of 4 independent runs (workflow)
- **kind / destination hint:** `unclassified` / `skill`
- **harness mechanic:** no
- **frequency:** 26 of 61 sessions open a turn with @N.png/@N.webp attachments; the 'commit per subsystem' close appears verbatim in 6 sessions (<session>, <session>, <session>, <session>, <session>, <session>); bulk-approval imperatives appear in ~12 sessions across 2026-07-02 through 2026-07-16.
- **confidence:** high

**Trigger** — A session (or a mid-session turn) opens with one or more rendered screenshots plus a prompt file — the '@1.png @2.png ... @question.txt' shape.

**Recommended action** — On a screenshot-opened turn: do not edit yet. Produce a numbered, severity-ranked findings list (P1/P2 or ARCH-/DATA- style IDs), with each finding tagged to a subsystem, and offer explicit lettered options where a design decision is genuinely open. Then wait. On approval, execute the whole list in the stated order in one pass. Finish by splitting the working tree into one commit per subsystem rather than a single omnibus commit, and expect a follow-up screenshot round on the same surface.

**Rationale** — The bulk-approval phrasing tells you what the user is buying: they are outsourcing triage, not execution choice. Asking 'which of these should I do first?' spends a turn re-deriving something they already delegated, and fixing one finding at a time forces an extra screenshot round per finding. The 'per subsystem' close exists because a batch of unrelated UI fixes lands as one dirty tree; splitting it at commit time is the only point at which the changes can still be attributed to the subsystem they belong to, which is what makes the review documents (see the review-ledger lesson) reconcilable against git history later.

**Risk** — Staleness: the ranking convention (P1/P2 vs ARCH-/DATA- IDs) is document-specific and may drift. Misuse risk: 'bulk approval' should not be read as licence to skip the diagnosis beat — the user consistently gets a findings list first, and the one session where the agent tried to act before clarifying ended in a denied tool use (<session> L246).

---

## 13. Report and fix the whole findings list, not a self-selected top-N

- **decision:** approved (blanket)  ·  **cluster:** `C14`  ·  **members:** P0-013
- **found by:** 1 of 4 independent runs (human)
- **kind / destination hint:** `pitfall_trap` / `trap`
- **harness mechanic:** no
- **frequency:** 7 corrective turns across 6 separate sessions and 8 days (2026-07-04 <session> L262, 2026-07-05 <session> L257, 2026-07-09 <session> L330 'fix all of them', 2026-07-11 <session> L427 'fix the P2s too', 2026-07-12 <session> L208 'fix all of these', 2026-07-14 <session> L194 and L527 'Go ahead and fix all of these in your priority order')
- **confidence:** high

**Trigger** — When you have completed a review/diagnosis and are about to propose a remediation scope, or when you catch yourself writing 'I'll fix the top N / the most important ones / the P1s' after finding more issues than that.

**Recommended action** — Present the complete set of findings with a priority ranking and default to fixing all of them in that order. Never silently truncate the remediation list to a 'top N' subset. If some findings genuinely should not be fixed now, list them explicitly with a one-line reason for deferral so the user can override, rather than dropping them from the proposal.

**Rationale** — Truncating the list costs a full extra round-trip every time and, worse, hides findings the user would have wanted acted on -- the two 'too' corrections show he was tracking specific bugs the agent had quietly dropped. Ranking already gives the user the control he needs; filtering on his behalf removes it. The explicit 'not just the top four' correction confirms this is the agent's error, not the user changing his mind.

**Risk** — Over-breadth is the main hazard: read literally this could push an agent to fix everything it ever finds, including out-of-scope refactors, on any project. It must be scoped to 'the findings list you just produced for the user' and must not become licence to expand scope beyond the review. Also note the corpus does not show whether the agent's truncation was ever justified by size, so the rule should still allow explicit, reasoned deferral -- just not silent dropping.

---

## 14. Fan a review backlog into per-lane git worktrees with a fixed merge order

- **decision:** approved (blanket)  ·  **cluster:** `C12`  ·  **members:** P0-019
- **found by:** 1 of 4 independent runs (workflow)
- **kind / destination hint:** `unclassified` / `skill`
- **harness mechanic:** no
- **frequency:** One coordinated fan-out on 2026-07-08 spanning 4 concurrent sessions (main-checkout lane A 12:57-15:55, plus lane-b/c/d worktrees started 13:27/13:29/13:32); the user then persisted the setup as a project-scoped skill file, and a squash-merge session the same morning (<session>, 'let's go with a squash commit') closes the loop.
- **confidence:** medium

**Trigger** — A living review document (CODE_REVIEW.md / UI_REVIEW.md) has accumulated many findings that touch disjoint subsystems, and the user wants them cleared in one sitting rather than serially.

**Recommended action** — When asked to clear a multi-finding review backlog: first partition the findings by subsystem into docs/lanes/LANE-<X>-<topic>.md plus a docs/lanes/README.md that states the shared conventions and the merge order; create one worktree+branch per lane; hand each lane session only its two files. Keep the lane that touches the widest surface in the main checkout. Start each worktree's dependency install immediately and do unrelated work while it runs — the user explicitly said 'Start slice 2 (useDocumentsPanel) here while the installs finish'.

**Rationale** — Worktree lanes work here because the findings are subsystem-scoped (runtime / data / routes) and therefore textually disjoint, so parallel edits do not collide; the cost is that each worktree is a fresh node_modules with native deps (better-sqlite3, node-pty) that must be installed before anything can run — which is why lane-c's first probe script died on 'Cannot find package better-sqlite3' and why the main session deliberately overlapped work with the installs. Fixing the merge order before the lanes start is what makes the disjointness hold: it decides in advance which lane rebases onto which, so no lane has to discover a conflict it cannot resolve without the other lane's context.

**Risk** — Observed as one coordinated burst rather than many repetitions, so 'repeated procedure' rests on the fact that the user formalized it into a reusable skill file rather than on repeat enactment. Over-breadth risk: worktree fan-out is only worth its install cost when findings are genuinely subsystem-disjoint; applying it to a small or entangled backlog would be pure overhead.

---

## 15. Label review findings CONFIRMED vs suspected; reproduce before claiming

- **decision:** approved (blanket)  ·  **cluster:** `C15`  ·  **members:** P0-014
- **found by:** 1 of 4 independent runs (human)
- **kind / destination hint:** `pitfall_trap` / `guidance`
- **harness mechanic:** no
- **frequency:** said in 2 separate sessions 6 days apart (2026-07-05 <session> L261, 2026-07-11 <session> L384); corroborated by an agent-authored project handover doc quoted in bash output on 2026-07-10 (<session> L312)
- **confidence:** medium

**Trigger** — When writing up bugs, code-review findings, or a diagnosis for this user -- especially in CODE_REVIEW.md / UI_REVIEW.md / FIX_PLAN.md style documents.

**Recommended action** — In every findings write-up, tag each item explicitly as CONFIRMED (reproduced, with the concrete command/observation that reproduced it) or SUSPECTED (reasoned from code reading only), and keep the two groups visually separate. Do not pad the list with speculative items to look thorough, and do not present a code-reading inference in the same voice as a reproduced failure.

**Rationale** — The user's approval step keys off this label -- an unlabelled list forces him to either trust everything or verify everything himself. Mixing speculation into a findings list also burns his review time and erodes trust in the confirmed items. Because he says 'fix all of these' (see the top-N trap), an unlabelled list additionally risks the agent being told to fix things that were never real.

**Risk** — Only two direct human occurrences, and the third evidence item is an agent-authored doc rather than a user statement -- so this is weaker recurrence than candidates 1-3. There is also a possibility the 'confirmed' wording was echoing a label the agent had already introduced in that session, in which case the lesson is 'keep doing this' rather than 'start doing this'; the digest has no assistant turns so I cannot distinguish. Low misuse risk, but it could degrade into ritual labelling if applied without actually attempting reproduction.

---

## 16. Project-C skills are symlinked live into ~/.claude/skills

- **decision:** approved (blanket)  ·  **cluster:** `C16`  ·  **members:** P0-034
- **found by:** 1 of 4 independent runs (repeat)
- **kind / destination hint:** `unclassified` / `insight`
- **harness mechanic:** no
- **frequency:** 1 occurrence, 1 session — but the evidence is a direct filesystem listing, not an inference
- **confidence:** medium

**Trigger** — Modifying, testing, or 'installing' a skill while working in <project-root>

**Recommended action** — Edit skills in place under <project-root> and never copy files into the skills directory or treat the two locations as separate artifacts. Expect edits to be live for subsequent sessions immediately, and treat a broken skill in the repo as a broken installed skill.

**Rationale** — Symlinked installation collapses source and deployed artifact into one file, which inverts the usual mental model in two directions: a build/copy step would be wrong (it would replace the link), and an experimental edit is not sandboxed — it changes the user's actually-loaded toolchain the moment it is written.

**Risk** — Single observation and a layout the user can change at any time; the symlink set is dated 2026-07-03 and may not still be current. Verify with a listing before relying on it. Borderline between insight and guidance since it does imply a concrete do/don't.

---

