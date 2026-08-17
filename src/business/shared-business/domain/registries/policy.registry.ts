export interface Policy<TState = unknown> {
  readonly name: string;
  evaluate(state: TState): boolean;
}

export class PolicyRegistry {
  private readonly items = new Map<string, Policy<unknown>[]>();

  register<TState = unknown>(key: string, policy: Policy<TState>): void {
    const list = this.items.get(key) ?? [];
    list.push(policy);
    this.items.set(key, list);
  }

  evaluate<TState = unknown>(key: string, state: TState): boolean {
    const list = this.items.get(key);
    if (!list) return true;
    for (const item of list) {
      if (!item.evaluate(state)) return false;
    }
    return true;
  }

  enforce<TState = unknown>(key: string, state: TState): void {
    const list = this.items.get(key);
    if (!list) return;
    for (const item of list) {
      if (!item.evaluate(state)) {
        throw Object.assign(new Error(`Policy "${item.name}" failed`), { statusCode: 422 });
      }
    }
  }

  has(key: string): boolean {
    return this.items.has(key);
  }
}

export const policyRegistry = new PolicyRegistry();
