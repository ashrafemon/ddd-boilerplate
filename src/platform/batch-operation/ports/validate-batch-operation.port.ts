import { BatchOperationPreview, ValidateBatchOperationInput } from '../batch-operation.types';

/** PHASE 1 dry-run — per-record preview, nothing persisted. */
export abstract class ValidateBatchOperationPort {
  abstract execute(input: ValidateBatchOperationInput): Promise<BatchOperationPreview>;
}
