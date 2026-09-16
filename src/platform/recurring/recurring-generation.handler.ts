import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { randomUUID } from 'crypto';
import { ConditionEvaluator } from '@platform/condition-engine/ports/condition-evaluator.port';
import { GenerationConditionParser } from '@platform/condition-engine/generation-condition.parser';
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
import { RecurrenceEngine } from './recurrence-engine';
import './events/recurring.registry';

/**
 * Scheduler (TIME) and DomainEventDispatcher (EVENT) both land here.
 *
 * Recurring owns claim / condition / reschedule. Document creation is not
 * done in-process: a RecurringOccurrenceRequested row is written to the
 * transactional outbox and published by infrastructure. PurchaseOrder (and
 * other aggregates) listen on RabbitMQ and create the document.
 *
 * The whole handler runs in one transaction, so claim + outbox append +
 * reschedule commit or roll back together — a crash never leaves a claimed
 * occurrence without a scheduling decision. A collision on claim is
 * therefore only possible when an *earlier* crashed transaction landed (the
 * insert committed with the slot unrescheduled): the collision path advances
 * the slot (settle) or re-claims a stale IN_PROGRESS row (self-heal) instead
 * of returning silently — otherwise a crashed deploy would kill the series
 * and put the scheduler in a claim-collision re-fire loop.
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

  @Transactional()
  async handle(payload: ScheduledJobPayload): Promise<void> {
    if (!payload.aggregateId) {
      throw new Error('ScheduledJobPayload.aggregateId is required for RecurringGenerationHandler');
    }
    const template = await this.templateRepository.findById(payload.aggregateId);
    if (!template) {
      throw new Error(`RecurringTemplate ${payload.aggregateId} not found`);
    }
    // The template row owns the tenancy; a payload carrying a different
    // tenant (stale queue copy, manual SQL drift) must never execute across.
    if (payload.tenantId && template.tenantId && payload.tenantId !== template.tenantId) {
      throw new Error(
        `Tenant mismatch on recurring generation: template ${template.id} belongs to ` +
          `'${template.tenantId}' but payload claimed '${payload.tenantId}'`,
      );
    }
    const tenantId = template.tenantId ?? payload.tenantId;

    const isTimeTriggered = payload.jobId !== null;
    const runDate = isTimeTriggered ? template.nextRunDate : null;
    const triggerKey = isTimeTriggered ? formatDate(runDate!) : payload.sourceEventId!;

    const context: RecurringContext = {
      tenantId,
      recurringTemplateId: template.id,
      triggerKey,
      traceId: randomUUID(),
      autoPost: template.autoPost,
      eventPayload: isTimeTriggered ? undefined : payload.eventPayload,
    };

    const execution = await this.executionRepository.claim({
      tenantId,
      recurringTemplateId: template.id,
      scheduleJobId: payload.jobId ?? undefined,
      runDate: runDate ?? undefined,
      sourceEventId: isTimeTriggered ? undefined : payload.sourceEventId,
      triggerKey,
      generatedDocumentType: template.targetEntityType,
    });

    if (!execution) {
      // Claim runs atomically with the outbox append and the reschedule in
      // this transaction, so a P2002 means the occurrence is already settled
      // (or being executed elsewhere): re-fire duplicates, not heals. Exit
      // cleanly; SweepStaleExecutionsUseCase fails executions whose consumer
      // never completed.
      const existing = await this.executionRepository.findByTemplateAndTrigger(
        template.id,
        triggerKey,
      );
      this.logger.debug(
        `Recurring occurrence '${triggerKey}' for template ${template.id} already claimed${
          existing ? ` (status ${existing.status})` : ''
        }; skipping`,
      );
      return;
    }
    context.executionId = execution.id;

    if (template.status !== 'ACTIVE') {
      await this.executionRepository.skip(execution.id, 'TemplateNotActive');
      return;
    }

    try {
      const condition = GenerationConditionParser.parse(template.generationCondition);
      if (condition) {
        const result = await this.conditionEvaluator.evaluate(condition, context);
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
          tenantId,
          context.eventPayload,
        ),
        'RecurringTemplate',
        template.id,
      );

      this.logger.log(
        `Outbox RecurringOccurrenceRequested for ${template.targetEntityType} execution ${execution.id}`,
      );
    } catch (err) {
      const message = FailureMessage.of(err);
      await this.executionRepository.fail(execution.id, message);
    }

    await this.reschedule(template);
  }

  private async reschedule(template: RecurringTemplateRecord): Promise<void> {
    if (template.triggerType !== 'TIME' || !template.frequency || !template.interval) {
      return;
    }

    const from = template.nextRunDate ?? template.startDate ?? new Date();
    const next = RecurrenceEngine.nextRunDate(
      template.frequency,
      template.interval,
      from,
      template.timeZone,
      template.startDate ?? undefined,
    );

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
