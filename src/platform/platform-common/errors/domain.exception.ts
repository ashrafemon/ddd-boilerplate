/**
 * Base class for platform domain errors (webhook, notification, …).
 *
 * Lives in the platform layer: the only consumers are platform capability
 * error sets. Business aggregates keep their own errors; infrastructure has
 * its own `InfrastructureException`.
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
