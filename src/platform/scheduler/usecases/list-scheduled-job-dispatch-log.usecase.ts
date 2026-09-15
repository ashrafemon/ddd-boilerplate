import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobDispatchLogRecord } from '../scheduler.types';

@Injectable()
export class ListScheduledJobDispatchLogUseCase {
  constructor(
    private readonly logs: ScheduledJobDispatchLogRepositoryPort,
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(
    jobId: string,
    options?: { limit?: number; offset?: number; tenantId?: string },
  ): Promise<ScheduledJobDispatchLogRecord[]> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Scheduled job '${jobId}' not found`);
    }
    TenantScope.assertVisible(
      job.tenantId ?? null,
      options?.tenantId ?? this.requestContext.getTenantId(),
    );
    return this.logs.listByJobId(jobId, options);
  }
}
