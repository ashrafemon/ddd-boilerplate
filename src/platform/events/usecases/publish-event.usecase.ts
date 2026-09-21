import { Injectable } from '@nestjs/common';
import { DomainEventEnvelope, EventPublishResult } from '../event-bus.types';
import { DomainEventDispatcher } from '../dispatchers/domain-event.dispatcher';

/**
 * Use case: publish a domain event to all registered handlers.
 */
@Injectable()
export class PublishEventUseCase {
  constructor(private readonly dispatcher: DomainEventDispatcher) {}

  async execute(
    event: DomainEventEnvelope,
    options?: { failFast?: boolean; timeoutMs?: number },
  ): Promise<EventPublishResult> {
    const dispatchedHandlers = await this.dispatcher.dispatch(event, options);
    return {
      eventId: event.eventId,
      dispatchedHandlers,
    };
  }
}
