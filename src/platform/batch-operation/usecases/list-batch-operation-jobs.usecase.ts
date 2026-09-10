import { Injectable } from '@nestjs/common';
import { PageResult } from '@shared-kernel/types/pagination';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { ListBatchOperationJobsPort } from '../ports/list-batch-operation-jobs.port';
import { BatchOperationJobRecord, BatchOperationListQuery } from '../batch-operation.types';

/** Job history / list screen — headers only, no rows. */
@Injectable()
export class ListBatchOperationJobsUseCase implements ListBatchOperationJobsPort {
  constructor(private readonly repository: BatchOperationJobRepositoryPort) {}

  async execute(query: BatchOperationListQuery): Promise<PageResult<BatchOperationJobRecord>> {
    return this.repository.listJobs(query);
  }
}
