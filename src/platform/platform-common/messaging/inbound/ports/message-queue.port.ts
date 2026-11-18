import type { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';

/**
 * Public Message Queue port — the ONLY outbox/messaging port for cross-process
 * transport. One method; the `broker` field on the envelope picks rabbitmq,
 * kafka or sqs. Business code never imports amqplib/kafkajs/sqs libs.
 *
 * An unconfigured broker target throws, so the outbox keeps the row PENDING and
 * retries it to DEAD_LETTER — a missing broker never blocks a transaction.
 */
export abstract class MessageQueuePort {
  abstract publish(envelope: OutboxEnvelope): Promise<void>;
}

/**
 * Raised when the envelope asks for a broker this deployment cannot reach
 * because of configuration, not because of a transient outage.
 *
 * Part of the port contract: the outbox parks such a message as FAILED instead
 * of retrying, because no amount of backoff makes `KAFKA_BROKERS` appear.
 */
export class UnsupportedBrokerTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedBrokerTargetError';
  }
}
