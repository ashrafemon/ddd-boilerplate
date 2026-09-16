import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from '../ports/batch-operation-job-row-repository.port';
import { BatchOperationJobRecord, BatchOperationStatusRules } from '../batch-operation.types';

/**
 * PHASE 7. Sets cancel_requested — the worker checks it between row claims and
 * stops claiming, letting an in-flight row finish.
 */
@Injectable()
export class CancelBatchOperationJobUseCase {
  constructor(
    private readonly jobs: BatchOperationJobRepositoryPort,
    private readonly rows: BatchOperationJobRowRepositoryPort,
    private readonly audit: AuditPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(jobId: string, tenantId?: string): Promise<BatchOperationJobRecord> {
    tenantId = tenantId ?? this.requestContext.getTenantId();
    const job = await this.jobs.findJob(jobId);
    if (!job) {
      throw new NotFoundException(`BatchOperationJob '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    if (BatchOperationStatusRules.isTerminal(job.status)) {
      throw new ConflictException(
        `BatchOperationJob '${jobId}' is ${job.status} and can no longer be cancelled`,
      );
    }

    await this.jobs.setCancelRequested(jobId);
    await this.audit.record({
      action: 'batch.cancel-requested',
      entityType: 'BatchOperationJob',
      entityId: jobId,
      changes: { status: job.status, aggregateType: job.aggregateType },
    });

    const pending = await this.rows.rowIds(jobId, 'PENDING');
    if (pending.length === 0) {
      const cancelled = await this.jobs.finaliseCancelled(jobId);
      if (cancelled) {
        return cancelled;
      }
    }
    return (await this.jobs.findJob(jobId)) ?? job;
  }
}
