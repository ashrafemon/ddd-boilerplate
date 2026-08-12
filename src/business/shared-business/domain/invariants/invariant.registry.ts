/**
 * A single invariant check. `check` throws an {@link InvariantException} when
 * the rule is violated. Invariants always hold regardless of policy.
 */
export interface Invariant<TState = unknown> {
  readonly name: string;
  check(state: TState): void;
}

/**
 * Central registry where aggregate/entity/value-object invariants are
 * registered and enforced. Keeps entity, aggregate and value-object classes
 * decoupled: they never import each other's invariant modules, they only talk
 * to this registry.
 */
export class InvariantRegistry {
  private readonly items = new Map<string, Invariant<unknown>[]>();

  register<TState = unknown>(key: string, invariant: Invariant<TState>): void {
    const list = this.items.get(key) ?? [];
    list.push(invariant);
    this.items.set(key, list);
  }

  enforce<TState = unknown>(key: string, state: TState): void {
    const list = this.items.get(key);
    if (!list) return;
    for (const item of list) {
      item.check(state);
    }
  }

  has(key: string): boolean {
    return this.items.has(key);
  }
}

export const invariantRegistry = new InvariantRegistry();
