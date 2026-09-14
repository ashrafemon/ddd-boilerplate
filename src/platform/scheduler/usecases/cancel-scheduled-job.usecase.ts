import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';

@Injectable()
export class CancelScheduledJobUseCase {
  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly audit: AuditPort,
  ) {}

  async execute(jobId: string, tenantId?: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Scheduled job '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    await this.jobs.cancel(jobId);
    await this.audit.record({
      action: 'scheduler.job.cancel',
      entityType: 'ScheduledJob',
      entityId: jobId,
      changes: { jobType: job.jobType, status: job.status },
    });
  }

  executeByAggregate(aggregateType: string, aggregateId: string): Promise<void> {
    return this.jobs.cancelByAggregate(aggregateType, aggregateId);
  }
}
