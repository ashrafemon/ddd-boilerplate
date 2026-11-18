import { instance, step } from '@test/support/saga/saga.fixtures';
import { ExecuteSagaStepUseCase } from './execute-saga-step.usecase';
import { SettleStepFailureUseCase } from './settle-step-failure.usecase';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import {
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepRecord,
  SagaStepStatus,
} from '../types/saga.types';

/**
 * Unit — a claimed step becomes a broker command, never a direct action call.
 *
 * The saga publishes `saga.command` and stops; the outcome arrives later as a
 * `saga.step.result` event. What stays here is the cheap pre-flight: a terminal
 * instance is skipped, an unregistered action fails fast instead of waiting for a
 * consumer that cannot serve it.
 */
describe('ExecuteSagaStepUseCase', () => {
  function makeSut(hasAction = true) {
    const steps = {
      markFailed: jest.fn(async () => undefined),
      markSkipped: jest.fn(async () => undefined),
    };
    const instances = {
      findById: jest.fn(async (): Promise<ReturnType<typeof instance> | null> => instance()),
    };
    const actions = { has: jest.fn(() => hasAction), resolve: jest.fn(() => null) };
    const publisher = { dispatch: jest.fn(async () => undefined) };
    const settleFailure = {
      execute: jest.fn(async (_i: string, _s: string, _k: SagaStepKind, _e: string) => undefined),
    };

    const useCase = new ExecuteSagaStepUseCase(
      steps as unknown as SagaStepRepositoryPort,
      instances as unknown as SagaInstanceRepositoryPort,
      actions,
      publisher,
      settleFailure as unknown as SettleStepFailureUseCase,
    );
    return { useCase, steps, instances, actions, publisher, settleFailure };
  }

  const claimed = (over: Partial<SagaStepRecord> = {}): SagaStepRecord =>
    step({ status: SagaStepStatus.RUNNING, ...over });

  it('publishes one command with the full execution context', async () => {
    const { useCase, publisher } = makeSut();

    await useCase.execute(claimed());

    expect(publisher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        sagaKey: 'grn-to-invoice',
        instanceId: 'instance-1',
        stepId: 'step-1',
        stepRowId: 'step-row-1',
        kind: SagaStepKind.DO,
        action: 'inventory.valuateReceipt',
        doOutput: undefined,
      }),
    );
  });

  it('carries the step output into an UNDO command', async () => {
    const { useCase, publisher } = makeSut();

    await useCase.execute(claimed({ kind: SagaStepKind.UNDO, input: { value: 7 } }));

    expect(publisher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: SagaStepKind.UNDO, doOutput: { value: 7 } }),
    );
  });

  it('fails fast when the definition references an unregistered action', async () => {
    const { useCase, steps, publisher, settleFailure } = makeSut(false);

    await useCase.execute(claimed());

    expect(publisher.dispatch).not.toHaveBeenCalled();
    expect(steps.markFailed).toHaveBeenCalledWith(
      'step-row-1',
      expect.stringContaining('not registered'),
    );
    expect(settleFailure.execute).toHaveBeenCalled();
  });

  it('skips a step whose instance is no longer live', async () => {
    const { useCase, steps, publisher, instances } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.CANCELLED }));

    await useCase.execute(claimed());

    expect(steps.markSkipped).toHaveBeenCalledWith('step-row-1');
    expect(publisher.dispatch).not.toHaveBeenCalled();
  });

  it('fails the step when its instance vanished', async () => {
    const { useCase, steps, instances } = makeSut();
    instances.findById.mockResolvedValue(null);

    await useCase.execute(claimed());

    expect(steps.markFailed).toHaveBeenCalledWith('step-row-1', 'instance missing');
  });
});
