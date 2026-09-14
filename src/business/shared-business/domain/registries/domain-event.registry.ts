import { DomainEvent } from '../bases/event.base';

/**
 * Reconstructs a domain event from the payload persisted in the outbox.
 * Rehydrators are registered by each aggregate's events module so the outbox
 * scheduler can re-dispatch in-process events without the use cases.
 */
export type DomainEventRehydrator<T extends DomainEvent = DomainEvent> = (
  payload: Record<string, unknown>,
) => T;

/**
 * Envelope fields persisted alongside the payload in the outbox. Applying
 * them on rehydration keeps `eventId`, `occurredAt`, correlation and
 * causation stable across the async hop — consumer idempotency and recurring
 * EVENT-trigger dedup rely on exactly that stability.
 */
export interface DomainEventEnvelope {
  eventId?: string;
  occurredAt?: Date;
  correlationId?: string;
  causationId?: string;
  headers?: Record<string, string>;
}

/**
 * Central registry mapping event types (constructor names) to rehydrators.
 * The outbox publisher uses it to rebuild domain events from outbox records
 * and publish them through the in-process event bus.
 */
export class DomainEventRegistry {
  private readonly rehydrators = new Map<string, DomainEventRehydrator>();

  register<T extends DomainEvent>(eventType: string, rehydrator: DomainEventRehydrator<T>): void {
    this.rehydrators.set(eventType, rehydrator);
  }

  rehydrate(
    eventType: string,
    payload: Record<string, unknown>,
    envelope?: DomainEventEnvelope,
  ): DomainEvent | null {
    const rehydrator = this.rehydrators.get(eventType);
    if (!rehydrator) return null;
    const event = rehydrator(payload);
    if (envelope) {
      const restore: Record<string, unknown> = {};
      if (envelope.eventId) restore.eventId = envelope.eventId;
      if (envelope.occurredAt) restore.occurredAt = envelope.occurredAt;
      if (envelope.correlationId) restore.correlationId = envelope.correlationId;
      if (envelope.causationId) restore.causationId = envelope.causationId;
      if (envelope.headers) restore.headers = envelope.headers;
      // Domain event envelopes are restored by value; the fields are only
      // `readonly` at compile time, so runtime assignment is safe.
      if (Object.keys(restore).length > 0) Object.assign(event, restore);
    }
    return event;
  }

  has(eventType: string): boolean {
    return this.rehydrators.has(eventType);
  }
}

export const domainEventRegistry = new DomainEventRegistry();
