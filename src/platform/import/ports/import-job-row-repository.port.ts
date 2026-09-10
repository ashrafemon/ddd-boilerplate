import {
  ImportJobRowRecord,
  ImportRowExecutionStatus,
  ImportRowValidationStatus,
  RowResult,
  RowVerdict,
} from '../import.types';

export abstract class ImportJobRowRepositoryPort {
  abstract bulkInsert(
    rows: Array<{
      tenantId?: string;
      importJobId: string;
      rowNumber: number;
      rawPayload?: Record<string, unknown>;
      mappedPayload?: Record<string, unknown>;
    }>,
  ): Promise<void>;

  abstract listByJob(
    jobId: string,
    opts?: { page?: number; pageSize?: number; validationStatus?: ImportRowValidationStatus },
  ): Promise<{ rows: ImportJobRowRecord[]; total: number }>;

  abstract listPendingValidation(jobId: string, limit: number): Promise<ImportJobRowRecord[]>;
  abstract listPendingExecution(jobId: string, limit: number): Promise<ImportJobRowRecord[]>;

  /**
   * Claim VALID+PENDING rows for execution. Concurrent claimers get disjoint
   * sets; UNIQUE (importJobId, rowNumber) + conditional update is the guard.
   */
  abstract claimForExecution(jobId: string, limit: number): Promise<ImportJobRowRecord[]>;

  abstract applyValidationVerdicts(jobId: string, verdicts: RowVerdict[]): Promise<void>;
  abstract applyExecutionResults(jobId: string, results: RowResult[]): Promise<number>;
  abstract countByValidationStatus(
    jobId: string,
  ): Promise<Record<ImportRowValidationStatus, number>>;
  abstract countByExecutionStatus(jobId: string): Promise<Record<ImportRowExecutionStatus, number>>;
  abstract deleteByJob(jobId: string): Promise<void>;

  /** Reset orphaned PROCESSING rows so a redelivered job can reclaim them. */
  abstract resetStaleProcessing(olderThan: Date): Promise<number>;
}
