import { OutboxEventBase } from '@platform/events/bases/outbox-event.base';
import { ImportJobStatus } from '../import.types';

/**
 * Raised when an import job finishes applying rows — COMPLETED when every row
 * applied, COMPLETED_WITH_ERRORS when some did not.
 */
export class ImportJobCompletedEvent extends OutboxEventBase {
  constructor(
    public readonly jobId: string,
    public readonly jobNo: string,
    public readonly entityKey: string,
    public readonly status: Extract<ImportJobStatus, 'COMPLETED' | 'COMPLETED_WITH_ERRORS'>,
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
