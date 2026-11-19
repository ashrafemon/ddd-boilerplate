import { instance, step } from '@test/support/saga/saga.fixtures';
import { CancelSagaUseCase } from './cancel-saga.usecase';
import { StartCompensationUseCase } from './start-compensation.usecase';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';
import {
  SagaInstanceReason,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepStatus,
} from '../types/saga.types';

/**
 * Unit — cancel means "stop" only while nothing happened. Once a DO step
 * completed, cancel must compensate; leaving the work in place would make the
 * cancellation a lie.
 */
describe('CancelSagaUseCase', () => {
  function makeSut() {
    const instances = {
      findById: jest.fn(async () => instance()),
      updateCas: jest.fn(async () => instance()),
    };
    const steps = { findByInstance: jest.fn(async () => [] as ReturnType<typeof step>[]) };
    const compensate = { execute: jest.fn(async () => instance()) };
    const useCase = new CancelSagaUseCase(
      instances as unknown as PrismaSagaInstanceRepository,
      steps as unknown as PrismaSagaStepRepository,
      compensate as unknown as StartCompensationUseCase,
    );
    return { useCase, instances, steps, compensate };
  }

  it('cancels outright when no DO step completed', async () => {
    const { useCase, instances, compensate } = makeSut();

    await useCase.execute('instance-1', SagaInstanceReason.CANCELLED_BY_USER);

    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.CANCELLED }),
    );
    expect(compensate.execute).not.toHaveBeenCalled();
  });

  it('compensates when business work already happened', async () => {
    const { useCase, steps, compensate } = makeSut();
    steps.findByInstance.mockResolvedValue([
      step({ kind: SagaStepKind.DO, status: SagaStepStatus.DONE }),
    ]);

    await useCase.execute('instance-1', SagaInstanceReason.CANCELLED_BY_EVENT);

    expect(compensate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'instance-1' }),
      0,
      SagaInstanceReason.CANCELLED_BY_EVENT,
      expect.any(String),
    );
  });

  it('ignores a terminal instance', async () => {
    const { useCase, instances, compensate } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.COMPLETED }));

    await useCase.execute('instance-1', SagaInstanceReason.CANCELLED_BY_USER);

    expect(instances.updateCas).not.toHaveBeenCalled();
    expect(compensate.execute).not.toHaveBeenCalled();
  });
});
