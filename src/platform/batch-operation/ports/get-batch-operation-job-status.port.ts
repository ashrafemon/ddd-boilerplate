import { BatchOperationJobRecord } from '../batch-operation.types';

/**
 * Read-only: job header + aggregated row counts, for progress polling.
 */
export abstract class GetBatchOperationJobStatusPort {
  abstract execute(jobId: string): Promise<BatchOperationJobRecord>;
}
