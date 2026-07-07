import type { Scope } from "./constants";

export type TrapMutationResult = {
  scope: Scope;
  success: boolean;
  error?: string;
};

export type AddTrapEvidenceResult = TrapMutationResult & {
  evidence_id: number | null;
};

export type ScopedMutationTarget = {
  scope: Scope;
};

export function resolveScopedMutation<TTarget extends ScopedMutationTarget, TExtra extends object>(
  targets: TTarget[],
  opts: { explicitScope: boolean; fallbackScope?: Scope },
  mutate: (target: TTarget) => { success: boolean } & TExtra,
  fallback: () => { success: false } & TExtra
): ({ scope: Scope; success: boolean } & TExtra) {
  for (const target of targets) {
    const result = mutate(target);
    if (result.success || opts.explicitScope) {
      return { scope: target.scope, ...result };
    }
  }
  return { scope: opts.fallbackScope ?? "global", ...fallback() };
}

export function mutationJsonPayload<T extends { success: boolean; error?: string }>(
  value: T,
  error: string
): T | (T & { error: string }) {
  return value.success ? value : { ...value, error: value.error ?? error };
}
