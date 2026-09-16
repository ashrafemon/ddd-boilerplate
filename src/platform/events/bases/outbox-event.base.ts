import { randomUUID } from 'crypto';

/**
 * Platform-owned event envelope contract. The outbox writer, the in-process
 * bus and the rehydration layer all speak THIS shape — a business
 * `DomainEvent` satisfies it structurally (same envelope fields), so the
 * platform pipes business events without importing anything from
 * `@business/**`.
 */
export interface OutboxEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly version: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly headers?: Record<string, string>;
}

/** Envelope fields persisted with the payload; restored on re-dispatch. */
export interface RehydrationEnvelope {
  eventId?: string;
  occurredAt?: Date;
  correlationId?: string;
  causationId?: string;
  headers?: Record<string, string>;
}

/** Rebuilds an event instance from the persisted payload. */
export type EventRehydrator = (payload: Record<string, unknown>) => OutboxEvent;

/**
 * Base class for the platform's OWN events (ImportJobCompleted,
 * RecurringOccurrenceRequested, BatchOperationJobCompleted, ...) so they ride
 * the same outbox pipeline as business events — no shared-business import.
 */
export abstract class OutboxEventBase implements OutboxEvent {
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
