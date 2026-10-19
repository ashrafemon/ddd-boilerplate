import { JsonObject } from '@shared-kernel/types/json-value.type';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { MessageEnvelope } from '@platform/events/ports/in-process-event-bus.port';
import { ScheduledJobHandlerRegistry } from '@platform/scheduler/scheduled-job-handler.registry';
import { RecurringTemplateRepositoryPort } from './ports/recurring-template-repository.port';

/**
 * EVENT-trigger path (doc §7 Phase 3B). Matches `recurring_templates` on
 * `(eventName, status=ACTIVE)` and invokes the SAME handler
 * SchedulerPollerService uses — `jobId: null`, nothing to lock/release,
 * `scheduled_jobs` stays untouched.
 *
 * Listens on `onAny`: the Event Bus emits `emitter.emit(envelope.eventType,
 * envelope)` (NestEventBusAdapter), so `eventName` is the event type and the
 * second argument is the canonical envelope — the payload is `envelope.payload`.
 *
 * Redelivery stability: the outbox carries a stable `eventId` on the envelope,
 * so `triggerKey = sourceEventId` survives an outbox retry and the claim insert
 * collapses the duplicate EVENT generation.
 */
@Injectable()
export class DomainEventDispatcher implements OnModuleInit {
  private readonly logger = new Logger(DomainEventDispatcher.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly templateRepository: RecurringTemplateRepositoryPort,
    private readonly handlerRegistry: ScheduledJobHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.onAny((eventName, message: unknown) => {
      void this.onEvent(String(eventName), DispatcherEventReader.asEnvelope(message));
    });
  }

  private async onEvent(eventName: string, message: MessageEnvelope | null): Promise<void> {
    try {
      const templates = await this.templateRepository.findActiveByEventName(eventName);
      if (templates.length === 0) {
        return;
      }

      const handler = this.handlerRegistry.resolveHandler('Recurring');
      const sourceEventId = message?.eventId ?? randomUUID();
      const eventPayload: JsonObject = message ? PrismaJson.snapshot(message.payload) : {};

      for (const template of templates) {
        try {
          await handler.handle({
            jobId: null,
            jobType: 'Recurring',
            tenantId: template.tenantId ?? undefined,
            aggregateType: 'RecurringTemplate',
            aggregateId: template.id,
            sourceEventId,
            eventPayload,
          });
        } catch (err) {
          this.logger.error(
            `EVENT-triggered dispatch failed for template ${template.id}: ${FailureMessage.of(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `EVENT dispatch pipeline failed for '${eventName}': ${FailureMessage.of(err)}`,
      );
    }
  }
}

/** One audited read of unknown bus payloads (the canonical envelope). */
class DispatcherEventReader {
  /**
   * Envelope read is STRUCTURAL (any object carrying `eventType` + `payload`),
   * so the dispatcher keeps zero compile-time dependency on the business kernel.
   */
  static asEnvelope(message: unknown): MessageEnvelope | null {
    if (!message || typeof message !== 'object') {
      return null;
    }
    const candidate = message as { eventType?: unknown; payload?: unknown };
    if (typeof candidate.eventType !== 'string') {
      return null;
    }
    return message as MessageEnvelope;
  }
}
