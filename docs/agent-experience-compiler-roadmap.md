# codetrap Mature Product Roadmap: Agent Experience Compiler

Date: 2026-06-22
Status: Product direction / long-term roadmap
Scope: Parent plan for codetrap mature product evolution

This document records codetrap's mature product goals. It is not a single implementation task, nor a commitment for the current release. Future development should treat this document as a parent plan, and then use the implementation-journal to build a task dossier, implementation log, and handoff for each milestone.

This version makes one key conceptual elevation over the original plan:

```text
codetrap does not hardcode "what was learned".
codetrap provides a typed, auditable, reviewable experience compiler layer
that lets AI coding tools such as Codex, Claude Code, and Cursor safely
propose experience candidates.
```

In other words:

```text
Agent / Skill understands the real work history;
codetrap CLI handles evidence, structure, validation, dedup, staging,
  and the durable write gate;
Web Learning Inbox handles human review;
Durable destinations make confirmed experience influence the next agent action.
```

---

## 1. Core Judgment

codetrap should not stop at being a "failure log repository," nor should it bloat into a general-purpose Agent Memory platform. Its mature form should be a local-first, agent-assisted, human-approved **Agent Experience Compiler**.

The mature flywheel:

```text
real work history
  -> agent-native discovery
  -> LessonCandidate drafting
  -> codetrap compiler validation, dedup, staging
  -> Web Learning Inbox review
  -> user confirmation into the right destination
  -> runtime guardrails
  -> next agent is smarter
```

One-line positioning (English):

```text
codetrap compiles real coding-agent work history into human-approved guardrails.
```

One-line positioning (Chinese):

```text
codetrap 把真实 AI 编程协作历史编译成用户批准的下一次行动护栏。
```

More complete product positioning:

```text
codetrap mines real coding-agent work history, lets agents draft reusable lessons,
validates those lessons with evidence and coverage checks, lets humans approve what
becomes durable, and injects approved lessons back into future agent work as traps,
project guidance, skills, custom agents, automations, evals, docs updates, or reviewed skips.
```

Key boundaries:

- codetrap does not own all raw history.
- codetrap only owns experience that is reviewable, durable, and actionable.
- codetrap does not cram every experience into `traps.db`.
- codetrap does not replace the semantic judgment of agents such as Codex, Claude Code, or Cursor.
- The codetrap CLI should not hardcode "what experience is worth saving."
- `.codetrap/sessions` is a candidate and review workspace, not the sole source of experience discovery for the mature product.
- Automation is only responsible for discovery, clustering, drafting, triage, validation, and staging; final durability must be confirmed by the user.

---

## 2. Why Upgrade

Existing codetrap already solves a clear problem: before an agent starts work, it retrieves confirmed traps to avoid repeating mistakes. That direction still holds, but it only covers a small part of experience.

In real usage, more reusable signals appear in user and agent history:

- Project preferences the user repeatedly corrects the agent on.
- The same class of failure recurring across sessions.
- A release, retrospective, debugging, evaluation, or docs-update flow being performed manually many times.
- Tasks that suit delegation to a bounded specialist subagent.
- Periodic checks that should become automation proposals.
- External articles, issues, blogs, or papers exposing pitfalls likely to be hit later.
- Retrieval queries that represent recall behavior worth protecting.
- Content that looks reasonable but is too broad, poorly evidenced, stale, sensitive, or one-off, and should explicitly be skipped.

If every experience is compressed into a trap, the database gets dirty.
If none of these experiences are recorded, the user never feels "the more I use it, the better it understands me."
If the agent directly creates skills, automations, AGENTS patches, or traps, the user loses trust.

The mature product needs a candidate model one layer above the trap: `LessonCandidate`.

---

## 3. Product Principles

### 3.1 codetrap is a compiler, not a brain

The codetrap core should not use fragile keyword rules to decide "what was learned."

It should NOT do:

```text
session contains "test failed" -> auto-create pitfall_trap
session contains "release" -> auto-create skill_candidate
session contains "every day" -> auto-create automation_idea
session contains "AGENTS" -> auto-edit AGENTS.md
```

It SHOULD do:

```text
agent / skill understands history and drafts candidates;
codetrap handles:
- source manifest
- evidence refs
- redaction
- schema validation
- coverage check
- risk flags
- skip archive
- staging review
- durable write gate
```

What may be hardcoded is the product contract and the safety boundary; what should not be hardcoded is the learning judgment.

