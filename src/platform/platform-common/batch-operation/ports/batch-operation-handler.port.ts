import { BatchOperationContext, ExecutionResult, ValidationResult } from '../batch-operation.types';

/**
 * The ONLY surface between the batch pipeline and a batch-capable aggregate.
 * Implemented once per aggregateType (e.g. PurchaseOrderBatchOperationAdapter)
 * as PURE data + routing — no lifecycle hooks, no registry imports: the
 * composition root (`src/bootstrap/configure-batch-operations.ts`) registers
 * the handler on `BatchOperationHandlerRegistry` at boot, and it is resolved
 * keyed on aggregateType. The handler is its own registration metadata:
 * aggregateType() + supportedOperations() are the single source of truth.
 *
 * If a third method appears here, ask what bookkeeping has leaked out of the
 * pipeline into an adapter meant to stay a thin router.
 */
export interface BatchOperationHandler {
  /** Stable key this handler answers to (e.g. 'PurchaseOrder'). */
  aggregateType(): string;

  /**
   * Which operationCodes this adapter actually implements — the single source
   * of truth for registration: registry.register(handler) reads the key and
   * this list from the handler, so there is nothing at boot to drift against.
   * A duplicate aggregateType registration throws at boot instead.
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
