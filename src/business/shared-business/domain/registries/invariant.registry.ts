/**
 * A single invariant check. `check` throws an {@link Error} when
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

  /**
   * Run every invariant registered under `key`.
   *
   * An UNKNOWN KEY THROWS: a typo or a missing side-effect import would
   * otherwise turn the guard into a silent no-op, which is how a dead
   * `product.price-change` check could ship unnoticed. Failing loud is the
   * whole point of a guard.
   */
  enforce<TState = unknown>(key: string, state: TState): void {
    const list = this.items.get(key);
    if (!list) {
      throw Object.assign(
        new Error(`No invariant registered for key "${key}" — check the registration import`),
        { statusCode: 500 },
      );
    }
    for (const item of list) {
      item.check(state);
    }
  }

  has(key: string): boolean {
    return this.items.has(key);
  }
}

export const invariantRegistry = new InvariantRegistry();