### 3.2 Explicit trigger, no silent background scanning

Learning review must be explicitly triggered by the user.

Allowed triggers:

```text
$codetrap-learning-review
codetrap learn review --since 30d --limit 10 --dry-run
user clearly says: scan the last 30 days of Codex sessions and generate LessonCandidates
clicking in the Web: Start Learning Review
explicit MCP call: codetrap.learn.review
```

Disallowed triggers:

```text
agent auto-scans history during an ordinary coding task
CLI periodically scans user sessions in the background
Web silently reads Codex history on open
MCP implicitly triggered into a learning review by an ordinary search
```

### 3.3 Dry-run by default, no durable write before user confirmation

The default behavior must be:

```text
generating candidates and reports: OK
writing confirmed traps: not OK
editing AGENTS.md: not OK
installing skills: not OK
creating custom agents: not OK
enabling automations: not OK
polluting eval fixtures: not OK
```

`accepted` does not equal runtime injection.
Only experience that has entered a durable destination and is in a runtime-eligible state may influence the next agent action.

### 3.4 Typed destinations over unified ingestion

The value of the mature product is not "store everything," but "put experience into the right long-term carrier."

---

## 4. Mature Product System

The mature codetrap consists of six systems:

```text
1. Experience Sources
2. Agent-native Discovery
3. Lesson Candidate Layer
4. codetrap Compiler Layer
5. Learning Review Web Workbench
6. Durable Destinations + Runtime Guardrail Injection
```

---

## 5. Experience Sources

Experience sources are divided into first-class sources, agent-native sources, and supplementary sources.

### 5.1 First-class sources

First-class sources are what the mature product should support and validate first:

- Codex local sessions
- Codex task summaries / rollout summaries
- Codex memories, when the user explicitly allows it and the agent can access them
- `.codetrap/sessions`
- existing traps
- pending candidates
- existing skills
- existing custom agents / subagents
- existing automations
- AGENTS / CLAUDE / Cursor rules / project guidance
- docs / roadmap / dogfood log / eval fixtures

### 5.2 Agent-native sources

Some history or context can only be reliably accessed by a specific agent, for example:

- Codex Memories
- Chronicle, if the user enables it
- Codex app internal task summaries
- Claude Code session summaries
- Cursor / Windsurf / other agent local context
- custom skills, subagents, and automations the agent already knows about

The codetrap core should not assume it can read these sources directly. It should support **agent-submitted candidates**:

```text
Agent reads the history it can access
  -> drafts LessonCandidate JSON
  -> calls codetrap learn stage
  -> codetrap does schema, evidence, coverage, risk, staging
```

### 5.3 Supplementary sources

Supplementary sources can enhance discovery, but are not required for the basic mature form:

- user corrections
- review feedback
- test failures / command failures
- external articles, issues, blogs, papers
- cross-tool duplicate work found by Chronicle
- future optional integrations: Slack, Jira, Linear, GitHub Issues, Notion, etc.

Principles:

- Reading these sources is for discovering experience, not for bulk-importing raw history into codetrap.
- No background scanning by default.
- Learning review must be explicitly triggered by the user.
- For sensitive or external sources, prefer storing an evidence pointer, short excerpt, hash, date, and source type instead of copying the full text.
- Broader sources like Chronicle are used for discovery only; important facts should be confirmed back in the relevant source system.

---

## 6. Agent-native Discovery

Agent-native discovery is an important entry point for the mature product.

### 6.1 Why agent-native discovery is needed

codetrap is an experience tool used by AI coding tools. Different agents access history, memory, task summaries, skills, subagents, and automations differently.

Therefore, the codetrap CLI should not be required to understand all sources on its own. A more sensible division of labor is:

```text
Codex Skill / Claude command / Cursor workflow
  -> asks the user for scope
  -> uses the sessions / memories / summaries the agent itself can access
  -> drafts candidates
  -> calls codetrap CLI to stage
```

The codetrap core only owns the stable contract.

### 6.2 Recommended skill entry point

The mature product should provide an explicit skill, for example:

```text
$codetrap-learning-review
```

Responsibilities:

```text
Help the user explicitly trigger a codetrap learning review:
read the Codex sessions / memories / rollout summaries / existing skills / agents / automations
  available within the specified time range,
dry-run generate LessonCandidates,
hand them to the codetrap CLI for validation and staging,
and finally guide the user into the Web Learning Inbox for review.
```

