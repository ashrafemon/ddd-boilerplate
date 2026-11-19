import { ConfigService } from '@config/config.service';
import { step } from '@test/support/saga/saga.fixtures';
import { SettleSagaStepResultUseCase } from './settle-saga-step-result.usecase';
import { SettleStepFailureUseCase } from './settle-step-failure.usecase';
import { SettleStepSuccessUseCase } from './settle-step-success.usecase';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';
import { SagaStepResult } from '../types/saga-command.types';
import { SagaStepKind, SagaStepRecord, SagaStepStatus } from '../types/saga.types';

/**
 * Unit — the saga learns an outcome only from `saga.step.result`.
 *
 * ok → done + advance, retry → reschedule with backoff, fail → failed +
 * compensate. Duplicate deliveries are absorbed by the CAS on `RUNNING`, which is
 * what makes broker redelivery safe.
 */
describe('SettleSagaStepResultUseCase', () => {
  const result = (over: Partial<SagaStepResult> = {}): SagaStepResult => ({
    tenantId: 'tenant-1',
    companyId: 'company-1',
    instanceId: 'instance-1',
    stepId: 'step-1',
    stepRowId: 'step-row-1',
    kind: SagaStepKind.DO,
    outcome: 'ok',
    output: { value: 1 },
    ...over,
  });

  function makeSut(status: SagaStepStatus = SagaStepStatus.RUNNING, attempts = 0) {
    const steps = {
      findById: jest.fn(async (): Promise<SagaStepRecord | null> => step({ status, attempts })),
      markDone: jest.fn(async () => undefined),
      markFailed: jest.fn(async () => undefined),
      reschedule: jest.fn(async () => undefined),
    };
    const settleSuccess = { execute: jest.fn(async () => undefined) };
    const settleFailure = { execute: jest.fn(async () => undefined) };

    const useCase = new SettleSagaStepResultUseCase(
      steps as unknown as PrismaSagaStepRepository,
      settleSuccess as unknown as SettleStepSuccessUseCase,
      settleFailure as unknown as SettleStepFailureUseCase,
      {
        getSaga: () => ({ retryBaseDelayMs: 1_000, retryMaxDelayMs: 60_000 }),
      } as unknown as ConfigService,
    );
    return { useCase, steps, settleSuccess, settleFailure };
  }

  it('marks the row done and advances on ok', async () => {
    const { useCase, steps, settleSuccess } = makeSut();

    await useCase.execute(result());

    expect(steps.markDone).toHaveBeenCalledWith('step-row-1', { value: 1 });
    expect(settleSuccess.execute).toHaveBeenCalledWith('instance-1', 'step-1', SagaStepKind.DO);
  });

  it('reschedules a retry with exponential backoff', async () => {
    const { useCase, steps, settleFailure } = makeSut(SagaStepStatus.RUNNING, 1);

    await useCase.execute(result({ outcome: 'retry', error: 'boom', output: null }));

    expect(steps.reschedule).toHaveBeenCalledWith('step-row-1', 2, expect.any(Date), 'boom');
    expect(settleFailure.execute).not.toHaveBeenCalled();
  });

  it('fails the step once the attempt ceiling is reached', async () => {
    const { useCase, steps, settleFailure } = makeSut(SagaStepStatus.RUNNING, 2);

    await useCase.execute(result({ outcome: 'retry', error: 'boom' }));

    expect(steps.markFailed).toHaveBeenCalledWith('step-row-1', 'boom');
    expect(settleFailure.execute).toHaveBeenCalledWith(
      'instance-1',
      'step-1',
      SagaStepKind.DO,
      'boom',
    );
  });

  it('compensates on an explicit failure', async () => {
    const { useCase, steps, settleFailure } = makeSut();

    await useCase.execute(result({ outcome: 'fail', error: 'business says no' }));

    expect(steps.markFailed).toHaveBeenCalledWith('step-row-1', 'business says no');
    expect(settleFailure.execute).toHaveBeenCalledWith(
      'instance-1',
      'step-1',
      SagaStepKind.DO,
      'business says no',
    );
  });

  it('ignores a duplicate result for an already settled row', async () => {
    const { useCase, steps, settleSuccess, settleFailure } = makeSut(SagaStepStatus.DONE);

    await useCase.execute(result());

    expect(steps.markDone).not.toHaveBeenCalled();
    expect(settleSuccess.execute).not.toHaveBeenCalled();
    expect(settleFailure.execute).not.toHaveBeenCalled();
  });

  it('ignores a result for an unknown row', async () => {
    const { useCase, steps } = makeSut();
    steps.findById.mockResolvedValue(null);

    await useCase.execute(result());

    expect(steps.markDone).not.toHaveBeenCalled();
  });
});
