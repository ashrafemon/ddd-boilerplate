import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { SchedulerPort } from '@platform/scheduler/ports/scheduler.port';
import { RecurringTemplateRepositoryPort } from '../ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from '../recurring-template.types';

@Injectable()
export class CancelRecurringTemplateUseCase {
  constructor(
    private readonly templateRepository: RecurringTemplateRepositoryPort,
    private readonly schedulerPort: SchedulerPort,
  ) {}

  @Transactional()
  async execute(
    id: string,
    modifiedBy?: string,
    tenantId?: string,
  ): Promise<RecurringTemplateRecord> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException('RecurringTemplate not found');
    }
    TenantScope.assertVisible(template.tenantId ?? null, tenantId);

    if (template.triggerType === 'TIME') {
      await this.schedulerPort.cancelByAggregate('RecurringTemplate', template.id);
    }

    return this.templateRepository.update(id, { status: 'CANCELLED', modifiedBy });
  }
}
