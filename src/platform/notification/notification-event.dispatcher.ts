import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { NotificationHandlerRegistry } from './notification-handler.registry';
import { SendNotificationUseCase } from './usecases/send-notification.usecase';

/**
 * EVENT-trigger path (workbook Phase 1.1 "a domain event fires"). Mirrors
 * recurring/domain-event.dispatcher.ts: matches on `event.constructor.name`,
 * the same way NestEventBusAdapter publishes
 * (`emitter.emit(event.constructor.name, event)`), so listening with onAny
 * needs no wildcard pattern of its own.
 *
 * dedupKey is derived from the event's own id so an at-least-once redelivery
 * of "the same" event lands on SendNotificationUseCase's dedup check (grain
 * #1) instead of fanning out twice.
 */
@Injectable()
export class NotificationEventDispatcher implements OnModuleInit {
  private readonly logger = new Logger(NotificationEventDispatcher.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly registry: NotificationHandlerRegistry,
    private readonly sendNotification: SendNotificationUseCase,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.onAny((eventName, event: unknown) => {
      void this.onEvent(String(eventName), event);
    });
  }

  private async onEvent(eventName: string, event: unknown): Promise<void> {
    const notificationTypes = this.registry.findByEventName(eventName);
    if (notificationTypes.length === 0) {
      return;
    }

    const eventId = extractEventId(event);
    const payload = toPlainObject(event);
    const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : undefined;

    for (const notificationType of notificationTypes) {
      try {
        await this.sendNotification.execute({
          notificationType,
          dedupKey: `${notificationType}:${eventId}`,
          payload,
          sourceEvent: eventName,
          tenantId,
        });
      } catch (err) {
        this.logger.error(
          `EVENT-triggered notification failed for ${notificationType}: ${(err as Error).message}`,
        );
      }
    }
  }
}

function extractEventId(event: unknown): string {
  if (
    event &&
    typeof event === 'object' &&
    'eventId' in event &&
    typeof event.eventId === 'string'
  ) {
    return event.eventId;
  }
  return randomUUID();
}

function toPlainObject(event: unknown): Record<string, unknown> {
  if (event && typeof event === 'object') {
    return JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
  }
  return {};
}
