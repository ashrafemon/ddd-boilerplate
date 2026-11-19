import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RabbitMQPublisherAdapter } from '../adapters/rabbitmq-publisher.adapter';
import { KafkaPublisherAdapter } from '../adapters/kafka-publisher.adapter';
import { SqsPublisherAdapter } from '../adapters/sqs-publisher.adapter';
import { UnsupportedBrokerTargetError } from '../ports/message-queue.port';
import {
  DEFAULT_BROKER_TARGET,
  OutboxEnvelope,
} from '@platform/platform-common/outbox/types/outbox.types';

/**
 * Use case: publish an envelope to the broker named by `envelope.broker`
 * (default rabbitmq).
 *
 * A transport error propagates so the outbox retries with backoff; a missing
 * configuration raises `UnsupportedBrokerTargetError`, which the outbox parks as
 * FAILED instead of retrying until the attempt ceiling.
 *
 * Every adapter call is bounded by `MESSAGE_QUEUE_PUBLISH_TIMEOUT_MS` — an
 * unresponsive broker rejects the publish so the outbox row stays PENDING and
 * retries rather than blocking the dispatcher tick indefinitely.
 */
@Injectable()
export class PublishMessageUseCase {
  constructor(
    private readonly rabbitMq: RabbitMQPublisherAdapter,
    private readonly kafka: KafkaPublisherAdapter,
    private readonly sqs: SqsPublisherAdapter,
    private readonly config: ConfigService,
  ) {}

  async execute(envelope: OutboxEnvelope): Promise<void> {
    const broker = envelope.broker ?? DEFAULT_BROKER_TARGET;
    const publish: Promise<void> = (() => {
      switch (broker) {
        case 'rabbitmq':
          return this.rabbitMq.publish(envelope);
        case 'kafka':
          if (this.config.getKafka().brokers.length === 0) {
            throw new UnsupportedBrokerTargetError(
              'Kafka broker target requested but KAFKA_BROKERS is not configured',
            );
          }
          return this.kafka.publish(envelope);
        case 'sqs':
          if (!this.config.getSqs().url) {
            throw new UnsupportedBrokerTargetError(
              'SQS broker target requested but SQS_URL is not configured',
            );
          }
          return this.sqs.publish(envelope);
        default:
          throw new UnsupportedBrokerTargetError(`Unsupported broker target "${String(broker)}"`);
      }
    })();

    const timeoutMs = this.config.getPublishTimeoutMs();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        publish,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Publish to "${broker}" timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
