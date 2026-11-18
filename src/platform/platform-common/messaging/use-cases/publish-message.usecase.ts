import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import {
  BrokerPublisher,
  KafkaPublisherPort,
  RabbitMqPublisherPort,
  SqsPublisherPort,
} from '../outbound/ports/broker-publisher.port';
import {
  DEFAULT_BROKER_TARGET,
  OutboxEnvelope,
} from '@platform/platform-common/outbox/types/outbox.types';

/**
 * Use case: publish an envelope to the broker named by `envelope.broker`
 * (default rabbitmq). An unconfigured target throws so the outbox retries.
 */
@Injectable()
export class PublishMessageUseCase {
  constructor(
    @Inject(RabbitMqPublisherPort) private readonly rabbitMq: BrokerPublisher,
    @Inject(KafkaPublisherPort) private readonly kafka: BrokerPublisher,
    @Inject(SqsPublisherPort) private readonly sqs: BrokerPublisher,
    private readonly config: ConfigService,
  ) {}

  async execute(envelope: OutboxEnvelope): Promise<void> {
    const broker = envelope.broker ?? DEFAULT_BROKER_TARGET;

    switch (broker) {
      case 'rabbitmq':
        return this.rabbitMq.publish(envelope);
      case 'kafka':
        if (this.config.getKafka().brokers.length === 0) {
          throw new Error('Kafka broker target requested but KAFKA_BROKERS is not configured');
        }
        return this.kafka.publish(envelope);
      case 'sqs':
        if (!this.config.getSqs().url) {
          throw new Error('SQS broker target requested but SQS_URL is not configured');
        }
        return this.sqs.publish(envelope);
      default:
        throw new Error(`Unsupported broker target "${String(broker)}"`);
    }
  }
}
