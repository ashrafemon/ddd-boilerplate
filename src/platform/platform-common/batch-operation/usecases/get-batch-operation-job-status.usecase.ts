import { TenantScope } from '@common/application/utils/tenant-scope';
import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRecord } from '../batch-operation.types';

/** Job header + aggregated counters for progress polling. */
@Injectable()
export class GetBatchOperationJobStatusUseCase {
  constructor(
    private readonly repository: BatchOperationJobRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(jobId: string, tenantId?: string): Promise<BatchOperationJobRecord> {
    tenantId = tenantId ?? this.requestContext.getTenantId();
    const job = await this.repository.findJob(jobId);
    if (!job) {
      throw new NotFoundException(`BatchOperationJob '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    return job;
  }
}
