# Handoff — The "environmental" test failure was a real product bug

## Result: fixed. The suite is fully green for the first time — 367 pass, 0 fail.

`web API > embedding reindex API refreshes project and global profile status`
had failed on every run this session. I reported it, repeatedly, as
*"pre-existing and environmental — no embedding provider available here"*, and
verified that claim only by reproducing it on a clean `HEAD` worktree. That
confirmed it was not caused by the current change; it did **not** confirm the
diagnosis, and the diagnosis was wrong.

The wide-lens mining run surfaced it as the single most repeated failure in this
project's history (36 occurrences). The user rejected a candidate that proposed
memorialising it, with the reason *"memorialises a defect that should be fixed
instead."* That was the correct call.

## Root cause

The test's fake Ollama server binds `127.0.0.1`. This machine exports
`http_proxy=http://127.0.0.1:7897` with `no_proxy=127.*,localhost`.

**Bun's `fetch` does not honor the `127.*` glob in `no_proxy`.** Measured:

```text
no_proxy="127.*,localhost"      fetch http://127.0.0.1:PORT -> 403
no_proxy="127.0.0.1"            fetch http://127.0.0.1:PORT -> 200
no_proxy="127.0.0.1,localhost"  fetch http://127.0.0.1:PORT -> 200
fetch http://localhost:PORT     (glob form)                 -> 200
```

So the request to a server on this machine was sent to the proxy, which refused
it with a bare `403` and an empty body — no indication a proxy was involved.

## Why this is a product bug, not a test bug

`DEFAULT_OLLAMA_ENDPOINT` is `http://127.0.0.1:11434`.

Any codetrap user who exports `http_proxy` — corporate networks, or anyone
running a local proxy — has their **local Ollama requests routed through the
proxy**. Depending on the proxy they get a `403`, or the request hangs. The
health message told them *"Ollama is not reachable at http://127.0.0.1:11434
(403)"* and suggested `ollama list`, which would have worked fine, sending them
looking in entirely the wrong place.

The test was reporting a genuine defect the whole time. I mislabeled it as
environment noise for the length of this session, and the mining run is what
forced it back into view.

## Fix

`src/lib/loopback-proxy.ts`: before calling an endpoint, if a proxy is
configured and the endpoint's host is loopback, add that **exact host** to
`no_proxy` for this process.

- Covers the whole `127.0.0.0/8` block, `localhost`, `0.0.0.0` and `::1` — not
  just `127.0.0.1`.
- Only ever **adds** entries, and only for loopback hosts, so it cannot widen
  what bypasses a proxy beyond this machine. A remote Ollama still goes through
  the proxy as intended, and there is a test asserting exactly that.
- Glob entries already present are deliberately not treated as covering the
  host, because the clients that ignore them are the reason this exists.

The health check now also names the proxy when a loopback endpoint returns
403/407, turning an opaque failure into a fixable one.

## What I should have done sooner

Reproducing on a clean `HEAD` established *"not caused by this change"* and I
allowed it to stand in for *"not our problem"*. Those are different claims, and
one 30-second probe printing the 500's body would have separated them on day
one. The cost was a red test carried through six phases and a wrong sentence in
five consecutive handoffs.

## The rejected candidate stays suppressed

The lesson said *"this test fails without an embedding provider; confirm on a
clean worktree and report it as pre-existing."* That is now false. Suppressed is
the correct state, not an oversight.

## Tests

`src/tests/loopback-proxy.test.ts` — 8 tests: loopback-range detection, exact vs
glob `no_proxy` matching, idempotence, the no-op when no proxy is set, the
guarantee that a remote host is never excluded, and an end-to-end request that
reproduces the original failure shape. That last one is bounded with an
`AbortSignal.timeout`, because without the fix the request hangs rather than
erroring and would otherwise stall the suite instead of reporting a regression.

Full suite: **367 pass, 0 fail.**
