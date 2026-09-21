import { EventHandlerRegistration, DomainEventEnvelope } from '../event-bus.types';

/**
 * Versioned event type registry — maps (eventType, eventVersion) to
 * registered handler registrations. Used by the Event Bus dispatcher
 * to route events to the correct handlers.
 */
export class DomainEventRegistry {
  private readonly handlers = new Map<string, EventHandlerRegistration[]>();

  /** Composite key for versioned event type. */
  private static key(eventType: string, eventVersion: number): string {
    return `${eventType}:v${eventVersion}`;
  }

  /** Register a handler for a specific event type + version. */
  register(registration: EventHandlerRegistration): void {
    const key = DomainEventRegistry.key(
      registration.eventType,
      registration.eventVersion,
    );
    const list = this.handlers.get(key) ?? [];
    // Prevent duplicate registration
    if (list.some(r => r.registrationId === registration.registrationId)) {
      return;
    }
    list.push(registration);
    this.handlers.set(key, list);
  }

  /** Unregister a handler by its registration ID. */
  unregister(registrationId: string): void {
    for (const [key, list] of this.handlers) {
      const idx = list.findIndex(r => r.registrationId === registrationId);
      if (idx !== -1) {
        list.splice(idx, 1);
        if (list.length === 0) this.handlers.delete(key);
        return;
      }
    }
  }

  /** Find all handlers for a given event type + version. */
  findHandlers(
    eventType: string,
    eventVersion: number,
  ): EventHandlerRegistration[] {
    const key = DomainEventRegistry.key(eventType, eventVersion);
    return this.handlers.get(key) ?? [];
  }

  /** Check if any handlers are registered for an event type + version. */
  has(eventType: string, eventVersion: number): boolean {
    const key = DomainEventRegistry.key(eventType, eventVersion);
    const list = this.handlers.get(key);
    return !!list && list.length > 0;
  }

  /** Get total registered handler count (useful for diagnostics). */
  count(): number {
    let total = 0;
    for (const list of this.handlers.values()) {
      total += list.length;
    }
    return total;
  }
}

/** Process-wide singleton registry. */
export const domainEventRegistry = new DomainEventRegistry();
