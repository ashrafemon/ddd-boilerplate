import { instance, plan, planStep, step } from '@test/support/saga/saga.fixtures';
import { ExpireWaitStepUseCase } from './expire-wait-step.usecase';
import { AdvanceSagaUseCase } from './advance-saga.usecase';
import { StartCompensationUseCase } from './start-compensation.usecase';
import { SagaInboxPort } from '@platform/platform-common/saga-inbox/ports/saga-inbox.port';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';
import {
  SagaInstanceReason,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepStatus,
} from '../types/saga.types';

/**
 * Unit — `onTimeout` is the whole decision: skip (default) continues the plan,
 * compensate reverses it. The WAIT row is marked FAILED either way so the sweep
 * never sees the same timeout twice. A skipped wait also parks its still-buffered
 * deliveries as IGNORED: no later step can consume them, so the ledger must not
 * keep pretending they are pending.
 */
describe('ExpireWaitStepUseCase', () => {
  function makeSut() {
    const instances = {
      findById: jest.fn(async () => instance({ status: SagaInstanceStatus.WAITING })),
      updateCas: jest.fn(async () => instance()),
    };
    const steps = { markFailed: jest.fn(async () => undefined) };
    const advanceSaga = { execute: jest.fn(async () => instance()) };
    const compensate = { execute: jest.fn(async () => instance()) };
    const inbox = { ignoreBuffered: jest.fn(async () => 0) };
    const useCase = new ExpireWaitStepUseCase(
      instances as unknown as PrismaSagaInstanceRepository,
      steps as unknown as PrismaSagaStepRepository,
      advanceSaga as unknown as AdvanceSagaUseCase,
      compensate as unknown as StartCompensationUseCase,
      inbox as unknown as SagaInboxPort,
    );
    return { useCase, instances, steps, advanceSaga, compensate, inbox };
  }

  const waitPlan = (onTimeout: 'skip' | 'compensate') =>
    plan([
      planStep({
        id: 'wait-bill',
        kind: SagaStepKind.WAIT,
        action: undefined,
        waitFor: { name: 'ap.bill.posted', version: 1 },
        onTimeout,
      }),
    ]);

  const waitRow = step({
    stepId: 'wait-bill',
    kind: SagaStepKind.WAIT,
    status: SagaStepStatus.PENDING,
    eventName: 'ap.bill.posted',
    eventVersion: 1,
  });

  it('marks the WAIT row failed and continues the plan by default', async () => {
    const { useCase, instances, steps, advanceSaga } = makeSut();
    instances.findById.mockResolvedValue(
      instance({ status: SagaInstanceStatus.WAITING, plan: waitPlan('skip') }),
    );

    await useCase.execute(waitRow);

    expect(steps.markFailed).toHaveBeenCalledWith('step-row-1', expect.any(String));
    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.RUNNING, cursor: 1 }),
    );
    expect(advanceSaga.execute).toHaveBeenCalledWith('instance-1');
  });

  it('parks the buffered events of a skipped wait as IGNORED', async () => {
    const { useCase, instances, inbox } = makeSut();
    instances.findById.mockResolvedValue(
      instance({ status: SagaInstanceStatus.WAITING, plan: waitPlan('skip') }),
    );

    await useCase.execute(waitRow);

    expect(inbox.ignoreBuffered).toHaveBeenCalledWith(
      'instance-1',
      'ap.bill.posted',
      1,
      expect.stringContaining('timed out'),
    );
  });

  it('compensates when the plan says compensate', async () => {
    const { useCase, instances, compensate, advanceSaga, inbox } = makeSut();
    instances.findById.mockResolvedValue(
      instance({ status: SagaInstanceStatus.WAITING, plan: waitPlan('compensate') }),
    );

    await useCase.execute(waitRow);

    expect(compensate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'instance-1' }),
      0,
      SagaInstanceReason.TIMEOUT,
      expect.any(String),
    );
    expect(advanceSaga.execute).not.toHaveBeenCalled();
    expect(inbox.ignoreBuffered).not.toHaveBeenCalled();
  });

  it('does nothing for a terminal instance', async () => {
    const { useCase, instances, steps } = makeSut();
    instances.findById.mockResolvedValue(instance({ status: SagaInstanceStatus.CANCELLED }));

    await useCase.execute(waitRow);

    expect(steps.markFailed).not.toHaveBeenCalled();
  });
});
