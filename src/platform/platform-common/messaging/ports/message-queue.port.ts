import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

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
