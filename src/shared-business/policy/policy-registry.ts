import { Policy } from './policy';
import { PolicyViolationException } from '../../shared-kernel/exceptions/policy-violation.exception';

export interface PolicyCheck<TContext> extends Policy<TContext> {
  evaluate(context: TContext): { isAllowed: boolean; reasons: string[] };
}

/**
 * A registry that collects and evaluates a set of business policies for a
 * given context in one pass. Useful when a use case must authorize an action
 * against several policies at once.
 */
export class PolicyRegistry<TContext> {
  private readonly policies: Array<PolicyCheck<TContext>> = [];

  public static create<TContext>(): PolicyRegistry<TContext> {
    return new PolicyRegistry<TContext>();
  }

  public add(policy: PolicyCheck<TContext>): this {
    this.policies.push(policy);
    return this;
  }

  public addAll(policies: Array<PolicyCheck<TContext>>): this {
    this.policies.push(...policies);
    return this;
  }

  public evaluateAll(context: TContext): Array<{ policy: string; reasons: string[] }> {
    const violations: Array<{ policy: string; reasons: string[] }> = [];
    for (const policy of this.policies) {
      const result = policy.evaluate(context);
      if (!result.isAllowed) {
        violations.push({ policy: policy.name, reasons: result.reasons });
      }
    }
    return violations;
  }

  public enforceAll(context: TContext): void {
    const violations = this.evaluateAll(context);
    if (violations.length > 0) {
      throw new PolicyViolationException('One or more policies rejected the operation', {
        violations,
      });
    }
  }
}
