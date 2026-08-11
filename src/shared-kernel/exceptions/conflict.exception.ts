import { DomainException } from './domain.exception';

/**
 * Raised when an operation conflicts with the current state of the system,
 * e.g. a duplicate unique key or an illegal state transition.
 */
export class ConflictException extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', details);
    this.name = 'ConflictException';
  }
}
