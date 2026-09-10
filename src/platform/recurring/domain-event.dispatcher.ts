import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ScheduledJobHandlerRegistry } from '@platform/scheduler/scheduled-job-handler.registry';
import { RecurringTemplateRepositoryPort } from './ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from './recurring-template.types';

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
 * Redelivery caveat: doc's failure matrix wants `triggerKey = sourceEventId`
 * stable across an at-least-once redelivery of "the same" event. In this
 * codebase every domain event is rehydrated from the outbox before it
 * reaches the in-process bus (see OutboxPublisher), and DomainEvent's
 * `eventId` field is randomised on construction with no way to carry the
 * original value through rehydration — so today `eventId` is only a
 * best-effort identifier, not a guaranteed-stable one across a genuine
 * outbox retry. Fixing that needs the event bus itself to expose a stable
 * message id (doc §11 open decision #14, event bus integration) — out of
 * scope until a concrete EVENT-triggered use case needs it for real.
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
      void this.onEvent(String(eventName), event);
    });
  }

  private async onEvent(eventName: string, event: unknown): Promise<void> {
    let templates: RecurringTemplateRecord[];
    try {
      templates = await this.templateRepository.findActiveByEventName(eventName);
    } catch (err) {
      this.logger.error(
        `Failed to look up EVENT-triggered templates for '${eventName}': ${(err as Error).message}`,
      );
      return;
    }
    if (templates.length === 0) {
      return;
    }

    const handler = this.handlerRegistry.resolveHandler('Recurring');
    const sourceEventId = extractEventId(event);
    const eventPayload = toPlainObject(event);

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
          `EVENT-triggered dispatch failed for template ${template.id}: ${(err as Error).message}`,
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
