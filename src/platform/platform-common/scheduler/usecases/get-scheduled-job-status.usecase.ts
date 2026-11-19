import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@common/application/utils/tenant-scope';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobRecord } from '../scheduler.types';

@Injectable()
export class GetScheduledJobStatusUseCase {
  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(jobId: string, tenantId?: string): Promise<ScheduledJobRecord> {
    tenantId = tenantId ?? this.requestContext.getTenantId();
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Scheduled job '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    return job;
  }
}
