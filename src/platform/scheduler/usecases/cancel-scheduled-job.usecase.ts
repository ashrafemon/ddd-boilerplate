import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';

@Injectable()
export class CancelScheduledJobUseCase {
  constructor(private readonly jobs: ScheduledJobRepositoryPort) {}

  async execute(jobId: string, tenantId?: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Scheduled job '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    return this.jobs.cancel(jobId);
  }

  executeByAggregate(aggregateType: string, aggregateId: string): Promise<void> {
    return this.jobs.cancelByAggregate(aggregateType, aggregateId);
  }
}
