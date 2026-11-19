import { registerAs } from '@nestjs/config';
import { booleanEnv } from '@common/application/utils/env.util';

export type IRabbitMQConfig = {
  url: string;
  exchange: string;
  /**
   * When false the app publishes but never registers `@RabbitSubscribe`
   * handlers, so startup does not block waiting for a broker channel.
   */
  registerHandlers: boolean;
};

export type IMessagingConfig = {
  rabbitmq: IRabbitMQConfig;
  /**
   * Bounded publish budget (ms) applied to every broker adapter. An
   * unresponsive broker must not block the outbox dispatcher tick beyond
   * this window — the row stays PENDING and is retried with backoff.
   */
  publishTimeoutMs: number;
  /**
   * Bounded channel-setup budget (ms) for broker subscriptions. The RabbitMQ
   * connection is opened with `wait: false`, so `createSubscriber` would
   * otherwise await a channel forever and block `app.init()`; after this
   * budget the subscription is left inactive and the owning state machine's
   * lease/outbox remains the retry path.
   */
  connectTimeoutMs: number;
};

/**
 * Messaging config — RabbitMQ connection settings for the integration event
 * publishers.
 *
 * The transport is intentionally single-driver: the outbox envelope still
 * carries a `broker` field, but only `rabbitmq` has a driver in this
 * deployment. A `kafka`/`sqs` envelope is parked as FAILED by
 * `PublishMessageUseCase` instead of being retried against a broker that
 * cannot exist here.
 */
export default registerAs('messaging', (): IMessagingConfig => ({
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'erp.events',
    registerHandlers: booleanEnv('RABBITMQ_REGISTER_HANDLERS', true),
  },
  publishTimeoutMs: Number(process.env.MESSAGE_QUEUE_PUBLISH_TIMEOUT_MS ?? 10_000),
  connectTimeoutMs: Number(process.env.MESSAGE_QUEUE_CONNECT_TIMEOUT_MS ?? 10_000),
}));
