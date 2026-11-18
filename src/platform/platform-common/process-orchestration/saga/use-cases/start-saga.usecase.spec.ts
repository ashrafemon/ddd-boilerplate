import { instance, plan, planStep } from '@test/support/saga/saga.fixtures';
import { StartSagaUseCase } from './start-saga.usecase';
import { AdvanceSagaUseCase } from './advance-saga.usecase';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';

/**
 * Unit — starting a saga is one insert guarded by the live key, then an advance.
 * A duplicate trigger (same correlation key, instance still live) must start
 * nothing: the WAIT routing owns that event instead.
 */
describe('StartSagaUseCase', () => {
  function makeSut() {
    const instances = { tryInsertLive: jest.fn() };
    const advanceSaga = { execute: jest.fn() };
    const useCase = new StartSagaUseCase(
      instances as unknown as SagaInstanceRepositoryPort,
      advanceSaga as unknown as AdvanceSagaUseCase,
    );
    return { useCase, instances, advanceSaga };
  }

  const input = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    sagaKey: 'grn-to-invoice',
    definitionId: 'definition-1',
    configId: null,
    correlationKey: 'GRN:grn-1',
    plan: plan([planStep()]),
    context: {},
    deadlineAt: null,
  };

  it('opens the instance and advances it', async () => {
    const { useCase, instances, advanceSaga } = makeSut();
    instances.tryInsertLive.mockResolvedValue(instance());
    advanceSaga.execute.mockResolvedValue(instance());

    const result = await useCase.execute(input);

    expect(instances.tryInsertLive).toHaveBeenCalledWith(
      expect.objectContaining({
        sagaKey: 'grn-to-invoice',
        correlationKey: 'GRN:grn-1',
        plan: input.plan,
      }),
    );
    expect(advanceSaga.execute).toHaveBeenCalledWith('instance-1');
    expect(result).not.toBeNull();
  });

  it('starts nothing when a live instance already holds the correlation key', async () => {
    const { useCase, instances, advanceSaga } = makeSut();
    instances.tryInsertLive.mockResolvedValue(null);

    await expect(useCase.execute(input)).resolves.toBeNull();
    expect(advanceSaga.execute).not.toHaveBeenCalled();
  });
});
