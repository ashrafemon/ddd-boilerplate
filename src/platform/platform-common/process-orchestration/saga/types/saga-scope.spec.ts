import { instance, step } from '@test/support/saga/saga.fixtures';
import { buildInput, buildScope, failedUndoError } from './saga-scope';
import { SagaStepKind, SagaStepStatus } from './saga.types';

/**
 * Unit — the scope is the only thing an expression may read.
 *
 * It is rebuilt from rows on every advance, which is what makes a resumed
 * instance evaluate `if`/`when`/`input` exactly as it did before the crash.
 */
describe('saga scope', () => {
  it('exposes event, saga key, company settings and earlier step outputs', () => {
    const scope = buildScope(
      instance({ context: { event: { grnId: 'grn-1' }, settings: { costing: 'fifo' } } }),
      [step({ stepId: 'first', status: SagaStepStatus.DONE, output: { value: 42 } })],
    );

    expect(scope.event).toEqual({ grnId: 'grn-1' });
    expect(scope.company.settings).toEqual({ costing: 'fifo' });
    expect(scope.saga.correlationKey).toBe('GRN:grn-1');
    expect(scope.steps.first).toEqual({ status: SagaStepStatus.DONE, output: { value: 42 } });
  });

  it('resolves input expressions against the scope', () => {
    const input = buildInput(
      { input: { grnId: 'event.grnId', value: 'steps.first.output.value' } },
      { event: { grnId: 'grn-1' }, steps: { first: { output: { value: 42 } } } },
    );

    expect(input).toEqual({ grnId: 'grn-1', value: 42 });
  });

  it('returns null when the step declares no input mapping', () => {
    expect(buildInput({}, {})).toBeNull();
  });

  it('reports the first failed UNDO error only', () => {
    const rows = [
      step({ kind: SagaStepKind.DO, status: SagaStepStatus.FAILED, lastError: 'do failed' }),
      step({ kind: SagaStepKind.UNDO, status: SagaStepStatus.FAILED, lastError: 'undo failed' }),
    ];

    expect(failedUndoError(rows)).toBe('undo failed');
    expect(failedUndoError([])).toBeNull();
  });
});
