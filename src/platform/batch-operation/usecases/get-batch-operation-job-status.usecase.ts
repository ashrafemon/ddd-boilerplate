import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { Injectable, NotFoundException } from '@nestjs/common';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRecord } from '../batch-operation.types';

/** Job header + aggregated counters for progress polling. */
@Injectable()
export class GetBatchOperationJobStatusUseCase {
  constructor(private readonly repository: BatchOperationJobRepositoryPort) {}

  async execute(jobId: string, tenantId?: string): Promise<BatchOperationJobRecord> {
    const job = await this.repository.findJob(jobId);
    if (!job) {
      throw new NotFoundException(`BatchOperationJob '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    return job;
  }
}
