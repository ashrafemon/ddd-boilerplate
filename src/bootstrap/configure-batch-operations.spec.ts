import { INestApplicationContext } from '@nestjs/common';
import { BatchOperationHandlerRegistry } from '@platform/batch-operation/batch-operation-handler.registry';
import { BatchOperationHandler } from '@platform/batch-operation/ports/batch-operation-handler.port';

// The default table references real business modules; stub them so this stays a
// unit test (importing the real module files pulls the full Nest/DI HTTP graph,
// which jest cannot parse here). The bridge LOGIC and table SHAPE still run.
jest.mock('@business/procurement/purchase-order/purchase-order.module', () => ({
  PurchaseOrderModule: class PurchaseOrderModule {},
}));
jest.mock(
  '@business/procurement/purchase-order/infrastructure/adapters/platform/purchase-order-batch-operation.adapter',
  () => ({ PurchaseOrderBatchOperationAdapter: class PurchaseOrderBatchOperationAdapter {} }),
);
jest.mock('@business/procurement/good-receipt-note/good-receipt-note.module', () => ({
  GoodReceiptNoteModule: class GoodReceiptNoteModule {},
}));
jest.mock(
  '@business/procurement/good-receipt-note/infrastructure/adapters/platform/grn-batch-operation.adapter',
  () => ({ GrnBatchOperationAdapter: class GrnBatchOperationAdapter {} }),
);

import { BATCH_OPERATION_AGGREGATES, configureBatchOperations } from './configure-batch-operations';

class FakeOwnerModule {}

class FakeBatchOperationAdapter implements BatchOperationHandler {
  aggregateType(): string {
    return 'FakeDoc';
  }
  supportedOperations(): string[] {
    return ['do'];
  }
  validate() {
    return Promise.resolve({ canProceed: true });
  }
  execute() {
    return Promise.resolve({});
  }
}

function fakeApp(registry: BatchOperationHandlerRegistry, handler: BatchOperationHandler) {
  return {
    get: (token: unknown) => (token === BatchOperationHandlerRegistry ? registry : undefined),
    select: () => ({ get: () => handler }),
  } as unknown as INestApplicationContext;
}

describe('configureBatchOperations (composition-root bridge)', () => {
  it('plugs a pure business handler into the platform registry, metadata from the handler', () => {
    const registry = new BatchOperationHandlerRegistry();

    configureBatchOperations(fakeApp(registry, new FakeBatchOperationAdapter()), [
      { ownerModule: FakeOwnerModule, batchHandler: FakeBatchOperationAdapter },
    ]);

    expect(registry.health()).toEqual([{ aggregateType: 'FakeDoc', supportedOperations: ['do'] }]);
  });

  it('fails fast when two aggregates share a key (duplicate provider row / template slip)', () => {
    const registry = new BatchOperationHandlerRegistry();
    const app = fakeApp(registry, new FakeBatchOperationAdapter());
    const optIn = { ownerModule: FakeOwnerModule, batchHandler: FakeBatchOperationAdapter };

    expect(() => configureBatchOperations(app, [optIn, optIn])).toThrow(/already registered/);
  });

  it('default table covers exactly the batch-capable aggregates', () => {
    expect(
      BATCH_OPERATION_AGGREGATES.map(
        ({
          ownerModule,
          batchHandler,
        }: {
          ownerModule: { name: string };
          batchHandler: { name: string };
        }) => [ownerModule.name, batchHandler.name],
      ),
    ).toEqual([
      ['PurchaseOrderModule', 'PurchaseOrderBatchOperationAdapter'],
      ['GoodReceiptNoteModule', 'GrnBatchOperationAdapter'],
    ]);
  });
});
