import { randomUUID } from 'crypto';

export abstract class DomainEvent {
  readonly eventId = randomUUID();
  readonly occurredAt = new Date();
  readonly version = 1;
  readonly correlationId?: string;
  readonly causationId?: string;
}
