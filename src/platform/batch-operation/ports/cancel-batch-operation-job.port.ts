import { BatchOperationJobRecord } from '../batch-operation.types';

/**
 * PHASE 7. Sets cancel_requested; in-flight rows finish, Pending rows stop being claimed.
 */
export abstract class CancelBatchOperationJobPort {
  abstract execute(jobId: string): Promise<BatchOperationJobRecord>;
}
