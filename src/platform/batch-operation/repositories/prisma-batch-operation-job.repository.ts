import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PageResult } from '@shared-kernel/types/pagination';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
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
import { BatchOperationMapper } from './batch-operation.mapper';

const ROW_INCLUDE = { rows: { orderBy: { createdAt: 'asc' as const } } };

/**
 * Prisma adapter for both job and row outbound ports. One class, two ports —
 * both tables are pipeline bookkeeping and share the same TransactionHost.
 */
@Injectable()
export class PrismaBatchOperationJobRepository
  implements BatchOperationJobRepositoryPort, BatchOperationJobRowRepositoryPort
{
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async createJobWithRows(
    job: NewBatchOperationJob,
    entityIds: string[],
  ): Promise<BatchOperationJobRecord> {
    return this.txHost.tx.$transaction(async tx => {
      const created = await tx.batchOperationJob.create({
        data: {
          jobNo: job.jobNo,
          aggregateType: job.aggregateType,
          operationCode: job.operationCode,
          operationParams: PrismaJson.toInput(job.operationParams),
          mode: job.mode,
          status: job.status,
          totalRecords: entityIds.length,
          tenantId: job.tenantId,
          companyId: job.companyId,
          branchId: job.branchId,
          requestedBy: job.requestedBy,
          startedAt: job.status === 'RUNNING' ? new Date() : null,
        },
      });

      await tx.batchOperationJobRow.createMany({
        data: entityIds.map(entityId => ({
          batchOperationJobId: created.id,
          tenantId: job.tenantId,
          entityId,
          status: 'PENDING' as const,
        })),
      });

      const withRows = await tx.batchOperationJob.findUniqueOrThrow({
        where: { id: created.id },
        include: ROW_INCLUDE,
      });
      return BatchOperationMapper.toJobRecord(withRows);
    });
  }

  async findJob(jobId: string): Promise<BatchOperationJobRecord | null> {
    const row = await this.txHost.tx.batchOperationJob.findUnique({ where: { id: jobId } });
    return row ? BatchOperationMapper.toJobRecord(row) : null;
  }

  async findJobWithRows(jobId: string): Promise<BatchOperationJobRecord | null> {
    const row = await this.txHost.tx.batchOperationJob.findUnique({
      where: { id: jobId },
      include: ROW_INCLUDE,
    });
    return row ? BatchOperationMapper.toJobRecord(row) : null;
  }

  async listJobs(query: BatchOperationListQuery): Promise<PageResult<BatchOperationJobRecord>> {
    const where = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.aggregateType ? { aggregateType: query.aggregateType } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.txHost.tx.batchOperationJob.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.txHost.tx.batchOperationJob.count({ where }),
    ]);
    return {
      items: rows.map(row => BatchOperationMapper.toJobRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async markJobRunning(jobId: string): Promise<void> {
    await this.txHost.tx.batchOperationJob.updateMany({
      where: { id: jobId, status: 'PENDING', cancelRequested: false },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  async finaliseJob(jobId: string): Promise<BatchOperationJobRecord | null> {
    const job = await this.txHost.tx.batchOperationJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return null;
    }
    const status =
      job.failedRecords === 0
        ? 'COMPLETED'
        : job.successRecords > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';

    const updated = await this.txHost.tx.batchOperationJob.updateMany({
      where: { id: jobId, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status, completedAt: new Date() },
    });
    if (updated.count !== 1) {
      return null;
    }
    return BatchOperationMapper.toJobRecord({ ...job, status, completedAt: new Date() });
  }

  async finaliseCancelled(jobId: string): Promise<BatchOperationJobRecord | null> {
    const updated = await this.txHost.tx.batchOperationJob.updateMany({
      where: { id: jobId, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    if (updated.count !== 1) {
      return null;
    }
    const job = await this.txHost.tx.batchOperationJob.findUnique({ where: { id: jobId } });
    return job ? BatchOperationMapper.toJobRecord({ ...job, status: 'CANCELLED' }) : null;
  }

  async markJobFailed(jobId: string): Promise<void> {
    await this.txHost.tx.batchOperationJob.updateMany({
      where: { id: jobId, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: 'FAILED', completedAt: new Date() },
    });
  }

  async recountJobCounters(): Promise<number> {
    return this.txHost.tx.$executeRaw`
      UPDATE "batch_operation_jobs" j
      SET "processedRecords" = s.processed,
          "successRecords"   = s.success,
          "failedRecords"    = s.failed,
          "skippedRecords"   = s.skipped
      FROM (
        SELECT "batchOperationJobId" AS job_id,
               count(*) FILTER (WHERE status IN ('SUCCESS','FAILED','SKIPPED'))::int AS processed,
               count(*) FILTER (WHERE status = 'SUCCESS')::int  AS success,
               count(*) FILTER (WHERE status = 'FAILED')::int   AS failed,
               count(*) FILTER (WHERE status = 'SKIPPED')::int  AS skipped
        FROM "batch_operation_job_rows"
        GROUP BY "batchOperationJobId"
      ) s
      WHERE j.id = s.job_id AND j.status IN ('PENDING', 'RUNNING')
        AND (j."processedRecords" <> s.processed
             OR j."successRecords" <> s.success
             OR j."failedRecords" <> s.failed
             OR j."skippedRecords" <> s.skipped)`;
  }

  async findCompletableJobs(): Promise<BatchOperationJobRecord[]> {
    const rows = await this.txHost.tx.batchOperationJob.findMany({
      where: {
        status: { in: ['PENDING', 'RUNNING'] },
        mode: 'ASYNC',
        rows: { none: { status: { in: ['PENDING', 'PROCESSING'] } } },
      },
      take: 100,
    });
    return rows.map(row => BatchOperationMapper.toJobRecord(row));
  }

  async setCancelRequested(jobId: string): Promise<void> {
    await this.txHost.tx.batchOperationJob.update({
      where: { id: jobId },
      data: { cancelRequested: true },
    });
  }

  async isCancelRequested(jobId: string): Promise<boolean> {
    const row = await this.txHost.tx.batchOperationJob.findUnique({
      where: { id: jobId },
      select: { cancelRequested: true },
    });
    return row?.cancelRequested ?? false;
  }

  async findResumableJobs(): Promise<BatchOperationJobRecord[]> {
    const rows = await this.txHost.tx.batchOperationJob.findMany({
      where: {
        status: { in: ['PENDING', 'RUNNING'] },
        mode: 'ASYNC',
        cancelRequested: false,
        rows: { some: { status: 'PENDING' } },
      },
      take: 100,
    });
    return rows.map(row => BatchOperationMapper.toJobRecord(row));
  }

  // --- row port ---

  async rowIds(jobId: string, status?: 'PENDING'): Promise<string[]> {
    const rows = await this.txHost.tx.batchOperationJobRow.findMany({
      where: { batchOperationJobId: jobId, ...(status ? { status } : {}) },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(row => row.id);
  }

  async findRowsByJobId(jobId: string): Promise<BatchOperationRowRecord[]> {
    const rows = await this.txHost.tx.batchOperationJobRow.findMany({
      where: { batchOperationJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(row => BatchOperationMapper.toRowRecord(row));
  }

  async claimRow(rowId: string): Promise<ClaimedBatchOperationRow | null> {
    const claimed = await this.txHost.tx.$queryRaw<ClaimedBatchOperationRow[]>`
      UPDATE "batch_operation_job_rows"
      SET status = 'PROCESSING', "claimToken" = "claimToken" + 1, "updatedAt" = now()
      WHERE id = ${rowId}::uuid AND status = 'PENDING'
      RETURNING id, "entityId", "batchOperationJobId" AS "jobId", "claimToken"
    `;
    return claimed[0] ?? null;
  }

  async settleRow(
    rowId: string,
    jobId: string,
    claimToken: number,
    settlement: BatchOperationRowSettlement,
  ): Promise<boolean> {
    const outcome = settlement.outcome;
    return this.txHost.tx.$transaction(async tx => {
      const settled = await tx.batchOperationJobRow.updateMany({
        where: { id: rowId, status: 'PROCESSING', claimToken },
        data: {
          status: outcome,
          resultSnapshot:
            outcome === 'SUCCESS'
              ? PrismaJson.toInput(settlement.resultSnapshot ?? null)
              : undefined,
          errorMessage:
            outcome === 'FAILED' ? (settlement.errorMessage ?? '').slice(0, 4000) : undefined,
          skipReason:
            outcome === 'SKIPPED' ? (settlement.skipReason ?? '').slice(0, 200) : undefined,
          processingTimeMs: settlement.processingTimeMs,
          processedAt: new Date(),
        },
      });
      if (settled.count !== 1) {
        // Stale claim token: a re-claim won the row; this settlement is discarded.
        return false;
      }
      await tx.batchOperationJob.update({
        where: { id: jobId },
        data: {
          processedRecords: { increment: 1 },
          ...(outcome === 'SUCCESS'
            ? { successRecords: { increment: 1 } }
            : outcome === 'FAILED'
              ? { failedRecords: { increment: 1 } }
              : { skippedRecords: { increment: 1 } }),
        },
      });
      return true;
    });
  }

  async resetStuckRows(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const reset = await this.txHost.tx.$executeRaw`
      UPDATE "batch_operation_job_rows" r
      SET status = 'PENDING', "claimToken" = r."claimToken" + 1, "updatedAt" = now()
      FROM "batch_operation_jobs" j
      WHERE r."batchOperationJobId" = j.id
        AND j.status IN ('PENDING', 'RUNNING')
        AND r.status = 'PROCESSING'
        AND r."updatedAt" < ${cutoff}`;
    await this.txHost.tx.$executeRaw`
      UPDATE "batch_operation_job_rows" r
      SET status = 'SKIPPED', "skipReason" = 'ABANDONED_ON_TERMINAL_JOB', "updatedAt" = now()
      FROM "batch_operation_jobs" j
      WHERE r."batchOperationJobId" = j.id
        AND j.status NOT IN ('PENDING', 'RUNNING')
        AND r.status = 'PROCESSING'`;
    return reset;
  }
}
