import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JsonObject } from '@shared-kernel/types/json-value.type';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { MessageEnvelope } from '@platform/events/ports/in-process-event-bus.port';
import { DispatchWebhookEventUseCase } from './usecases/dispatch-webhook-event.usecase';
import { WebhookEventTypeRegistry } from './webhook-event-type.registry';

/**
 * Outbound EVENT-trigger path — structurally copied from
 * notification/notification-event.dispatcher.ts: the Event Bus emits
 * `emitter.emit(envelope.eventType, envelope)`, so `onAny` receives the event
 * type and the canonical envelope (payload is `envelope.payload`). Only events
 * on the boot-time WEBHOOK_EVENT_TYPES allowlist (WebhookEventTypeRegistry) go
 * any further — everything else is ignored before touching the DB.
 */
@Injectable()
export class WebhookDispatchDispatcher implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatchDispatcher.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly eventTypes: WebhookEventTypeRegistry,
    private readonly dispatchWebhookEvent: DispatchWebhookEventUseCase,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.onAny((eventName, message: unknown) => {
      void this.onEvent(String(eventName), message);
    });
  }

  private async onEvent(eventName: string, message: unknown): Promise<void> {
    if (!this.eventTypes.has(eventName)) {
      return;
    }

    const envelope = asEnvelope(message);
    const eventId = envelope?.eventId ?? randomUUID();
    const payload: JsonObject = envelope ? PrismaJson.snapshot(envelope.payload) : {};

    try {
      await this.dispatchWebhookEvent.execute(eventName, eventId, payload);
    } catch (err) {
      this.logger.error(
        `Webhook dispatch failed for eventType '${eventName}': ${(err as Error).message}`,
      );
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
