import { ConfigService } from '@config/config.service';
import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { PublishMessageUseCase } from './publish-message.usecase';
import { UnsupportedBrokerTargetError } from '../ports/message-queue.port';
import { RabbitMQPublisherAdapter } from '../adapters/rabbitmq-publisher.adapter';
import { KafkaPublisherAdapter } from '../adapters/kafka-publisher.adapter';
import { SqsPublisherAdapter } from '../adapters/sqs-publisher.adapter';

/**
 * Unit — broker routing.
 *
 * The envelope's `broker` field is the only switch; an unconfigured target must
 * throw so the outbox retries the row instead of dropping the event.
 */

const ENVELOPE: OutboxEnvelope = {
  eventId: 'evt-1',
  eventType: 'OrderCreated',
  aggregateType: 'PurchaseOrder',
  aggregateId: 'order-1',
  payload: {},
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeSut(options: { kafkaBrokers?: string[]; sqsUrl?: string } = {}) {
  const publisher = () => {
    const publish = jest.fn<Promise<void>, [OutboxEnvelope]>();
    publish.mockResolvedValue(undefined);
    return { publish };
  };
  const rabbit = publisher();
  const kafka = publisher();
  const sqs = publisher();
  const config = {
    getKafka: () => ({ brokers: options.kafkaBrokers ?? ['localhost:9092'] }),
    getSqs: () => ({ url: options.sqsUrl ?? 'https://sqs.local/queue' }),
    getPublishTimeoutMs: () => 10_000,
  } as unknown as ConfigService;

  const useCase = new PublishMessageUseCase(
    rabbit as unknown as RabbitMQPublisherAdapter,
    kafka as unknown as KafkaPublisherAdapter,
    sqs as unknown as SqsPublisherAdapter,
    config,
  );

  return { useCase, rabbit, kafka, sqs };
}

describe('PublishMessageUseCase', () => {
  it('defaults to RabbitMQ when the envelope names no broker', async () => {
    const { useCase, rabbit } = makeSut();

    await useCase.execute(ENVELOPE);

    expect(rabbit.publish).toHaveBeenCalledWith(ENVELOPE);
  });

  it('routes to Kafka and SQS by the envelope field', async () => {
    const { useCase, rabbit, kafka, sqs } = makeSut();

    await useCase.execute({ ...ENVELOPE, broker: 'kafka' });
    await useCase.execute({ ...ENVELOPE, broker: 'sqs' });

    expect(kafka.publish).toHaveBeenCalledTimes(1);
    expect(sqs.publish).toHaveBeenCalledTimes(1);
    expect(rabbit.publish).not.toHaveBeenCalled();
  });

  it('throws when Kafka is requested but not configured', async () => {
    const { useCase, kafka } = makeSut({ kafkaBrokers: [] });

    await expect(useCase.execute({ ...ENVELOPE, broker: 'kafka' })).rejects.toBeInstanceOf(
      UnsupportedBrokerTargetError,
    );
    expect(kafka.publish).not.toHaveBeenCalled();
  });

  it('throws when SQS is requested but not configured', async () => {
    const { useCase, sqs } = makeSut({ sqsUrl: '' });

    await expect(useCase.execute({ ...ENVELOPE, broker: 'sqs' })).rejects.toBeInstanceOf(
      UnsupportedBrokerTargetError,
    );
    expect(sqs.publish).not.toHaveBeenCalled();
  });

  it('propagates a driver failure so the outbox can retry', async () => {
    const { useCase, rabbit } = makeSut();
    rabbit.publish.mockRejectedValue(new Error('amqp down'));

    await expect(useCase.execute(ENVELOPE)).rejects.toThrow('amqp down');
  });
});
