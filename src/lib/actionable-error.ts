/** Recoverable command failure with explicit inputs/actions for AI clients. */
export class ActionableError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly recovery: {
      missing_fields?: string[];
      next_actions: Array<{ command: string; description: string }>;
    },
  ) {
    super(message);
    this.name = "ActionableError";
  }
}
