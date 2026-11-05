import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

/**
 * Internal contract every broker adapter implements. Not public — the only
 * published messaging port is `MessageQueuePort`; these are the DI tokens the
 * publish use case routes across.
 */
export interface BrokerPublisher {
  publish(envelope: OutboxEnvelope): Promise<void>;
}

export abstract class RabbitMqPublisher {}
export abstract class KafkaPublisher {}
export abstract class SqsPublisher {}
