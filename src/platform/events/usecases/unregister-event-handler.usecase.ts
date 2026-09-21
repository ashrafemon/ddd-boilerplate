import { Injectable } from '@nestjs/common';
import { DomainEventRegistry } from '../registries/domain-event.registry';

/**
 * Use case: unregister an event handler by its registration ID.
 */
@Injectable()
export class UnregisterEventHandlerUseCase {
  constructor(private readonly registry: DomainEventRegistry) {}

  execute(registrationId: string): void {
    this.registry.unregister(registrationId);
  }
}
