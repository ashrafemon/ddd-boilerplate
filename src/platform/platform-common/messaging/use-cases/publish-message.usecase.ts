import { Injectable } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RabbitMQPublisherAdapter } from '../adapters/rabbitmq-publisher.adapter';
import { UnsupportedBrokerTargetError } from '../ports/message-queue.port';
import {
  DEFAULT_BROKER_TARGET,
  OutboxEnvelope,
} from '@platform/platform-common/outbox/types/outbox.types';

/**
 * Use case: publish an envelope to the broker named by `envelope.broker`
 * (default rabbitmq).
 *
 * Routing is still conditional on the envelope field: this deployment ships
 * the RabbitMQ driver only, so `kafka` and `sqs` are *unavailable targets*,
 * not unknown ones — they raise `UnsupportedBrokerTargetError`, which the
 * outbox parks as FAILED instead of retrying until the attempt ceiling. An
 * envelope written before the rollback is therefore visible in the ledger
 * rather than silently dropped or infinitely retried.
 *
 * A transport error propagates so the outbox retries with backoff.
 *
 * Every adapter call is bounded by `MESSAGE_QUEUE_PUBLISH_TIMEOUT_MS` — an
 * unresponsive broker rejects the publish so the outbox row stays PENDING and
 * retries rather than blocking the dispatcher tick indefinitely.
 */
@Injectable()
export class PublishMessageUseCase {
  constructor(
    private readonly rabbitMq: RabbitMQPublisherAdapter,
    private readonly config: ConfigService,
  ) {}

  async execute(envelope: OutboxEnvelope): Promise<void> {
    const broker = envelope.broker ?? DEFAULT_BROKER_TARGET;
    const publish: Promise<void> = (() => {
      switch (broker) {
        case 'rabbitmq':
          return this.rabbitMq.publish(envelope);
        case 'kafka':
        case 'sqs':
          // Keeping the branch (instead of narrowing `BrokerTarget`) keeps the
          // envelope contract stable for a later driver, and turns a stale
          // envelope into a parked FAILED row with a reason an operator reads.
          throw new UnsupportedBrokerTargetError(
            `Broker target "${broker}" is not available in this deployment; only "rabbitmq" is configured`,
          );
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
