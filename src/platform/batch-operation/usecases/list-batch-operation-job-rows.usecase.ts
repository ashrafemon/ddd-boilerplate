import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from '../ports/batch-operation-job-row-repository.port';
import { BatchOperationRowRecord } from '../batch-operation.types';

/** Row-level detail for audit / failure drill-down. */
@Injectable()
export class ListBatchOperationJobRowsUseCase {
  constructor(
    private readonly jobs: BatchOperationJobRepositoryPort,
    private readonly rows: BatchOperationJobRowRepositoryPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(jobId: string, tenantId?: string): Promise<BatchOperationRowRecord[]> {
    tenantId = tenantId ?? this.requestContext.getTenantId();
    const job = await this.jobs.findJob(jobId);
    if (!job) {
      throw new NotFoundException(`BatchOperationJob '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    return this.rows.findRowsByJobId(jobId);
  }
}
