import { instance, plan, planStep } from '@test/support/saga/saga.fixtures';
import { SettleStepFailureUseCase } from './settle-step-failure.usecase';
import { StartCompensationUseCase } from './start-compensation.usecase';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { SagaInstanceReason, SagaInstanceStatus, SagaStepKind } from '../types/saga.types';

/**
 * Unit — the two failure directions. A failed DO compensates from its own step;
 * a failed UNDO parks FAILED_MANUAL, because a reversal that cannot be reversed
 * needs a human, not another retry loop.
 */
describe('SettleStepFailureUseCase', () => {
  function makeSut() {
    const instances = {
      findById: jest.fn(async () => instance()),
      updateCas: jest.fn(async () => instance()),
    };
    const compensate = { execute: jest.fn(async () => instance()) };
    const useCase = new SettleStepFailureUseCase(
      instances as unknown as PrismaSagaInstanceRepository,
      compensate as unknown as StartCompensationUseCase,
    );
    return { useCase, instances, compensate };
  }

  it('compensates from the failed DO step index', async () => {
    const { useCase, instances, compensate } = makeSut();
    instances.findById.mockResolvedValue(
      instance({ plan: plan([planStep({ id: 'first' }), planStep({ id: 'second' })]) }),
    );

    await useCase.execute('instance-1', 'second', SagaStepKind.DO, 'ledger down');

    expect(compensate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'instance-1' }),
      1,
      SagaInstanceReason.STEP_FAILED,
      'ledger down',
    );
  });

  it('parks FAILED_MANUAL when an UNDO fails', async () => {
    const { useCase, instances, compensate } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.COMPENSATING }));

    await useCase.execute('instance-1', 'first', SagaStepKind.UNDO, 'reversal rejected');

    expect(compensate.execute).not.toHaveBeenCalled();
    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({
        status: SagaInstanceStatus.FAILED_MANUAL,
        lastError: 'reversal rejected',
      }),
    );
  });

  it('ignores a terminal instance', async () => {
    const { useCase, instances, compensate } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.CANCELLED }));

    await useCase.execute('instance-1', 'first', SagaStepKind.DO, 'late');

    expect(compensate.execute).not.toHaveBeenCalled();
    expect(instances.updateCas).not.toHaveBeenCalled();
  });
});
