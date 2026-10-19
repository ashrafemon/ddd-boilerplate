import { registerAs } from '@nestjs/config';
import { booleanEnv } from './env.util';

export type IRabbitMQConfig = {
  url: string;
  exchange: string;
  /**
   * When false the app publishes but never registers `@RabbitSubscribe`
   * handlers, so startup does not block waiting for a broker channel.
   */
  registerHandlers: boolean;
};
export type IKafkaConfig = {
  brokers: string[];
  clientId: string;
  groupId: string;
  /**
   * Bounded connect budget. Kafka is OPT-IN and the project's own compose
   * file does not start a broker, so an unreachable broker must degrade to
   * "Kafka inactive" in a couple of seconds — never block app bootstrap.
   */
  connectionTimeoutMs: number;
  retryCount: number;
};
export type ISqsConfig = {
  accessKey: string;
  secretKey: string;
  url: string;
  region?: string;
};

/**
 * Messaging config — RabbitMQ / Kafka / SQS connection settings for the
 * integration event publishers.
 */
export default registerAs('messaging', () => ({
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'erp.events',
    registerHandlers: booleanEnv('RABBITMQ_REGISTER_HANDLERS', true),
  },
  kafka: {
    // Opt-in: unset KAFKA_BROKERS disables Kafka instead of pointing at a
    // non-existent localhost broker (fan-out events would fail-publish there).
    brokers: (process.env.KAFKA_BROKERS ?? '')
      .split(',')
      .map(broker => broker.trim())
      .filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'erp-boilerplate',
    groupId: process.env.KAFKA_GROUP_ID ?? 'erp-boilerplate-group',
    connectionTimeoutMs: Number(process.env.KAFKA_CONNECTION_TIMEOUT_MS ?? 3000),
    retryCount: Number(process.env.KAFKA_RETRY_COUNT ?? 2),
  },
  sqs: {
    accessKey: process.env.SQS_ACCESS_KEY ?? '',
    secretKey: process.env.SQS_SECRET_KEY ?? '',
    url: process.env.SQS_URL ?? '',
    region: process.env.SQS_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
  },
}));
