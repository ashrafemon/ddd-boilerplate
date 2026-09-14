import { BatchOperationHandlerRegistry } from './batch-operation-handler.registry';
import { BatchOperationHandler } from './ports/batch-operation-handler.port';

function fakeHandler(ops: string[]): BatchOperationHandler {
  return {
    supportedOperations: () => ops,
    validate: () => Promise.resolve({ canProceed: true }),
    execute: () => Promise.resolve({}),
  };
}

describe('BatchOperationHandlerRegistry', () => {
  it('registers and resolves a handler by aggregateType', () => {
    const registry = new BatchOperationHandlerRegistry();
    const handler = fakeHandler(['approve', 'cancel']);
    registry.register('Invoice', ['approve', 'cancel'], handler);

    expect(registry.resolveHandler('Invoice')).toBe(handler);
    expect(registry.health()).toEqual([
      { aggregateType: 'Invoice', supportedOperations: ['approve', 'cancel'] },
    ]);
  });

  it('throws on a duplicate aggregateType registration', () => {
    const registry = new BatchOperationHandlerRegistry();
    registry.register('Invoice', ['approve'], fakeHandler(['approve']));

    expect(() => registry.register('Invoice', ['approve'], fakeHandler(['approve']))).toThrow(
      /already registered/,
    );
  });

  it('throws at registration when the declared operations exceed what the handler reports', () => {
    const registry = new BatchOperationHandlerRegistry();

    expect(() =>
      registry.register('Invoice', ['approve', 'post'], fakeHandler(['approve'])),
    ).toThrow(/does not report/);
  });

  it('throws for an unknown aggregateType', () => {
    const registry = new BatchOperationHandlerRegistry();

    expect(() => registry.resolveHandler('Ghost')).toThrow(/No BatchOperationHandler registered/);
    expect(() => registry.assertOperationSupported('Ghost', 'approve')).toThrow(
      /No BatchOperationHandler registered/,
    );
  });

  it('rejects an operationCode outside the registered supportedOperations', () => {
    const registry = new BatchOperationHandlerRegistry();
    registry.register('Invoice', ['approve'], fakeHandler(['approve', 'post']));

    expect(() => registry.assertOperationSupported('Invoice', 'post')).toThrow(
      /does not support operationCode/,
    );
    expect(() => registry.assertOperationSupported('Invoice', 'approve')).not.toThrow();
  });
});
