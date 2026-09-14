/* eslint-disable @typescript-eslint/require-await -- in-memory test double: the port is async, the storage is a Map */
import { randomUUID } from 'crypto';
import { PageResult } from '@shared-kernel/types/pagination';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from '../ports/batch-operation-job-row-repository.port';
import {
  BatchOperationJobRecord,
  BatchOperationListQuery,
  BatchOperationRowRecord,
  BatchOperationRowSettlement,
  ClaimedBatchOperationRow,
  NewBatchOperationJob,
} from '../batch-operation.types';

/**
 * In-memory dual-port repository for unit tests. The claim/step mirrors
 * production exactly: synchronous check-and-set on the row's status plus a
 * fencing `claimToken` that terminal writes must present.
 */
type InternalRow = BatchOperationRowRecord & {
  jobId: string;
  updatedAt: Date;
  claimToken: number;
};

export class InMemoryBatchOperationJobRepository
  implements BatchOperationJobRepositoryPort, BatchOperationJobRowRepositoryPort
{
  readonly jobs = new Map<string, BatchOperationJobRecord>();
  readonly rows = new Map<string, InternalRow>();

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
      const row: InternalRow = {
        id: rowId,
        jobId: id,
        entityId,
        status: 'PENDING',
        claimToken: 0,
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
        (!query.tenantId || j.tenantId === query.tenantId) &&
        (!query.status || j.status === query.status) &&
        (!query.aggregateType || j.aggregateType === query.aggregateType),
    );
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    return {
      items: items
        .slice((page - 1) * pageSize, page * pageSize)
        .map(j => clone({ ...j, rows: undefined })),
      page,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    };
  }

  async markJobRunning(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'PENDING' && !job.cancelRequested) {
      job.status = 'RUNNING';
      job.startedAt = new Date();
    }
  }

  async finaliseJob(jobId: string): Promise<BatchOperationJobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== 'PENDING' && job.status !== 'RUNNING')) {
      return null;
    }
    job.status =
      job.failedRecords === 0
        ? 'COMPLETED'
        : job.successRecords > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';
    job.completedAt = new Date();
    return clone({ ...job, rows: undefined });
  }

  async finaliseCancelled(jobId: string): Promise<BatchOperationJobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== 'PENDING' && job.status !== 'RUNNING')) {
      return null;
    }
    job.status = 'CANCELLED';
    job.completedAt = new Date();
    return clone({ ...job, rows: undefined });
  }

  async markJobFailed(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'PENDING' || job.status === 'RUNNING')) {
      job.status = 'FAILED';
      job.completedAt = new Date();
    }
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
          j.mode === 'ASYNC' &&
          !j.cancelRequested &&
          [...this.rows.values()].some(r => r.jobId === j.id && r.status === 'PENDING'),
      )
      .map(j => clone({ ...j, rows: undefined }));
  }

  async recountJobCounters(): Promise<number> {
    let changed = 0;
    for (const job of this.jobs.values()) {
      if (job.status !== 'PENDING' && job.status !== 'RUNNING') continue;
      const rows = [...this.rows.values()].filter(r => r.jobId === job.id);
      const counts = {
        processedRecords: rows.filter(r => r.status !== 'PENDING' && r.status !== 'PROCESSING')
          .length,
        successRecords: rows.filter(r => r.status === 'SUCCESS').length,
        failedRecords: rows.filter(r => r.status === 'FAILED').length,
        skippedRecords: rows.filter(r => r.status === 'SKIPPED').length,
      };
      if (
        job.processedRecords !== counts.processedRecords ||
        job.successRecords !== counts.successRecords ||
        job.failedRecords !== counts.failedRecords ||
        job.skippedRecords !== counts.skippedRecords
      ) {
        Object.assign(job, counts);
        changed += 1;
      }
    }
    return changed;
  }

  async findCompletableJobs(): Promise<BatchOperationJobRecord[]> {
    return [...this.jobs.values()]
      .filter(
        j =>
          (j.status === 'PENDING' || j.status === 'RUNNING') &&
          j.mode === 'ASYNC' &&
          ![...this.rows.values()].some(
            r => r.jobId === j.id && (r.status === 'PENDING' || r.status === 'PROCESSING'),
          ),
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
    row.claimToken += 1;
    row.status = 'PROCESSING';
    row.updatedAt = new Date();
    return { id: row.id, entityId: row.entityId, jobId: row.jobId, claimToken: row.claimToken };
  }

  async settleRow(
    rowId: string,
    jobId: string,
    claimToken: number,
    settlement: BatchOperationRowSettlement,
  ): Promise<boolean> {
    const row = this.rows.get(rowId);
    if (!row || row.status !== 'PROCESSING' || row.claimToken !== claimToken) {
      return false;
    }
    row.status = settlement.outcome;
    row.resultSnapshot = settlement.resultSnapshot ?? null;
    row.errorMessage = settlement.errorMessage ?? null;
    row.skipReason = settlement.skipReason ?? null;
    row.processingTimeMs = settlement.processingTimeMs;
    row.processedAt = new Date();
    row.updatedAt = new Date();

    const job = this.jobs.get(jobId);
    if (job) {
      job.processedRecords += 1;
      if (settlement.outcome === 'SUCCESS') job.successRecords += 1;
      else if (settlement.outcome === 'FAILED') job.failedRecords += 1;
      else job.skippedRecords += 1;
    }
    return true;
  }

  async resetStuckRows(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.status !== 'PROCESSING' || row.updatedAt.getTime() >= cutoff) {
        continue;
      }
      const job = this.jobs.get(row.jobId);
      if (job && (job.status === 'PENDING' || job.status === 'RUNNING')) {
        row.claimToken += 1;
        row.status = 'PENDING';
        row.updatedAt = new Date();
        count += 1;
      } else if (job) {
        row.status = 'SKIPPED';
        row.skipReason = 'ABANDONED_ON_TERMINAL_JOB';
        row.updatedAt = new Date();
      }
    }
    return count;
  }

  private rowsForJob(jobId: string): BatchOperationRowRecord[] {
    return [...this.rows.values()].filter(r => r.jobId === jobId).map(stripInternal);
  }
}

function stripInternal(row: InternalRow): BatchOperationRowRecord {
  const { jobId: _jobId, updatedAt: _updatedAt, claimToken: _claimToken, ...rest } = row;
  void _jobId;
  void _updatedAt;
  void _claimToken;
  return { ...rest };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
