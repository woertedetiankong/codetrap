import type { TrapInput } from "../domain/trap";

export function trap(overrides: Partial<TrapInput> = {}): TrapInput {
  return {
    title: "Use fetchWrapper for HTTP requests",
    category: "api",
    tags: ["http", "fetch"],
    scope: "global",
    context: "When making network requests, use the project fetchWrapper.",
    mistake: "Calling fetch or axios directly bypasses retry and error handling.",
    fix: "Use fetchWrapper and follow the HTTP request convention.",
    severity: "warning",
    ...overrides,
  };
}
