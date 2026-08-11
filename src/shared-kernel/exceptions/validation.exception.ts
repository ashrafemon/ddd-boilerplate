import { DomainException } from './domain.exception';

export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

/**
 * Thrown for input/schema validation failures (Zod). Business correctness is
 * enforced by domain invariants, not by this exception.
 */
export class ValidationException extends DomainException {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[], message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', { issues });
    this.issues = issues;
    this.name = 'ValidationException';
  }
}
