import { toWireEnvelope } from '@platform/platform-common/messaging/outbound/adapters/envelope.serializer';
import { SettleSagaStepResultUseCase } from '../use-cases/settle-saga-step-result.usecase';
import { SagaStepResult, toResultEnvelope } from '../types/saga-command.types';
import { SagaStepKind } from '../types/saga.types';
import { SagaStepResultConsumerService } from './saga-step-result.consumer';

/**
 * Unit — the consumer that lets the saga learn an action finished.
 *
 * The state machine advances only from this message, so it must reconstruct the
 * result exactly, ignore unrelated deliveries and absorb its own failures (the
 * saga's lease sweep is the retry path, not the queue).
 */
describe('SagaStepResultConsumerService', () => {
  const result: SagaStepResult = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    instanceId: 'instance-1',
    stepId: 'valuate',
    stepRowId: 'step-row-1',
    kind: SagaStepKind.DO,
    outcome: 'ok',
    output: { unitCosts: [1] },
    error: null,
  };
  const wire = toWireEnvelope(toResultEnvelope(result));

  function makeSut() {
    const settleResult = { execute: jest.fn(async (_r: SagaStepResult) => undefined) };
    const consumer = { subscribe: jest.fn(async () => undefined) };
    const service = new SagaStepResultConsumerService(
      settleResult as unknown as SettleSagaStepResultUseCase,
      consumer,
    );
    return { service, settleResult, consumer };
  }

  it('subscribes to the result routing key on module init', async () => {
    const { service, consumer } = makeSut();

    await service.onModuleInit();

    expect(consumer.subscribe).toHaveBeenCalledWith(
      { routingKey: 'saga.step.result', queue: 'saga.step-results.erp' },
      expect.any(Function),
    );
  });

  it('rebuilds the result and settles the step', async () => {
    const { service, settleResult } = makeSut();

    await service.onStepResult(wire);

    expect(settleResult.execute).toHaveBeenCalledWith(result);
  });

  it('ignores a delivery that is not a result', async () => {
    const { service, settleResult } = makeSut();
    const warn = jest.spyOn(service['logger'], 'warn');

    await service.onStepResult({ nope: true });

    expect(settleResult.execute).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('swallows a settle error instead of killing the consumer', async () => {
    const { service, settleResult } = makeSut();
    settleResult.execute.mockRejectedValueOnce(new Error('db down'));
    const error = jest.spyOn(service['logger'], 'error');

    await expect(service.onStepResult(wire)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
