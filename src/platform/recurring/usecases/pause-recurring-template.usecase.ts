import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { SchedulerPort } from '@platform/scheduler/ports/scheduler.port';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from '../recurring-template.types';

/**
 * TIME templates: clears scheduled_jobs.nextRunAt (suspends it) in the same
 * transaction as status=PAUSED. EVENT templates: only ever touch
 * recurringTemplate.status — DomainEventDispatcher's own lookup already
 * filters on status=ACTIVE, so there is no separate row to disable.
 */
@Injectable()
export class PauseRecurringTemplateUseCase {
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

    if (template.triggerType === 'TIME') {
      await this.schedulerPort.cancelByAggregate('RecurringTemplate', template.id);
    }

    return this.templateRepository.update(id, { status: 'PAUSED', modifiedBy });
  }
}
