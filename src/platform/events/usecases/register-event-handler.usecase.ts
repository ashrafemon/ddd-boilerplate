import { Injectable } from '@nestjs/common';
import { EventHandlerRegistration } from '../event-bus.types';
import { DomainEventRegistry } from '../registries/domain-event.registry';

/**
 * Use case: register an event handler for a specific event type + version.
 */
@Injectable()
export class RegisterEventHandlerUseCase {
  constructor(private readonly registry: DomainEventRegistry) {}

  execute(registration: EventHandlerRegistration): void {
    this.registry.register(registration);
  }
}
