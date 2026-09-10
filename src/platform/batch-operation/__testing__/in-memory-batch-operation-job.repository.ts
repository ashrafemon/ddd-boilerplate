/* eslint-disable @typescript-eslint/require-await -- in-memory test double: the port is async, the storage is a Map */
import { randomUUID } from 'crypto';
import { PageResult } from '@shared-kernel/types/pagination';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from '../ports/batch-operation-job-row-repository.port';
import {
  BatchOperationJobRecord,
  BatchOperationListQuery,
  BatchOperationRowOutcome,
  BatchOperationRowRecord,
  ClaimedBatchOperationRow,
  NewBatchOperationJob,
} from '../batch-operation.types';

/**
 * In-memory dual-port repository for unit tests. The claim is a synchronous
 * check-and-set on the row's status, mirroring the production conditional UPDATE.
 */
export class InMemoryBatchOperationJobRepository
  implements BatchOperationJobRepositoryPort, BatchOperationJobRowRepositoryPort
{
  readonly jobs = new Map<string, BatchOperationJobRecord>();
  readonly rows = new Map<string, BatchOperationRowRecord & { jobId: string; updatedAt: Date }>();

  async createJobWithRows(
    job: NewBatchOperationJob,
    entityIds: string[],
  ): Promise<BatchOperationJobRecord> {
    const id = randomUUID();
    const now = new Date();
    const record: BatchOperationJobRecord = {
      id,
      tenantId: job.tenantId,
      companyId: job.companyId,
      branchId: job.branchId,
      jobNo: job.jobNo,
      aggregateType: job.aggregateType,
      operationCode: job.operationCode,
      operationParams: job.operationParams,
      mode: job.mode,
      status: job.status,
      totalRecords: entityIds.length,
      processedRecords: 0,
      successRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      cancelRequested: false,
      requestedBy: job.requestedBy,
      startedAt: job.status === 'RUNNING' ? now : null,
      completedAt: null,
      createdAt: now,
      rows: [],
    };
    const rowRecords = entityIds.map(entityId => {
      const rowId = randomUUID();
      const row = {
        id: rowId,
        jobId: id,
        entityId,
        status: 'PENDING' as const,
        skipReason: null,
        errorMessage: null,
        resultSnapshot: null,
        processingTimeMs: null,
        createdAt: now,
        updatedAt: now,
        processedAt: null,
      };
      this.rows.set(rowId, row);
      return row;
    });
    record.rows = rowRecords.map(stripInternal);
    this.jobs.set(id, record);
    return clone(record);
  }

  async findJob(jobId: string): Promise<BatchOperationJobRecord | null> {
    const job = this.jobs.get(jobId);
    return job ? clone({ ...job, rows: undefined }) : null;
  }

  async findJobWithRows(jobId: string): Promise<BatchOperationJobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return clone({ ...job, rows: this.rowsForJob(jobId) });
  }

  async listJobs(query: BatchOperationListQuery): Promise<PageResult<BatchOperationJobRecord>> {
    const items = [...this.jobs.values()].filter(
      j =>
        (!query.status || j.status === query.status) &&
        (!query.aggregateType || j.aggregateType === query.aggregateType),
    );
    return {
      items: items.map(j => clone({ ...j, rows: undefined })),
      page: 1,
      pageSize: 20,
      total: items.length,
      totalPages: 1,
    };
  }

  async markJobRunning(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'PENDING') {
      job.status = 'RUNNING';
      job.startedAt = new Date();
    }
  }

  async incrementProgress(
    jobId: string,
    outcome: BatchOperationRowOutcome,
  ): Promise<BatchOperationJobRecord> {
    const job = this.jobs.get(jobId)!;
    job.processedRecords += 1;
    if (outcome === 'SUCCESS') job.successRecords += 1;
    else if (outcome === 'FAILED') job.failedRecords += 1;
    else job.skippedRecords += 1;
    return clone({ ...job, rows: undefined });
  }

  async finaliseJob(jobId: string): Promise<BatchOperationJobRecord> {
    const job = this.jobs.get(jobId)!;
    job.status =
      job.failedRecords === 0
        ? 'COMPLETED'
        : job.successRecords > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';
    job.completedAt = new Date();
    return clone({ ...job, rows: undefined });
  }

  async finaliseCancelled(jobId: string): Promise<BatchOperationJobRecord> {
    const job = this.jobs.get(jobId)!;
    job.status = 'CANCELLED';
    job.completedAt = new Date();
    return clone({ ...job, rows: undefined });
  }

  async setCancelRequested(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) job.cancelRequested = true;
  }

  async isCancelRequested(jobId: string): Promise<boolean> {
    return this.jobs.get(jobId)?.cancelRequested ?? false;
  }

  async findResumableJobs(): Promise<BatchOperationJobRecord[]> {
    return [...this.jobs.values()]
      .filter(
        j =>
          (j.status === 'PENDING' || j.status === 'RUNNING') &&
          !j.cancelRequested &&
          [...this.rows.values()].some(r => r.jobId === j.id && r.status === 'PENDING'),
      )
      .map(j => clone({ ...j, rows: undefined }));
  }

  async rowIds(jobId: string, status?: 'PENDING'): Promise<string[]> {
    return [...this.rows.values()]
      .filter(r => r.jobId === jobId && (!status || r.status === status))
      .map(r => r.id);
  }

  async findRowsByJobId(jobId: string): Promise<BatchOperationRowRecord[]> {
    return this.rowsForJob(jobId);
  }

  async claimRow(rowId: string): Promise<ClaimedBatchOperationRow | null> {
    const row = this.rows.get(rowId);
    if (!row || row.status !== 'PENDING') return null;
    row.status = 'PROCESSING';
    row.updatedAt = new Date();
    return { id: row.id, entityId: row.entityId };
  }

  async markRowSuccess(
    rowId: string,
    snapshot: Record<string, unknown> | null,
    ms: number,
  ): Promise<void> {
    this.terminal(rowId, 'SUCCESS', ms, { resultSnapshot: snapshot });
  }

  async markRowFailed(rowId: string, error: string, ms: number): Promise<void> {
    this.terminal(rowId, 'FAILED', ms, { errorMessage: error });
  }

  async markRowSkipped(rowId: string, reason: string, ms: number): Promise<void> {
    this.terminal(rowId, 'SKIPPED', ms, { skipReason: reason });
  }

  async resetStuckRows(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.status === 'PROCESSING' && row.updatedAt.getTime() < cutoff) {
        row.status = 'PENDING';
        count += 1;
      }
    }
    return count;
  }

  private terminal(
    rowId: string,
    status: BatchOperationRowRecord['status'],
    ms: number,
    extra: Partial<BatchOperationRowRecord>,
  ): void {
    const row = this.rows.get(rowId);
    if (!row) return;
    row.status = status;
    row.processingTimeMs = ms;
    row.processedAt = new Date();
    row.updatedAt = new Date();
    Object.assign(row, extra);
  }

  private rowsForJob(jobId: string): BatchOperationRowRecord[] {
    return [...this.rows.values()].filter(r => r.jobId === jobId).map(stripInternal);
  }
}

function stripInternal(
  row: BatchOperationRowRecord & { jobId: string; updatedAt: Date },
): BatchOperationRowRecord {
  const { jobId: _jobId, updatedAt: _updatedAt, ...rest } = row;
  void _jobId;
  void _updatedAt;
  return { ...rest };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