Default parameters:

```text
source: Codex sessions, adding memories / summaries when needed
range: last 30 days, or all available history if shorter
limit: 10 LessonCandidates
mode: dry-run
write_durable: false
output: .codetrap/learning/reviews/<review-id>/
```

If the user has already specified the scope, for example:

```text
read the last 30 days of Codex sessions and dry-run generate 10 LessonCandidates
```

the skill should not ask again; it only needs to confirm the red lines:

```text
I will read the last 30 days of Codex sessions and generate at most 10 LessonCandidates.
This run is dry-run only; results are written to .codetrap/learning/reviews/<review-id>/.
I will not write to traps.db, not edit AGENTS.md, not install any skill, not create any custom agent, and not enable any automation.
```

If the user only says:

```text
run a codetrap learning review for me
```

the skill should briefly ask for scope:

```text
Which range should I scan?
1. Last 7 days
2. Last 30 days (default)
3. Custom start/end dates
4. Last N sessions
```

### 6.3 Security principles for the skill

The learning review skill should only allow explicit invocation and should not be triggered implicitly.

Recommended principle:

```text
allow_implicit_invocation: false
```

Safety rules:

- Do not auto-scan history during an ordinary coding task.
- Dry-run by default.
- Do not write `traps.db`.
- Do not edit `AGENTS.md`, `CLAUDE.md`, or Cursor rules.
- Do not install or modify skills.
- Do not create or modify custom agents / subagents.
- Do not enable automations.
- Do not copy full Codex session transcripts into codetrap.
- Store only the source manifest, evidence pointer, short excerpt, hash, date, and necessary metadata.

### 6.4 codetrap-flavored discovery prompt

A generic Codex prompt can be adapted into the upper-layer prompt of a codetrap skill:

```text
Look back over my recent work from the requested range, defaulting to the last 30 days
or all available history if shorter, and identify reusable lessons worth staging for
codetrap review.

Use available evidence in this order:
- Recent Codex sessions and task summaries.
- Codex Memories and rollout summaries, when explicitly available, to find patterns repeated across sessions.
- Chronicle, if enabled, for discovery only; confirm important details in the relevant source system when possible.
- Existing traps, pending candidates, AGENTS/CLAUDE/Cursor guidance, skills, custom agents, automations, docs, and eval fixtures,
  so you reuse or extend what already exists instead of duplicating it.

Look broadly for lessons that are repeated, costly, error-prone, context-heavy,
or likely to improve future agent behavior.

Choose the smallest appropriate LessonCandidate type:
- pitfall_trap: repeated failure or misuse pattern.
- project_convention: stable project or team preference.
- skill_candidate: reusable workflow or playbook.
- custom_agent_candidate: bounded specialist role or investigation task suitable for delegation.
- automation_idea: scheduled or recurring check, report, reminder, or monitor.
- search_eval_case: query or recall behavior that should be protected.
- docs_guidance: README, roadmap, install docs, or agent guidance update.
- skip: too one-off, ambiguous, sensitive, broad, risky, or poorly evidenced.

First produce a compact shortlist with:
- candidate title
- type
- trigger
- lesson
- recommended action
- supporting evidence and dates
- frequency / confidence
- existing coverage
- risk
- recommended destination
- why it is or is not worth staging

Stage only high-confidence missing proposals.
Do not write traps.db.
Do not edit AGENTS.md.
Do not install skills.
Do not create custom agents.
Do not enable automations.
Do not merge eval fixtures.
Do not create speculative, overlapping, or overly broad assets.

Finish with:
- what was staged
- what was deliberately skipped
- what needs more evidence before packaging
- confirmation that no durable destination was modified
```

---

## 7. Lesson Candidate Layer

The mature product should introduce the higher-level concept `LessonCandidate`. A trap is one kind of lesson, not the whole of it.

### 7.1 Candidate types

