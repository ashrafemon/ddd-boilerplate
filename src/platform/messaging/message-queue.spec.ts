import { ConfigService } from '@config/config.service';
import { OutboxEnvelope } from '@platform/outbox/outbox.types';
import { PublishMessageUseCase } from './usecases/publish-message.usecase';
import { MessageQueueService } from './services/message-queue.service';

interface ConfigLike {
  getKafka: () => { brokers: string[] };
  getSqs: () => { url: string };
}

function makeEnvelope(overrides: Partial<OutboxEnvelope> = {}): OutboxEnvelope {
  return {
    eventId: 'evt-1',
    eventType: 'OrderCreated',
    aggregateType: 'SalesOrder',
    aggregateId: 'order-1',
    payload: { id: 'order-1' },
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('MessageQueuePort — broker by envelope param', () => {
  let rabbit: { publish: jest.Mock };
  let kafka: { publish: jest.Mock };
  let sqs: { publish: jest.Mock };
  let config: ConfigLike;
  let service: MessageQueueService;

  beforeEach(() => {
    rabbit = { publish: jest.fn().mockResolvedValue(undefined) };
    kafka = { publish: jest.fn().mockResolvedValue(undefined) };
    sqs = { publish: jest.fn().mockResolvedValue(undefined) };
    config = {
      getKafka: () => ({ brokers: [] }),
      getSqs: () => ({ url: '' }),
    };

    const useCase = new PublishMessageUseCase(
      rabbit,
      kafka,
      sqs,
      config as unknown as ConfigService,
    );
    service = new MessageQueueService(useCase);
  });

  it('defaults to rabbitmq when no broker is named', async () => {
    await service.publish(makeEnvelope());

    expect(rabbit.publish).toHaveBeenCalledTimes(1);
    expect(kafka.publish).not.toHaveBeenCalled();
    expect(sqs.publish).not.toHaveBeenCalled();
  });

  it('routes to the broker named on the envelope', async () => {
    config.getKafka = () => ({ brokers: ['localhost:9092'] });

    await service.publish(makeEnvelope({ broker: 'kafka' }));

    expect(kafka.publish).toHaveBeenCalledTimes(1);
    expect(rabbit.publish).not.toHaveBeenCalled();
  });

  it('throws for an unconfigured kafka target so the outbox retries', async () => {
    await expect(service.publish(makeEnvelope({ broker: 'kafka' }))).rejects.toThrow(
      /KAFKA_BROKERS/,
    );
    expect(kafka.publish).not.toHaveBeenCalled();
  });

  it('throws for an unconfigured sqs target so the outbox retries', async () => {
    await expect(service.publish(makeEnvelope({ broker: 'sqs' }))).rejects.toThrow(/SQS_URL/);
    expect(sqs.publish).not.toHaveBeenCalled();
  });
});
