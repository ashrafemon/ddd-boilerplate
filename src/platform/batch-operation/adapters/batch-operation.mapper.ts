import {
  BatchOperationJobRecord,
  BatchOperationJobStatus,
  BatchOperationMode,
  BatchOperationRowRecord,
  BatchOperationRowStatus,
} from '../batch-operation.types';

interface JobRow {
  id: string;
  tenantId: string | null;
  companyId: string | null;
  branchId: string | null;
  jobNo: string;
  aggregateType: string;
  operationCode: string;
  operationParams: unknown;
  mode: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  failedRecords: number;
  skippedRecords: number;
  cancelRequested: boolean;
  requestedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  rows?: RowRow[];
}

interface RowRow {
  id: string;
  entityId: string;
  status: string;
  skipReason: string | null;
  errorMessage: string | null;
  resultSnapshot: unknown;
  processingTimeMs: number | null;
  createdAt: Date;
  processedAt: Date | null;
}

export class BatchOperationMapper {
  static toJobRecord(row: JobRow): BatchOperationJobRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      branchId: row.branchId,
      jobNo: row.jobNo,
      aggregateType: row.aggregateType,
      operationCode: row.operationCode,
      operationParams: (row.operationParams as Record<string, unknown> | null) ?? null,
      mode: row.mode as BatchOperationMode,
      status: row.status as BatchOperationJobStatus,
      totalRecords: row.totalRecords,
      processedRecords: row.processedRecords,
      successRecords: row.successRecords,
      failedRecords: row.failedRecords,
      skippedRecords: row.skippedRecords,
      cancelRequested: row.cancelRequested,
      requestedBy: row.requestedBy,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      rows: row.rows ? row.rows.map(r => BatchOperationMapper.toRowRecord(r)) : undefined,
    };
  }

  static toRowRecord(row: RowRow): BatchOperationRowRecord {
    return {
      id: row.id,
      entityId: row.entityId,
      status: row.status as BatchOperationRowStatus,
      skipReason: row.skipReason,
      errorMessage: row.errorMessage,
      resultSnapshot: (row.resultSnapshot as Record<string, unknown> | null) ?? null,
      processingTimeMs: row.processingTimeMs,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
    };
  }
}

export function toPrismaJson(value: Record<string, unknown> | null): object | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as object;
}