| Type | Applicable scenario | Recommended destination | Red line |
|---|---|---|---|
| `pitfall_trap` | failure mode, misuse pattern, a pit that is easy to step on repeatedly | confirmed trap + evidence + lifecycle | do not auto-write `traps.db` |
| `project_convention` | project preference, team norm, boundary constraint | AGENTS/CLAUDE/Cursor guidance patch proposal | do not silently edit agent guidance |
| `skill_candidate` | repeated workflow, SOP, reusable playbook | staged skill draft | do not auto-install, do not auto-trigger |
| `custom_agent_candidate` | bounded specialist role, investigation task, delegable role | custom subagent proposal | do not auto-create or enable subagent |
| `automation_idea` | periodic check, report, reminder, monitor | automation proposal | do not auto-enable, no external side effects |
| `search_eval_case` | query/case whose retrieval quality must be protected | eval candidate / fixture proposal | do not pollute fixtures, no ordinary no-results |
| `docs_guidance` | README, roadmap, install docs, agent guidance that needs updating | docs patch proposal | do not write temporary ideas as long-term facts |
| `skip` | generic knowledge, one-off task, insufficient evidence, too risky | skip record / archive reason | do not let low-quality candidates keep reappearing |

### 7.2 Minimum fields per candidate

Each `LessonCandidate` must at least express:

```text
id
schema_version
title
type
status
trigger
lesson
recommended_action
evidence
source_manifest_refs
frequency
confidence
coverage
risk
recommended_destination
runtime_eligibility
created_at
updated_at
```

Field semantics:

- `title`: one-line summary.
- `type`: recommended candidate type.
- `trigger`: when it should be recalled.
- `lesson`: what was learned.
- `recommended_action`: what the agent should do next time.
- `evidence`: sources, dates, snippets, related files, session/ref id, hash.
- `source_manifest_refs`: points to the list of sources used by this review.
- `frequency`: number of occurrences or repeated signal.
- `confidence`: confidence level.
- `coverage`: whether it is already covered by a trap, pending candidate, AGENTS, CLAUDE, Cursor rules, skill, custom agent, automation, docs, eval, or skip.
- `risk`: misuse, overly broad, stale, privacy, sensitive, external-side-effect risk.
- `recommended_destination`: recommended long-term carrier.
- `runtime_eligibility`: whether and when it may enter runtime recall.
- `status`: current review status.

### 7.3 Recommended state machine

```text
proposed
  -> edited
  -> staged
  -> accepted
  -> merged
```

Bypass states:

```text
rejected
skipped
superseded
```

State definitions:

- `proposed`: generated by the agent or CLI, not yet reviewed.
- `edited`: the candidate content has been modified by the user or agent.
- `staged`: entered a destination proposal/draft, but with no durable write.
- `accepted`: the user accepts the candidate and its recommended destination, but it has not necessarily been written to a long-term carrier.
- `merged`: written into a long-term carrier with a clear rollback path.
- `rejected`: not adopted; usually not used for noise reduction.
- `skipped`: explicitly archived with a skip reason, used to suppress repeated noise.
- `superseded`: covered by an existing or better new candidate.

Key principle:

```text
accepted does not equal runtime injection.
merged / installed / enabled / fixture accepted is what may become a runtime guardrail.
```

### 7.4 Quality bar

- Experience without a trigger condition cannot become a guardrail.
- Experience without a recommended action cannot enter runtime.
- Content with insufficient evidence should go to skip or watch, not be forced into durability.
- Recurrence is not the only condition; high-cost experience that will clearly recur can also be a candidate.
- Candidates duplicating existing content should merge, supersede, or skip, not be recreated.
- Candidates whose misuse risk exceeds their benefit must not enter runtime.
- Candidates from sensitive sources must go through redaction and explicit confirmation.

---

## 8. codetrap Compiler Layer

The codetrap CLI is the compiler layer, not the brain that makes learning judgments.

### 8.1 What the CLI should own

The CLI should own:

- source discovery, when sources are locally readable files.
- source manifest generation.
- evidence pack generation.
- evidence excerpt length limits.
- redaction / privacy checks.
- LessonCandidate schema validation.
- coverage check.
- duplicate detection.
- risk flagging.
- skip archive.
- staging review directory.
- durable write gates.
- JSON / Web / MCP contract.

### 8.2 What the CLI should not own

The CLI should not hardcode:

- which natural-language summaries are definitely traps.
- which command sequences are definitely skills.
- which date words are definitely automations.
- which project files should definitely modify AGENTS.
- which candidates should definitely enter runtime.
- supporting only Codex.
- reading only the last 30 days.
- generating only 10 entries.

### 8.3 Two review modes

#### Mode A: Pull mode

codetrap reads local sources itself:

```bash
codetrap learn review \
  --source codex-sessions \
  --since 30d \
  --limit 10 \
  --dry-run
```

Suitable for:

- Codex local sessions
- `.codetrap/sessions`
- local dogfood log
- local docs
- agent logs at known paths

