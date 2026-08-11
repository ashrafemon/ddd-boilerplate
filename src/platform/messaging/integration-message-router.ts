import { Injectable } from '@nestjs/common';
import { IntegrationMessage } from '../../shared-kernel/ports/messaging/integration-message';
import { IntegrationEventHandler } from '../../shared-kernel/ports/messaging/integration-event-handler.port';

/**
 * Routes integration messages to the handlers registered by business modules.
 * A message is routed by its `eventType`; every registered handler for that
 * type is invoked.
 */
@Injectable()
export class IntegrationMessageRouter {
  private readonly handlers = new Map<string, IntegrationEventHandler[]>();

  public register(handler: IntegrationEventHandler): void {
    const existing = this.handlers.get(handler.eventType) ?? [];
    this.handlers.set(handler.eventType, [...existing, handler]);
  }

  public hasHandler(eventType: string): boolean {
    return (this.handlers.get(eventType)?.length ?? 0) > 0;
  }

  public async route(message: IntegrationMessage): Promise<void> {
    const handlers = this.handlers.get(message.eventType) ?? [];
    for (const handler of handlers) {
      await handler.handle(message);
    }
  }
}
