import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { instance, plan, planStep, step } from '@test/support/saga/saga.fixtures';
import { ExecuteSagaStepUseCase } from './execute-saga-step.usecase';
import { SettleStepFailureUseCase } from './settle-step-failure.usecase';
import { SettleStepSuccessUseCase } from './settle-step-success.usecase';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import { SagaInstanceStatus, SagaStepKind } from '../types/saga.types';

/**
 * Unit — one claimed row, one action call, one CAS settle.
 *
 * Retry scheduling must respect the attempt ceiling, an unregistered action is a
 * permanent failure (retrying cannot register it), and a claim whose instance is
 * already terminal is skipped rather than retried.
 */
describe('ExecuteSagaStepUseCase', () => {
  function makeSut(actionOutcome: 'ok' | 'retry' | 'fail' = 'ok', hasAction = true) {
    const steps = {
      markDone: jest.fn(async () => undefined),
      markFailed: jest.fn(async () => undefined),
      markSkipped: jest.fn(async () => undefined),
      reschedule: jest.fn(async () => undefined),
    };
    const instances = {
      findById: jest.fn(async (): Promise<ReturnType<typeof instance> | null> => instance()),
    };
    const action = {
      name: 'inventory.valuateReceipt',
      do: jest.fn(async () => ({ outcome: actionOutcome, output: { value: 1 }, error: 'boom' })),
      undo: jest.fn(async () => ({ outcome: actionOutcome, error: 'boom' })),
    };
    const actions = {
      resolve: jest.fn(() => (hasAction ? action : null)),
      has: jest.fn(() => hasAction),
    };
    const settleSuccess = { execute: jest.fn(async () => undefined) };
    const settleFailure = { execute: jest.fn(async () => undefined) };

    const useCase = new ExecuteSagaStepUseCase(
      steps as unknown as SagaStepRepositoryPort,
      instances as unknown as SagaInstanceRepositoryPort,
      actions,
      {
        run: jest.fn((_c: unknown, fn: () => Promise<void>) => fn()),
      } as unknown as RequestContextPort,
      {
        getSaga: () => ({ retryBaseDelayMs: 1_000, retryMaxDelayMs: 60_000 }),
      } as unknown as ConfigService,
      settleSuccess as unknown as SettleStepSuccessUseCase,
      settleFailure as unknown as SettleStepFailureUseCase,
    );
    return { useCase, steps, instances, action, actions, settleSuccess, settleFailure };
  }

  it('runs the action and settles the step DONE', async () => {
    const { useCase, steps, action, settleSuccess } = makeSut('ok');

    await useCase.execute(step());

    expect(action.do).toHaveBeenCalledWith(
      expect.objectContaining({
        stepId: 'step-1',
        idempotencyKey: 'step-row-1',
        correlationKey: 'GRN:grn-1',
      }),
    );
    expect(steps.markDone).toHaveBeenCalledWith('step-row-1', { value: 1 });
    expect(settleSuccess.execute).toHaveBeenCalledWith('instance-1', 'step-1', SagaStepKind.DO);
  });

  it('reschedules a retry with exponential backoff', async () => {
    const { useCase, steps, settleFailure } = makeSut('retry');

    await useCase.execute(step({ attempts: 1 }));

    expect(steps.reschedule).toHaveBeenCalledWith('step-row-1', 2, expect.any(Date), 'boom');
    expect(settleFailure.execute).not.toHaveBeenCalled();
  });

  it('fails the step once the attempt ceiling is reached', async () => {
    const { useCase, steps, settleFailure } = makeSut('fail');

    await useCase.execute(step({ attempts: 3, maxAttempts: 3 }));

    expect(steps.markFailed).toHaveBeenCalledWith('step-row-1', 'boom');
    expect(settleFailure.execute).toHaveBeenCalledWith(
      'instance-1',
      'step-1',
      SagaStepKind.DO,
      'boom',
    );
  });

  it('treats an unregistered action as a permanent failure', async () => {
    const { useCase, steps, settleFailure } = makeSut('ok', false);

    await useCase.execute(step());

    expect(steps.markFailed).toHaveBeenCalledWith(
      'step-row-1',
      expect.stringContaining('not registered'),
    );
    expect(settleFailure.execute).toHaveBeenCalled();
  });

  it('skips a step whose instance is no longer live', async () => {
    const { useCase, steps, instances } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.CANCELLED }));

    await useCase.execute(step());

    expect(steps.markSkipped).toHaveBeenCalledWith('step-row-1');
    expect(steps.markDone).not.toHaveBeenCalled();
  });

  it('fails the step when its instance vanished', async () => {
    const { useCase, steps, instances } = makeSut();
    instances.findById.mockResolvedValue(null);

    await useCase.execute(step());

    expect(steps.markFailed).toHaveBeenCalledWith('step-row-1', 'instance missing');
  });

  it('calls undo for an UNDO row with the DO output as input', async () => {
    const { useCase, action } = makeSut('ok');

    await useCase.execute(step({ kind: SagaStepKind.UNDO, input: { value: 7 } }));

    expect(action.undo).toHaveBeenCalledWith(expect.objectContaining({ doOutput: { value: 7 } }));
  });

  it('honours the plan step id when the row is a WAIT row', async () => {
    const { useCase, instances } = makeSut('ok');
    instances.findById.mockResolvedValue(instance({ plan: plan([planStep({ id: 'other' })]) }));

    await useCase.execute(step({ stepId: 'other' }));

    expect(instances.findById).toHaveBeenCalledWith('instance-1');
  });
});
