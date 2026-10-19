import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { MessageEnvelope } from '@platform/events/ports/in-process-event-bus.port';
import { NotificationHandlerRegistry } from './notification-handler.registry';
import { SendNotificationUseCase } from './usecases/send-notification.usecase';

/**
 * EVENT-trigger path (workbook Phase 1.1 "a domain event fires"). Mirrors
 * recurring/domain-event.dispatcher.ts: the Event Bus emits
 * `emitter.emit(envelope.eventType, envelope)`, so `onAny` receives the event
 * type and the canonical envelope; the payload is `envelope.payload`.
 *
 * dedupKey is derived from the envelope's stable eventId so an at-least-once
 * redelivery of "the same" event lands on SendNotificationUseCase's dedup check
 * (grain #1) instead of fanning out twice.
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
    this.eventEmitter.onAny((eventName, message: unknown) => {
      void this.onEvent(String(eventName), message);
    });
  }

  private async onEvent(eventName: string, message: unknown): Promise<void> {
    const notificationTypes = this.registry.findByEventName(eventName);
    if (notificationTypes.length === 0) {
      return;
    }

    const envelope = asEnvelope(message);
    const eventId = envelope?.eventId ?? randomUUID();
    const payload = asPayload(envelope);
    const tenantId = envelope?.tenantId ?? undefined;

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

function asEnvelope(message: unknown): MessageEnvelope | null {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const candidate = message as { eventType?: unknown };
  return typeof candidate.eventType === 'string' ? (message as MessageEnvelope) : null;
}

function asPayload(envelope: MessageEnvelope | null): Record<string, unknown> {
  if (!envelope || typeof envelope.payload !== 'object' || envelope.payload === null) {
    return {};
  }
  return JSON.parse(JSON.stringify(envelope.payload)) as Record<string, unknown>;
}
