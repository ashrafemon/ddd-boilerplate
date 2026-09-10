import { BatchOperationDispatch } from '../batch-operation.types';

/**
 * PHASE 5. One row: claim → validate → execute → record → progress.
 * Called by BatchOperationWorker for each entityId in a chunk.
 */
export abstract class ProcessBatchOperationRowPort {
  abstract execute(
    dispatch: BatchOperationDispatch,
    rowId: string,
  ): Promise<'PROCESSED' | 'SKIPPED_CLAIM' | 'CANCELLED'>;
}
