import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { instance, step } from '@test/support/saga/saga.fixtures';
import { RunSagaStepCommandUseCase } from './run-saga-step-command.usecase';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';
import { SagaStepCommand } from '../types/saga-command.types';
import { SagaStepKind, SagaStepRecord, SagaStepStatus } from '../types/saga.types';

/**
 * Unit — the consumer half of the EDA step execution.
 *
 * A delivered `saga.command` is the only place an action runs, and the outcome
 * leaves as a `saga.step.result` event. A command whose row already settled, or
 * that names an action nobody registered, must never touch business work.
 */
describe('RunSagaStepCommandUseCase', () => {
  const command = (over: Partial<SagaStepCommand> = {}): SagaStepCommand => ({
    tenantId: 'tenant-1',
    companyId: 'company-1',
    sagaKey: 'goods_receipt',
    instanceId: 'instance-1',
    stepId: 'step-1',
    stepRowId: 'step-row-1',
    kind: SagaStepKind.DO,
    action: 'inventory.valuateReceipt',
    correlationKey: 'GRN:grn-1',
    input: { grnId: 'grn-1' },
    ...over,
  });

  function makeSut(outcome: 'ok' | 'retry' | 'fail' = 'ok', registered = true) {
    const steps = {
      findById: jest.fn(async (): Promise<SagaStepRecord | null> =>
        step({ status: SagaStepStatus.RUNNING }),
      ),
    };
    const action = {
      name: 'inventory.valuateReceipt',
      do: jest.fn(async () => ({ outcome, output: { value: 1 }, error: 'boom' })),
      undo: jest.fn(async () => ({ outcome, error: 'boom' })),
    };
    const actions = {
      resolve: jest.fn(() => (registered ? action : null)),
      has: jest.fn(() => registered),
    };
    const results = { publish: jest.fn(async () => undefined) };
    const requestContext = {
      run: jest.fn((_ctx: unknown, fn: () => Promise<unknown>) => fn()),
    };

    const useCase = new RunSagaStepCommandUseCase(
      steps as unknown as PrismaSagaStepRepository,
      actions,
      results,
      requestContext as unknown as RequestContextPort,
    );
    return { useCase, steps, action, results, requestContext };
  }

  it('runs the action inside the tenant context and publishes the result', async () => {
    const { useCase, action, results, requestContext } = makeSut('ok');

    await useCase.execute(command());

    expect(requestContext.run).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', companyId: 'company-1', correlationId: 'instance-1' },
      expect.any(Function),
    );
    expect(action.do).toHaveBeenCalledWith(
      expect.objectContaining({
        stepId: 'step-1',
        idempotencyKey: 'step-row-1',
        correlationKey: 'GRN:grn-1',
        input: { grnId: 'grn-1' },
      }),
    );
    expect(results.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        stepRowId: 'step-row-1',
        instanceId: 'instance-1',
        outcome: 'ok',
        output: { value: 1 },
      }),
    );
  });

  it('reports a thrown action as retry instead of losing the step', async () => {
    const { useCase, action, results } = makeSut();
    action.do.mockRejectedValueOnce(new Error('inventory down'));

    await useCase.execute(command());

    expect(results.publish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'retry', error: 'inventory down' }),
    );
  });

  it('runs undo for an UNDO command with the DO output', async () => {
    const { useCase, action } = makeSut('ok');

    await useCase.execute(command({ kind: SagaStepKind.UNDO, doOutput: { value: 7 } }));

    expect(action.undo).toHaveBeenCalledWith(expect.objectContaining({ doOutput: { value: 7 } }));
    expect(action.do).not.toHaveBeenCalled();
  });

  it('ignores a redelivered command whose row is no longer RUNNING', async () => {
    const { useCase, steps, action, results } = makeSut();
    steps.findById.mockResolvedValue(step({ status: SagaStepStatus.DONE }));

    await useCase.execute(command());

    expect(action.do).not.toHaveBeenCalled();
    expect(results.publish).not.toHaveBeenCalled();
  });

  it('reports a failure when the action is not registered', async () => {
    const { useCase, action, results } = makeSut('ok', false);

    await useCase.execute(command());

    expect(action.do).not.toHaveBeenCalled();
    expect(results.publish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'fail', error: 'action not registered' }),
    );
  });

  it('ignores a command whose row disappeared', async () => {
    const { useCase, steps, action } = makeSut();
    steps.findById.mockResolvedValue(null);

    await useCase.execute(command());

    expect(action.do).not.toHaveBeenCalled();
  });

  it('keeps the fixture instance shape compatible with the step record', () => {
    expect(instance().id).toBe('instance-1');
  });
});