#### Mode B: Agent-submitted mode

The agent reads the context it can access, then submits candidates to codetrap:

```bash
codetrap learn stage \
  --review-dir .codetrap/learning/reviews/2026-06-22-codex-30d \
  --candidates lesson-candidates.json \
  --source-manifest source-manifest.json \
  --validate \
  --coverage-check \
  --dry-run
```

Suitable for:

- Codex Memories
- Chronicle
- Codex task summaries
- Claude Code summaries
- Cursor / Windsurf context
- other agent-native memory

#### Mode C: Hybrid mode

codetrap first generates an evidence pack, the agent then drafts candidates, and codetrap finally stages:

```text
codetrap learn evidence-pack
  -> agent drafts lesson-candidates.json
  -> codetrap learn stage --validate --coverage-check
  -> Web Learning Inbox
```

This is the recommended mature form.

### 8.4 Recommended command drafts

Discover sources:

```bash
codetrap learn sources \
  --source codex-sessions \
  --since 30d \
  --json
```

Generate an evidence pack:

```bash
codetrap learn evidence-pack \
  --source codex-sessions \
  --since 30d \
  --out .codetrap/learning/reviews/2026-06-22-codex-30d
```

Direct review:

```bash
codetrap learn review \
  --source codex-sessions \
  --since 30d \
  --limit 10 \
  --dry-run
```

Exact date range:

```bash
codetrap learn review \
  --source codex-sessions \
  --from 2026-05-18 \
  --to 2026-06-18 \
  --limit 10 \
  --dry-run
```

Last N sessions:

```bash
codetrap learn review \
  --source codex-sessions \
  --last-sessions 50 \
  --limit 10 \
  --dry-run
```

Stage agent-generated candidates:

```bash
codetrap learn stage \
  --review-dir .codetrap/learning/reviews/<review-id> \
  --validate \
  --coverage-check \
  --dry-run
```

Open the review:

```bash
codetrap web
```

---

## 9. Learning Review Web Workbench

Web Review should be upgraded from trap-only review into a Learning Inbox.

### 9.1 List view

The list should let users quickly judge:

```text
[type] [title] [confidence] [frequency] [evidence dates] [recommended destination] [coverage] [risk] [status]
```

### 9.2 Detail page

The detail page should show:

- trigger condition.
- candidate lesson.
- recommended action.
- supporting evidence.
- source manifest.
- coverage relationship with existing traps, pending candidates, AGENTS/CLAUDE/Cursor guidance, skills, custom agents, automations, docs, evals, and skip archive.
- recommended destination and rationale.
- risk notes.
- current status and available actions.

### 9.3 User actions

Basic actions:

- accept
- edit
- merge
- supersede
- convert type
- reject
- skip as one-off
- stage proposal

Different types have different confirmation strengths:

```text
pitfall_trap:
  accept -> confirmed trap proposal -> user confirms -> traps.db

project_convention:
  accept -> guidance patch proposal -> user reviews diff -> merge

skill_candidate:
  accept -> staged skill draft -> user installs explicitly

custom_agent_candidate:
  accept -> custom agent proposal -> user creates/enables explicitly

automation_idea:
  accept -> automation proposal -> user enables explicitly

search_eval_case:
  accept -> eval fixture proposal -> user merges into evals explicitly

docs_guidance:
  accept -> docs patch proposal -> user reviews diff -> merge

skip:
  accept skip -> archive reason -> suppress duplicate noise
```

Key UX principles:

- One unified entry, different destinations.
- The Web can review in one place, but cannot ingest into one place.
- The larger the side effect of a destination, the more explicit the confirmation.
- The user should feel they are "approving learning," not "entering data into a database."
- Show low-context candidate cards by default; drill into evidence on demand.
- All durable writes should have a diff, confirmation, and a rollback path.

---

## 10. Durable Destinations

Different experiences enter different long-term carriers.

| Candidate | Durable destination | User confirmation | Rollback path |
|---|---|---|---|
| `pitfall_trap` | `traps.db` confirmed trap + evidence + lifecycle | required | delete / supersede / lifecycle status |
| `project_convention` | AGENTS/CLAUDE/Cursor guidance patch | must review diff | revert patch |
| `skill_candidate` | staged skill/playbook draft | must install | remove skill / disable skill |
| `custom_agent_candidate` | custom subagent / agent config draft | must create/enable | disable / remove agent |
| `automation_idea` | automation proposal | must enable | disable automation |
| `search_eval_case` | eval fixture proposal | must merge fixture | remove fixture / mark obsolete |
| `docs_guidance` | docs patch proposal | must review diff | revert patch |
| `skip` | skip archive reason | accept skip | unskip / reopen |

