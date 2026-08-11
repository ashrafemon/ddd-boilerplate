/**
 * A domain error carries a stable machine-readable code plus a message.
 * Application/HTTP layers map codes to HTTP semantics without leaking
 * framework exceptions into the domain.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  constructor(message: string) {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

export class InvalidStateTransitionError extends DomainError {
  readonly code = 'INVALID_STATE_TRANSITION';

  constructor(message: string) {
    super(message);
  }
}

export class BusinessRuleViolationError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';

  constructor(message: string) {
    super(message);
  }
}
