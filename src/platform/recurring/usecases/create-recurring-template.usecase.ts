import { ConflictException, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { SchedulerPort } from '@platform/scheduler/ports/scheduler.port';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { CreateRecurringTemplateInput, RecurringTemplateRecord } from '../recurring-template.types';
import { InvalidPartyTypeError, InvalidTriggerFieldsError } from '../recurring.errors';

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
  ) {}

  @Transactional()
  async execute(input: CreateRecurringTemplateInput): Promise<RecurringTemplateRecord> {
    this.validate(input);

    const template = await this.templateRepository.create(input);

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
        throw new InvalidPartyTypeError(input.targetEntityType, input.partyType);
      }
    }

    if (input.triggerType === 'TIME') {
      if (!input.frequency || !input.interval || !input.startDate) {
        throw new InvalidTriggerFieldsError('TIME');
      }
    } else if (input.triggerType === 'EVENT') {
      if (!input.eventName) {
        throw new InvalidTriggerFieldsError('EVENT');
      }
    }

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ConflictException('RecurringTemplate.lines must be a non-empty array');
    }
  }
}
