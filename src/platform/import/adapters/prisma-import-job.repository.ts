import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PageResult, buildPageResult } from '@shared-kernel/types/pagination';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import {
  ColumnMapping,
  ImportDescriptor,
  ImportJobListQuery,
  ImportJobRecord,
  ImportJobStatus,
  ImportOptions,
  NewImportJob,
  StatusHistoryEntry,
} from '../import.types';

type JobRow = {
  id: string;
  tenantId: string | null;
  jobNo: string;
  entityKey: string;
  status: ImportJobStatus;
  descriptorVersion: number;
  descriptorSnapshot: unknown;
  columnMapping: unknown;
  statusHistory: unknown;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  appliedRows: number;
  failedRows: number;
  cancelRequested: boolean;
  sourceStorageObjectId: string | null;
  errorReportStorageObjectId: string | null;
  options: unknown;
  requestedBy: string | null;
  traceId: string | null;
  buildSha: string | null;
  heartbeatAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

@Injectable()
export class PrismaImportJobRepository implements ImportJobRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async create(job: NewImportJob): Promise<ImportJobRecord> {
    const history: StatusHistoryEntry[] = [
      {
        from: 'PENDING_UPLOAD',
        to: 'UPLOADED',
        at: new Date(),
        actor: job.requestedBy,
        detail: 'job created after upload verification',
      },
    ];
    const created = await this.txHost.tx.importJob.create({
      data: {
        tenantId: job.tenantId ?? null,
        jobNo: job.jobNo,
        entityKey: job.entityKey,
        status: 'UPLOADED',
        descriptorVersion: job.descriptorVersion,
        descriptorSnapshot: toJsonInput(job.descriptorSnapshot),
        statusHistory: toJsonInput(history),
        sourceStorageObjectId: job.sourceStorageObjectId,
        options: toJsonInput(job.options ?? {}),
        requestedBy: job.requestedBy ?? null,
        traceId: job.traceId ?? null,
        buildSha: job.buildSha ?? null,
      },
    });
    return mapJob(created);
  }

  async findById(jobId: string): Promise<ImportJobRecord | null> {
    const row = await this.txHost.tx.importJob.findUnique({ where: { id: jobId } });
    return row ? mapJob(row) : null;
  }

  async list(query: ImportJobListQuery): Promise<PageResult<ImportJobRecord>> {
    const where = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.entityKey ? { entityKey: query.entityKey } : {}),
    };
    const [total, rows] = await Promise.all([
      this.txHost.tx.importJob.count({ where }),
      this.txHost.tx.importJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return buildPageResult(
      rows.map(r => mapJob(r as JobRow)),
      total,
      { page: query.page, pageSize: query.pageSize },
    );
  }

  async transitionStatus(
    jobId: string,
    from: ImportJobStatus | ImportJobStatus[],
    to: ImportJobStatus,
    history: StatusHistoryEntry,
  ): Promise<ImportJobRecord> {
    const allowed = Array.isArray(from) ? from : [from];
    const updated = await this.txHost.tx.importJob.updateMany({
      where: { id: jobId, status: { in: allowed } },
      data: {
        status: to,
        statusHistory: undefined as never,
      },
    });
    if (updated.count === 0) {
      const current = await this.findById(jobId);
      throw new Error(
        `Failed to transition import job ${jobId} to ${to} from ${allowed.join('|')} (current=${current?.status})`,
      );
    }
    const job = await this.txHost.tx.importJob.findUniqueOrThrow({ where: { id: jobId } });
    const historyList = [
      ...((job.statusHistory as unknown as StatusHistoryEntry[]) ?? []),
      history,
    ];
    const saved = await this.txHost.tx.importJob.update({
      where: { id: jobId },
      data: {
        statusHistory: toJsonInput(historyList),
        version: { increment: 1 },
        ...(to === 'PARSING' || to === 'VALIDATING' || to === 'EXECUTING'
          ? { heartbeatAt: new Date() }
          : {}),
      },
    });
    return mapJob(saved);
  }

  async setColumnMapping(jobId: string, mapping: ColumnMapping): Promise<ImportJobRecord> {
    const saved = await this.txHost.tx.importJob.update({
      where: { id: jobId },
      data: {
        columnMapping: toJsonInput(mapping),
        version: { increment: 1 },
      },
    });
    return mapJob(saved);
  }

  async updateCounters(
    jobId: string,
    counters: Partial<
      Pick<
        ImportJobRecord,
        'totalRows' | 'validRows' | 'invalidRows' | 'appliedRows' | 'failedRows'
      >
    >,
  ): Promise<void> {
    await this.txHost.tx.importJob.update({
      where: { id: jobId },
      data: {
        ...counters,
        heartbeatAt: new Date(),
      },
    });
  }

  async setCancelRequested(jobId: string): Promise<void> {
    await this.txHost.tx.importJob.update({
      where: { id: jobId },
      data: { cancelRequested: true },
    });
  }

  async isCancelRequested(jobId: string): Promise<boolean> {
    const row = await this.txHost.tx.importJob.findUnique({
      where: { id: jobId },
      select: { cancelRequested: true },
    });
    return row?.cancelRequested ?? false;
  }

  async markTerminal(
    jobId: string,
    status: Extract<
      ImportJobStatus,
      'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED'
    >,
    history: StatusHistoryEntry,
  ): Promise<ImportJobRecord> {
    const job = await this.txHost.tx.importJob.findUniqueOrThrow({ where: { id: jobId } });
    const historyList = [
      ...((job.statusHistory as unknown as StatusHistoryEntry[]) ?? []),
      history,
    ];
    const saved = await this.txHost.tx.importJob.update({
      where: { id: jobId },
      data: {
        status,
        statusHistory: toJsonInput(historyList),
        completedAt: new Date(),
        lockedUntil: null,
        lockedBy: null,
        version: { increment: 1 },
      },
    });
    return mapJob(saved);
  }

  async findStaleJobs(olderThan: Date): Promise<ImportJobRecord[]> {
    const rows = await this.txHost.tx.importJob.findMany({
      where: {
        status: { in: ['PARSING', 'VALIDATING', 'EXECUTING'] },
        OR: [{ heartbeatAt: { lt: olderThan } }, { heartbeatAt: null }],
      },
    });
    return rows.map(r => mapJob(r as JobRow));
  }

  async attachErrorReport(jobId: string, errorReportStorageObjectId: string): Promise<void> {
    await this.txHost.tx.importJob.update({
      where: { id: jobId },
      data: { errorReportStorageObjectId },
    });
  }
}

function mapJob(row: JobRow): ImportJobRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? undefined,
    jobNo: row.jobNo,
    entityKey: row.entityKey,
    status: row.status,
    descriptorVersion: row.descriptorVersion,
    descriptorSnapshot: row.descriptorSnapshot as ImportDescriptor,
    columnMapping: (row.columnMapping as ColumnMapping) ?? undefined,
    statusHistory: (row.statusHistory as StatusHistoryEntry[]) ?? [],
    totalRows: row.totalRows,
    validRows: row.validRows,
    invalidRows: row.invalidRows,
    appliedRows: row.appliedRows,
    failedRows: row.failedRows,
    cancelRequested: row.cancelRequested,
    sourceStorageObjectId: row.sourceStorageObjectId ?? undefined,
    errorReportStorageObjectId: row.errorReportStorageObjectId ?? undefined,
    options: (row.options as ImportOptions) ?? undefined,
    requestedBy: row.requestedBy ?? undefined,
    traceId: row.traceId ?? undefined,
    buildSha: row.buildSha ?? undefined,
    heartbeatAt: row.heartbeatAt ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? undefined,
  };
}
function toJsonInput(value: unknown): object {
  return JSON.parse(JSON.stringify(value)) as object;
}
