import { instance, plan, planStep, step } from '@test/support/saga/saga.fixtures';
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
 * Unit — compensation walks completed DO steps backwards.
 *
 * Three rules carried here: UNDO rows are enqueued newest-first, a step past the
 * pivot can never be reversed (FAILED_MANUAL), and a completed step without an
 * `undo` is a manual reversal rather than a silent skip.
 */
describe('StartCompensationUseCase', () => {
  function makeSut() {
    const instances = { updateCas: jest.fn(async () => instance()) };
    const steps = {
      findByInstance: jest.fn(async () => [] as ReturnType<typeof step>[]),
      createIfAbsent: jest.fn(async (input: { stepId: string }) => step({ stepId: input.stepId })),
    };
    const useCase = new StartCompensationUseCase(
      instances as unknown as PrismaSagaInstanceRepository,
      steps as unknown as PrismaSagaStepRepository,
    );
    return { useCase, instances, steps };
  }

  const twoStepPlan = plan([
    planStep({ id: 'first' }),
    planStep({ id: 'second', undo: 'b.undo' }),
    planStep({ id: 'third' }),
  ]);

  it('enqueues UNDO rows for completed DO steps in reverse order', async () => {
    const { useCase, instances, steps } = makeSut();
    steps.findByInstance.mockResolvedValue([
      step({ stepId: 'first', kind: SagaStepKind.DO, status: SagaStepStatus.DONE }),
      step({ stepId: 'second', kind: SagaStepKind.DO, status: SagaStepStatus.DONE }),
    ]);

    await useCase.execute(
      instance({ plan: twoStepPlan }),
      2,
      SagaInstanceReason.STEP_FAILED,
      'third failed',
    );

    expect(steps.createIfAbsent.mock.calls.map(call => call[0].stepId)).toEqual([
      'second',
      'first',
    ]);
    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.COMPENSATING }),
    );
  });

  it('skips steps that never completed and WAIT steps', async () => {
    const { useCase, steps } = makeSut();
    steps.findByInstance.mockResolvedValue([
      step({ stepId: 'first', kind: SagaStepKind.DO, status: SagaStepStatus.SKIPPED }),
      step({ stepId: 'second', kind: SagaStepKind.WAIT, status: SagaStepStatus.DONE }),
    ]);

    await useCase.execute(
      instance({ plan: twoStepPlan }),
      2,
      SagaInstanceReason.STEP_FAILED,
      'boom',
    );

    expect(steps.createIfAbsent).not.toHaveBeenCalled();
  });

  it('parks FAILED_MANUAL when the failure is past the pivot step', async () => {
    const { useCase, instances, steps } = makeSut();
    const pivoted = plan([planStep({ id: 'first' }), planStep({ id: 'pivot', pivot: true })]);

    await useCase.execute(instance({ plan: pivoted }), 2, SagaInstanceReason.STEP_FAILED, 'late');

    expect(steps.createIfAbsent).not.toHaveBeenCalled();
    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.FAILED_MANUAL }),
    );
  });

  it('parks FAILED_MANUAL when a completed step has no undo', async () => {
    const { useCase, instances, steps } = makeSut();
    steps.findByInstance.mockResolvedValue([
      step({ stepId: 'first', kind: SagaStepKind.DO, status: SagaStepStatus.DONE }),
    ]);

    await useCase.execute(
      instance({
        plan: plan([planStep({ id: 'first', undo: undefined }), planStep({ id: 'second' })]),
      }),
      1,
      SagaInstanceReason.STEP_FAILED,
      'no reversal',
    );

    expect(instances.updateCas).toHaveBeenCalledWith(
      'instance-1',
      1,
      expect.objectContaining({
        status: SagaInstanceStatus.FAILED_MANUAL,
        lastError: expect.stringContaining('no undo') as string,
      }),
    );
  });
});
