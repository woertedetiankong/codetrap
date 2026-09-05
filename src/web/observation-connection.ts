import { observationIntegrationStatus } from "../lib/observation-integration";

export interface ObservationConnection {
  state: "not_configured" | "awaiting_run" | "has_records" | "unavailable";
  clients: Array<{ client: "codex" | "claude"; status: "configured" | "not_configured" | "unavailable" }>;
  run_count: number | null;
}

/** Configuration is evidence of installation only, never client trust or execution. */
export function observationConnection(projectRoot: string, runCount: number | null): ObservationConnection {
  const clients: ObservationConnection["clients"] = (["codex", "claude"] as const).map((client) => {
    try {
      const status = observationIntegrationStatus(projectRoot, client);
      return { client, status: status.enabled ? "configured" : "not_configured" };
    } catch { return { client, status: "unavailable" }; }
  });
  const state = runCount === null ? "unavailable" : runCount > 0 ? "has_records"
    : clients.some((client) => client.status === "configured") ? "awaiting_run"
    : clients.some((client) => client.status === "unavailable") ? "unavailable" : "not_configured";
  return { state, clients, run_count: runCount };
}
