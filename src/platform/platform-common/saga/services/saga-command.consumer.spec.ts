import { toWireEnvelope } from '@platform/platform-common/messaging/adapters/envelope.serializer';
import { RunSagaStepCommandUseCase } from '../use-cases/run-saga-step-command.usecase';
import { SagaStepCommand, toCommandEnvelope } from '../types/saga-command.types';
import { SagaStepKind } from '../types/saga.types';
import { SagaCommandConsumerService } from './saga-command.consumer';

/**
 * Unit — the consumer that turns a delivered `saga.command` into work.
 *
 * It must reconstruct the command from the wire body (not trust the payload
 * object blindly), ignore anything else on the queue, and never let a consumer
 * error escape into the broker loop.
 */
describe('SagaCommandConsumerService', () => {
  const command: SagaStepCommand = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    sagaKey: 'goods_receipt',
    instanceId: 'instance-1',
    stepId: 'valuate',
    stepRowId: 'step-row-1',
    kind: SagaStepKind.DO,
    action: 'inventory.valuation.posted',
    correlationKey: 'GRN:grn-1',
    input: { grnId: 'grn-1' },
  };
  const wire = toWireEnvelope(toCommandEnvelope(command));

  function makeSut() {
    const runCommand = { execute: jest.fn(async (_c: SagaStepCommand) => undefined) };
    const consumer = { subscribe: jest.fn(async () => undefined) };
    const service = new SagaCommandConsumerService(
      runCommand as unknown as RunSagaStepCommandUseCase,
      consumer,
    );
    return { service, runCommand, consumer };
  }

  it('subscribes to the command routing key on module init', async () => {
    const { service, consumer } = makeSut();

    await service.onModuleInit();

    expect(consumer.subscribe).toHaveBeenCalledWith(
      { routingKey: 'saga.command', queue: 'saga.commands.erp' },
      expect.any(Function),
    );
  });

  it('rebuilds the command from the wire body and runs it', async () => {
    const { service, runCommand } = makeSut();

    await service.onCommand(wire);

    expect(runCommand.execute).toHaveBeenCalledWith(command);
  });

  it('ignores a delivery that is not a command', async () => {
    const { service, runCommand } = makeSut();
    const warn = jest.spyOn(service['logger'], 'warn');

    await service.onCommand({ hello: 'world' });

    expect(runCommand.execute).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('swallows a consumer error so the broker loop survives', async () => {
    const { service, runCommand } = makeSut();
    runCommand.execute.mockRejectedValueOnce(new Error('inventory down'));
    const error = jest.spyOn(service['logger'], 'error');

    await expect(service.onCommand(wire)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('inventory down'));
  });
});
