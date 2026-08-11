import { DomainException } from './domain.exception';

export interface InvariantViolationDetail {
  invariant: string;
  messages: string[];
}

/**
 * Thrown when a domain invariant is violated.
 *
 * Invariants are explicit business correctness rules (e.g. an aggregate
 * must always have at least one line). They are distinct from input
 * validation (Zod).
 */
export class InvariantViolationException extends DomainException {
  public readonly violations: InvariantViolationDetail[];

  constructor(violations: InvariantViolationDetail[]);
  constructor(invariant: string, messages: string[]);
  constructor(
    invariantOrViolations: string | InvariantViolationDetail[],
    messages?: string[],
  ) {
    if (typeof invariantOrViolations === 'string') {
      super(messages?.join('; ') ?? invariantOrViolations, 'INVARIANT_VIOLATION', {
        invariant: invariantOrViolations,
        messages,
      });
      this.violations = [{ invariant: invariantOrViolations, messages: messages ?? [] }];
    } else {
      const message = invariantOrViolations
        .map((v) => `${v.invariant}: ${v.messages.join('; ')}`)
        .join('\n');
      super(message, 'INVARIANT_VIOLATION', { violations: invariantOrViolations });
      this.violations = invariantOrViolations;
    }
    this.name = 'InvariantViolationException';
  }
}
