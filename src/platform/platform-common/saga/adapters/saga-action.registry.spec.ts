import { SagaActionRegistry } from './saga-action.registry';
import { SagaAction } from '../ports/saga-action.port';
import { SagaActionResult, SagaUndoResult } from '../types/saga.types';

/**
 * Unit — the action registry is the only place a saga action name is bound.
 *
 * Duplicate names throw at bootstrap (two modules cannot silently claim the same
 * action), and an unknown name resolves to `null` so the worker can park the step
 * instead of crashing the tick.
 */
describe('SagaActionRegistry', () => {
  function action(name: string): SagaAction {
    return {
      name,
      do: jest.fn(async (): Promise<SagaActionResult> => ({ outcome: 'ok' })),
      undo: jest.fn(async (): Promise<SagaUndoResult> => ({ outcome: 'ok' })),
    };
  }

  it('registers the providers injected under the SAGA_ACTION token', () => {
    const registry = new SagaActionRegistry([action('inventory.valuateReceipt')]);

    expect(registry.has('inventory.valuateReceipt')).toBe(true);
    expect(registry.resolve('inventory.valuateReceipt')?.name).toBe('inventory.valuateReceipt');
  });

  it('works with no providers at all', () => {
    const registry = new SagaActionRegistry(undefined);

    expect(registry.resolve('anything')).toBeNull();
  });

  it('throws on a duplicate action name', () => {
    const registry = new SagaActionRegistry([action('a.duplicate')]);

    expect(() => registry.register(action('a.duplicate'))).toThrow(/Duplicate saga action/);
  });
});
