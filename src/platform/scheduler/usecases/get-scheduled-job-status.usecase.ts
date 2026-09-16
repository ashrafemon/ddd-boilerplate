import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PageQuery,
  PageResult,
  buildPageResult,
  normalizePageQuery,
} from '@shared-kernel/types/pagination';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
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

  async list(
    query: Partial<PageQuery> & { jobType?: string; status?: string; tenantId?: string },
  ): Promise<PageResult<ScheduledJobRecord>> {
    const page = normalizePageQuery(query);
    const filter = {
      jobType: query.jobType,
      status: query.status,
      tenantId: query.tenantId ?? this.requestContext.getTenantId(),
    };
    const [items, total] = await Promise.all([
      this.jobs.list({ ...filter, limit: page.pageSize, offset: (page.page - 1) * page.pageSize }),
      this.jobs.count(filter),
    ]);
    return buildPageResult(items, total, page);
  }
}
