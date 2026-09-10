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
  abstract markTerminal(
    jobId: string,
    status: TerminalImportJobStatus,
    history: StatusHistoryEntry,
  ): Promise<ImportJobRecord>;
  abstract findStaleJobs(olderThan: Date): Promise<ImportJobRecord[]>;
  abstract attachErrorReport(jobId: string, errorReportStorageObjectId: string): Promise<void>;
}
