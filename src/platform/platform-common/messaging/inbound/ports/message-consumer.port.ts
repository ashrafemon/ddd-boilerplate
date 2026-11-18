/**
 * Public Message Consumer port — the inbound mirror of `MessageQueuePort`.
 *
 * Platform and business modules subscribe through this port instead of importing
 * a broker client or calling `@RabbitSubscribe` themselves, so the transport
 * (RabbitMQ today, another broker tomorrow) stays owned by the messaging module.
 *
 * The handler receives the decoded envelope body. Returning normally acks the
 * message; throwing nacks it, so a subscriber only propagates errors it wants
 * redelivered.
 */

/** One durable subscription: a queue bound to a routing key on the topic exchange. */
export interface BrokerSubscription {
  /** Routing key on the topic exchange — `saga.command`, `saga.step.result`, `#`. */
  routingKey: string;
  /** Queue owned by this subscriber. Durable by default. */
  queue: string;
  durable?: boolean;
}

export type BrokerMessageHandler = (body: unknown) => Promise<void>;

export abstract class MessageConsumerPort {
  /**
   * Bind `queue` to `routingKey` and start consuming. Idempotent per
   * `(queue, routingKey)`: subscribing twice with the same pair is a no-op.
   */
  abstract subscribe(
    subscription: BrokerSubscription,
    handler: BrokerMessageHandler,
  ): Promise<void>;
}
