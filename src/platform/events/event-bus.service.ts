import { Injectable } from '@nestjs/common';
import { EventBusPort } from './ports/event-bus.port';
import {
  DomainEventEnvelope,
  EventHandlerRegistration,
  EventPublishResult,
} from './event-bus.types';
import { PublishEventUseCase } from './usecases/publish-event.usecase';
import { RegisterEventHandlerUseCase } from './usecases/register-event-handler.usecase';
import { UnregisterEventHandlerUseCase } from './usecases/unregister-event-handler.usecase';

/**
 * Event Bus service facade — the single entry point for all event bus operations.
 *
 * Delegates to individual use cases (one per file) without containing
 * business rules itself. This class implements the public EventBusPort.
 */
@Injectable()
export class EventBusService implements EventBusPort {
  constructor(
    private readonly publishEvent: PublishEventUseCase,
    private readonly registerHandler: RegisterEventHandlerUseCase,
    private readonly unregisterHandler: UnregisterEventHandlerUseCase,
  ) {}

  async publish(
    event: DomainEventEnvelope,
    options?: { failFast?: boolean; timeoutMs?: number },
  ): Promise<EventPublishResult> {
    return this.publishEvent.execute(event, options);
  }

  register(registration: EventHandlerRegistration): void {
    this.registerHandler.execute(registration);
  }

  unregister(registrationId: string): void {
    this.unregisterHandler.execute(registrationId);
  }
}
