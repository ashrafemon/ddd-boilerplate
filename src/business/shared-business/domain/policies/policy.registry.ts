import { ok, Result } from '../result';

/**
 * A single policy decision. Policies evolve independently of invariants; a
 * failed policy evaluation blocks the operation.
 */
export interface Policy<TState = unknown> {
  readonly name: string;
  evaluate(state: TState): Result<unknown, string>;
}

/**
 * Central registry where aggregate/entity policies are registered and
 * enforced. Mirror image of {@link InvariantRegistry} — same decoupling, but
 * policy rules may change per environment/company.
 */
export class PolicyRegistry {
  private readonly items = new Map<string, Policy<unknown>[]>();

  register<TState = unknown>(key: string, policy: Policy<TState>): void {
    const list = this.items.get(key) ?? [];
    list.push(policy);
    this.items.set(key, list);
  }

  /** Run every registered policy and return the first failure (no throw). */
  evaluate<TState = unknown>(key: string, state: TState): Result<unknown, string> {
    const list = this.items.get(key);
    if (!list) return ok(true);
    for (const item of list) {
      const result = item.evaluate(state);
      if (!result.ok) return result;
    }
    return ok(true);
  }

  /** Run every registered policy and throw on the first violation. */
  enforce<TState = unknown>(key: string, state: TState): void {
    const result = this.evaluate(key, state);
    if (!result.ok) {
      throw Object.assign(new Error(String(result.error)), { statusCode: 422 });
    }
  }

  has(key: string): boolean {
    return this.items.has(key);
  }
}

export const policyRegistry = new PolicyRegistry();

export { ok };
export type { Result };
