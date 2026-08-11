import { DomainException } from './domain.exception';

/**
 * Raised when an infrastructure dependency fails (database, cache, message
 * broker, external API, ...). Never exposes internal details to clients.
 */
export class InfrastructureException extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INFRASTRUCTURE_ERROR', details);
    this.name = 'InfrastructureException';
  }
}
