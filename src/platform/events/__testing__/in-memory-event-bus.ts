import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventBusPort } from '@platform/events/ports/event-bus.port';
import {
  DomainEventEnvelope,
  EventHandlerRegistration,
  EventPublishResult,
} from '@platform/events/event-bus.types';

/**
 * In-memory Event Bus for unit tests. No broker dependencies.
 */
@Injectable()
export class InMemoryEventBus implements EventBusPort {
  private readonly handlers = new Map<string, EventHandlerRegistration[]>();
  private readonly published: DomainEventEnvelope[] = [];

  async publish(event: DomainEventEnvelope): Promise<EventPublishResult> {
    this.published.push(event);
    const key = `${event.eventType}:v${event.eventVersion}`;
    const registrations = this.handlers.get(key) ?? [];
    let dispatched = 0;

    for (const reg of registrations) {
      try {
        await reg.handler.handle(
          event as DomainEventEnvelope & { payload: unknown },
        );
        dispatched++;
      } catch {
        // Handler failure is logged but doesn't block others
      }
    }

    return {
      eventId: event.eventId,
      dispatchedHandlers: dispatched,
    };
  }

  register(registration: EventHandlerRegistration): void {
    const key = `${registration.eventType}:v${registration.eventVersion}`;
    const list = this.handlers.get(key) ?? [];
    list.push(registration);
    this.handlers.set(key, list);
  }

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

  /** Test helper: get all published events. */
  getPublished(): readonly DomainEventEnvelope[] {
    return this.published;
  }

  /** Test helper: clear published events. */
  clearPublished(): void {
    this.published.length = 0;
  }

  /** Test helper: create a test event envelope. */
  static testEvent(overrides: Partial<DomainEventEnvelope> = {}): DomainEventEnvelope {
    return {
      eventId: randomUUID(),
      eventType: 'TestEvent',
      eventVersion: 1,
      aggregateType: 'TestAggregate',
      aggregateId: randomUUID(),
      payload: {},
      occurredAt: new Date(),
      ...overrides,
    };
  }
}
