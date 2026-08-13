import { DomainEvent } from '../bases';

/**
 * Reconstructs a domain event from the payload persisted in the outbox.
 * Rehydrators are registered by each aggregate's events module so the outbox
 * scheduler can re-dispatch in-process events without the use cases.
 */
export type DomainEventRehydrator<T extends DomainEvent = DomainEvent> = (
  payload: Record<string, unknown>,
) => T;

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

  rehydrate(eventType: string, payload: Record<string, unknown>): DomainEvent | null {
    const rehydrator = this.rehydrators.get(eventType);
    return rehydrator ? rehydrator(payload) : null;
  }

  has(eventType: string): boolean {
    return this.rehydrators.has(eventType);
  }
}

export const domainEventRegistry = new DomainEventRegistry();
