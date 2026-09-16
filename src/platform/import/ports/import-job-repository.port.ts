import { PageResult } from '@shared-kernel/types/pagination';
import {
  ColumnMapping,
  ImportJobListQuery,
  ImportJobRecord,
  ImportJobStatus,
  NewImportJob,
  StatusHistoryEntry,
  TerminalImportJobStatus,
} from '../import.types';

export abstract class ImportJobRepositoryPort {
  abstract create(job: NewImportJob): Promise<ImportJobRecord>;
  abstract findById(jobId: string): Promise<ImportJobRecord | null>;
  abstract list(query: ImportJobListQuery): Promise<PageResult<ImportJobRecord>>;
  abstract transitionStatus(
    jobId: string,
    from: ImportJobStatus | ImportJobStatus[],
    to: ImportJobStatus,
    history: StatusHistoryEntry,
  ): Promise<ImportJobRecord>;
  abstract setColumnMapping(jobId: string, mapping: ColumnMapping): Promise<ImportJobRecord>;
  abstract updateCounters(
    jobId: string,
    counters: Partial<
      Pick<
        ImportJobRecord,
        'totalRows' | 'validRows' | 'invalidRows' | 'appliedRows' | 'failedRows'
      >
    >,
  ): Promise<void>;
  abstract setCancelRequested(jobId: string): Promise<void>;
  abstract isCancelRequested(jobId: string): Promise<boolean>;
  /** CAS: only non-terminal jobs flip; null = already terminal elsewhere. */
  abstract markTerminal(
    jobId: string,
    status: TerminalImportJobStatus,
    history: StatusHistoryEntry,
  ): Promise<ImportJobRecord | null>;
  abstract findStaleJobs(olderThan: Date): Promise<ImportJobRecord[]>;
  abstract attachErrorReport(jobId: string, errorReportStorageObjectId: string): Promise<void>;

  /**
   * Job-level stage lock (the schema has advertised lockedBy/lockedUntil for
   * ages — now enforced). CAS-acquirable while expired/unheld; the pipeline
   * stages and the reconciler all go through it, so "heartbeat stale" never
   * means "the pipeline owns nothing".
   */
  abstract tryAcquireLock(jobId: string, lockedBy: string, lockedUntil: Date): Promise<boolean>;
  /** Extend + heartbeat only while still the named owner (and non-terminal). */
  abstract heartbeat(jobId: string, lockedBy: string, lockedUntil: Date): Promise<boolean>;
  abstract releaseLock(jobId: string, lockedBy: string): Promise<void>;

  /** Header counters re-derived from row truth; returns the fresh record. */
  abstract recountCounters(jobId: string): Promise<ImportJobRecord | null>;
}
