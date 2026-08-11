import { randomUUID } from 'crypto';

/**
 * Framework-independent domain event marker. Raised by aggregates when state
 * changes; dispatched in-process and/or persisted to the transactional outbox
 * as an integration event.
 */
export abstract class DomainEvent {
  readonly eventId: string = randomUUID();
  readonly occurredAt: Date = new Date();
  readonly version = 1;

  readonly correlationId?: string;
  readonly causationId?: string;
  readonly headers?: Record<string, string>;

  constructor(options?: {
    correlationId?: string;
    causationId?: string;
    headers?: Record<string, string>;
  }) {
    this.correlationId = options?.correlationId;
    this.causationId = options?.causationId;
    this.headers = options?.headers;
  }
}
