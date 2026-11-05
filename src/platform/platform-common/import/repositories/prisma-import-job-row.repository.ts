import { Prisma } from '../../../generated/client';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import {
  ImportJobRowRecord,
  ImportRowExecutionStatus,
  ImportRowValidationStatus,
  RowExecutionSettlement,
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
        rawPayload: PrismaJson.toInput(r.rawPayload ?? {}),
        mappedPayload: PrismaJson.toInput(r.mappedPayload ?? {}),
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
    return { rows: rows.map(row => ImportJobRowMapper.toRecord(row)), total };
  }

  async listPendingValidation(jobId: string, limit: number): Promise<ImportJobRowRecord[]> {
    const rows = await this.txHost.tx.importJobRow.findMany({
      where: { importJobId: jobId, validationStatus: 'PENDING' },
      orderBy: { rowNumber: 'asc' },
      take: limit,
    });
    return rows.map(row => ImportJobRowMapper.toRecord(row));
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
    return rows.map(row => ImportJobRowMapper.toRecord(row));
  }

  async claimForExecution(jobId: string, limit: number): Promise<ImportJobRowRecord[]> {
    const claimed = await this.txHost.tx.$queryRaw<
      Array<{
        id: string;
        tenantId: string | null;
        importJobId: string;
        rowNumber: number;
        rawPayload: Prisma.JsonValue | null;
        mappedPayload: Prisma.JsonValue | null;
        validationStatus: ImportRowValidationStatus;
        executionStatus: ImportRowExecutionStatus;
        validationErrors: Prisma.JsonValue | null;
        errorMessage: string | null;
        entityId: string | null;
        secondaryEntityIds: Prisma.JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        processedAt: Date | null;
        executionClaimToken: number;
      }>
    >`
      UPDATE import_job_rows
      SET "executionStatus" = 'PROCESSING',
          "executionClaimToken" = "executionClaimToken" + 1,
          "updatedAt" = now()
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
    return claimed.map(row => ImportJobRowMapper.toRecord(row));
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

  async applyExecutionResults(jobId: string, results: RowExecutionSettlement[]): Promise<number> {
    let applied = 0;
    for (const r of results) {
      const res = await this.txHost.tx.importJobRow.updateMany({
        where: {
          importJobId: jobId,
          rowNumber: r.rowNumber,
          executionStatus: 'PROCESSING',
          // Fencing: without the token the settlement came from this very
          // claim, stale-worker writes land on rows they no longer own.
          executionClaimToken: r.executionClaimToken,
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
    const reset = await this.txHost.tx.$executeRaw`
      UPDATE import_job_rows r
      SET "executionStatus" = 'PENDING',
          "executionClaimToken" = r."executionClaimToken" + 1,
          "updatedAt" = now()
      FROM import_jobs j
      WHERE r."importJobId" = j.id
        AND j.status IN ('VALIDATED', 'EXECUTING')
        AND r."executionStatus" = 'PROCESSING'
        AND r."updatedAt" < ${olderThan}`;
    await this.txHost.tx.$executeRaw`
      UPDATE import_job_rows r
      SET "executionStatus" = 'SKIPPED',
          "errorMessage" = 'ABANDONED_ON_TERMINAL_JOB',
          "updatedAt" = now()
      FROM import_jobs j
      WHERE r."importJobId" = j.id
        AND j.status IN ('COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED')
        AND r."executionStatus" = 'PROCESSING'`;
    return reset;
  }
}

export class ImportJobRowMapper {
  static toRecord(row: {
    id: string;
    tenantId: string | null;
    importJobId: string;
    rowNumber: number;
    rawPayload: Prisma.JsonValue | null;
    mappedPayload: Prisma.JsonValue | null;
    validationStatus: ImportRowValidationStatus;
    executionStatus: ImportRowExecutionStatus;
    validationErrors: Prisma.JsonValue | null;
    errorMessage: string | null;
    entityId: string | null;
    secondaryEntityIds: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    processedAt: Date | null;
    executionClaimToken?: number;
  }): ImportJobRowRecord {
    return {
      id: row.id,
      tenantId: row.tenantId ?? undefined,
      importJobId: row.importJobId,
      rowNumber: row.rowNumber,
      rawPayload: PrismaJson.as<Record<string, string>>(row.rawPayload) ?? undefined,
      mappedPayload: PrismaJson.as<Record<string, string>>(row.mappedPayload) ?? undefined,
      validationStatus: row.validationStatus,
      executionStatus: row.executionStatus,
      validationErrors: PrismaJson.as<string[]>(row.validationErrors) ?? undefined,
      errorMessage: row.errorMessage ?? undefined,
      entityId: row.entityId ?? undefined,
      secondaryEntityIds: PrismaJson.as<string[]>(row.secondaryEntityIds) ?? undefined,
      executionClaimToken: row.executionClaimToken,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      processedAt: row.processedAt ?? undefined,
    };
  }
}
