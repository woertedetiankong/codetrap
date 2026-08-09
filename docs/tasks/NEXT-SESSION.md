# Next Session

Project `D:\llm\codetrap\codetrap` (codetrap). Read
`docs/tasks/2026-08-09-phase4-public-retrieval-benchmark/handoff.md` first.
Previous session: Phase 4A implemented a package-ready synthetic retrieval
benchmark plus a pinned-Bun Windows/Linux clean-runner workflow and JSON report
artifacts. Six focused tests, benchmark verification, npm dry-run, and Windows
builds pass.
Errata: full `bunx tsc --noEmit` still reports three pre-existing Phase 2 type
errors named in the handoff; benchmark tests and builds are green.
Current state: Phase 4A is committed on local `main`, the temporary branch has
been deleted locally, and `main` remains unpushed. Overall Phase 4 remains open
for the first remote workflow run, independent reproduction, and longitudinal
evidence. The final full suite is green at 386 passed, one intentional
browser-smoke skip, and zero failures.
Environment: the benchmark is offline and did not change any user store;
`question.txt` remains user-owned if it reappears.
Now do: 1. push local `main` only when explicitly requested and GitHub
authentication is available 2. verify both GitHub-hosted runner artifacts
3. obtain independent reproduction 4. do not publish Phase 4B metrics without
evidence.
Red lines: do not publish the internal fixture; do not call the proxy a real
embedding score; do not push, npm publish, or create a release without approval.
First verify: `git status --short --branch; bun run benchmark:retrieval -- --verify; bun test src/tests/public-retrieval-benchmark.test.ts`
(expected clean local `main` ahead of `origin/main`, verification passed, and 6 tests passed; a
mismatch means inspect dataset, package, or retrieval drift before continuing).
