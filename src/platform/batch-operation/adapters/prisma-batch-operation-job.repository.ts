import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
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
import { BatchOperationMapper, toPrismaJson } from './batch-operation.mapper';

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
          operationParams: toPrismaJson(job.operationParams),
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
      where: { id: jobId, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  async incrementProgress(
    jobId: string,
    outcome: BatchOperationRowOutcome,
  ): Promise<BatchOperationJobRecord> {
    const counter =
      outcome === 'SUCCESS'
        ? { successRecords: { increment: 1 } }
        : outcome === 'FAILED'
          ? { failedRecords: { increment: 1 } }
          : { skippedRecords: { increment: 1 } };

    const row = await this.txHost.tx.batchOperationJob.update({
      where: { id: jobId },
      data: { processedRecords: { increment: 1 }, ...counter },
    });
    return BatchOperationMapper.toJobRecord(row);
  }

  async finaliseJob(jobId: string): Promise<BatchOperationJobRecord> {
    const job = await this.txHost.tx.batchOperationJob.findUniqueOrThrow({ where: { id: jobId } });
    const status =
      job.failedRecords === 0
        ? 'COMPLETED'
        : job.successRecords > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED';

    const row = await this.txHost.tx.batchOperationJob.update({
      where: { id: jobId },
      data: { status, completedAt: new Date() },
    });
    return BatchOperationMapper.toJobRecord(row);
  }

  async finaliseCancelled(jobId: string): Promise<BatchOperationJobRecord> {
    const row = await this.txHost.tx.batchOperationJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    return BatchOperationMapper.toJobRecord(row);
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
      SET status = 'PROCESSING', "updatedAt" = now()
      WHERE id = ${rowId}::uuid AND status = 'PENDING'
      RETURNING id, "entityId"
    `;
    return claimed[0] ?? null;
  }

  async markRowSuccess(
    rowId: string,
    resultSnapshot: Record<string, unknown> | null,
    processingTimeMs: number,
  ): Promise<void> {
    await this.txHost.tx.batchOperationJobRow.update({
      where: { id: rowId },
      data: {
        status: 'SUCCESS',
        resultSnapshot: toPrismaJson(resultSnapshot),
        processingTimeMs,
        processedAt: new Date(),
      },
    });
  }

  async markRowFailed(
    rowId: string,
    errorMessage: string,
    processingTimeMs: number,
  ): Promise<void> {
    await this.txHost.tx.batchOperationJobRow.update({
      where: { id: rowId },
      data: {
        status: 'FAILED',
        errorMessage: errorMessage.slice(0, 4000),
        processingTimeMs,
        processedAt: new Date(),
      },
    });
  }

  async markRowSkipped(rowId: string, skipReason: string, processingTimeMs: number): Promise<void> {
    await this.txHost.tx.batchOperationJobRow.update({
      where: { id: rowId },
      data: {
        status: 'SKIPPED',
        skipReason: skipReason.slice(0, 200),
        processingTimeMs,
        processedAt: new Date(),
      },
    });
  }

  async resetStuckRows(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await this.txHost.tx.batchOperationJobRow.updateMany({
      where: { status: 'PROCESSING', updatedAt: { lt: cutoff } },
      data: { status: 'PENDING' },
    });
    return result.count;
  }
}
