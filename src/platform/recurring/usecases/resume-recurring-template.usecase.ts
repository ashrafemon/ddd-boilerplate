import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { SchedulerPort } from '@platform/scheduler/ports/scheduler.port';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from '../recurring-template.types';
import { computeNextRunDate } from '../recurrence-engine';

@Injectable()
export class ResumeRecurringTemplateUseCase {
  constructor(
    private readonly templateRepository: RecurringTemplateRepositoryPort,
    private readonly schedulerPort: SchedulerPort,
  ) {}

  @Transactional()
  async execute(id: string, modifiedBy?: string): Promise<RecurringTemplateRecord> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException('RecurringTemplate not found');
    }
    if (template.triggerType !== 'TIME') {
      // EVENT templates only ever flip status — nothing scheduled to recompute.
      return this.templateRepository.update(id, { status: 'ACTIVE', modifiedBy });
    }
    if (!template.frequency || !template.interval) {
      throw new ConflictException('RecurringTemplate is missing TIME trigger fields');
    }

    const nextRunDate = computeNextRunDate(
      template.frequency,
      template.interval,
      new Date(),
      template.timeZone,
    );

    const updated = await this.templateRepository.update(id, {
      status: 'ACTIVE',
      nextRunDate,
      modifiedBy,
    });
    await this.schedulerPort.rescheduleByAggregate('RecurringTemplate', template.id, nextRunDate);
    return updated;
  }
}
