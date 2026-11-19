import { Injectable } from '@nestjs/common';
import {
  PageQuery,
  PageResult,
  buildPageResult,
  normalizePageQuery,
} from '@common/application/types/pagination';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { ScheduledJobRecord } from '../scheduler.types';

@Injectable()
export class ListScheduledJobsUseCase {
  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(
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
