# /goal Prompt

Run `/goal` with this objective:

Implement candidate review visibility for codetrap. Use `goals/candidate-review-visibility/` as the durable source of truth. Make pending session candidate traps visible through `session status/list`, `doctor`, and the Web review entrypoint, using existing session files only. Do not change `traps.db`, candidate file schema, confirmed trap search behavior, MCP session tools, embeddings, daemons, or batch review actions.

Acceptance evidence must include automated tests, typecheck, dogfood eval report, and ESP32 dogfood verification against `/Users/superstorm/Documents/Code/esp32` session `2026-06-04-codetrap-candidate-inbox-test`. Append concrete progress and proof to `goals/candidate-review-visibility/progress.jsonl`.
