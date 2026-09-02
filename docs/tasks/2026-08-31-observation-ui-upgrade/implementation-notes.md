# Observation UI upgrade — implementation notes

Date: 2026-08-31
Scope: Impact (observation) view visual/UX upgrade, slices ①-④ as approved by the user.
Source of design patterns: DeepSeek Harness `ui-trajectory` / `ui-primitives` (local checkout at `D:\llm\codetrap\deepseek-harness`), adapted to codetrap's no-build inline client.

## Goals

1. ① Semantic colors extended beyond 9px dots; timeline rows compressed to one line with expandable facts; relative `+Ns` offsets; drop the two constant pills (evidence_class shown only when != observed_fact; sensitivity moved into the expanded body).
2. ② Overview: compact hero + dsh StatsLine-style strip; zero-valued metric groups drop out entirely (dsh rule); Evidence mix becomes a proportional stacked bar with legend.
3. ③ Mini gantt (single track) above the run timeline with click-to-scroll; StateDot (done/error/ongoing-pulse) for run status in the queue; relative times ("5 min ago") for run start labels.
4. ④ Event category filter chips above the timeline; `trap_id` facts deep-link to Library via existing `jumpToTrap(scope, id)`.

## Constraints discovered (must keep true)

- `web-client-text.test.ts`: zh/en key parity; `.impact-hero`, `.impact-timeline::before`, `.impact-event.human_label::before`, `.impact-metrics { grid-template-columns: repeat(2` must remain in WEB_INDEX_HTML; various `impact.*` keys keep their zh copy.
- `web-browser-smoke.test.ts`: `.impact-hero` contains "What changed while Codetrap was present?"; `.impact-metrics` contains "1"; `.impact-event` count == 6 for the 6-event fixture run; `#detail` contains "Trap search completed"; `#detail` must not contain BROWSER_RAW_SECRET; `.impact-run-meta` == 2 columns at 500px; zero console errors.
- Pitfall trap #9 (project): background polling must not rebuild the scroll surface — keep `impactContentSignature()` free of new UI-only state (event filter must NOT go into the signature); background re-render path unchanged.
- Pitfall trap #20 (project): `impactTabs()` stays rendered in every branch (empty/error/loading included).
- Hash routing: never use raw `#anchor` hrefs (they would corrupt the `#/...` route). Gantt hits use buttons + scrollIntoView.

## Decisions

- Event row = native `<details>/<summary>` (no JS binding needed for expand/collapse, accessible by default).
- Two visual axes: type category drives glyph + glyph color (`cat-search`, `cat-expose`, ...); evidence_class keeps the existing palette and now also drives a 3px left border. Rail dot rules kept (tests + still useful).
- `impactEventFilter` is user state set only by explicit clicks (direct re-render), never part of the content signature.
- Zero-dropout rule applies to: stats-strip groups, metric tiles, evidence-mix legend entries (bar shows only non-zero segments).
- Relative times are computed at render time from wall clock; they may go stale between content changes until the next re-render (accepted; refresh + polling re-render on data change).
- Trap deep link: resolve scope from loaded `state.traps` when possible, else try `project` then `global` via `jumpToTrap`.

## Deviations

1. **Windows smoke-test enable attempt reverted (pitfall trap #7).** The browser smoke test skips on Windows because `chromeExecutablePath()` only lists macOS/Linux paths. I added Windows Chrome paths to make it run locally; the test then hung at `chromium.launch` until the 20s timeout — exactly the failure mode recorded in project trap #7 ("Windows 上使用系统浏览器时，Bun 启动 Playwright 可能会卡住"). Reverted the test change. Verified the same journey with **Node-driven** playwright-core (per the trap's guidance): launch 453ms, full Impact journey 3.8s, zero page errors. The Bun-runtime launch issue is pre-existing and out of scope.

## Verification results

- `bun run typecheck` — clean.
- `bun test src/tests/web-client-text.test.ts src/tests/web-client-script.test.ts src/tests/web-browser-smoke.test.ts` — 20 pass, 1 skip (Windows smoke skip is pre-existing), 0 fail.
- OpenCLI Browser Bridge walkthrough (live project data, EN + ZH):
  - Overview: compact hero (h≈326px at 1280×720 incl. intro), stats strip renders, zero-valued "helpful labels" tile dropped, evidence mix bar + legend render.
  - Run detail: 5 compact event rows with icons/keylines/relative offsets (`+1.9s`), 5 gantt hits, 4 filter chips; expanding "Trap exposed" shows facts + `#7` deep-link button.
  - Interactions: filter chip "Search" → only "Trap search completed" visible; gantt hit (validate) → scrolls, opens, applies `.impact-flash`; trap link → navigates to `#/library`, detail-meta `#7 / project`.
  - Queue: StateDot `done` + relative start time; zero console/page errors throughout.
