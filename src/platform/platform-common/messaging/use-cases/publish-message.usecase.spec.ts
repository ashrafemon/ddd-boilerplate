import { ConfigService } from '@config/config.service';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { PublishMessageUseCase } from './publish-message.usecase';
import { UnsupportedBrokerTargetError } from '../ports/message-queue.port';
import { RabbitMQPublisherAdapter } from '../adapters/rabbitmq-publisher.adapter';

/**
 * Unit — broker routing.
 *
 * The envelope's `broker` field is the only switch. This deployment ships
 * RabbitMQ only, so a Kafka/SQS target must be rejected as *unavailable* (the
 * outbox parks the row as FAILED) rather than silently published somewhere
 * else or retried forever.
 */

const ENVELOPE: OutboxEnvelope = {
  eventId: 'evt-1',
  eventType: 'OrderCreated',
  aggregateType: 'PurchaseOrder',
  aggregateId: 'order-1',
  payload: {},
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeSut() {
  const publisher = () => {
    const publish = jest.fn<Promise<void>, [OutboxEnvelope]>();
    publish.mockResolvedValue(undefined);
    return { publish };
  };
  const rabbit = publisher();
  const config = {
    getPublishTimeoutMs: () => 10_000,
  } as unknown as ConfigService;

  const useCase = new PublishMessageUseCase(rabbit as unknown as RabbitMQPublisherAdapter, config);

  return { useCase, rabbit };
}

describe('PublishMessageUseCase', () => {
  it('defaults to RabbitMQ when the envelope names no broker', async () => {
    const { useCase, rabbit } = makeSut();

    await useCase.execute(ENVELOPE);

    expect(rabbit.publish).toHaveBeenCalledWith(ENVELOPE);
  });

  it('publishes an explicitly addressed RabbitMQ envelope', async () => {
    const { useCase, rabbit } = makeSut();

    await useCase.execute({ ...ENVELOPE, broker: 'rabbitmq' });

    expect(rabbit.publish).toHaveBeenCalledWith({ ...ENVELOPE, broker: 'rabbitmq' });
  });

  it.each(['kafka', 'sqs'] as const)(
    'rejects the %s target as unavailable in this deployment',
    async broker => {
      const { useCase, rabbit } = makeSut();

      await expect(useCase.execute({ ...ENVELOPE, broker })).rejects.toBeInstanceOf(
        UnsupportedBrokerTargetError,
      );
      expect(rabbit.publish).not.toHaveBeenCalled();
    },
  );

  it('propagates a driver failure so the outbox can retry', async () => {
    const { useCase, rabbit } = makeSut();
    rabbit.publish.mockRejectedValue(new Error('amqp down'));

    await expect(useCase.execute(ENVELOPE)).rejects.toThrow('amqp down');
  });
});
