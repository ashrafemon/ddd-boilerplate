import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ConditionEvaluator,
  GenerationCondition,
} from '@platform/condition-engine/ports/condition-evaluator.port';
import { UnregisteredFieldError } from '@platform/condition-engine/errors/unregistered-field.error';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { SchedulerPort } from '@platform/scheduler/ports/scheduler.port';
import {
  ScheduledJobFireHandler,
  ScheduledJobPayload,
} from '@platform/scheduler/ports/scheduled-job-fire-handler.port';
import { RecurringOccurrenceRequested } from './events/recurring-occurrence-requested.event';
import { RecurringTemplateRepositoryPort } from './ports/recurring-template-repository.port';
import { RecurringExecutionRepositoryPort } from './ports/recurring-execution-repository.port';
import { RecurringContext } from './recurring-context.types';
import { RecurringTemplateRecord } from './recurring-template.types';
import { computeNextRunDate } from './recurrence-engine';
import './events/recurring.registry';

/**
 * Scheduler (TIME) and DomainEventDispatcher (EVENT) both land here.
 *
 * Recurring owns claim / condition / reschedule. Document creation is not
 * done in-process: a RecurringOccurrenceRequested row is written to the
 * transactional outbox and published by infrastructure. PurchaseOrder (and
 * other aggregates) listen on RabbitMQ and create the document.
 */
@Injectable()
export class RecurringGenerationHandler implements ScheduledJobFireHandler {
  private readonly logger = new Logger(RecurringGenerationHandler.name);

  constructor(
    private readonly templateRepository: RecurringTemplateRepositoryPort,
    private readonly executionRepository: RecurringExecutionRepositoryPort,
    private readonly outboxWriter: OutboxWriterPort,
    private readonly schedulerPort: SchedulerPort,
    private readonly conditionEvaluator: ConditionEvaluator,
  ) {}

  async handle(payload: ScheduledJobPayload): Promise<void> {
    if (!payload.aggregateId) {
      throw new Error('ScheduledJobPayload.aggregateId is required for RecurringGenerationHandler');
    }
    const template = await this.templateRepository.findById(payload.aggregateId);
    if (!template) {
      throw new Error(`RecurringTemplate ${payload.aggregateId} not found`);
    }

    const isTimeTriggered = payload.jobId !== null;
    const runDate = isTimeTriggered ? template.nextRunDate : null;
    const triggerKey = isTimeTriggered ? formatDate(runDate!) : payload.sourceEventId!;

    const context: RecurringContext = {
      tenantId: payload.tenantId,
      recurringTemplateId: template.id,
      triggerKey,
      traceId: randomUUID(),
      autoPost: template.autoPost,
      eventPayload: isTimeTriggered ? undefined : payload.eventPayload,
    };

    const execution = await this.executionRepository.claim({
      tenantId: payload.tenantId,
      recurringTemplateId: template.id,
      scheduleJobId: payload.jobId ?? undefined,
      runDate: runDate ?? undefined,
      sourceEventId: isTimeTriggered ? undefined : payload.sourceEventId,
      triggerKey,
      generatedDocumentType: template.targetEntityType,
    });
    if (!execution) {
      return;
    }
    context.executionId = execution.id;

    if (template.status !== 'ACTIVE') {
      await this.executionRepository.skip(execution.id, 'TemplateNotActive');
      return;
    }

    try {
      if (template.generationCondition) {
        const result = await this.conditionEvaluator.evaluate(
          template.generationCondition as unknown as GenerationCondition,
          context,
        );
        if (!result.passed) {
          await this.executionRepository.skip(
            execution.id,
            'ConditionNotMet',
            result.evaluatedValues,
          );
          await this.reschedule(template);
          return;
        }
      }

      await this.outboxWriter.append(
        new RecurringOccurrenceRequested(
          execution.id,
          template.id,
          template.targetEntityType,
          template.partyId,
          template.partyType,
          template.currency,
          template.autoPost,
          triggerKey,
          context.traceId,
          template.headerOverrides,
          template.lines,
          template.tenantId ?? payload.tenantId,
          context.eventPayload,
        ),
        'RecurringTemplate',
        template.id,
      );

      this.logger.log(
        `Outbox RecurringOccurrenceRequested for ${template.targetEntityType} execution ${execution.id}`,
      );
    } catch (err) {
      const message = err instanceof UnregisteredFieldError ? err.message : (err as Error).message;
      await this.executionRepository.fail(execution.id, message);
    }

    await this.reschedule(template);
  }

  private async reschedule(template: RecurringTemplateRecord): Promise<void> {
    if (template.triggerType !== 'TIME' || !template.frequency || !template.interval) {
      return;
    }

    const from = template.nextRunDate ?? template.startDate ?? new Date();
    const next = computeNextRunDate(template.frequency, template.interval, from, template.timeZone);

    if (template.endDate && next > template.endDate) {
      await this.templateRepository.update(template.id, { status: 'COMPLETED', lastRunDate: from });
      await this.schedulerPort.cancelByAggregate('RecurringTemplate', template.id);
      return;
    }

    await this.templateRepository.update(template.id, { nextRunDate: next, lastRunDate: from });
    await this.schedulerPort.rescheduleByAggregate('RecurringTemplate', template.id, next);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
