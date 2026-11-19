import { MessagingSagaPublisher } from './messaging-saga.publisher';
import { SagaStepCommand, SagaStepResult } from '../types/saga-command.types';
import { SagaStepKind } from '../types/saga.types';

/**
 * Unit — the saga speaks the platform transport, not a broker client.
 *
 * Both messages must leave through `MessageQueuePort` with the routing key in
 * `eventType`, so transport selection stays in the messaging module and the saga
 * never imports amqp/kafka.
 */
describe('MessagingSagaPublisher', () => {
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

  const result: SagaStepResult = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    instanceId: 'instance-1',
    stepId: 'valuate',
    stepRowId: 'step-row-1',
    kind: SagaStepKind.DO,
    outcome: 'ok',
    output: { unitCosts: [1] },
  };

  function makeSut() {
    const publish = jest.fn(async (_envelope: { eventType: string }) => undefined);
    const publisher = new MessagingSagaPublisher({ publish });
    return { publisher, publish };
  }

  it('publishes a command on the saga.command routing key', async () => {
    const { publisher, publish } = makeSut();

    await publisher.dispatch(command);

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'saga.command',
        broker: 'rabbitmq',
        aggregateType: 'Saga',
        aggregateId: 'instance-1',
        tenantId: 'tenant-1',
        companyId: 'company-1',
      }),
    );
  });

  it('publishes a result on the saga.step.result routing key', async () => {
    const { publisher, publish } = makeSut();

    await publisher.publish(result);

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'saga.step.result',
        broker: 'rabbitmq',
        aggregateId: 'instance-1',
      }),
    );
  });

  it('propagates a transport failure so the step stays retryable', async () => {
    const { publisher, publish } = makeSut();
    publish.mockRejectedValueOnce(new Error('broker down'));

    await expect(publisher.dispatch(command)).rejects.toThrow('broker down');
  });
});
