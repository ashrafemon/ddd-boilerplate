import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JsonObject } from '@shared-kernel/types/json-value.type';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { DispatchWebhookEventUseCase } from './usecases/dispatch-webhook-event.usecase';
import { WebhookEventTypeRegistry } from './webhook-event-type.registry';

/**
 * Outbound EVENT-trigger path — structurally copied from
 * notification/notification-event.dispatcher.ts: matches on
 * `event.constructor.name` (`emitter.emit(event.constructor.name, event)`),
 * so `onAny` needs no wildcard pattern. Only events on the boot-time
 * WEBHOOK_EVENT_TYPES allowlist (WebhookEventTypeRegistry) go any further —
 * everything else is ignored before touching the DB.
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
    this.eventEmitter.onAny((eventName, event: unknown) => {
      void this.onEvent(String(eventName), event);
    });
  }

  private async onEvent(eventName: string, event: unknown): Promise<void> {
    if (!this.eventTypes.has(eventName)) {
      return;
    }

    const eventId = extractEventId(event);
    const payload = toPlainObject(event);

    try {
      await this.dispatchWebhookEvent.execute(eventName, eventId, payload);
    } catch (err) {
      this.logger.error(
        `Webhook dispatch failed for eventType '${eventName}': ${(err as Error).message}`,
      );
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

function toPlainObject(event: unknown): JsonObject {
  return event && typeof event === 'object' ? PrismaJson.snapshot(event) : {};
}
