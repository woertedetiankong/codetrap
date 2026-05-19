import type { Trap } from "../domain/trap";

export type TrapLifecycleAdapter = {
  get(id: number): Trap | null;
  transaction<T>(callback: () => T): T;
  markArchived(id: number): boolean;
  markSuperseded(id: number, stateKey: string): boolean;
  markSuperseding(id: number, supersedesId: number, stateKey: string): boolean;
};

export function archiveTrapLifecycle(adapter: TrapLifecycleAdapter, id: number): boolean {
  return adapter.markArchived(id);
}

export function supersedeTrapLifecycle(
  adapter: TrapLifecycleAdapter,
  id: number,
  supersededById: number,
  stateKey?: string
): boolean {
  if (id === supersededById) return false;

  const oldTrap = adapter.get(id);
  const newTrap = adapter.get(supersededById);
  if (!oldTrap || !newTrap) return false;

  const key = lifecycleStateKey(oldTrap, newTrap, stateKey);
  return adapter.transaction(() => {
    adapter.markSuperseded(id, key);
    adapter.markSuperseding(supersededById, id, key);
    return true;
  });
}

export function lifecycleStateKey(oldTrap: Trap, newTrap: Trap, requested?: string): string {
  return requested ?? oldTrap.state_key ?? newTrap.state_key ?? `trap:${oldTrap.id}`;
}