Red lines:

- Do not auto-write `traps.db`.
- Do not silently edit agent guidance.
- Do not auto-install skills.
- Do not auto-create custom agents.
- Do not auto-enable automations.
- Do not pollute eval fixtures.
- Do not write temporary ideas as long-term facts.
- Do not let low-quality candidates keep reappearing.

---

## 11. Runtime Guardrail Injection

Confirmed experience must be able to influence the next agent job; otherwise it is just notes, not a guardrail.

### 11.1 Runtime injection paths

- Confirmed `pitfall_trap` enters pre-flight search.
- Confirmed `project_convention` enters agent guidance.
- Confirmed `skill_candidate` becomes a triggerable workflow.
- Confirmed `custom_agent_candidate` becomes a delegatable specialist role.
- Confirmed `automation_idea` becomes a recurring action after user approval.
- Confirmed `search_eval_case` protects retrieval quality.
- Confirmed `docs_guidance` improves future human and agent context.
- `skip` records suppress repeated noise.

### 11.2 Runtime eligibility

Each lesson needs an independent field deciding whether it can enter runtime:

```text
runtime_eligibility:
  never
  after_acceptance
  after_durable_merge
  manual_only
```

Recommended defaults:

```text
pitfall_trap: after_durable_merge
project_convention: after_durable_merge
skill_candidate: manual_only until installed
custom_agent_candidate: manual_only until enabled
automation_idea: manual_only until enabled
search_eval_case: never for runtime, yes for eval protection
docs_guidance: after_durable_merge as documentation context
skip: never for runtime, yes for suppression
```

---

## 12. Mature Product Boundaries

Must hold:

- local-first.
- CLI-first.
- Web review as the main review UX.
- MCP optional.
- skill / agent workflow as the trigger and drafting layer.
- user explicitly triggers learning review.
- user explicitly confirms durable writes.
- evidence is traceable.
- source manifest is required.
- coverage check always runs.
- skip is a first-class result.
- low-context action card / candidate card, drill down on demand.

Explicitly not doing:

- not building a general chat memory store.
- not building a whole-codebase RAG.
- not bulk-importing Codex session text into the codetrap database.
- not silently scanning user history in the background.
- not auto-writing confirmed traps.
- not auto-editing AGENTS/CLAUDE/Cursor guidance.
- not auto-installing skills.
- not auto-creating custom agents.
- not auto-enabling automations.
- not saving generic knowledge, motivational summaries, or marketing copy as guardrails.
- not letting low-confidence candidates enter runtime recall.
- not hardcoding Codex-specific capabilities as the sole entry of the codetrap core.

---

## 13. Recommended Evolution Path

This document is not an implementation breakdown, but later development can advance along the following capability layers. Each layer should have a task dossier, implementation log, handoff, and validation evidence.

### Layer A: Product language and data model

Goal: extend the product language from `CandidateTrap` to `LessonCandidate`.

Mature outcomes:

- Docs clearly state the relationship between lesson candidates and trap candidates.
- Existing trap candidates can be seen as the `pitfall_trap` subset of lesson candidates.
- Types, states, quality bar, evidence model, coverage model, risk model, and durable destination semantics are stable.
- Add `custom_agent_candidate` to avoid pushing work suited to a subagent into a skill.

Completion signals:

- Later implementers no longer need to discuss "whether experience must be a trap."
- Web/CLI/skill copy uniformly uses learning candidate / lesson candidate semantics.
- Old trap review keeps working.

### Layer B: Learning Review Trigger

Goal: provide an explicit learning review entry point.

Mature outcomes:

- `codetrap learn review --dry-run` exists.
- A `$codetrap-learning-review` skill or equivalent agent workflow exists.
- The skill asks or confirms the time range: last 7 days, last 30 days, custom dates, last N sessions.
- Dry-run by default.
- No durable destination written before user confirmation.

Completion signals:

- The user can trigger it in one sentence: read the last 30 days of Codex sessions and dry-run generate 10 LessonCandidates.
- The tool clearly states it will not write `traps.db`, not edit guidance, not install skills, and not enable automations.

### Layer C: Experience Mining / Agent-native Discovery

