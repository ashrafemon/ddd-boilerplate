import type { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';

/**
 * Outbound ports: one per broker driver.
 *
 * The publish use case routes on `envelope.broker` and injects these tokens; the
 * drivers live in `outbound/adapters/`. Not public — the only published
 * messaging port is `MessageQueuePort`.
 *
 * An unconfigured target must throw, so the outbox keeps the row PENDING and
 * retries it instead of losing the event.
 */
/** Shape every driver adapter and the routing use case speak. */
export interface BrokerPublisher {
  publish(envelope: OutboxEnvelope): Promise<void>;
}

/** DI tokens — one per driver, so routing never guesses which client to use. */
export abstract class RabbitMqPublisherPort implements BrokerPublisher {
  abstract publish(envelope: OutboxEnvelope): Promise<void>;
}

export abstract class KafkaPublisherPort implements BrokerPublisher {
  abstract publish(envelope: OutboxEnvelope): Promise<void>;
}

export abstract class SqsPublisherPort implements BrokerPublisher {
  abstract publish(envelope: OutboxEnvelope): Promise<void>;
}
