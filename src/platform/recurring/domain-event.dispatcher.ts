import { JsonObject } from '@shared-kernel/types/json-value.type';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { ScheduledJobHandlerRegistry } from '@platform/scheduler/scheduled-job-handler.registry';
import { RecurringTemplateRepositoryPort } from './ports/recurring-template-repository.port';

/**
 * EVENT-trigger path (doc §7 Phase 3B). Matches `recurring_templates` on
 * `(eventName, status=ACTIVE)` and invokes the SAME handler
 * SchedulerPollerService uses — `jobId: null`, nothing to lock/release,
 * `scheduled_jobs` stays untouched.
 *
 * Matches on `event.constructor.name` the same way NestEventBusAdapter
 * publishes (`emitter.emit(event.constructor.name, event)`), so listening
 * with `onAny` needs no wildcard pattern of its own.
 *
 * Redelivery stability: in-process dispatch is fed by the outbox publisher,
 * which restores the persisted envelope (`eventId` included) on rehydration —
 * so `triggerKey = sourceEventId` survives an outbox retry and the claim
 * insert collapses the duplicate EVENT generation.
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
    this.eventEmitter.onAny((eventName, event: unknown) => {
      void this.onEvent(
        String(eventName),
        event !== null && typeof event === 'object' ? event : null,
      );
    });
  }

  private async onEvent(eventName: string, event: object | null): Promise<void> {
    try {
      const templates = await this.templateRepository.findActiveByEventName(eventName);
      if (templates.length === 0) {
        return;
      }

      const handler = this.handlerRegistry.resolveHandler('Recurring');
      const sourceEventId = DispatcherEventReader.eventId(event);
      const eventPayload = DispatcherEventReader.snapshot(event);

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

/** One audited read of unknown bus payloads (domain-event envelope). */
class DispatcherEventReader {
  /**
   * Envelope read is STRUCTURAL (any event carrying `eventId` — a business
   * DomainEvent or a platform OutboxEvent) so the dispatcher keeps zero
   * compile-time dependency on the business kernel.
   */
  static eventId(event: object | null): string {
    const candidate = (event as { eventId?: unknown } | null)?.eventId;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : randomUUID();
  }

  static snapshot(event: object | null): JsonObject {
    return event ? PrismaJson.snapshot(event) : {};
  }
}
