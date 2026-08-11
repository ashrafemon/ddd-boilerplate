import { DomainException } from './domain.exception';

/**
 * Thrown when a business policy denies an operation.
 *
 * Policies answer questions such as "can this organization purchase this
 * product?" or "can this order be approved within the current limits?".
 */
export class PolicyViolationException extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'POLICY_VIOLATION', details);
    this.name = 'PolicyViolationException';
  }
}
