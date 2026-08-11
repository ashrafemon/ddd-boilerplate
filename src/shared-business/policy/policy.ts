import { PolicyViolationException } from '../../shared-kernel/exceptions/policy-violation.exception';

export interface PolicyResult {
  isAllowed: boolean;
  reasons: string[];
}

/**
 * Base class for business policies.
 *
 * Policies answer authorization-like business questions:
 *   - Can this organization purchase this product?
 *   - Can this order be approved within the configured limits?
 *   - Is this vendor allowed for this organization?
 *
 * They are evaluated/enforced by UseCases. They are separate from invariants:
 * invariants protect intrinsic correctness of an aggregate, policies decide
 * whether an action is permitted in a given business context.
 */
export abstract class Policy<TContext> {
  public abstract readonly name: string;

  public abstract evaluate(context: TContext): PolicyResult;

  public can(context: TContext): boolean {
    return this.evaluate(context).isAllowed;
  }

  public enforce(context: TContext): void {
    const result = this.evaluate(context);
    if (!result.isAllowed) {
      throw new PolicyViolationException(`${this.name} policy rejected the operation`, {
        reasons: result.reasons,
      });
    }
  }
}
