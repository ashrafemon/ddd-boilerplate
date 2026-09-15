import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { SchedulerPort } from '@platform/scheduler/ports/scheduler.port';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { CreateRecurringTemplateInput, RecurringTemplateRecord } from '../recurring-template.types';

/**
 * partyType must correlate with targetEntityType — application-layer rule,
 * no DB constraint can express it since partyId has no FK (it points at
 * different tables depending on partyType). Extend this map as new
 * generators are onboarded.
 */
const PARTY_TYPE_BY_TARGET_ENTITY: Record<string, string> = {
  PurchaseOrder: 'VENDOR',
  Bill: 'VENDOR',
  Invoice: 'CUSTOMER',
};

@Injectable()
export class CreateRecurringTemplateUseCase {
  constructor(
    private readonly templateRepository: RecurringTemplateRepositoryPort,
    private readonly schedulerPort: SchedulerPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  async execute(input: CreateRecurringTemplateInput): Promise<RecurringTemplateRecord> {
    const scoped: CreateRecurringTemplateInput = {
      ...input,
      tenantId: input.tenantId ?? this.requestContext.getTenantId(),
      createdBy: input.createdBy ?? this.requestContext.getUserId(),
    };
    this.validate(scoped);

    const template = await this.templateRepository.create(scoped);

    // TIME templates get their first scheduled_jobs row written in the same
    // transaction as the template (doc §7 Phase 1). EVENT templates write
    // nothing here — DomainEventDispatcher matches them directly at fire
    // time and there is nothing to schedule.
    if (template.triggerType === 'TIME') {
      await this.schedulerPort.schedule({
        jobType: 'Recurring',
        aggregateType: 'RecurringTemplate',
        aggregateId: template.id,
        nextRunAt: template.nextRunDate ?? template.startDate!,
        tenantId: template.tenantId ?? undefined,
      });
    }

    return template;
  }

  private validate(input: CreateRecurringTemplateInput): void {
    if (input.partyType) {
      const expected = PARTY_TYPE_BY_TARGET_ENTITY[input.targetEntityType];
      if (expected && input.partyType !== expected) {
        throw new BadRequestException(
          `partyType '${input.partyType}' does not correlate with targetEntityType '${input.targetEntityType}'`,
        );
      }
    }

    if (input.triggerType === 'TIME') {
      if (!input.frequency || !input.interval || !input.startDate) {
        throw new BadRequestException("triggerType 'TIME' requires its matching fields to be set");
      }
    } else if (input.triggerType === 'EVENT') {
      if (!input.eventName) {
        throw new BadRequestException("triggerType 'EVENT' requires its matching fields to be set");
      }
    }

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ConflictException('RecurringTemplate.lines must be a non-empty array');
    }
  }
}
