import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { ImportJobStatus } from '../import.types';

/**
 * Raised when an import job aborts as a whole (unreadable file, row limit,
 * exhausted retries). Per-row failures do NOT raise this — they end the job
 * COMPLETED_WITH_ERRORS.
 */
export class ImportJobFailedEvent extends DomainEvent {
  constructor(
    public readonly jobId: string,
    public readonly jobNo: string,
    public readonly entityKey: string,
    public readonly status: Extract<ImportJobStatus, 'FAILED'>,
    public readonly totalRows: number,
    public readonly appliedRows: number,
    public readonly failedRows: number,
    public readonly invalidRows: number,
    public readonly tenantId?: string,
    public readonly traceId?: string,
  ) {
    super();
  }
}
