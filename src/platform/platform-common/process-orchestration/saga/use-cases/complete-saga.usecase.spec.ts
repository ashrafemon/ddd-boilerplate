import { instance, plan, planStep } from '@test/support/saga/saga.fixtures';
import { CompleteSagaUseCase } from './complete-saga.usecase';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaInstanceStatus } from '../types/saga.types';

/**
 * Unit — completion is a terminal CAS plus, optionally, one outbox event. The
 * emit must ride the same transaction as the status change, otherwise a crash
 * between them loses the downstream event forever.
 */
describe('CompleteSagaUseCase', () => {
  function makeSut() {
    const instances = {
      updateCas: jest.fn(async (): Promise<ReturnType<typeof instance> | null> => instance()),
    };
    const outbox = { append: jest.fn(async () => undefined) };
    const useCase = new CompleteSagaUseCase(
      instances as unknown as SagaInstanceRepositoryPort,
      outbox,
    );
    return { useCase, instances, outbox };
  }

  it('completes with the final cursor and emits nothing when no onComplete is set', async () => {
    const { useCase, instances, outbox } = makeSut();

    await useCase.execute(instance({ version: 4 }), 2);

    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      4,
      expect.objectContaining({ status: SagaInstanceStatus.COMPLETED, cursor: 2 }),
    );
    expect(outbox.append).not.toHaveBeenCalled();
  });

  it('appends the onComplete event when the plan declares one', async () => {
    const { useCase, outbox } = makeSut();
    const target = instance({
      plan: plan([planStep()], { onComplete: { emit: 'saga.grn.valued' } }),
    });

    await useCase.execute(target, 1);

    expect(outbox.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'saga.grn.valued' }),
      'Saga',
      'instance-1',
    );
  });

  it('does not emit when the CAS lost the race', async () => {
    const { useCase, instances, outbox } = makeSut();
    instances.updateCas.mockResolvedValue(null);

    await useCase.execute(
      instance({ plan: plan([planStep()], { onComplete: { emit: 'saga.done' } }) }),
      1,
    );

    expect(outbox.append).not.toHaveBeenCalled();
  });
});
