import { BatchOperationContext, ExecutionResult, ValidationResult } from '../batch-operation.types';

/**
 * The ONLY surface between the batch pipeline and a batch-capable aggregate.
 * Implemented once per aggregateType (e.g. PurchaseOrderBatchOperationAdapter),
 * registered on `BatchOperationHandlerRegistry` inside the
 * domain module that owns the aggregate, and resolved by
 * `BatchOperationHandlerRegistry` keyed on aggregateType.
 *
 * Two methods, one context object. If a third method appears here, ask what
 * bookkeeping has leaked out of the pipeline into an adapter meant to stay a
 * thin router.
 */
export interface BatchOperationHandler {
  /**
   * Which operationCodes this adapter actually implements. Checked at boot
   * against the array passed to registry.register() — a mismatch fails
   * boot, never the first row that hits it.
   */
  supportedOperations(): string[];

  /**
   * Pure check against the record's CURRENT state — the exact rule a manual
   * single-record action enforces. Called from the read-only dry-run preview
   * as often as from the real run, so it must never mutate anything.
   */
  validate(
    entityId: string,
    operationCode: string,
    params: Record<string, unknown> | undefined,
    context: BatchOperationContext,
  ): Promise<ValidationResult>;

  /**
   * Runs only after validate() passed. Delegates to the aggregate's OWN
   * existing single-record service method, inside THAT service's own
   * transaction — never a special Bulk*() path. Returns exactly what changed.
   */
  execute(
    entityId: string,
    operationCode: string,
    params: Record<string, unknown> | undefined,
    context: BatchOperationContext,
  ): Promise<ExecutionResult>;
}

/** What an aggregate module records against an aggregateType. */
export interface BatchOperationHandlerRegistration {
  aggregateType: string;
  supportedOperations: string[];
}
