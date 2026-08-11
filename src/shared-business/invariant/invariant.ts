import { InvariantViolationException } from '../../shared-kernel/exceptions/invariant-violation.exception';

export interface InvariantResult {
  isValid: boolean;
  messages: string[];
}

/**
 * Base class for domain invariants.
 *
 * An invariant is a business correctness rule that must always hold for an
 * aggregate, entity or value object. Invariants are explicit, named and
 * reusable. UseCases orchestrate which invariants apply at which point.
 *
 * Input/schema validation (Zod) and domain invariants are different
 * responsibilities and must not be conflated.
 */
export abstract class Invariant {
  public abstract readonly name: string;

  public abstract check(context: unknown): InvariantResult;

  public validate(context: unknown): InvariantResult {
    return this.check(context);
  }

  public enforce(context: unknown): void {
    const result = this.check(context);
    if (!result.isValid) {
      throw new InvariantViolationException(this.name, result.messages);
    }
  }
}
