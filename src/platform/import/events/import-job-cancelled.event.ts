import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { ImportJobStatus } from '../import.types';

/**
 * Raised once the last in-flight chunk of a cancel-requested job has finished.
 * Rows already applied stay applied — cancel stops future work, never rolls back.
 */
export class ImportJobCancelledEvent extends DomainEvent {
  constructor(
    public readonly jobId: string,
    public readonly jobNo: string,
    public readonly entityKey: string,
    public readonly status: Extract<ImportJobStatus, 'CANCELLED'>,
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
