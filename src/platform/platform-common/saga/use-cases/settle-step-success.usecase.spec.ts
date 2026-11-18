import { instance, plan, planStep, step } from '@test/support/saga/saga.fixtures';
import { SettleStepSuccessUseCase } from './settle-step-success.usecase';
import { AdvanceSagaUseCase } from './advance-saga.usecase';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import { SagaInstanceStatus, SagaStepKind, SagaStepStatus } from '../types/saga.types';

/**
 * Unit — a successful step moves either the cursor (DO) or the compensation
 * (UNDO). The UNDO branch must wait for every UNDO row to settle before closing
 * the instance, otherwise a later failed reversal would land on a terminal row.
 */
describe('SettleStepSuccessUseCase', () => {
  function makeSut() {
    const instances = {
      findById: jest.fn(async () => instance()),
      updateCas: jest.fn(async () => instance()),
    };
    const steps = { findByInstance: jest.fn(async () => [] as ReturnType<typeof step>[]) };
    const advanceSaga = { execute: jest.fn(async () => instance()) };
    const useCase = new SettleStepSuccessUseCase(
      instances as unknown as SagaInstanceRepositoryPort,
      steps as unknown as SagaStepRepositoryPort,
      advanceSaga as unknown as AdvanceSagaUseCase,
    );
    return { useCase, instances, steps, advanceSaga };
  }

  it('moves the cursor past a successful DO step and continues', async () => {
    const { useCase, instances, advanceSaga } = makeSut();
    instances.findById.mockResolvedValue(
      instance({ plan: plan([planStep({ id: 'first' }), planStep({ id: 'second' })]) }),
    );

    await useCase.execute('instance-1', 'first', SagaStepKind.DO);

    expect(instances.updateCas).toHaveBeenCalledWith('instance-1', 1, { cursor: 1 });
    expect(advanceSaga.execute).toHaveBeenCalledWith('instance-1');
  });

  it('closes a compensation once no UNDO row is pending', async () => {
    const { useCase, instances } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.COMPENSATING }));

    await useCase.execute('instance-1', 'first', SagaStepKind.UNDO);

    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.COMPENSATED }),
    );
  });

  it('keeps the first undo error on the compensated instance', async () => {
    const { useCase, instances, steps } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.COMPENSATING }));
    steps.findByInstance.mockResolvedValue([
      step({ kind: SagaStepKind.UNDO, status: SagaStepStatus.FAILED, lastError: 'ledger locked' }),
    ]);

    await useCase.execute('instance-1', 'first', SagaStepKind.UNDO);

    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({
        status: SagaInstanceStatus.COMPENSATED,
        lastError: 'ledger locked',
      }),
    );
  });

  it('waits while another UNDO row is still pending', async () => {
    const { useCase, instances, steps } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.COMPENSATING }));
    steps.findByInstance.mockResolvedValue([
      step({ kind: SagaStepKind.UNDO, status: SagaStepStatus.PENDING }),
    ]);

    await useCase.execute('instance-1', 'first', SagaStepKind.UNDO);

    expect(instances.updateCas).not.toHaveBeenCalled();
  });

  it('ignores an UNDO success when the instance is not compensating', async () => {
    const { useCase, instances } = makeSut();

    await useCase.execute('instance-1', 'first', SagaStepKind.UNDO);

    expect(instances.updateCas).not.toHaveBeenCalled();
  });
});
