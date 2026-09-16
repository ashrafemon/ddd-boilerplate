import {
  ImportJobRowRecord,
  ImportRowExecutionStatus,
  ImportRowValidationStatus,
  RowExecutionSettlement,
  RowVerdict,
} from '../import.types';

export abstract class ImportJobRowRepositoryPort {
  abstract bulkInsert(
    rows: Array<{
      tenantId?: string;
      importJobId: string;
      rowNumber: number;
      rawPayload?: Record<string, string>;
      mappedPayload?: Record<string, string>;
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
   * Each returned row carries `executionClaimToken` for its settlement.
   */
  abstract claimForExecution(jobId: string, limit: number): Promise<ImportJobRowRecord[]>;

  abstract applyValidationVerdicts(jobId: string, verdicts: RowVerdict[]): Promise<void>;
  /**
   * Applies results fenced by (`PROCESSING`, claim token): stale-worker
   * settlements are dropped (not counted in the returned applied total).
   */
  abstract applyExecutionResults(jobId: string, results: RowExecutionSettlement[]): Promise<number>;
  abstract countByValidationStatus(
    jobId: string,
  ): Promise<Record<ImportRowValidationStatus, number>>;
  abstract countByExecutionStatus(jobId: string): Promise<Record<ImportRowExecutionStatus, number>>;
  abstract deleteByJob(jobId: string): Promise<void>;

  /** Reset orphaned PROCESSING rows so a redelivered job can reclaim them. */
  abstract resetStaleProcessing(olderThan: Date): Promise<number>;
}
