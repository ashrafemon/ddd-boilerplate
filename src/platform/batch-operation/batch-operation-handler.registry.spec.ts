import { BatchOperationHandlerRegistry } from './batch-operation-handler.registry';
import { BatchOperationHandler } from './ports/batch-operation-handler.port';

function fakeHandler(ops: string[], aggregateType = 'Invoice'): BatchOperationHandler {
  return {
    aggregateType: () => aggregateType,
    supportedOperations: () => ops,
    validate: () => Promise.resolve({ canProceed: true }),
    execute: () => Promise.resolve({}),
  };
}

describe('BatchOperationHandlerRegistry', () => {
  it('registers and resolves a handler, entry derived from the handler itself', () => {
    const registry = new BatchOperationHandlerRegistry();
    const handler = fakeHandler(['approve', 'cancel']);
    registry.register(handler);

    expect(registry.resolveHandler('Invoice')).toBe(handler);
    expect(registry.health()).toEqual([
      { aggregateType: 'Invoice', supportedOperations: ['approve', 'cancel'] },
    ]);
  });

  it('throws on a duplicate aggregateType registration', () => {
    const registry = new BatchOperationHandlerRegistry();
    registry.register(fakeHandler(['approve']));

    expect(() => registry.register(fakeHandler(['approve']))).toThrow(/already registered/);
  });

  it('throws for an unknown aggregateType', () => {
    const registry = new BatchOperationHandlerRegistry();

    expect(() => registry.resolveHandler('Ghost')).toThrow(/No BatchOperationHandler registered/);
    expect(() => registry.assertOperationSupported('Ghost', 'approve')).toThrow(
      /No BatchOperationHandler registered/,
    );
  });

  it('rejects an operationCode outside the handler-reported supportedOperations', () => {
    const registry = new BatchOperationHandlerRegistry();
    registry.register(fakeHandler(['approve', 'post']));

    expect(() => registry.assertOperationSupported('Invoice', 'delete')).toThrow(
      /does not support operationCode/,
    );
    expect(() => registry.assertOperationSupported('Invoice', 'approve')).not.toThrow();
    registry.register(fakeHandler(['approve'], 'Bill'));
    expect(() => registry.assertOperationSupported('Bill', 'post')).toThrow(
      /does not support operationCode/,
    );
  });
});
