/**
 * Base exception for all domain-level errors.
 *
 * Domain code may throw (or derive from) this exception when a domain rule
 * cannot be satisfied. It is intentionally framework-independent.
 */
export class DomainException extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code = 'DOMAIN_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainException';
    this.code = code;
    this.details = details;
  }
}
