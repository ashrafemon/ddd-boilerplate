import { BatchOperationJobRecord, SubmitBatchOperationInput } from '../batch-operation.types';

/**
 * PHASE 2–3. Validates capability, writes job + Pending rows, decides Sync/Async,
 * dispatches chunks. Called by BatchOperationController.
 */
export abstract class CreateBatchOperationJobPort {
  abstract execute(input: SubmitBatchOperationInput): Promise<BatchOperationJobRecord>;
}
