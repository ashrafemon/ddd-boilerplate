import { BatchOperationRowRecord } from '../batch-operation.types';

/**
 * Read-only: row-level detail for audit / failure drill-down.
 */
export abstract class ListBatchOperationJobRowsPort {
  abstract execute(jobId: string): Promise<BatchOperationRowRecord[]>;
}
