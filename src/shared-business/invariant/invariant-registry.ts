import { Invariant } from './invariant';
import { InvariantViolationException } from '../../shared-kernel/exceptions/invariant-violation.exception';

export interface InvariantCheck<TContext> extends Invariant {
  check(context: TContext): { isValid: boolean; messages: string[] };
}

/**
 * A registry that collects and enforces a set of invariants for a given
 * context in one pass. Useful when a use case must enforce several rules at a
 * transaction boundary.
 */
export class InvariantRegistry<TContext> {
  private readonly invariants: Array<InvariantCheck<TContext>> = [];

  public static create<TContext>(): InvariantRegistry<TContext> {
    return new InvariantRegistry<TContext>();
  }

  public add(invariant: InvariantCheck<TContext>): this {
    this.invariants.push(invariant);
    return this;
  }

  public addAll(invariants: Array<InvariantCheck<TContext>>): this {
    this.invariants.push(...invariants);
    return this;
  }

  public checkAll(context: TContext): Array<{ invariant: string; messages: string[] }> {
    const violations: Array<{ invariant: string; messages: string[] }> = [];
    for (const invariant of this.invariants) {
      const result = invariant.check(context);
      if (!result.isValid) {
        violations.push({ invariant: invariant.name, messages: result.messages });
      }
    }
    return violations;
  }

  public enforceAll(context: TContext): void {
    const violations = this.checkAll(context);
    if (violations.length > 0) {
      throw new InvariantViolationException(violations);
    }
  }
}
