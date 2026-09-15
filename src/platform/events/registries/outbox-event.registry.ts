import { EventRehydrator, OutboxEvent, RehydrationEnvelope } from '../bases/outbox-event.base';

/** Any source that can rebuild events by type — structurally satisfied by the
 * shared-business `DomainEventRegistry`; injected via the composition root. */
export interface EventRehydrationSource {
  rehydrate(
    eventType: string,
    payload: Record<string, unknown>,
    envelope?: RehydrationEnvelope,
  ): OutboxEvent | null;
  has(eventType: string): boolean;
}

/**
 * Platform-owned registry mapping event type names (constructor names) to
 * rehydrators. Platform events register theirs directly; the business
 * rehydrator lookup is attached as a read-only DELEGATE by the composition
 * root (`src/bootstrap/configure-event-rehydration.ts`) — platform never
 * imports `@business/**`.
 */
export class OutboxEventRegistry implements EventRehydrationSource {
  private readonly rehydrators = new Map<string, EventRehydrator>();
  private readonly delegates: EventRehydrationSource[] = [];

  register(eventType: string, rehydrator: EventRehydrator): void {
    this.rehydrators.set(eventType, rehydrator);
  }

  /** Composition-root only: adds another lookup source (e.g. the
   * shared-business registry). Earlier delegates win on collisions. */
  addDelegate(source: EventRehydrationSource): void {
    this.delegates.push(source);
  }

  rehydrate(
    eventType: string,
    payload: Record<string, unknown>,
    envelope?: RehydrationEnvelope,
  ): OutboxEvent | null {
    const rehydrator = this.rehydrators.get(eventType);
    if (rehydrator) {
      const event = rehydrator(payload);
      applyEnvelope(event, envelope);
      return event;
    }
    for (const delegate of this.delegates) {
      if (delegate.has(eventType)) {
        return delegate.rehydrate(eventType, payload, envelope);
      }
    }
    return null;
  }

  has(eventType: string): boolean {
    return this.rehydrators.has(eventType) || this.delegates.some(d => d.has(eventType));
  }
}

/** Restores stable persisted-envelope identity (consumer idempotency). */
function applyEnvelope(event: OutboxEvent, envelope?: RehydrationEnvelope): void {
  if (!envelope) {
    return;
  }
  const restore: Record<string, unknown> = {};
  if (envelope.eventId) restore.eventId = envelope.eventId;
  if (envelope.occurredAt) restore.occurredAt = envelope.occurredAt;
  if (envelope.correlationId) restore.correlationId = envelope.correlationId;
  if (envelope.causationId) restore.causationId = envelope.causationId;
  if (envelope.headers) restore.headers = envelope.headers;
  // Envelope fields are only `readonly` at compile time — value restore is safe.
  if (Object.keys(restore).length > 0) Object.assign(event, restore);
}

/** Process-wide instance platform events register into (side-effect modules). */
export const outboxEventRegistry = new OutboxEventRegistry();
