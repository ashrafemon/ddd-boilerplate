import { ConfigService } from '@config/config.service';
import { instance, plan, planStep, step } from '@test/support/saga/saga.fixtures';
import { AdvanceSagaUseCase } from './advance-saga.usecase';
import { CompleteSagaUseCase } from './complete-saga.usecase';
import { SagaInstanceRepositoryPort } from '../outbound/ports/saga-instance.repository.port';
import { SagaInboxPort } from '@platform/platform-common/saga-inbox/inbound/ports/saga-inbox.port';
import { SagaStepRepositoryPort } from '../outbound/ports/saga-step.repository.port';
import { SagaInstanceStatus, SagaStepKind, SagaStepStatus } from '../types/saga.types';

const CONFIG = {
  getSaga: () => ({ workerLeaseSeconds: 60 }),
} as unknown as ConfigService;

function makeSut() {
  const instances = {
    findById: jest.fn(),
    updateCas: jest.fn(async () => instance()),
  };
  const steps = {
    findByInstance: jest.fn(async () => [] as ReturnType<typeof step>[]),
    createIfAbsent: jest.fn(async (input: { stepId: string; status: SagaStepStatus }) =>
      step({ stepId: input.stepId, status: input.status }),
    ),
  };
  const inbox = {
    listBuffered: jest.fn(async () => [] as unknown[]),
    markConsumed: jest.fn(async () => true),
  };
  const completeSaga = { execute: jest.fn(async () => instance()) };

  const useCase = new AdvanceSagaUseCase(
    instances as unknown as SagaInstanceRepositoryPort,
    steps as unknown as SagaStepRepositoryPort,
    inbox as unknown as SagaInboxPort,
    CONFIG,
    completeSaga as unknown as CompleteSagaUseCase,
  );
  return { useCase, instances, steps, inbox, completeSaga };
}

describe('AdvanceSagaUseCase', () => {
  it('enqueues the next DO step and parks the instance RUNNING at that cursor', async () => {
    const { useCase, instances, steps } = makeSut();
    instances.findById.mockResolvedValue(instance());

    await useCase.execute('instance-1');

    expect(steps.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        stepId: 'step-1',
        kind: SagaStepKind.DO,
        status: SagaStepStatus.PENDING,
      }),
    );
    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({ cursor: 0, status: SagaInstanceStatus.RUNNING }),
    );
  });

  it('bypasses a step whose condition is false and records it SKIPPED', async () => {
    const { useCase, instances, steps, completeSaga } = makeSut();
    instances.findById.mockResolvedValue(
      instance({
        plan: plan([planStep({ if: 'event.qty > 100' })]),
        context: { event: { qty: 1 } },
      }),
    );

    await useCase.execute('instance-1');

    expect(steps.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ status: SagaStepStatus.SKIPPED }),
    );
    expect(completeSaga.execute).toHaveBeenCalled();
  });

  it('parks a WAIT step with its event contract and timeout', async () => {
    const { useCase, instances, steps } = makeSut();
    instances.findById.mockResolvedValue(
      instance({
        plan: plan([
          planStep({
            id: 'wait-bill',
            kind: SagaStepKind.WAIT,
            action: undefined,
            waitFor: { name: 'ap.bill.posted', version: 2 },
            timeout: 'PT30M',
          }),
        ]),
      }),
    );

    await useCase.execute('instance-1');

    expect(steps.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        stepId: 'wait-bill',
        kind: SagaStepKind.WAIT,
        eventName: 'ap.bill.posted',
        eventVersion: 2,
      }),
    );
    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({
        status: SagaInstanceStatus.WAITING,
        waitingEvent: 'ap.bill.posted@2',
      }),
    );
  });

  it('consumes a buffered event for the WAIT step instead of parking', async () => {
    const { useCase, instances, steps, inbox, completeSaga } = makeSut();
    instances.findById.mockResolvedValue(
      instance({
        plan: plan([
          planStep({
            id: 'wait-bill',
            kind: SagaStepKind.WAIT,
            action: undefined,
            waitFor: { name: 'ap.bill.posted', version: 1 },
          }),
        ]),
      }),
    );
    inbox.listBuffered.mockResolvedValue([
      { id: 'inbox-1', eventId: 'evt-9', payload: {}, correlationKey: 'GRN:grn-1' },
    ]);

    await useCase.execute('instance-1');

    expect(inbox.markConsumed).toHaveBeenCalledWith('inbox-1');
    expect(steps.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: 'wait-bill', status: SagaStepStatus.DONE }),
    );
    expect(completeSaga.execute).toHaveBeenCalled();
  });

  it('does not consume a buffered event whose match expression disagrees', async () => {
    const { useCase, instances, inbox } = makeSut();
    instances.findById.mockResolvedValue(
      instance({
        plan: plan([
          planStep({
            id: 'wait-bill',
            kind: SagaStepKind.WAIT,
            action: undefined,
            waitFor: { name: 'ap.bill.posted', version: 1 },
            match: 'BILL:{{event.billId}}',
          }),
        ]),
      }),
    );
    inbox.listBuffered.mockResolvedValue([
      { id: 'inbox-1', eventId: 'evt-9', payload: { billId: 'b-1' } },
    ]);

    await useCase.execute('instance-1');

    expect(inbox.markConsumed).not.toHaveBeenCalled();
    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.WAITING }),
    );
  });

  it('walks past a step already recorded DONE', async () => {
    const { useCase, instances, steps, completeSaga } = makeSut();
    instances.findById.mockResolvedValue(instance());
    steps.createIfAbsent.mockResolvedValue(
      step({ status: SagaStepStatus.DONE, output: { valuation: 42 } }),
    );

    await useCase.execute('instance-1');

    expect(completeSaga.execute).toHaveBeenCalled();
  });

  it('does nothing for a terminal instance', async () => {
    const { useCase, instances, steps } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.COMPLETED }));

    await useCase.execute('instance-1');

    expect(steps.createIfAbsent).not.toHaveBeenCalled();
    expect(instances.updateCas).not.toHaveBeenCalled();
  });

  it('refuses to advance an instance that is compensating', async () => {
    const { useCase, instances, steps } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.COMPENSATING }));

    await useCase.execute('instance-1');

    expect(steps.createIfAbsent).not.toHaveBeenCalled();
  });
});
