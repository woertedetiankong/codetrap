# Candidate Review Visibility

## Mission

Make pending session candidate traps visible enough that humans naturally review them before the lessons are forgotten.

## Context

codetrap already supports `session capture`, candidate quality scoring, conflict checks, and explicit accept/reject/supersede. The current gap is discoverability: candidates can sit in closed sessions without showing up in `doctor`, `session status`, or the default Web review entrypoint.

## Constraints

- Use existing session files as the source of truth.
- Do not change `traps.db`, candidate file schema, or confirmed trap search behavior.
- Do not add batch review actions, daemons, MCP session tools, or embedding/provider work.
- Keep JSON changes additive and backward-compatible.

## Non-Goals

- Automatic candidate acceptance.
- Background notifications.
- New database migrations.
- A redesign of search ranking or semantic embeddings.

## Done Condition

`doctor`, `session status/list`, and the Web review surface clearly expose pending candidate counts, and the ESP32 dogfood session with three pending candidates demonstrates the closed-loop review entrypoint.
