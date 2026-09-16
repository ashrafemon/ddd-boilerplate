import { INestApplicationContext, Type } from '@nestjs/common';
import { BatchOperationHandlerRegistry } from '@platform/batch-operation/batch-operation-handler.registry';
import { BatchOperationHandler } from '@platform/batch-operation/ports/batch-operation-handler.port';
import { GoodReceiptNoteModule } from '@business/procurement/good-receipt-note/good-receipt-note.module';
import { GrnBatchOperationAdapter } from '@business/procurement/good-receipt-note/infrastructure/adapters/platform/grn-batch-operation.adapter';
import { PurchaseOrderModule } from '@business/procurement/purchase-order/purchase-order.module';
import { PurchaseOrderBatchOperationAdapter } from '@business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-batch-operation.adapter';

/**
 * Composition-root bridge for the batch-operation opt-in — same precedent as
 * `configure-event-rehydration.ts`: the batch adapters are PURE
 * `BatchOperationHandler`s (no lifecycle, no registry imports), business
 * module classes stay bodyless `@Module`s, and only this file — the layer
 * allowed to know both sides — plugs business handlers into the platform
 * registry after modules are instantiated but before the server listens.
 * Adding a batch-capable aggregate = one row in `BATCH_OPERATION_AGGREGATES`
 * (what the module generator emits); key + operations come from the handler
 * itself, and a duplicate aggregateType still throws at boot.
 */
export interface BatchOperationAggregateOptIn {
  ownerModule: Type<unknown>;
  batchHandler: Type<BatchOperationHandler>;
}

export const BATCH_OPERATION_AGGREGATES: readonly BatchOperationAggregateOptIn[] = [
  {
    ownerModule: PurchaseOrderModule,
    batchHandler: PurchaseOrderBatchOperationAdapter,
  },
  {
    ownerModule: GoodReceiptNoteModule,
    batchHandler: GrnBatchOperationAdapter,
  },
];

/** Strict per-module lookup: fails loudly if a module stops providing its adapter. */
export function configureBatchOperations(
  app: INestApplicationContext,
  aggregates: readonly BatchOperationAggregateOptIn[] = BATCH_OPERATION_AGGREGATES,
): void {
  const registry = app.get(BatchOperationHandlerRegistry);
  for (const { ownerModule, batchHandler } of aggregates) {
    registry.register(app.select(ownerModule).get(batchHandler, { strict: true }));
  }
}
