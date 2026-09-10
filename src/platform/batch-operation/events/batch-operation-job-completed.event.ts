import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { BatchOperationJobStatus } from '../batch-operation.types';

/** Raised when a batch job reaches a terminal status (Completed* / Failed / Cancelled). */
export class BatchOperationJobCompletedEvent extends DomainEvent {
  constructor(
    public readonly jobId: string,
    public readonly jobNo: string,
    public readonly aggregateType: string,
    public readonly operationCode: string,
    public readonly status: BatchOperationJobStatus,
    public readonly totalRecords: number,
    public readonly successRecords: number,
    public readonly failedRecords: number,
    public readonly skippedRecords: number,
    public readonly tenantId: string | null,
  ) {
    super();
  }
}