Goal: propose candidates from real Codex work history while allowing agent-native submission.

Mature outcomes:

- Pull mode can read the last N days of available Codex sessions / `.codetrap/sessions` / local docs.
- Agent-submitted mode can receive LessonCandidates drafted by a Codex skill.
- Hybrid mode can first generate an evidence pack, then let the agent draft candidates, and finally have codetrap stage them.
- The tool outputs high-confidence candidates and explicit skips.
- The tool checks existing coverage to avoid duplicate entries.

Completion signals:

- It can propose several editable candidates from real history.
- Each candidate provides source dates, snippets, a source manifest ref, and a recommended destination.
- Each skip has a reason and can be used for noise reduction.

### Layer D: codetrap Compiler Validation

Goal: compile agent-generated candidates into reviewable assets.

Mature outcomes:

- LessonCandidate schema validation.
- evidence refs validation.
- source manifest validation.
- coverage report.
- risk report.
- duplicate / supersede suggestions.
- staging review directory.

Completion signals:

- The agent cannot bypass schema and the durable write gate.
- Low-quality candidates are flagged as skip / low confidence / needs more evidence.
- The Web can read the same set of staged review artifacts.

### Layer E: Learning Inbox

Goal: upgrade Web Review into a unified candidate review console.

Mature outcomes:

- The user can browse all candidate types in the Web.
- The user can edit, convert type, merge, reject, and skip.
- The trap type reuses the existing accept / supersede / conflict review capability.
- Non-trap types enter a proposal/draft first, with no high-risk writes.

Completion signals:

- The Web becomes the user's main entry for managing agent experience.
- The user does not need to hand-write JSON or directly edit internal candidate files.

### Layer F: Durable Destination Workflows

Goal: let different experiences enter the right carrier.

Mature outcomes:

- `pitfall_trap` connects to the existing trap lifecycle.
- `project_convention` generates a guidance patch proposal.
- `skill_candidate` generates a staged skill draft.
- `custom_agent_candidate` generates a custom agent proposal.
- `automation_idea` generates an automation proposal.
- `search_eval_case` enters eval review.
- `docs_guidance` generates a docs patch proposal.
- `skip` records the archive reason.

Completion signals:

- The user can solidify different candidates into different destinations from the same Learning Inbox.
- Each destination has explicit confirmation, a diff, and a rollback path.

### Layer G: Runtime Feedback Loop

Goal: let solidified experience change the next agent behavior.

Mature outcomes:

- pre-flight search consumes confirmed traps.
- agent guidance consumes confirmed conventions.
- skills/playbooks can be triggered by the agent.
- custom agents can be explicitly delegated to.
- automations run after user approval.
- search eval continuously protects recall quality.
- skip archive suppresses repeated noise.

Completion signals:

- The user can see experience accepted in learning review being referenced or triggered in subsequent Codex / Claude Code / Cursor work.
- "The more I use it, the better it understands me" becomes a perceptible product experience.

---

## 14. First Proof Point

The minimal proof is not a full implementation, but running one real-history learning review.

Recommended proof point:

```text
User explicitly triggers:
  $codetrap-learning-review

Skill asks or confirms:
  source = Codex sessions
  range = last 30 days, or all available history if shorter
  limit = 10
  mode = dry-run

System executes:
  read the last 30 days of Codex sessions
  optionally use Codex memories / summaries for repeated-pattern discovery
  generate source manifest
  generate evidence pack
  draft 10 LessonCandidates
  generate skip candidates
  generate coverage report
  stage to .codetrap/learning/reviews/<review-id>/

User review:
  the user is willing to accept / edit / stage at least 3
  each accepted/editable candidate can clearly explain how the next agent behavior will change

Red-line verification:
  0 writes to traps.db before user confirmation
  0 auto-edits to AGENTS/CLAUDE/Cursor guidance
  0 auto-installs of skills
  0 auto-creations of custom agents
  0 auto-enables of automations
  0 auto-pollutions of eval fixtures
```

If this holds, the product flywheel holds:

```text
use -> leave history -> agent discovers experience -> codetrap compiles candidates
   -> user confirms -> smarter next time
```

---

## 15. Falsifier

If most candidates mined from real history take the following forms, then automatic experience mining is not yet mature:

