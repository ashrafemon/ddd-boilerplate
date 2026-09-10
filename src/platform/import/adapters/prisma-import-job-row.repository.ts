import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import {
  ImportJobRowRecord,
  ImportRowExecutionStatus,
  ImportRowValidationStatus,
  RowResult,
  RowVerdict,
} from '../import.types';

@Injectable()
export class PrismaImportJobRowRepository implements ImportJobRowRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async bulkInsert(
    rows: Array<{
      tenantId?: string;
      importJobId: string;
      rowNumber: number;
      rawPayload?: Record<string, unknown>;
      mappedPayload?: Record<string, unknown>;
    }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.txHost.tx.importJobRow.createMany({
      data: rows.map(r => ({
        tenantId: r.tenantId ?? null,
        importJobId: r.importJobId,
        rowNumber: r.rowNumber,
        rawPayload: toJsonInput(r.rawPayload ?? {}),
        mappedPayload: toJsonInput(r.mappedPayload ?? {}),
      })),
      skipDuplicates: true,
    });
  }

  async listByJob(
    jobId: string,
    opts?: { page?: number; pageSize?: number; validationStatus?: ImportRowValidationStatus },
  ): Promise<{ rows: ImportJobRowRecord[]; total: number }> {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 50;
    const where = {
      importJobId: jobId,
      ...(opts?.validationStatus ? { validationStatus: opts.validationStatus } : {}),
    };
    const [total, rows] = await Promise.all([
      this.txHost.tx.importJobRow.count({ where }),
      this.txHost.tx.importJobRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { rows: rows.map(mapRow), total };
  }

  async listPendingValidation(jobId: string, limit: number): Promise<ImportJobRowRecord[]> {
    const rows = await this.txHost.tx.importJobRow.findMany({
      where: { importJobId: jobId, validationStatus: 'PENDING' },
      orderBy: { rowNumber: 'asc' },
      take: limit,
    });
    return rows.map(mapRow);
  }

  async listPendingExecution(jobId: string, limit: number): Promise<ImportJobRowRecord[]> {
    const rows = await this.txHost.tx.importJobRow.findMany({
      where: {
        importJobId: jobId,
        validationStatus: 'VALID',
        executionStatus: 'PENDING',
      },
      orderBy: { rowNumber: 'asc' },
      take: limit,
    });
    return rows.map(mapRow);
  }

  async claimForExecution(jobId: string, limit: number): Promise<ImportJobRowRecord[]> {
    const claimed = await this.txHost.tx.$queryRaw<
      Array<{
        id: string;
        tenantId: string | null;
        importJobId: string;
        rowNumber: number;
        rawPayload: unknown;
        mappedPayload: unknown;
        validationStatus: ImportRowValidationStatus;
        executionStatus: ImportRowExecutionStatus;
        validationErrors: unknown;
        errorMessage: string | null;
        entityId: string | null;
        secondaryEntityIds: unknown;
        createdAt: Date;
        updatedAt: Date;
        processedAt: Date | null;
      }>
    >`
      UPDATE import_job_rows
      SET "executionStatus" = 'PROCESSING', "updatedAt" = now()
      WHERE id IN (
        SELECT id FROM import_job_rows
        WHERE "importJobId" = ${jobId}::uuid
          AND "validationStatus" = 'VALID'
          AND "executionStatus" = 'PENDING'
        ORDER BY "rowNumber" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;
    return claimed.map(mapRow);
  }

  async applyValidationVerdicts(jobId: string, verdicts: RowVerdict[]): Promise<void> {
    for (const v of verdicts) {
      await this.txHost.tx.importJobRow.updateMany({
        where: { importJobId: jobId, rowNumber: v.rowNumber },
        data: {
          validationStatus: v.status,
          validationErrors: v.errors ?? [],
        },
      });
    }
  }

  async applyExecutionResults(jobId: string, results: RowResult[]): Promise<number> {
    let applied = 0;
    for (const r of results) {
      const res = await this.txHost.tx.importJobRow.updateMany({
        where: {
          importJobId: jobId,
          rowNumber: r.rowNumber,
          executionStatus: { in: ['PENDING', 'PROCESSING'] },
        },
        data: {
          executionStatus: r.status,
          entityId: r.entityId ?? null,
          secondaryEntityIds: r.secondaryEntityIds ?? [],
          errorMessage: r.errorMessage ?? null,
          processedAt: new Date(),
        },
      });
      applied += res.count;
    }
    return applied;
  }

  async countByValidationStatus(jobId: string): Promise<Record<ImportRowValidationStatus, number>> {
    const groups = await this.txHost.tx.importJobRow.groupBy({
      by: ['validationStatus'],
      where: { importJobId: jobId },
      _count: { _all: true },
    });
    const out: Record<ImportRowValidationStatus, number> = {
      PENDING: 0,
      VALID: 0,
      INVALID: 0,
      DUPLICATE: 0,
    };
    for (const g of groups) {
      out[g.validationStatus] = g._count._all;
    }
    return out;
  }

  async countByExecutionStatus(jobId: string): Promise<Record<ImportRowExecutionStatus, number>> {
    const groups = await this.txHost.tx.importJobRow.groupBy({
      by: ['executionStatus'],
      where: { importJobId: jobId },
      _count: { _all: true },
    });
    const out: Record<ImportRowExecutionStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      APPLIED: 0,
      FAILED: 0,
      SKIPPED: 0,
    };
    for (const g of groups) {
      out[g.executionStatus] = g._count._all;
    }
    return out;
  }

  async deleteByJob(jobId: string): Promise<void> {
    await this.txHost.tx.importJobRow.deleteMany({ where: { importJobId: jobId } });
  }

  async resetStaleProcessing(olderThan: Date): Promise<number> {
    const res = await this.txHost.tx.importJobRow.updateMany({
      where: {
        executionStatus: 'PROCESSING',
        updatedAt: { lt: olderThan },
      },
      data: { executionStatus: 'PENDING' },
    });
    return res.count;
  }
}

function mapRow(row: {
  id: string;
  tenantId: string | null;
  importJobId: string;
  rowNumber: number;
  rawPayload: unknown;
  mappedPayload: unknown;
  validationStatus: ImportRowValidationStatus;
  executionStatus: ImportRowExecutionStatus;
  validationErrors: unknown;
  errorMessage: string | null;
  entityId: string | null;
  secondaryEntityIds: unknown;
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
}): ImportJobRowRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? undefined,
    importJobId: row.importJobId,
    rowNumber: row.rowNumber,
    rawPayload: (row.rawPayload as Record<string, unknown>) ?? undefined,
    mappedPayload: (row.mappedPayload as Record<string, unknown>) ?? undefined,
    validationStatus: row.validationStatus,
    executionStatus: row.executionStatus,
    validationErrors: (row.validationErrors as string[]) ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    entityId: row.entityId ?? undefined,
    secondaryEntityIds: (row.secondaryEntityIds as string[]) ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    processedAt: row.processedAt ?? undefined,
  };
}
function toJsonInput(value: unknown): object {
  return JSON.parse(JSON.stringify(value)) as object;
}
