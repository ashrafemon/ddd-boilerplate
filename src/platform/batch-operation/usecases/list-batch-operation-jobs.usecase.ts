import { Injectable } from '@nestjs/common';
import { PageResult } from '@shared-kernel/types/pagination';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRecord, BatchOperationListQuery } from '../batch-operation.types';

/** Job history / list screen — headers only, no rows. */
@Injectable()
export class ListBatchOperationJobsUseCase {
  constructor(
    private readonly repository: BatchOperationJobRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(query: BatchOperationListQuery): Promise<PageResult<BatchOperationJobRecord>> {
    return this.repository.listJobs({
      ...query,
      tenantId: query.tenantId ?? this.requestContext.getTenantId(),
    });
  }
}