- vague trigger conditions.
- unclear recommended actions.
- insufficient evidence.
- just generic summaries.
- duplicating existing content.
- the user does not want to save them.
- unable to change the next agent behavior.
- misuse risk higher than benefit.
- involving sensitive history but with no redaction.
- the agent can summarize it, but codetrap cannot audit the source.
- pure prompts can create things, but with no review gate.

If the falsifier holds, continue strengthening:

- semi-automatic capture.
- evidence pack.
- coverage check.
- candidate quality scoring.
- skip archive.
- Learning Inbox UX.

Do not push automatic mining or automatic durable writes.

---

## 16. Relationship with Existing Documents / Mechanisms

Existing mechanisms should be preserved and elevated semantically:

- `codetrap session capture`: continue as a low-friction candidate entry; in the long run it can become one source of lesson candidate capture.
- Web Review: evolve from trap review into the Learning Inbox.
- `docs/dogfood-flywheel.md`: the current promotion lanes can serve as a prototype of lesson destinations.
- `codetrap-capture-external`: capturing experience from external articles should become one of the Experience Sources, but the CLI still must not directly crawl the web.
- `docs/codetrap-optimization-roadmap.zh-CN.md`: continues to be the main technical optimization route; this document is the mature product direction roadmap.
- Codex skill / Claude command / Cursor workflow: serves as the agent-native discovery and user-friendly trigger layer, and does not replace the codetrap CLI/Web compiler and review gate.

Misconceptions to avoid:

- `.codetrap/sessions` is not the only source of a user's real history.
- `traps.db` is not the only destination for all experience.
- Web Review is not a pure database management interface, but the interface where the user reviews agent learning.
- A skill is not an auto-installer for durable destinations, but an explicit trigger and drafting workflow.
- The CLI is not a smart brain, but a reusable, testable, auditable compiler layer.
- Codex-specific capabilities cannot become the sole assumption of the codetrap core.

---

## 17. How to Use the implementation-journal Going Forward

Any subsequent milestone implementing this document should:

1. Treat this document as the parent plan.
2. Write the current implementation slice in `docs/tasks/<YYYY-MM-DD>-<slug>/task-brief.md`.
3. Write an `implementation-log.md` for decisions that affect the product model, data model, Web review, or CLI/MCP/skill contract.
4. At the end of each phase, write a `handoff.md` explaining:
   - which capability layer was completed.
   - which red lines are still being honored.
   - how the user can verify that no learning candidate auto-entered a durable destination.
   - whether the source manifest and evidence are traceable.
   - whether the coverage check ran.
   - the next highest-ROI implementation task.
5. Write back to this document or the main roadmap only with status and evidence links, not implementation details.

Suggested task slug examples:

- `lesson-candidate-model`
- `learning-review-trigger-skill`
- `codex-history-learning-review`
- `agent-submitted-lesson-candidates`
- `learning-inbox-web`
- `lesson-durable-destinations`
- `runtime-guardrail-feedback`
- `custom-agent-candidate-destination`

---

## 18. Mature Product Success Criteria

When the mature product holds, it should satisfy:

- After the user has used Codex / Claude Code / Cursor for a while, codetrap can propose evidence-backed learning candidates.
- When the user reviews candidates, at least some of them clearly change future agent behavior.
- The trap database stays high-precision and is not polluted by generic experience.
- The Web Learning Inbox becomes the user's main entry for managing agent experience.
- Confirmed experience can flow back into the next agent job instead of sitting in docs.
- High-side-effect destinations such as skills, custom agents, automations, and guidance patches all have explicit confirmation and rollback paths.
- The skip archive reduces repeated noise.
- The user feels "the more I use it, the better it understands me" while still trusting that the system will not silently read, write, install, or enable things.

---

## 19. Minimal Executable Summary

If you can only remember one sentence:

```text
codetrap does not remember everything itself, nor does it make every judgment for the agent;
it compiles the experience the agent proposes from real work history into reviewable,
traceable, dedupable, durable, and reinjectable guardrails.
```

Minimal architecture:

```text
$codetrap-learning-review
  -> ask/confirm range
  -> agent-native discovery
  -> LessonCandidate shortlist
  -> codetrap learn stage --validate --coverage-check --dry-run
  -> Web Learning Inbox
  -> user-approved durable destination
  -> runtime guardrail
```

Minimal proof point:

```text
last 30 days of Codex sessions
  -> 10 LessonCandidates
  -> at least 3 the user is willing to accept/edit/stage
  -> 0 unconfirmed durable writes
  -> at least 1 referenced or triggered in subsequent agent work
```
